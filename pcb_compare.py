# ==========================================================================================
# pcb_compare.py — เปรียบเทียบ "mask ลายทองแดงที่โมเดลทำนาย" กับ "ไฟล์ต้นแบบ (design)"
#   1) โหลด/ทำความสะอาด design + mask (รองรับ design ทองแดงสีดำหรือสีขาว, auto)
#   2) จัดตำแหน่งอัตโนมัติ: หมุนได้ทุกมุม + กลับซ้าย-ขวา (mirror) + ปรับสเกล + เลื่อน + perspective
#   3) หาจุดต่าง (candidate) ระหว่างสองลาย
#   4) สกัด feature เชิงรูปทรง/การเชื่อมต่อ (topology) ของแต่ละจุด
#   5) จำแนกด้วยโมเดล AI (RandomForest) → open / short / minor / normal
# ใช้ได้ทั้งใน notebook และ FastAPI บน Raspberry Pi 5 (ต้องการแค่ numpy, opencv, scikit-image, scikit-learn)
# ==========================================================================================
import os
import json
import time
import math
import cv2
import numpy as np
try:
    from skimage.morphology import skeletonize
except ImportError:
    def skeletonize(image):
        img = (image > 0).astype(np.uint8) * 255
        skel = np.zeros(img.shape, np.uint8)
        element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
        while True:
            eroded = cv2.erode(img, element)
            temp = cv2.dilate(eroded, element)
            temp = cv2.subtract(img, temp)
            skel = cv2.bitwise_or(skel, temp)
            img = eroded.copy()
            if cv2.countNonZero(img) == 0:
                break
        return skel > 0

CLASSES = ["open", "short", "minor", "normal"]          # normal = ไม่ใช่ตำหนิ (false alarm)
CLASS_COLORS = {"open": (0, 0, 255), "short": (255, 0, 255), "minor": (0, 200, 255), "normal": (160, 160, 160)}
CANON_LONG = 512                                         # ความยาวด้านยาวของ "กรอบมาตรฐาน" ที่ใช้เปรียบเทียบ (px)


# ---------------------------------------------------------------------------------------
# ยูทิลิตี้
# ---------------------------------------------------------------------------------------
def disk(r):
    r = max(0, int(round(r)))
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def dil(m, r):
    return cv2.dilate(m, disk(r)) if r >= 0.5 else m.copy()


def ero(m, r):
    return cv2.erode(m, disk(r)) if r >= 0.5 else m.copy()


def remove_small(m01, min_area):
    m01 = m01.astype(np.uint8)
    if min_area <= 1:
        return m01
    n, lab, st, _ = cv2.connectedComponentsWithStats(m01, connectivity=8)
    keep = np.zeros(n, np.uint8)
    keep[1:] = st[1:, cv2.CC_STAT_AREA] >= min_area
    return keep[lab]


def fill_small_holes(m01, max_area):
    inv = (1 - m01).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    small = np.zeros(n, bool)
    small[1:] = st[1:, cv2.CC_STAT_AREA] < max_area
    # ไม่เติมช่องที่แตะขอบภาพ
    for side in (lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]):
        small[np.unique(side)] = False
    out = m01.copy()
    out[small[lab]] = 1
    return out


def _read_gray(src):
    if isinstance(src, str):
        img = cv2.imread(src, cv2.IMREAD_UNCHANGED)
        if img is None:
            raise FileNotFoundError(src)
    else:
        img = np.asarray(src)
    if img.ndim == 3:
        if img.shape[2] == 4:                       # PNG โปร่งใส → วางบนพื้นขาว
            a = img[..., 3:4].astype(np.float32) / 255
            img = (img[..., :3] * a + 255 * (1 - a)).astype(np.uint8)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    if img.dtype != np.uint8:                        # probability map 0..1
        img = np.clip(img.astype(np.float32) * (255 if img.max() <= 1.0 else 1), 0, 255).astype(np.uint8)
    return img


def load_mask(src, thr=64):
    """mask จากโมเดลแยกทองแดง: ขาว = ทองแดง (ค่า >= thr ถือเป็นทองแดง; label 128 'ไม่แน่ใจ' นับเป็นทองแดง)"""
    return (_read_gray(src) >= thr).astype(np.uint8)


def _trim_uniform(b01, frac=0.995):
    """ตัดขอบที่เป็นสีเดียวกันทั้งแถว/คอลัมน์ออก (ขอบกระดาษ/ขอบว่างของไฟล์ export)"""
    H, W = b01.shape
    bg = np.bincount([b01[0, 0], b01[0, -1], b01[-1, 0], b01[-1, -1]], minlength=2).argmax()
    rows = (b01 == bg).mean(1) < frac
    cols = (b01 == bg).mean(0) < frac
    if rows.sum() < 10 or cols.sum() < 10:
        return b01, (0, 0, W, H)
    y0, y1 = np.where(rows)[0][[0, -1]]
    x0, x1 = np.where(cols)[0][[0, -1]]
    return b01[y0:y1 + 1, x0:x1 + 1], (int(x0), int(y0), int(x1 - x0 + 1), int(y1 - y0 + 1))


def _drop_frame(m01, band_frac=0.05, thick_px=None):
    """
    ลบเส้นกรอบบอร์ด (board outline) ที่พิมพ์ติดมากับไฟล์ต้นแบบ:
      1) ก้อนทองแดงบางๆ ที่แตะขอบทั้ง 4 ด้าน
      2) เส้นตรงยาวบางๆ ที่วิ่งขนานขอบภาพ (อยู่ในแถบ band_frac ของขอบ)
    """
    H, W = m01.shape
    n, lab, st, _ = cv2.connectedComponentsWithStats(m01, connectivity=8)
    out = m01.copy()
    for k in range(1, n):
        x, y, w, h, a = st[k]
        if w >= 0.97 * W and h >= 0.97 * H and a < 0.12 * W * H:
            out[lab == k] = 0
    t = thick_px or max(4, int(round(0.012 * max(H, W))))       # เส้นที่บางกว่านี้ = เส้นกรอบ
    band = max(3, int(band_frac * min(H, W)))
    zone = np.zeros_like(out)
    zone[:band, :] = 1
    zone[-band:, :] = 1
    zone[:, :band] = 1
    zone[:, -band:] = 1
    hl = cv2.morphologyEx(out, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(3, int(0.3 * W)), 1)))
    vl = cv2.morphologyEx(out, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(3, int(0.3 * H)))))
    thick_v = cv2.morphologyEx(out, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, t)))
    thick_h = cv2.morphologyEx(out, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (t, 1)))
    frame = ((hl & (1 - thick_v)) | (vl & (1 - thick_h))) & zone
    frame = cv2.dilate(frame, np.ones((3, 3), np.uint8)) & out & (1 - (thick_v & thick_h))
    out[frame > 0] = 0
    return remove_small(out, max(4, int(0.0002 * H * W)))


def load_design(src, copper="auto", trim=True, drop_frame=True):
    """
    โหลดไฟล์ต้นแบบ (PNG/JPG ขาว-ดำ จาก KiCad/EasyEDA/ไฟล์พิมพ์ลาย)
    copper: "black" = ทองแดงเป็นสีดำ, "white" = ทองแดงเป็นสีขาว, "auto" = ลองทั้งสองแบบตอนจัดตำแหน่ง
    คืน dict {variants: [(ชื่อ, mask 0/1)], crop}
    """
    gray = _read_gray(src)
    _, bw = cv2.threshold(gray, 0, 1, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    crop = (0, 0, bw.shape[1], bw.shape[0])
    if trim:
        bw, crop = _trim_uniform(bw)
    variants = []
    for pol in (["black", "white"] if copper == "auto" else [copper]):
        m = (1 - bw) if pol == "black" else bw.copy()
        m = m.astype(np.uint8)
        if drop_frame:
            m = _drop_frame(m)
        variants.append((pol, m))
    return dict(variants=variants, crop=crop, src_shape=gray.shape)


def to_canon(m01, long_side=CANON_LONG):
    H, W = m01.shape
    s = long_side / max(H, W)
    size = (max(8, int(round(W * s))), max(8, int(round(H * s))))
    f = cv2.resize(m01.astype(np.float32), size, interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR)
    return (f >= 0.5).astype(np.uint8)


def trace_width(D):
    """ประมาณความกว้างเส้นลายทั่วไป (px) จาก distance transform บนเส้นกลาง"""
    dt = cv2.distanceTransform(D, cv2.DIST_L2, 5)
    sk = skeletonize(D > 0)
    v = dt[sk]
    v = v[v >= 1]
    if len(v) == 0:
        return 4.0
    return float(max(3.0, 2 * np.percentile(v, 35)))


def _main_copper(m01, keep=0.985):
    """ตัดก้อนเล็กๆ ที่อยู่นอกบอร์ด (noise) ออก เก็บก้อนใหญ่ที่รวมกันได้ >= keep ของทองแดงทั้งหมด"""
    n, lab, st, _ = cv2.connectedComponentsWithStats(m01, connectivity=8)
    if n <= 2:
        return m01
    a = st[1:, cv2.CC_STAT_AREA]
    order = np.argsort(-a)
    cum = np.cumsum(a[order]) / a.sum()
    k = int(np.searchsorted(cum, keep)) + 1
    ok = np.zeros(n, np.uint8)
    ok[order[:k] + 1] = 1
    return ok[lab]


def _hull_area(m01):
    pts = cv2.findNonZero(m01)
    if pts is None or len(pts) < 3:
        return 1.0
    return max(1.0, float(cv2.contourArea(cv2.convexHull(pts))))


# ---------------------------------------------------------------------------------------
# การจัดตำแหน่ง (alignment): หมุนทุกมุม + mirror + สเกล + เลื่อน → ECC affine → ECC homography
# A (3x3) = การแปลงพิกัดจาก "กรอบมาตรฐานของ design" → "พิกัดภาพ mask"
# ---------------------------------------------------------------------------------------
def _M3(M2):
    return np.vstack([M2, [0, 0, 1]]).astype(np.float64)


def _blurf(m, sigma):
    f = m.astype(np.float32)
    return cv2.GaussianBlur(f, (0, 0), sigma) if sigma > 0 else f


def _rot_canvas(h, w, angle, scale, flip):
    """เมทริกซ์ (3x3) หมุน/สเกล/กลับด้าน รอบจุดกลาง แล้วเลื่อนให้อยู่ในกรอบใหม่ + ขนาดกรอบ"""
    F = np.array([[-1, 0, w - 1], [0, 1, 0], [0, 0, 1]], np.float64) if flip else np.eye(3)
    R = _M3(cv2.getRotationMatrix2D(((w - 1) / 2, (h - 1) / 2), angle, scale))
    M = R @ F
    c = np.array([[0, 0, 1], [w - 1, 0, 1], [w - 1, h - 1, 1], [0, h - 1, 1]], np.float64).T
    p = (M @ c)[:2]
    x0, y0 = p.min(1)
    x1, y1 = p.max(1)
    T = np.array([[1, 0, -x0], [0, 1, -y0], [0, 0, 1]], np.float64)
    return T @ M, (int(math.ceil(x1 - x0)) + 1, int(math.ceil(y1 - y0)) + 1)


def warp_to_canon(img, A, canon_shape, nearest=False, border=0):
    """ดัดภาพจากกรอบ mask กลับมาหากรอบมาตรฐานของ design (canon)"""
    flags = cv2.INTER_NEAREST if nearest else cv2.INTER_LINEAR
    return cv2.warpPerspective(img, np.linalg.inv(A), (canon_shape[1], canon_shape[0]), flags=flags, borderValue=border)


def warp_mask_to_canon(T, A, canon_shape):
    w = warp_to_canon(T, A, canon_shape)
    return (w >= 0.5).astype(np.uint8)


def match_score(D, Tc, r=2):
    """F1-score ระหว่างสองลาย (ยอมรับความคลาดเคลื่อน r px)"""
    cm = cv2.dilate(Tc, disk(r))
    cd = cv2.dilate(D, disk(r))
    prec = float((Tc & cd).sum() / max(1, Tc.sum()))
    rec = float((D & cm).sum() / max(1, D.sum()))
    return 0.0 if (prec + rec) == 0 else 2 * prec * rec / (prec + rec)


def align_quality(D, Tc, r=2, hull=None):
    """ประเมินคุณภาพการซ้อน: ดูทั้งพื้นที่รวมและเฉพาะพื้นที่ที่มีทองแดง"""
    s1 = match_score(D, Tc, r=r)
    s2 = match_score(D, Tc, r=max(1, r - 1))
    return 0.6 * s1 + 0.4 * s2


def _coarse_search(Dc, T, s0, angle_step=4.0, scale_factors=(0.85, 1.0, 1.18),
                   flips=(False, True), coarse_long=112, sigma=1.0, pad_frac=0.3, angles=None,
                   aspect_ratios=(1.0,)):
    """ค้นหาแบบหยาบ: รองรับหมุนทุกองศา × กลับด้าน × สเกล × อัตราส่วนภาพ (Aspect Ratio) ด้วย NCC"""
    Hc, Wc = Dc.shape
    ct = coarse_long / max(T.shape)
    Tsm = cv2.resize(T.astype(np.float32), (max(8, int(round(T.shape[1] * ct))), max(8, int(round(T.shape[0] * ct)))),
                     interpolation=cv2.INTER_AREA)
    ctx, cty = Tsm.shape[1] / T.shape[1], Tsm.shape[0] / T.shape[0]
    Tsm = cv2.GaussianBlur(Tsm, (0, 0), sigma)
    max_ar = max(aspect_ratios)
    pad = int(max(Wc, Hc) * s0 * ct * max(scale_factors) * max_ar * pad_frac) + 8
    Tp = cv2.copyMakeBorder(Tsm, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
    ii, ii2 = cv2.integral2(Tp, sdepth=cv2.CV_64F)
    Sinv = np.diag([1 / ctx, 1 / cty, 1.0])
    res = []
    jobs = [(f, a) for f in flips for a in np.arange(0, 360, angle_step)] if angles is None else [(f, a) for f, a in angles]
    
    for ar in aspect_ratios:
        for sf in scale_factors:
            sx = s0 * sf
            sy = s0 * sf * ar
            w_c = max(4, int(round(Wc * sx * ct)))
            h_c = max(4, int(round(Hc * sy * ct)))
            Ds = cv2.resize(Dc.astype(np.float32), (w_c, h_c), interpolation=cv2.INTER_AREA)
            kx, ky = Ds.shape[1] / Wc, Ds.shape[0] / Hc
            Rs = np.diag([kx, ky, 1.0])
            for flip, ang in jobs:
                M, (tw, th) = _rot_canvas(Ds.shape[0], Ds.shape[1], ang, 1.0, flip)
                if tw >= Tp.shape[1] or th >= Tp.shape[0]:
                    continue
                tmpl = cv2.warpAffine(Ds, M[:2], (tw, th), flags=cv2.INTER_LINEAR, borderValue=0)
                tmpl = cv2.GaussianBlur(tmpl, (0, 0), sigma)
                if tmpl.std() < 1e-4:
                    continue
                r = cv2.matchTemplate(Tp, tmpl, cv2.TM_CCOEFF_NORMED)
                n = tw * th
                S = ii[th:, tw:] - ii[:-th, tw:] - ii[th:, :-tw] + ii[:-th, :-tw]
                S2 = ii2[th:, tw:] - ii2[:-th, tw:] - ii2[th:, :-tw] + ii2[:-th, :-tw]
                var = (S2 - S * S / n) / n
                r = np.where(var[:r.shape[0], :r.shape[1]] > 0.02 * tmpl.var(), r, -1)
                r = np.nan_to_num(r, nan=-1, posinf=-1, neginf=-1)
                _, mx, _, loc = cv2.minMaxLoc(r)
                Tr = np.array([[1, 0, loc[0] - pad], [0, 1, loc[1] - pad], [0, 0, 1]], np.float64)
                A = Sinv @ Tr @ M @ Rs
                res.append(dict(score=float(mx), flip=bool(flip), angle=float(ang), scale=float(s0 * sf), ar=float(ar), A=A))
    res.sort(key=lambda d: -d["score"])
    return res


def _ecc(Dc, T, A, motion, sigma_c=2.0, iters=80, eps=1e-5):
    """ECC บนภาพที่ย่อ design ลงให้ใกล้ความละเอียดของ mask (เร็วขึ้นมากบน Pi)"""
    s = math.sqrt(abs(np.linalg.det(A[:2, :2] / A[2, 2])))    # test px ต่อ canon px
    k = min(1.0, 1.3 * s)
    size = (max(8, int(round(Dc.shape[1] * k))), max(8, int(round(Dc.shape[0] * k))))
    kx, ky = size[0] / Dc.shape[1], size[1] / Dc.shape[0]
    K, Kinv = np.diag([kx, ky, 1.0]), np.diag([1 / kx, 1 / ky, 1.0])
    tmpl = cv2.GaussianBlur(cv2.resize(Dc.astype(np.float32), size, interpolation=cv2.INTER_AREA), (0, 0), max(0.6, sigma_c * k))
    inp = _blurf(T, max(0.6, sigma_c * s))
    As = A @ Kinv
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, iters, eps)
    try:
        if motion == cv2.MOTION_HOMOGRAPHY:
            w = (As / As[2, 2]).astype(np.float32)
            cc, w = cv2.findTransformECC(tmpl, inp, w, motion, crit, None, 1)
            return w.astype(np.float64) @ K, float(cc)
        w = (As / As[2, 2])[:2].astype(np.float32)
        cc, w = cv2.findTransformECC(tmpl, inp, w, motion, crit, None, 1)
        return _M3(w) @ K, float(cc)
    except cv2.error:
        return None, 0.0


def _sane(A0, A1, canon_shape, max_rel=0.25):
    """ป้องกัน ECC หลุด: มุมทั้ง 4 ของบอร์ดต้องไม่ขยับเกิน max_rel ของขนาดบอร์ด"""
    Hc, Wc = canon_shape
    c = np.array([[0, 0, 1], [Wc, 0, 1], [Wc, Hc, 1], [0, Hc, 1]], np.float64).T
    p0 = A0 @ c
    p1 = A1 @ c
    if np.any(np.abs(p1[2]) < 1e-6):
        return False
    p0, p1 = p0[:2] / p0[2], p1[:2] / p1[2]
    size = np.linalg.norm(p0[:, 2] - p0[:, 0])
    return bool(np.max(np.linalg.norm(p1 - p0, axis=0)) < max_rel * size)


def _angle_diff(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


def align(design, mask01, canon_max=768, canon_min=256, px_per_test=2.0, angle_step=4.0,
          allow_mirror=True, perspective=True, top_k=5, good_enough=0.92, verbose=False):
    """
    จัดตำแหน่ง design ให้ซ้อนกับ mask: หมุนได้ทุกมุม 360° + กลับซ้าย-ขวา + ปรับสเกล/อัตราส่วนภาพ + เลื่อน + perspective
      1) ประมาณสเกลเบื้องต้นจากพื้นที่ convex hull ของทองแดง
      2) ค้นหาแบบหยาบ (Coarse Search): ครอบคลุมมุมรอบทิศ × {ปกติ, กลับด้าน} × {สเกลหลายระดับ} × {ชดเชย Aspect Ratio จากกล้อง}
      3) คัดเลือกผู้สมัครที่ดีที่สุด top_k อันดับ
      4) ปรับละเอียดด้วย ECC affine → ECC homography (ชดเชยมุมกล้อง/perspective tilt)
    คืน dict: A (canon→mask 3x3), D (design ในกรอบมาตรฐาน), Tc (mask ที่ดัดเข้ากรอบมาตรฐาน), score, ...
    """
    t0 = time.time()
    if not isinstance(design, dict):
        design = load_design(design)
    mask01 = (mask01 > 0).astype(np.uint8)
    T = _main_copper(mask01)
    hullT = _hull_area(T)
    cands, canon = [], {}
    for pol, dm in design["variants"]:
        Hd, Wd = dm.shape
        ar_d = Wd / Hd
        ar_options = [1.0]
        if abs(ar_d - 1.0) > 0.08:
            ar_options.extend([ar_d, 1.0 / ar_d])
        
        base = to_canon(dm, 512)
        s512 = math.sqrt(hullT / _hull_area(base))
        long_ = int(np.clip(round(px_per_test * s512 * 512), canon_min, canon_max))
        Dc = to_canon(dm, long_)
        canon[pol] = Dc
        s0 = math.sqrt(hullT / _hull_area(Dc))
        flips = (False, True) if allow_mirror else (False,)
        
        # ค้นหาแบบหยาบครอบคลุมทั้ง scale factors และ aspect ratio options
        res = _coarse_search(Dc, T, s0, angle_step=angle_step, scale_factors=(0.85, 1.0, 1.18),
                             flips=flips, aspect_ratios=ar_options)
        for r in res:
            r["polarity"] = pol
        cands += res[:top_k * 2]
        
    cands.sort(key=lambda d: -d["score"])
    picked = []
    for c in cands:
        if all(not (c["polarity"] == p["polarity"] and c["flip"] == p["flip"] and
                    _angle_diff(c["angle"], p["angle"]) <= angle_step * 1.5) for p in picked):
            picked.append(c)
        if len(picked) >= top_k:
            break
            
    best = None
    for c in picked:
        Dc = canon[c["polarity"]]
        A = c["A"]
        for sig in (3.0, 1.5):
            A1, cc = _ecc(Dc, T, A, cv2.MOTION_AFFINE, sigma_c=sig)
            if A1 is not None and _sane(A, A1, Dc.shape):
                A = A1
        sc = align_quality(Dc, warp_mask_to_canon(T, A, Dc.shape))
        if perspective:
            A2, cc = _ecc(Dc, T, A, cv2.MOTION_HOMOGRAPHY, sigma_c=1.5)
            if A2 is not None and _sane(A, A2, Dc.shape, 0.08):
                sc2 = align_quality(Dc, warp_mask_to_canon(T, A2, Dc.shape))
                if sc2 >= sc - 1e-3:
                    A, sc = A2, sc2
        if verbose:
            print(f"  pol={c['polarity']} flip={c['flip']} ang={c['angle']:.1f} coarse={c['score']:.3f} → {sc:.3f}")
        if best is None or sc > best["score"]:
            best = dict(c, A=A, score=sc, D=Dc)
        if sc >= good_enough:
            break
            
    Dc, A = best["D"], best["A"]
    L = A[:2, :2] / A[2, 2]
    det = np.linalg.det(L)
    mirrored = det < 0
    Lm = L @ np.diag([-1, 1]) if mirrored else L
    angle = (-math.degrees(math.atan2(Lm[1, 0], Lm[0, 0]))) % 360
    return dict(A=A, D=Dc, Tc=warp_mask_to_canon(mask01, A, Dc.shape), T=mask01,
                score=best["score"], coarse_score=best["score"], polarity=best["polarity"],
                mirrored=bool(mirrored), angle=round(angle, 1), scale=round(math.sqrt(abs(det)), 4),
                time_s=round(time.time() - t0, 3))


def design_as_seen(D, A, mask_shape, blur=0.6):
    """
    'ต้นแบบในสายตากล้อง': ย่อ design ลงความละเอียดเดียวกับ mask (+เบลอเล็กน้อย) แล้วดัดกลับเข้ากรอบมาตรฐาน
    รายละเอียดที่เล็กกว่าความละเอียดกล้อง (รูเจาะเล็ก, thermal relief, วงแหวนบาง) จะหายไปเหมือนใน mask จริง
    → ลด false alarm ได้มาก
    """
    h, w = mask_shape
    s = math.sqrt(abs(np.linalg.det(A[:2, :2] / A[2, 2])))
    f = cv2.GaussianBlur(D.astype(np.float32), (0, 0), max(0.3, 0.45 / s))
    Dm = cv2.warpPerspective(f, A, (w, h), flags=cv2.INTER_LINEAR, borderValue=0)
    if blur > 0:
        Dm = cv2.GaussianBlur(Dm, (0, 0), blur)
    Dm = (Dm >= 0.5).astype(np.uint8)
    return warp_mask_to_canon(Dm, A, D.shape), Dm




# ---------------------------------------------------------------------------------------
# หาจุดต่าง (candidates) + feature
# ---------------------------------------------------------------------------------------
FEATURE_NAMES = [
    "area_miss", "area_extra", "miss_skel_len", "miss_depth", "extra_out",
    "nets_bridged_local", "nets_bridged_global", "split_local", "split_global",
    "width_min", "width_mean", "extra_width_max", "bbox_long", "bbox_aspect",
    "region_solidity", "miss_frac_local", "extra_frac_local", "near_border", "align_score",
    "extra_touch_nets", "gap_local", "unc_frac",
]


def _touch_nets(region01, net_core_lab, min_px=3):
    v = net_core_lab[region01 > 0]
    v = v[v > 0]
    if len(v) == 0:
        return set()
    ids, cnt = np.unique(v, return_counts=True)
    return set(int(i) for i, c in zip(ids, cnt) if c >= min_px)


class Comparator:
    """เตรียมข้อมูลของการเปรียบเทียบหนึ่งคู่ (design canon D กับ mask ที่ดัดแล้ว Tc)"""

    def __init__(self, D, Tc, align_score=1.0, tol=None, border=None, px=1.0, min_feature=1.6, D_hi=None):
        """
        D    = design 'ในสายตากล้อง' (canon)  — ใช้หา net / ทองแดงหาย
        D_hi = design ความละเอียดเต็ม (canon) — ใช้ตัดสินทองแดงเกิน (ถ้าต้นแบบมีทองแดงจริงตรงนั้น ไม่นับว่าเกิน)
        Tc   = mask ที่ดัดเข้ากรอบแล้ว, px = จำนวน px ของ canon ต่อ 1 px ของ mask
        """
        self.D = D.astype(np.uint8)
        self.D_hi = (D_hi if D_hi is not None else D).astype(np.uint8)
        self.px = float(px)
        self.tw = trace_width(self.D)
        tw = self.tw
        self.tol = int(tol if tol is not None else max(3, round(max(0.35 * tw, 2.0 * px))))
        self.min_area = max(4, int(0.2 * tw * tw), int(round(px * px)))
        T = remove_small(Tc.astype(np.uint8), self.min_area)
        T = fill_small_holes(T, max(4, int(0.15 * tw * tw)))
        self.T_raw = T
        # โซนที่กล้องแยกไม่ออก: ช่องว่าง/ทองแดงที่แคบกว่า ~min_feature px ของ mask
        #   → ไม่นับว่าช็อต/ขาดตรงนั้น (ตรวจไม่ได้จริงที่ความละเอียดนี้)
        r = max(1, int(math.ceil((min_feature * px - 1) / 2)))
        k = disk(r)
        self.thin_gap = dil(((1 - D) & (1 - cv2.morphologyEx((1 - D).astype(np.uint8), cv2.MORPH_OPEN, k))).astype(np.uint8), 1) & (1 - D)
        self.thin_cu = dil((D & (1 - cv2.morphologyEx(D, cv2.MORPH_OPEN, k))).astype(np.uint8), 1) & D
        # ส่วนที่ 'ต้นแบบในสายตากล้อง' ต่างจากต้นแบบจริง = รายละเอียดเล็กกว่าความละเอียดกล้อง → ตรวจไม่ได้
        self.subres = (dil((self.D ^ self.D_hi).astype(np.uint8), 1)) if D_hi is not None else np.zeros_like(self.D)
        self.uncertain = (self.thin_gap | self.thin_cu | self.subres).astype(np.uint8)
        T = ((T & (1 - self.thin_gap)) | self.thin_cu).astype(np.uint8)
        T = np.where(self.subres > 0, self.D, T).astype(np.uint8)
        self.T = T
        self.align_score = align_score
        H, W = D.shape
        b_x_l = max(28, int(round(0.06 * W))) if border is None else int(border)
        b_x_r = max(72, int(round(0.12 * W))) if border is None else int(border)
        b_y = max(24, int(round(0.06 * H))) if border is None else int(border)
        self.valid = np.zeros_like(self.D)
        self.valid[b_y:H - b_y, b_x_l:W - b_x_r] = 1
        self.n_net, self.net = cv2.connectedComponents(self.D, connectivity=8)
        counts = np.bincount(self.net.ravel())
        self.ground_net = int(counts[1:].argmax()) + 1 if len(counts) > 1 else -1
        self.dtD = cv2.distanceTransform(self.D, cv2.DIST_L2, 5)
        self.dtDo = cv2.distanceTransform((1 - self.D).astype(np.uint8), cv2.DIST_L2, 5)
        self.dtT = cv2.distanceTransform(self.T, cv2.DIST_L2, 5)
        self.core = ero(self.D, 1)
        self.core_lab = self.net * self.core
        sk = skeletonize(self.D > 0).astype(np.uint8)
        self.skel = sk & (self.dtD >= max(1.5, 0.3 * tw)).astype(np.uint8)
        self.skel_lab = self.net * self.skel
        self.n_t, self.t_lab = cv2.connectedComponents(self.T, connectivity=8)
        # รูเจาะ (drill hole) + รูเจาะน็อต 4 มุม + มาร์คกล้อง + จุดที่ไม่ใช่วงจร
        self.ignore = self._build_ignore_mask()
        # จำนวนท่อนของแต่ละ net ใน T (ใช้บอก open ระดับทั้งบอร์ด)
        self.frag_global = self._fragments_global()

    def _build_ignore_mask(self):
        tw = self.tw
        H, W = self.D.shape
        ign = np.zeros_like(self.D)

        nD, labD, statsD, _ = cv2.connectedComponentsWithStats(self.D, connectivity=8)
        for i in range(1, nD):
            x, y, w_comp, h_comp, a_comp = statsD[i]
            aspect = max(w_comp, h_comp) / max(1, min(w_comp, h_comp))
            is_corner = (x < 0.12 * W or x + w_comp > 0.88 * W) and (y < 0.12 * H or y + h_comp > 0.88 * H)

            # 1. Corner mounting holes
            if is_corner and aspect < 1.4 and a_comp < 15 * tw * tw:
                ign[max(0, y - 10):min(H, y + h_comp + 10), max(0, x - 10):min(W, x + w_comp + 10)] = 1
            # 2. Fiducials
            elif aspect < 1.4 and a_comp < 15 * tw * tw and a_comp < 0.02 * H * W:
                ign[max(0, y - 8):min(H, y + h_comp + 8), max(0, x - 8):min(W, x + w_comp + 8)] = 1
            # 3. TEST1 text badge
            elif y > 0.82 * H and a_comp < 5 * tw * tw:
                ign[max(0, y - 6):min(H, y + h_comp + 6), max(0, x - 6):min(W, x + w_comp + 6)] = 1

        # 4. Through-hole component pads inside (1 - D)
        inv = (1 - self.D).astype(np.uint8)
        n_inv, lab_inv, st_inv, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
        for k in range(1, n_inv):
            x, y, w_h, h_h, a_h = st_inv[k, :5]
            if x <= 1 or y <= 1 or x + w_h >= W - 1 or y + h_h >= H - 1:
                continue
            if a_h > 15.0 * tw * tw:
                continue
            comp = (lab_inv == k).astype(np.uint8)
            ign |= dil(comp, max(1, int(round(0.75 * tw))))

        return ign

    def _drill_holes(self):
        tw = self.tw
        inv = (1 - self.D).astype(np.uint8)
        n, lab, st, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
        ign = np.zeros_like(self.D)
        for k in range(1, n):
            if st[k, cv2.CC_STAT_AREA] > 10.0 * tw * tw:
                continue
            x, y, w, h = st[k, :4]
            if x <= 1 or y <= 1 or x + w >= self.D.shape[1] - 1 or y + h >= self.D.shape[0] - 1:
                continue
            x0, y0, x1, y1 = max(0, x - 3), max(0, y - 3), min(self.D.shape[1], x + w + 3), min(self.D.shape[0], y + h + 3)
            comp = (lab[y0:y1, x0:x1] == k).astype(np.uint8)
            ring = dil(comp, 2) & (1 - comp)
            nets = set(np.unique(self.net[y0:y1, x0:x1][ring > 0]).tolist()) - {0}
            if len(nets) <= 1:
                ign[y0:y1, x0:x1] |= dil(comp, 2)
        return ign

    def _fragments_global(self):
        frag = {}
        T_filled = (self.T | self.ignore)
        n_t, t_lab = cv2.connectedComponents(T_filled, connectivity=8)
        tcov = dil(T_filled, 1)
        ground_net = getattr(self, "ground_net", -1)
        for i in range(1, self.n_net):
            if i == ground_net:
                continue
            sk = (self.skel_lab == i) & (self.ignore == 0)
            n_sk = int(sk.sum())
            if n_sk < 3:
                continue
            ids = t_lab[(sk > 0) & (tcov > 0)]
            ids = ids[ids > 0]
            if len(ids) == 0:
                frag[i] = 0
                continue
            u, c = np.unique(ids, return_counts=True)
            frag[i] = int((c >= max(3, 0.5 * self.tw)).sum())
        return frag

    # ------------------------------------------------------------------
    def candidates(self):
        tw, tol = self.tw, self.tol
        D, T, V = self.D, self.T, self.valid
        Dh = dil(self.D_hi, 1)
        miss = (D & self.D_hi & (1 - T) & V & (1 - self.ignore)).astype(np.uint8)
        extra = (T & (1 - D) & (1 - Dh) & V & (1 - self.ignore)).astype(np.uint8)
        keep = np.zeros_like(D)
        # ทองแดงหาย: ต้องลึกถึงเส้นกลาง หรือ หนาเกิน tol
        n, lab, st, _ = cv2.connectedComponentsWithStats(miss, connectivity=8)
        skd = dil(self.skel, 1)
        for k in range(1, n):
            if st[k, cv2.CC_STAT_AREA] < 3:
                continue
            x, y, w, h = st[k, :4]
            comp = lab[y:y + h, x:x + w] == k
            if (skd[y:y + h, x:x + w][comp]).any() or self.dtD[y:y + h, x:x + w][comp].max() > tol + 0.5:
                keep[y:y + h, x:x + w][comp] = 1
        # ทองแดงเกิน: ต้องยื่นออกเกิน tol
        n, lab, st, _ = cv2.connectedComponentsWithStats(extra, connectivity=8)
        for k in range(1, n):
            if st[k, cv2.CC_STAT_AREA] < 3:
                continue
            x, y, w, h = st[k, :4]
            comp = lab[y:y + h, x:x + w] == k
            if self.dtDo[y:y + h, x:x + w][comp].max() > tol + 0.5:
                keep[y:y + h, x:x + w][comp] = 1
        # short ที่ช่องแคบมาก (สะพานอยู่ในระยะ tol): T ก้อนเดียวแตะหลาย net
        for j in range(1, self.n_t):
            comp = (self.t_lab == j)
            nets = _touch_nets(comp.astype(np.uint8), self.core_lab, 3)
            if len(nets) < 2:
                continue
            ex = comp & (D == 0) & (V > 0)
            if not ex.any():
                continue
            nets = sorted(nets)[:6]
            dts = [cv2.distanceTransform((self.net != i).astype(np.uint8), cv2.DIST_L2, 3) for i in nets]
            for a in range(len(nets)):
                for b in range(a + 1, len(nets)):
                    s = dts[a] + dts[b]
                    sv = s[ex]
                    if len(sv) == 0:
                        continue
                    lim = sv.min() + max(2.0, 0.5 * tw)
                    if sv.min() > 6 * tw:
                        continue
                    keep[ex & (s <= lim)] = 1
        # รวมจุดใกล้กันเป็นกลุ่มเดียว
        grp = dil(keep, max(2, round(0.6 * tw)))
        n, lab, st, _ = cv2.connectedComponentsWithStats(grp, connectivity=8)
        out = []
        for k in range(1, n):
            x, y, w, h = st[k, :4]
            reg = ((lab == k) & (keep > 0)).astype(np.uint8)
            if reg.sum() < 3:
                continue
            out.append(dict(bbox=[int(x), int(y), int(w), int(h)], region=reg))
        return out

    # ------------------------------------------------------------------
    def features(self, cand):
        tw, tol = self.tw, self.tol
        D, T = self.D, self.T
        H, W = D.shape
        x, y, w, h = cand["bbox"]
        pad = int(round(2.5 * tw))
        x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(W, x + w + pad), min(H, y + h + pad)
        sl = (slice(y0, y1), slice(x0, x1))
        reg = cand["region"][sl]
        Dw, Tw = D[sl], T[sl]
        Dhw = self.D_hi[sl]
        miss = reg & Dw & Dhw & (1 - Tw)
        extra = reg & Tw & (1 - Dw) & (1 - dil(Dhw, 1))
        f = {}
        f["area_miss"] = miss.sum() / tw ** 2
        f["area_extra"] = extra.sum() / tw ** 2
        skw = self.skel[sl]
        regd = dil(reg, 1)
        f["miss_skel_len"] = float((skw & regd & (1 - Tw)).sum()) / tw
        f["miss_depth"] = float(self.dtD[sl][miss > 0].max() / tw) if miss.any() else 0.0
        f["extra_out"] = float(self.dtDo[sl][extra > 0].max() / tw) if extra.any() else 0.0
        # short: T ก้อนที่ทับบริเวณนี้ แตะ net ต่างกันกี่ net
        core_w = self.core_lab[sl]
        tl, tlab = cv2.connectedComponents(Tw, connectivity=8)
        ids = np.unique(tlab[(regd > 0) & (Tw > 0)])
        nb_loc, touch_all = 0, set()
        for j in ids[ids > 0]:
            nets = _touch_nets((tlab == j).astype(np.uint8), core_w, 3)
            nb_loc = max(nb_loc, len(nets))
        gids = np.unique(self.t_lab[sl][(regd > 0) & (Tw > 0)])
        nb_glob = 0
        for j in gids[gids > 0]:
            nets = _touch_nets((self.t_lab == j).astype(np.uint8), self.core_lab, 3)
            nb_glob = max(nb_glob, len(nets))
        f["nets_bridged_local"] = float(nb_loc)
        f["nets_bridged_global"] = float(nb_glob)
        # open: net ในหน้าต่างนี้ ถูกแบ่งเป็นกี่ท่อนเพิ่มขึ้น (กรอง ground net และ รูเจาะ through-hole ออก)
        nets_here = set(np.unique(self.net[sl][dil(reg, 2) > 0]).tolist()) - {0}
        split_loc, split_glob = 0, 0
        ign_w = self.ignore[sl]
        Tw_filled = (Tw | ign_w)
        tcov = dil(Tw_filled, 1)
        ground_net = getattr(self, "ground_net", -1)
        for i in nets_here:
            if i == ground_net:
                continue
            dn = (self.net[sl] == i).astype(np.uint8)
            skn = (skw > 0) & (dn > 0) & (ign_w == 0)
            if skn.sum() < 3:
                continue
            nd = cv2.connectedComponents(dn, connectivity=8)[0] - 1
            tn = (Tw_filled & dil(dn, tol)).astype(np.uint8)
            nt, tlb = cv2.connectedComponents(tn, connectivity=8)
            bool_mask = (skn > 0) & (tcov > 0)
            cnt = np.bincount(tlb[bool_mask].ravel(), minlength=nt)
            cnt[0] = 0
            nfr = int((cnt >= 2).sum())
            split_loc = max(split_loc, nfr - nd)
            split_glob = max(split_glob, self.frag_global.get(i, 1) - 1)
        f["split_local"] = float(max(0, split_loc))
        f["split_global"] = float(max(0, split_glob))
        f["is_non_circuit"] = 1.0 if ign_w.mean() > 0.5 else 0.0
        # ความกว้างที่เหลือของเส้นเทียบกับต้นแบบ (0 = ขาด, 1 = ครบ)
        skr = (skw > 0) & (regd > 0)
        if skr.any():
            ratio = np.clip(self.dtT[sl][skr] / np.maximum(1.0, self.dtD[sl][skr]), 0, 1.5)
            f["width_min"] = float(ratio.min())
            f["width_mean"] = float(ratio.mean())
        else:
            f["width_min"], f["width_mean"] = 1.0, 1.0
        if extra.any():
            dte = cv2.distanceTransform(extra.astype(np.uint8), cv2.DIST_L2, 3)
            f["extra_width_max"] = float(2 * dte.max() / tw)
        else:
            f["extra_width_max"] = 0.0
        f["bbox_long"] = max(w, h) / tw
        f["bbox_aspect"] = max(w, h) / max(1, min(w, h))
        pts = cv2.findNonZero(reg)
        ha = _hull_area(reg) if pts is not None and len(pts) >= 3 else 1.0
        f["region_solidity"] = float(min(1.0, reg.sum() / ha))
        f["miss_frac_local"] = float((Dw & (1 - Tw)).sum() / max(1, Dw.sum()))
        f["extra_frac_local"] = float((Tw & (1 - Dw)).sum() / max(1, (1 - Dw).sum()))
        cx, cy = x + w / 2, y + h / 2
        f["near_border"] = float(min(cx, cy, W - cx, H - cy) / tw)
        f["align_score"] = float(self.align_score)
        f["extra_touch_nets"] = float(len(_touch_nets(dil(extra, 1), core_w, 1))) if extra.any() else 0.0
        # ช่องว่างระหว่าง net ใกล้ๆ (ถ้าแคบ short เกิดง่าย / false alarm ง่าย)
        dto = self.dtDo[sl]
        f["gap_local"] = float(2 * np.percentile(dto[dto > 0], 60) / tw) if (dto > 0).any() else 10.0
        f["unc_frac"] = float((dil(self.uncertain, 1)[sl] & reg).sum() / max(1, reg.sum()))
        return np.array([f[k] for k in FEATURE_NAMES], np.float32), f


# ---------------------------------------------------------------------------------------
# ตัวจำแนก
# ---------------------------------------------------------------------------------------
def rule_predict(f):
    """กฎตั้งต้น: ใช้ตัดสินตอนยังไม่มีโมเดล หรือใช้เป็น baseline (ปรับปรุงลด False Alarm ที่รูเจาะและเส้นตรงยาว)"""
    if f.get("is_non_circuit", 0) > 0.5:
        return "normal"

    # 1. Short: ต้องเชื่อมต่อข้าม Net อย่างแท้จริง (>= 2 nets ทั้งใน local และแตะ extra)
    if f.get("nets_bridged_local", 0) >= 2 and f.get("extra_touch_nets", 0) >= 2:
        return "short"
    
    # 2. Open: ต้องมีหลักฐานการขาดจริง (Local Disconnection หรือ Global Split + Copper Disappearance)
    if f.get("split_local", 0) >= 1:
        return "open"
    if f.get("split_global", 0) >= 1 and f.get("miss_skel_len", 0) >= 0.8 and f.get("width_min", 1.0) == 0.0:
        return "open"

    # 3. Minor: ตำหนิทองแดงเกินที่ชัดเจน
    if f.get("area_extra", 0) >= 1.2 and f.get("extra_width_max", 0) >= 0.8:
        return "minor"
    return "normal"


class DefectClassifier:
    """ตัวจำแนกตำหนิด้วย AI (RandomForest) หรือกฎตั้งต้น"""

    def __init__(self, model=None, classes=None, meta=None):
        self.model = model
        self.classes = list(classes or CLASSES)
        self.meta = meta or {}

    @staticmethod
    def load(path):
        import joblib
        obj = joblib.load(path)
        if obj.get("feature_names") != FEATURE_NAMES:
            raise ValueError("feature ของโมเดลไม่ตรงกับเวอร์ชันโค้ด — เทรนใหม่")
        return DefectClassifier(obj["model"], obj["classes"], obj.get("meta"))

    def save(self, path):
        import joblib
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        joblib.dump(dict(model=self.model, classes=self.classes, feature_names=FEATURE_NAMES,
                         meta=self.meta), path, compress=3)

    def fit(self, X, y, sample_weight=None, n_estimators=300, seed=0):
        from sklearn.ensemble import RandomForestClassifier
        self.model = RandomForestClassifier(n_estimators=n_estimators, min_samples_leaf=2,
                                            class_weight="balanced", n_jobs=-1, random_state=seed)
        self.model.fit(X, y, sample_weight=sample_weight)
        self.classes = [str(c) for c in self.model.classes_]
        return self

    def predict(self, X, feats=None, critical_thr=None):
        """
        critical_thr: ถ้าความน่าจะเป็นของ open หรือ short ≥ ค่านี้ ให้ตอบคลาสนั้น (แม้ไม่ใช่ค่าสูงสุด)
                      → ลดโอกาสพลาดตำหนิร้ายแรง แลกกับ false alarm เพิ่มเล็กน้อย (None = ใช้ค่าสูงสุดตามปกติ)
        """
        if self.model is None:
            labs = [rule_predict(f) for f in feats]
            P = np.array([[1.0 if c == l else 0.0 for c in CLASSES] for l in labs])
            return labs, P, list(CLASSES)
        P = self.model.predict_proba(np.atleast_2d(X))
        cls = [str(c) for c in self.model.classes_]
        labs = [cls[i] for i in P.argmax(1)]
        if critical_thr is not None:
            crit = [c for c in ("open", "short") if c in cls]
            for n, p in enumerate(P):
                if crit:
                    c = max(crit, key=lambda k: p[cls.index(k)])
                    if p[cls.index(c)] >= critical_thr:
                        labs[n] = c
        return labs, P, cls


def match_best_design(mask, designs_dict, **align_kw):
    """
    ค้นหาและจับคู่ mask กับไฟล์ต้นแบบที่ตรงที่สุดโดยอัตโนมัติ (Zero-Shot Template Matching)
    1. Fast Coarse Scan (~0.4s) เพื่อคัดเลือกลำดับต้นแบบที่มีแนวโน้มตรงที่สุด
    2. รัน Full Alignment & ECC บนต้นแบบที่เลือกเพื่อความแม่นยำสูงสุด
    คืน (best_name, best_align_result, best_design_obj)
    """
    m = (mask > 0).astype(np.uint8) if not isinstance(mask, np.ndarray) else mask
    T = _main_copper(m)
    hullT = _hull_area(T)
    
    # 1. Fast Coarse Scan
    coarse_scores = {}
    for name, des in designs_dict.items():
        pol, dm = des["variants"][0]
        Dc = to_canon(dm, 256)
        s0 = math.sqrt(hullT / _hull_area(Dc))
        Hd, Wd = dm.shape
        ar_d = Wd / Hd
        ar_options = [1.0]
        if abs(ar_d - 1.0) > 0.08:
            ar_options.extend([ar_d, 1.0 / ar_d])
        r = _coarse_search(Dc, T, s0, angle_step=12.0, scale_factors=(1.0,), flips=(True, False),
                           coarse_long=80, aspect_ratios=ar_options)
        coarse_scores[name] = r[0]["score"] if r else 0.0
        
    sorted_candidates = sorted(coarse_scores.keys(), key=lambda k: -coarse_scores[k])
    
    best_name = None
    best_al = None
    best_des = None
    best_score = -1.0
    for name in sorted_candidates:
        des = designs_dict[name]
        al = align(des, m, **align_kw)
        if al["score"] > best_score:
            best_score = al["score"]
            best_name = name
            best_al = al
            best_des = des
        if best_score >= align_kw.get("good_enough", 0.92):
            break
            
    return best_name, best_al, best_des


def fast_pcb_similarity(mask, design, canon_size=192, iters=8, threshold=0.75):
    """
    วัดความเหมือน/ความต่างของแผ่น PCB กับแบบต้นแบบอย่างรวดเร็วระดับ Real-Time (~60ms)
    ใช้สำหรับคัดแยกชิ้นงานเบื้องต้นเพื่อควบคุม Servo ทันที ก่อนเข้าสู่งานวิเคราะห์ Open/Short
    คืนค่า: (is_same_board: bool, similarity_score: float, elapsed_seconds: float)
    """
    t0 = time.time()
    if not isinstance(design, dict):
        design = load_design(design)
    m = (mask > 0).astype(np.uint8) if not isinstance(mask, np.ndarray) else (mask > 0).astype(np.uint8)
    T = _main_copper(m)
    hullT = _hull_area(T)
    if hullT < 100:
        return False, 0.0, float(time.time() - t0)

    best_sc = 0.0
    # รางสายพานกำหนดแนวของบอร์ดเป็นหลักที่ 0, 90, 180, 270 องศา (เผื่อการเอียงเล็กน้อย +/- 8 องศา)
    test_angles = [-8, -4, 0, 4, 8, 172, 176, 180, 184, 188, 82, 86, 90, 94, 98, 262, 266, 270, 274, 278]
    angle_jobs = [(f, a) for f in [False, True] for a in test_angles]

    for pol, dm in design.get("variants", []):
        Dc = to_canon(dm, canon_size)
        area_ratio = hullT / max(1, _hull_area(Dc))
        if area_ratio < 0.15 or area_ratio > 7.0:
            continue
        s0 = math.sqrt(area_ratio)
        cands = _coarse_search(Dc, T, s0, angles=angle_jobs, scale_factors=(1.0,), flips=(True, False), coarse_long=64)
        if not cands:
            continue
        c = cands[0]
        A1, _ = _ecc(Dc, T, c["A"], cv2.MOTION_AFFINE, sigma_c=2.0, iters=iters)
        A = A1 if A1 is not None and _sane(c["A"], A1, Dc.shape) else c["A"]
        sc = align_quality(Dc, warp_mask_to_canon(T, A, Dc.shape))
        if sc > best_sc:
            best_sc = sc
        if best_sc >= 0.80:
            break

    elapsed = time.time() - t0
    is_same = bool(best_sc >= threshold)
    return is_same, float(best_sc), float(elapsed)


# ---------------------------------------------------------------------------------------
# ฟังก์ชันหลัก: ตรวจ 1 แผ่น
# ---------------------------------------------------------------------------------------
def inspect(mask, design, classifier=None, photo=None, mask_thr=64, copper="auto", align_kw=None,
            tol=None, min_prob=0.0, design_blur=0.6, min_align=0.8, critical_thr=None):
    """
    mask   : mask ทองแดงจากโมเดล (path / ภาพ gray / probability) — ขาว = ทองแดง
    design : ไฟล์ต้นแบบ (path / ภาพ / dict จาก load_design / หรือ dict ของหลายต้นแบบ)
             หากส่ง dict ของหลายต้นแบบ เช่น DESIGNS ระบบจะค้นหาต้นแบบที่ตรงที่สุดให้อัตโนมัติ!
    photo  : (ไม่บังคับ) ภาพถ่ายต้นฉบับกรอบเดียวกับ mask ใช้แสดงผล
    design_blur : เบลอ design ที่ย่อแล้ว (หน่วย px ของ mask) — None = เทียบกับ design ความละเอียดเต็ม
    min_align   : คะแนนซ้อนต่ำกว่านี้ → verdict = NO_MATCH
    critical_thr: (ไม่บังคับ) ถ้า P(open) หรือ P(short) ≥ ค่านี้ ให้ตอบคลาสนั้น เช่น 0.3 = ไวขึ้น แต่ false alarm มากขึ้น
    คืน result (dict, พร้อมแปลงเป็น JSON ด้วย result_to_json) และ ctx (ข้อมูลกลางทาง)
    """
    t0 = time.time()
    m = load_mask(mask, mask_thr) if not (isinstance(mask, np.ndarray) and mask.dtype == np.uint8 and mask.max() <= 1) else mask
    
    # หาก design เป็น dict ที่เก็บหลายต้นแบบ ให้ค้นหาต้นแบบที่ตรงที่สุดโดยอัตโนมัติ
    matched_design_name = None
    if isinstance(design, dict) and "variants" not in design:
        matched_design_name, al, design = match_best_design(m, design, **(align_kw or {}))
    else:
        if not isinstance(design, dict):
            design = load_design(design, copper=copper)
        al = align(design, m, **(align_kw or {}))

    # ป้องกันกรณี Mask กลับขั้ว (Inverted Mask เช่น ถ่ายแบบ Frontlit หรือโมเดลสกัดสับสน):
    # ถ้าคะแนนต่ำกว่า min_align ให้ลองตรวจสอบด้วย inverted mask ทันที
    if al["score"] < min_align:
        m_inv = (1 - m).astype(np.uint8)
        if isinstance(design, dict) and "variants" not in design:
            name_inv, al_inv, des_inv = match_best_design(m_inv, design, **(align_kw or {}))
        else:
            name_inv = matched_design_name
            des_inv = design
            al_inv = align(design, m_inv, **(align_kw or {}))
        if al_inv["score"] > al["score"]:
            m = m_inv
            al = al_inv
            design = des_inv
            matched_design_name = name_inv
        
    s_test = math.sqrt(abs(np.linalg.det(al["A"][:2, :2] / al["A"][2, 2])))
    D_eff, _ = design_as_seen(al["D"], al["A"], m.shape, blur=design_blur) if design_blur is not None else (al["D"], None)
    cmp_ = Comparator(D_eff, al["Tc"], al["score"], tol=tol, px=1.0 / s_test, D_hi=al["D"])
    cands = cmp_.candidates()
    X, F = [], []
    for c in cands:
        x, f = cmp_.features(c)
        X.append(x)
        F.append(f)
    clf = classifier or DefectClassifier()
    defects = []
    if cands:
        labs, P, cls = clf.predict(np.array(X), F, critical_thr=critical_thr)
        H_c, W_c = cmp_.D.shape
        b_c = cmp_.tol
        for c, x, f, lab, p in zip(cands, X, F, labs, P):
            prob = float(p[cls.index(lab)]) if lab in cls else float(p.max())
            bx, by, bw, bh = c["bbox"]
            pts = np.array([[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], np.float64)
            pm = cv2.perspectiveTransform(pts[None], al["A"])[0]

            # ตรวจสอบความถูกต้องทางกายภาพเพื่อตัด False Alarm
            final_lab = lab
            if f.get("is_non_circuit", 0) > 0.5:
                final_lab = "normal"
            elif (bx <= 30 or bx + bw >= W_c - 70) or (by <= 24 or by + bh >= H_c - 28):
                final_lab = "normal"
            elif f.get("near_border", 10.0) < 1.5 and f.get("split_local", 0) == 0:
                final_lab = "normal"
            elif final_lab == "short":
                has_true_short = (f.get("nets_bridged_local", 0) >= 2 and f.get("extra_touch_nets", 0) >= 2)
                if not has_true_short:
                    final_lab = "minor" if (f.get("area_extra", 0) >= 1.2 and f.get("extra_width_max", 0) >= 0.8) else "normal"
            elif final_lab == "open":
                is_true_open = (
                    f.get("split_local", 0) >= 1 or
                    (f.get("split_global", 0) >= 1 and f.get("miss_skel_len", 0) >= 0.8 and f.get("width_min", 1.0) == 0.0)
                )
                if not is_true_open:
                    final_lab = "normal"
            elif final_lab == "minor":
                if not (f.get("area_extra", 0) >= 1.2 and f.get("extra_width_max", 0) >= 0.8):
                    final_lab = "normal"

            defects.append(dict(cls=str(final_lab), prob=round(prob, 3),
                                probs={str(k): round(float(v), 3) for k, v in zip(cls, p)},
                                rule=rule_predict(f), bbox=c["bbox"], poly_mask=pm.round(1).tolist(),
                                features={k: round(float(v), 4) for k, v in f.items()},
                                _x=x, _region=c["region"]))
    real = [d for d in defects if d["cls"] != "normal" and d["prob"] >= min_prob]
    counts = {k: sum(d["cls"] == k for d in defects) for k in CLASSES}
    verdict = "FAIL" if (counts.get("open", 0) + counts.get("short", 0)) else ("WARN" if counts.get("minor", 0) else "PASS")
    warn = []
    if al["score"] < min_align:
        verdict = "NO_MATCH"
        warn.append(f"ALIGN_LOW: ลายซ้อนกันได้น้อย (คะแนน {al['score']:.2f} < {min_align}) — อาจเป็นคนละลาย, ผิดด้าน (top/bottom), "
                    f"หรือ mask ไม่ดี → ผลตำหนิเชื่อถือไม่ได้")
    tw_test = cmp_.tw / cmp_.px                                   # ความกว้างเส้นใน px ของ mask
    unresolved = float((cmp_.uncertain & cmp_.valid).sum() / max(1, cmp_.valid.sum()))
    if tw_test < 3.0 or unresolved > 0.08:
        why = []
        if tw_test < 3.0:
            why.append(f"เส้นลายกว้างเพียง {tw_test:.1f} px ใน mask (ควร ≥ 4 px)")
        if unresolved > 0.08:
            why.append(f"{unresolved * 100:.0f}% ของบอร์ดมีช่องว่าง/ลายที่แคบเกินกว่าจะตรวจ open/short ได้ (ควร < 8%)")
        warn.append("LOW_RES: " + " และ ".join(why) + " — ควรใช้ mask ความละเอียดสูงขึ้น")
    result = dict(verdict=verdict, matched_design=matched_design_name, counts=counts, n_candidates=len(defects),
                  align=dict(score=round(al["score"], 4), angle=al["angle"], mirrored=al["mirrored"],
                             scale=al["scale"], polarity=al["polarity"], time_s=al["time_s"]),
                  trace_width_px=round(cmp_.tw, 2), trace_width_mask_px=round(tw_test, 2), tol_px=cmp_.tol,
                  unresolved_frac=round(unresolved, 4), canon_size=list(al["D"].shape[::-1]),
                  model="rf" if clf.model is not None else "rule", warnings=warn,
                  defects=defects, time_s=round(time.time() - t0, 3))
    ctx = dict(align=al, cmp=cmp_, mask=m, photo=photo, design_name=matched_design_name)
    return result, ctx


def result_to_json(result):
    out = dict(result)
    out["defects"] = [{k: v for k, v in d.items() if not k.startswith("_")} for d in result["defects"]]
    return out




# ---------------------------------------------------------------------------------------
# วาดผล
# ---------------------------------------------------------------------------------------
def draw_canon(result, ctx, show_normal=False):
    """ภาพเทียบในกรอบ design: เขียว=ตรงกัน, แดง=ต้นแบบมีแต่ของจริงหาย, ฟ้า=ของจริงมีเกิน"""
    cm = ctx["cmp"]
    D, T = cm.D > 0, cm.T > 0
    vis = np.full(D.shape + (3,), 30, np.uint8)
    vis[D & T] = (0, 150, 0)
    vis[D & ~T] = (0, 0, 220)
    vis[~D & T] = (220, 160, 0)
    vis = cv2.resize(vis, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_NEAREST)
    for i, d in enumerate(result["defects"]):
        if d["cls"] == "normal" and not show_normal:
            continue
        x, y, w, h = [int(round(v * 1.5)) for v in d["bbox"]]
        c = CLASS_COLORS[d["cls"]]
        cv2.rectangle(vis, (x - 4, y - 4), (x + w + 4, y + h + 4), c, 2)
        cv2.putText(vis, f"{i}:{d['cls']} {d['prob']:.2f}", (x - 4, max(12, y - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, c, 1, cv2.LINE_AA)
    return vis


def draw_on_mask(result, ctx, show_normal=False, scale=3):
    """วาดกรอบตำหนิกลับไปบนภาพต้นฉบับ (photo ถ้ามี ไม่งั้น mask) — ทิศทางเดิมของกล้อง"""
    photo = ctx.get("photo")
    m = ctx["mask"]
    if photo is not None:
        base = photo if photo.ndim == 3 else cv2.cvtColor(photo, cv2.COLOR_GRAY2BGR)
        sx, sy = base.shape[1] / m.shape[1], base.shape[0] / m.shape[0]
    else:
        base = cv2.cvtColor((m * 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)
        sx = sy = 1.0
    s = scale if max(base.shape[:2]) < 700 else 1
    vis = cv2.resize(base, None, fx=s, fy=s, interpolation=cv2.INTER_NEAREST)
    # เส้นลายต้นแบบ (ขอบ) ทับบนภาพ
    D = ctx["cmp"].D
    Dm = cv2.warpPerspective(D, ctx["align"]["A"], (m.shape[1], m.shape[0]), flags=cv2.INTER_NEAREST)
    Dm = cv2.resize(Dm, (vis.shape[1], vis.shape[0]), interpolation=cv2.INTER_NEAREST)
    edge = Dm - cv2.erode(Dm, np.ones((3, 3), np.uint8))
    vis[edge > 0] = (0, 255, 255)
    for i, d in enumerate(result["defects"]):
        if d["cls"] == "normal" and not show_normal:
            continue
        p = np.array(d["poly_mask"]) * [sx * s, sy * s]
        c = CLASS_COLORS[d["cls"]]
        cv2.polylines(vis, [p.astype(np.int32)], True, c, 2)
        cv2.putText(vis, f"{i}:{d['cls']}", tuple(p.min(0).astype(int) + [0, -4]),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, c, 1, cv2.LINE_AA)
    cv2.putText(vis, result["verdict"], (8, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.8,
                {"FAIL": (0, 0, 255), "WARN": (0, 200, 255), "PASS": (0, 200, 0)}.get(result["verdict"], (255, 0, 255)), 2)
    return vis


def get_aligned_photo(ctx):
    """
    คืนภาพถ่ายชิ้นงานจริงที่ถูก 'หมุน เลื่อน ปรับสเกล และดัด Perspective' 
    (Warp to Canon) ให้เข้าสู่ระนาบและทิศทางเดียวกับภาพต้นแบบ (Template) พอดิบพอดี 100%
    """
    photo = ctx.get("photo")
    al = ctx.get("align")
    if photo is None or al is None:
        return None
    A = al["A"]
    canon_shape = al["D"].shape
    return warp_to_canon(photo, A, canon_shape)


def draw_aligned(result, ctx, show_normal=False, show_edge=True):
    """
    วาดผลการตรวจสอบลงบนภาพชิ้นงานจริงที่ถูก 'หมุนและเลื่อน' ให้ตรงกับทิศทางของ Template พอดิบพอดี:
    - ภาพถ่ายจริงจากกล้องจะถูกหมุน 90°/180°/270°, พลิกด้าน (Un-mirror), และเลื่อนตำแหน่งตรงกับกรอบ Template
    - ขอบเส้นลายต้นแบบสีเหลืองจะทับลงบนลายทองแดงจริง เพื่อยืนยันว่าจัดตำแหน่งตรง 100%
    - ตีกรอบ Defect (Open=แดง, Short=ส้ม, Minor=เหลือง) ในทิศทางเดียวกับ Template สะดวกต่อการดูเทียบ 1:1
    """
    cm = ctx["cmp"]
    D = cm.D
    photo = ctx.get("photo")
    al = ctx.get("align")
    A = al["A"]
    canon_shape = D.shape

    if photo is not None:
        base = warp_to_canon(photo, A, canon_shape)
        if base.ndim == 2:
            base = cv2.cvtColor(base, cv2.COLOR_GRAY2BGR)
    else:
        Tc = al["Tc"]
        base = cv2.cvtColor((Tc * 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)

    vis = base.copy()

    # แสดงเส้นขอบของ Design สีเหลือง เพื่อเช็คความแม่นยำของการซ้อนทับ (Alignment)
    if show_edge:
        edge = D - cv2.erode(D, np.ones((3, 3), np.uint8))
        vis[edge > 0] = (0, 255, 255)

    # วาดกรอบตำหนิ
    for i, d in enumerate(result["defects"]):
        if d["cls"] == "normal" and not show_normal:
            continue
        x, y, w, h = [int(round(v)) for v in d["bbox"]]
        c = CLASS_COLORS.get(d["cls"], (255, 255, 255))
        cv2.rectangle(vis, (x - 3, y - 3), (x + w + 3, y + h + 3), c, 2)
        cv2.putText(vis, f"{i}:{d['cls']} {d['prob']:.2f}", (x - 3, max(14, y - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, c, 1, cv2.LINE_AA)

    # ข้อความ Verdict สรุป
    verdict_colors = {"PASS": (0, 200, 0), "WARN": (0, 200, 255), "FAIL": (0, 0, 255), "NO_MATCH": (180, 180, 180)}
    v_col = verdict_colors.get(result.get("verdict"), (255, 0, 255))
    cv2.putText(vis, f"{result['verdict']} (Score: {al['score']:.2f}, Rot: {al['angle']} deg)",
                (10, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.75, v_col, 2, cv2.LINE_AA)
    return vis


def manual_adjust_alignment(ctx, dx=0.0, dy=0.0, d_angle=0.0, d_scale=1.0):
    """
    ฟังก์ชันสำหรับ 'เลื่อน ปรับ' (Manual / Fine-tune Alignment):
    - dx, dy: เลื่อนแกน X, Y (พิกเซล)
    - d_angle: หมุนปรับองศาเพิ่มเติม (degree)
    - d_scale: ปรับอัตราขยายย่อ/ขยาย
    ช่วยให้ปรับแก้ตำแหน่งการทาบของบอร์ดได้ละเอียดระดับพิกเซล
    """
    al = ctx["align"].copy()
    A = al["A"].copy()
    Hc, Wc = al["D"].shape
    cx, cy = (Wc - 1) / 2.0, (Hc - 1) / 2.0
    rad = math.radians(d_angle)
    cos_a, sin_a = math.cos(rad), math.sin(rad)

    T_shift = np.array([[1, 0, -dx], [0, 1, -dy], [0, 0, 1]], dtype=np.float64)
    T_c1 = np.array([[1, 0, -cx], [0, 1, -cy], [0, 0, 1]], dtype=np.float64)
    R_s = np.array([[d_scale * cos_a, -d_scale * sin_a, 0],
                    [d_scale * sin_a,  d_scale * cos_a, 0],
                    [0, 0, 1]], dtype=np.float64)
    T_c2 = np.array([[1, 0, cx], [0, 1, cy], [0, 0, 1]], dtype=np.float64)

    M_canon = T_c2 @ R_s @ T_c1 @ T_shift
    A_new = A @ np.linalg.inv(M_canon)
    al["A"] = A_new
    al["Tc"] = warp_mask_to_canon(ctx["mask"], A_new, al["D"].shape)
    al["score"] = align_quality(al["D"], al["Tc"])
    ctx["align"] = al
    return al


def candidate_crop(ctx, d, size=96):
    """ภาพตัวอย่าง 3 ช่อง (ต้นแบบ | mask จริง | ความต่าง) ของจุดหนึ่ง สำหรับหน้าจอ label"""
    cm = ctx["cmp"]
    x, y, w, h = d["bbox"]
    tw = cm.tw
    half = int(max(w, h) / 2 + 2.5 * tw)
    cx, cy = x + w // 2, y + h // 2
    H, W = cm.D.shape

    def crop(img):
        P = cv2.copyMakeBorder(img, half, half, half, half, cv2.BORDER_CONSTANT, value=0)
        c = P[cy:cy + 2 * half, cx:cx + 2 * half]
        return cv2.resize(c, (size, size), interpolation=cv2.INTER_NEAREST)

    Dc = crop(cm.D * 255)
    Tc = crop(cm.T * 255)
    diff = np.zeros((size, size, 3), np.uint8)
    Db, Tb = Dc > 0, Tc > 0
    diff[Db & Tb] = (0, 150, 0)
    diff[Db & ~Tb] = (0, 0, 230)
    diff[~Db & Tb] = (230, 160, 0)
    reg = crop(d["_region"] * 255) > 0
    edge = reg & ~(cv2.erode(reg.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    diff[edge] = (255, 255, 255)
    g = lambda a: cv2.cvtColor(a, cv2.COLOR_GRAY2BGR)
    sep = np.full((size, 3, 3), 255, np.uint8)
    return np.hstack([g(Dc), sep, g(Tc), sep, diff])



# ---------------------------------------------------------------------------------------
# ชุดข้อมูลสำหรับ label เอง (active learning)
#   save_candidates → โฟลเดอร์ label_data/  (crops/*.png + candidates.jsonl)
#   set_label        → labels.csv  (id,label)
#   load_labeled     → X, y สำหรับเทรน
# ---------------------------------------------------------------------------------------
def save_candidates(result, ctx, out_dir="label_data", source="board", include_normal=True, context=True, min_align=0.8):
    # ป้องกันการบันทึกภาพตำหนิจากบอร์ดที่ align ไม่ผ่านหรือจับคู่ผิดแบบ
    if result.get("verdict") == "NO_MATCH" or result.get("align", {}).get("score", 1.0) < min_align:
        return []
    os.makedirs(os.path.join(out_dir, "crops"), exist_ok=True)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    ids = []
    board_vis = draw_canon(result, ctx, show_normal=True) if context else None
    with open(os.path.join(out_dir, "candidates.jsonl"), "a", encoding="utf-8") as fp:
        for i, d in enumerate(result["defects"]):
            if d["cls"] == "normal" and not include_normal:
                continue
            cid = f"{source}_{stamp}_{i:03d}"
            crop = candidate_crop(ctx, d, 128)
            if board_vis is not None:
                bv = board_vis.copy()
                x, y, w, h = [int(round(v * 1.5)) for v in d["bbox"]]
                cv2.rectangle(bv, (x - 8, y - 8), (x + w + 8, y + h + 8), (255, 255, 255), 3)
                s_ = 128 * 2 / bv.shape[0]
                bv = cv2.resize(bv, None, fx=s_, fy=s_, interpolation=cv2.INTER_AREA)
                top = np.zeros((bv.shape[0], max(bv.shape[1], crop.shape[1] * 1), 3), np.uint8)
                crop_big = cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_NEAREST)
                sheet = np.hstack([crop_big, np.full((crop_big.shape[0], 6, 3), 255, np.uint8),
                                   cv2.resize(bv, (int(bv.shape[1] * crop_big.shape[0] / bv.shape[0]), crop_big.shape[0]))])
            else:
                sheet = cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_NEAREST)
            cv2.imwrite(os.path.join(out_dir, "crops", cid + ".png"), sheet)
            rec = dict(id=cid, source=source, pred=d["cls"], prob=d["prob"], rule=d["rule"], bbox=d["bbox"],
                       x=[float(v) for v in d["_x"]], feature_names=FEATURE_NAMES)
            fp.write(json.dumps(rec, ensure_ascii=False) + "\n")
            ids.append(cid)
    return ids


def read_candidates(out_dir="label_data"):
    p = os.path.join(out_dir, "candidates.jsonl")
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8") as fp:
        return [json.loads(l) for l in fp if l.strip()]


def read_labels(out_dir="label_data"):
    p = os.path.join(out_dir, "labels.csv")
    lab = {}
    if os.path.exists(p):
        with open(p, encoding="utf-8") as fp:
            for line in fp:
                line = line.strip()
                if line and not line.startswith("id,"):
                    k, v = line.split(",", 1)
                    lab[k] = v
    return lab


def set_label(cid, label, out_dir="label_data"):
    """บันทึก label (ถ้าเคย label แล้วจะเขียนทับ); label = 'skip' เพื่อข้าม, '' เพื่อลบ"""
    lab = read_labels(out_dir)
    if label:
        lab[cid] = label
    else:
        lab.pop(cid, None)
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "labels.csv"), "w", encoding="utf-8") as fp:
        fp.write("id,label\n")
        for k, v in lab.items():
            fp.write(f"{k},{v}\n")


def load_labeled(out_dir="label_data", classes=None):
    classes = classes or CLASSES
    lab = read_labels(out_dir)
    X, y, ids = [], [], []
    for r in read_candidates(out_dir):
        l = lab.get(r["id"])
        if l in classes and r.get("feature_names") == FEATURE_NAMES:
            X.append(r["x"])
            y.append(l)
            ids.append(r["id"])
    return np.array(X, np.float32).reshape(-1, len(FEATURE_NAMES)), np.array(y), ids
