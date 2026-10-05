# ==========================================================
# pcb_core.py  —  PCB copper inspection core (ใช้ได้ทั้งใน notebook และ FastAPI บน Raspberry Pi 5)
# ส่วนที่ 1: ยูทิลิตี้ + ค้นหาบอร์ดในภาพ + ดัดภาพให้ตรง (perspective warp)
# ==========================================================
import os
import json
import cv2
import numpy as np
from skimage.morphology import skeletonize

# ค่ามาตรฐานของภาพที่เข้าโมเดล (ต้องตรงกันทั้งตอนเทรนและตอนใช้งาน)
NORM_MEAN = 0.5
NORM_STD = 0.25
BOARD_LONG_SIDE = 640          # ความยาวด้านยาวของบอร์ดหลังดัดภาพ (px) — ยิ่งมาก เส้นยิ่งละเอียด แต่ช้าลง


def disk(r):
    r = int(r)
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def dil(m, r):
    return cv2.dilate(m, disk(r)) if r > 0 else m.copy()


def ero(m, r):
    return cv2.erode(m, disk(r)) if r > 0 else m.copy()


def remove_small(mask01, min_area):
    """ลบก้อนเล็กกว่า min_area pixel (mask เป็น 0/1 uint8)"""
    if min_area <= 0:
        return mask01
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask01.astype(np.uint8), connectivity=8)
    keep = np.zeros(n, np.uint8)
    keep[1:] = (st[1:, cv2.CC_STAT_AREA] >= min_area)
    return keep[lab]


def fill_small_holes(mask01, max_hole):
    """เติมรูเล็กๆ ในทองแดง (เช่น จุดสะท้อนแสง) ที่เล็กกว่า max_hole pixel"""
    inv = (1 - mask01).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    small = np.zeros(n, bool)
    small[1:] = st[1:, cv2.CC_STAT_AREA] < max_hole
    out = mask01.copy()
    out[small[lab]] = 1
    return out


def order_quad(pts):
    """เรียงมุม 4 จุดเป็น tl, tr, br, bl"""
    pts = np.asarray(pts, np.float32).reshape(4, 2)
    s = pts.sum(1)
    d = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)],
                     pts[np.argmax(s)], pts[np.argmax(d)]], np.float32)


def find_boards(img_bgr, sat_min=30, val_min=40, min_area_ratio=0.01, rect_min=0.75):
    """
    หาบอร์ด PCB ทุกแผ่นในภาพจากกล้อง (รองรับทั้งไฟส่องทะลุ Backlit และไฟส่องตรง Frontlit)
    คืนค่า list ของ dict {quad, area, rectangularity, center} เรียงจากบนลงล่าง
    """
    h, w = img_bgr.shape[:2]
    b, g, r = cv2.split(img_bgr)
    diff_rb = r.astype(int) - b.astype(int)
    diff_gb = g.astype(int) - b.astype(int)
    hsv = cv2.cvtColor(cv2.GaussianBlur(img_bgr, (5, 5), 0), cv2.COLOR_BGR2HSV)
    H, S, V = cv2.split(hsv)

    is_sub_backlit = (H >= 17) & (H <= 43) & (S >= 35) & (V >= 70) & (diff_gb > 15) & (diff_rb > 20)
    is_frontlit = ((H <= 45) | (H >= 165)) & (S >= 35) & (V >= 50) & (diff_rb > 20)
    board_seed = (is_sub_backlit | is_frontlit).astype(np.uint8) * 255

    board_seed = cv2.morphologyEx(board_seed, cv2.MORPH_OPEN, disk(2))
    k = max(21, int(round(min(h, w) * 0.08))) | 1
    m = cv2.morphologyEx(board_seed, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (k, k)))

    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boards = []
    for c in cnts:
        hull = cv2.convexHull(c)
        area = cv2.contourArea(hull)
        if area < min_area_ratio * h * w:
            continue
        rect = cv2.minAreaRect(hull)
        rw, rh = rect[1]
        if rw * rh == 0:
            continue
        rectangularity = area / (rw * rh)
        if rectangularity < rect_min:
            continue
        peri = cv2.arcLength(hull, True)
        approx = cv2.approxPolyDP(hull, 0.03 * peri, True)
        quad = approx.reshape(-1, 2) if len(approx) == 4 else cv2.boxPoints(rect)
        boards.append(dict(quad=order_quad(quad), area=float(area),
                           rectangularity=float(rectangularity), center=rect[0]))
    boards.sort(key=lambda b: (round(b["center"][1] / (h * 0.1)), b["center"][0]))
    return boards


def quad_size(quad):
    tl, tr, br, bl = order_quad(quad)
    w = (np.linalg.norm(tr - tl) + np.linalg.norm(br - bl)) / 2
    h = (np.linalg.norm(bl - tl) + np.linalg.norm(br - tr)) / 2
    return w, h


def warp_board(img_bgr, quad, out_size=None, long_side=BOARD_LONG_SIDE):
    """ดัดภาพบอร์ดให้เป็นสี่เหลี่ยมตรง out_size=(W,H) — ถ้าไม่ระบุจะคงอัตราส่วนจริงของบอร์ด"""
    quad = order_quad(quad)
    if out_size is None:
        w, h = quad_size(quad)
        s = long_side / max(w, h)
        out_size = (int(round(w * s)) // 2 * 2, int(round(h * s)) // 2 * 2)
    W, H = out_size
    dst = np.float32([[0, 0], [W - 1, 0], [W - 1, H - 1], [0, H - 1]])
    M = cv2.getPerspectiveTransform(quad, dst)
    warped = cv2.warpPerspective(img_bgr, M, (W, H), flags=cv2.INTER_LINEAR,
                                 borderMode=cv2.BORDER_REPLICATE)
    return warped, M


def sharpness(img_bgr):
    """ความคมของภาพ (variance of Laplacian) — ใช้เลือกเฟรมที่เบลอน้อยที่สุด"""
    g = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(g, cv2.CV_64F).var())


def pick_sharpest(frames):
    scores = [sharpness(f) for f in frames]
    i = int(np.argmax(scores))
    return frames[i], i, scores


# ==========================================================
# ส่วนที่ 2: แยกทองแดง (segmentation)
#   - classical_copper_mask : วิธีสีแบบทนแสง (ใช้สร้าง pseudo-label และเป็น fallback)
#   - CopperSegmenter      : ใช้โมเดล CNN (ONNX) ที่เทรนแล้ว
# ==========================================================
def classical_copper_mask(board_bgr, min_area=10, return_label=False, return_thr=False):
    """
    แยกทองแดงอัตโนมัติ รองรับทั้งไฟส่องทะลุ (Backlit) และไฟส่องตรง (Frontlit):
    - แยกขอบเขตแผ่นบอร์ดออกจากฉากหลัง 100%
    - ดึงลายทองแดง (Copper Traces, Pads, Ground Pour) คมชัด
    - return_label=True → คืน label 3 ระดับสำหรับเทรน: 255=ทองแดง, 0=พื้น, 128=เส้นขอบรอยต่อ
    """
    h, w = board_bgr.shape[:2]
    b, g, r = cv2.split(board_bgr)
    diff_rb = r.astype(int) - b.astype(int)
    diff_gb = g.astype(int) - b.astype(int)
    hsv = cv2.cvtColor(board_bgr, cv2.COLOR_BGR2HSV)
    H, S, V = cv2.split(hsv)

    # 1. ขอบเขตบอร์ด (ตัดพื้นหลังออก)
    is_yellow_sub = (H >= 17) & (H <= 43) & (S >= 40) & (V >= 80) & (diff_gb > 20) & (diff_rb > 25)
    sub_u8 = (is_yellow_sub.astype(np.uint8)) * 255
    sub_cleaned = cv2.morphologyEx(sub_u8, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    k = max(15, int(round(min(h, w) * 0.08))) | 1
    board_closed = cv2.morphologyEx(sub_cleaned, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (k, k)))

    cnts, _ = cv2.findContours(board_closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    board_mask = np.zeros((h, w), dtype=np.uint8)
    if cnts:
        c = max(cnts, key=cv2.contourArea)
        if cv2.contourArea(c) > 0.05 * h * w:
            hull = cv2.convexHull(c)
            cv2.fillPoly(board_mask, [hull], 255)
            board_mask = cv2.erode(board_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
        else:
            board_mask[:] = 255
    else:
        board_mask[:] = 255

    sub_pixels = is_yellow_sub & (board_mask > 0)
    is_backlit = sub_pixels.sum() > (0.08 * max(1, board_mask.sum() // 255))

    gray = cv2.cvtColor(board_bgr, cv2.COLOR_BGR2GRAY)
    filtered = cv2.bilateralFilter(gray, 7, 50, 7)

    if is_backlit:
        board_pix = filtered[board_mask > 0]
        if len(board_pix) > 50:
            t_otsu, _ = cv2.threshold(board_pix, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            t_val = float(max(60, min(t_otsu - 12, 115)))
        else:
            t_val = 110.0
        copper_raw = (filtered < t_val) & (board_mask > 0)
    else:
        red_diff = np.clip(r.astype(int) - b.astype(int), 0, 255).astype(np.uint8)
        board_pix = red_diff[board_mask > 0]
        if len(board_pix) > 50:
            t_otsu, _ = cv2.threshold(board_pix, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            t_val = float(max(30, t_otsu))
        else:
            t_val = 40.0
        copper_raw = (red_diff > t_val) & (board_mask > 0)

    m = cv2.medianBlur(copper_raw.astype(np.uint8) * 255, 3) // 255

    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    keep = np.zeros(n, np.uint8)
    keep[1:] = (st[1:, cv2.CC_STAT_AREA] >= min_area)
    m_clean = keep[lab]

    out = (m_clean * 255).astype(np.uint8)
    if return_label:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        edge = cv2.dilate(m_clean, kernel) != cv2.erode(m_clean, kernel)
        out = out.copy()
        out[edge] = 128
        out[board_mask == 0] = 0

    if return_thr:
        return out, t_val
    return out


def preprocess(img_bgr):
    """BGR uint8 (H,W,3) → float32 (3,H,W) normalized  — ใช้ทั้งตอนเทรนและ inference"""
    x = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    x = (x - NORM_MEAN) / NORM_STD
    return np.ascontiguousarray(x.transpose(2, 0, 1))


def pad_to_multiple(img, m=32):
    h, w = img.shape[:2]
    ph, pw = (-h) % m, (-w) % m
    if ph or pw:
        img = cv2.copyMakeBorder(img, 0, ph, 0, pw, cv2.BORDER_REFLECT_101)
    return img, (h, w)


class CopperSegmenter:
    """
    ตัวแยกทองแดง: ถ้ามีไฟล์ ONNX จะใช้ CNN, ถ้าไม่มีจะใช้ classical_copper_mask แทน
    """

    def __init__(self, onnx_path=None, threshold=0.5, tta=True, threads=4, min_area=20):
        self.threshold = threshold
        self.tta = tta
        self.min_area = min_area
        self.sess = None
        if onnx_path and os.path.exists(onnx_path):
            import onnxruntime as ort
            so = ort.SessionOptions()
            so.intra_op_num_threads = threads
            so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            self.sess = ort.InferenceSession(onnx_path, so, providers=["CPUExecutionProvider"])
            self.inp = self.sess.get_inputs()[0].name
        self.mode = "cnn" if self.sess else "classical"

    def _run(self, img):
        x = preprocess(img)[None]
        logit = self.sess.run(None, {self.inp: x})[0][0, 0]
        return 1.0 / (1.0 + np.exp(-logit))

    def predict_prob(self, board_bgr):
        if self.sess is None:
            return classical_copper_mask(board_bgr).astype(np.float32) / 255.0
        img, (h, w) = pad_to_multiple(board_bgr, 32)
        p = self._run(img)
        if self.tta:
            p = (p + self._run(img[:, ::-1].copy())[:, ::-1]) / 2
        return p[:h, :w]

    def predict_mask(self, board_bgr):
        p = self.predict_prob(board_bgr)
        m = (p >= self.threshold).astype(np.uint8)
        m = remove_small(m, self.min_area)
        m = fill_small_holes(m, max(4, self.min_area // 2))
        return m * 255


# ==========================================================
# ส่วนที่ 3: จัดตำแหน่งภาพทดสอบให้ตรงกับต้นแบบ (alignment)
#   1) หมุน 0/90/180/270 เลือกอันที่ซ้อนทับได้ดีที่สุด (บอร์ดอาจวางกลับด้านบนสายพาน)
#   2) ECC affine ละเอียดระดับ sub-pixel บน mask ที่เบลอแล้ว
# ==========================================================
def mask_iou(a, b, r=0):
    a = dil((a > 127).astype(np.uint8), r)
    b = dil((b > 127).astype(np.uint8), r)
    inter = np.logical_and(a, b).sum()
    uni = np.logical_or(a, b).sum()
    return float(inter) / max(1, uni)


def best_rotation(golden_mask, test_board, test_mask):
    """คืน (board, mask, k, score) ที่หมุน k*90° แล้วตรงกับต้นแบบที่สุด"""
    H, W = golden_mask.shape[:2]
    best = None
    for k in range(4):
        m = np.rot90(test_mask, k)
        if m.shape[:2] != (H, W):
            if k % 2 == 1 and abs(H - W) <= 0.05 * max(H, W):
                m = cv2.resize(np.ascontiguousarray(m), (W, H), interpolation=cv2.INTER_NEAREST)
            else:
                continue
        s = mask_iou(golden_mask, m, r=2)
        if best is None or s > best[3]:
            b = np.rot90(test_board, k)
            if b.shape[:2] != (H, W):
                b = cv2.resize(np.ascontiguousarray(b), (W, H))
            best = (np.ascontiguousarray(b), np.ascontiguousarray(m), k, s)
    return best


def refine_alignment(golden_mask, test_mask, test_board=None, sigma=3.0,
                     motion=cv2.MOTION_AFFINE, max_shift_ratio=0.06):
    """ECC alignment: หา affine ที่ทำให้ test ซ้อนต้นแบบพอดี (ชดเชยการดัดภาพที่คลาดเล็กน้อย)"""
    H, W = golden_mask.shape[:2]
    g = cv2.GaussianBlur(golden_mask.astype(np.float32) / 255.0, (0, 0), sigma)
    t = cv2.GaussianBlur(test_mask.astype(np.float32) / 255.0, (0, 0), sigma)
    warp = np.eye(2, 3, dtype=np.float32)
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
    try:
        cc, warp = cv2.findTransformECC(g, t, warp, motion, crit, None, 5)
    except cv2.error:
        return test_mask, test_board, None, 0.0
    shift = np.abs(warp[:, 2]).max()
    lin = warp[:, :2]
    if shift > max_shift_ratio * max(H, W) or np.abs(lin - np.eye(2)).max() > 0.08:
        return test_mask, test_board, None, float(cc)       # ผลแปลก → ไม่ใช้
    flags = cv2.WARP_INVERSE_MAP
    m2 = cv2.warpAffine(test_mask, warp, (W, H), flags=cv2.INTER_NEAREST | flags,
                        borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    b2 = None
    if test_board is not None:
        b2 = cv2.warpAffine(test_board, warp, (W, H), flags=cv2.INTER_LINEAR | flags,
                            borderMode=cv2.BORDER_REPLICATE)
    return m2, b2, warp, float(cc)


# ==========================================================
# ส่วนที่ 4: เปรียบเทียบลายทองแดงเชิง "การเชื่อมต่อ" (connectivity / netlist)
#
#  แนวคิด (= ไอเดียเดินเขาวงกตของคุณ แต่ทำให้เป็นระบบ):
#   - ลายทองแดงแต่ละก้อนที่ต่อถึงกันในต้นแบบ = 1 net (เหมือนเดินเขาวงกตแล้วไปถึงกันได้)
#   - เส้นกลาง (skeleton) ของแต่ละ net = "เส้นสีแดง" ที่ลากตามลาย
#   - OPEN  : net เดียวในต้นแบบ แต่ในบอร์ดทดสอบขาดเป็น ≥2 ท่อน  → หาตำแหน่งจาก skeleton ที่ไม่มีทองแดง
#   - SHORT : ทองแดง 1 ก้อนในบอร์ดทดสอบ แตะ ≥2 net ของต้นแบบ  → หาตำแหน่งจากทองแดงส่วนเกินที่เชื่อม
#   ขอบลายขรุขระจากการกัดเอง ไม่ทำให้ net ขาด/เชื่อมกัน → จึงไม่ถูกนับเป็น defect (ทนกว่า XOR ธรรมดามาก)
# ==========================================================
DEFAULT_CMP = dict(
    tol_px=3,            # ระยะคลาดเคลื่อนที่ยอมรับ (alignment + ขอบลายไม่คม)
    min_net_area=40,     # net ต้นแบบที่เล็กกว่านี้ไม่นับ
    min_frag_skel=10,    # ท่อนทองแดงต้องคลุมเส้นกลางอย่างน้อยกี่ px จึงนับเป็น 1 ท่อน
    min_frag_area=60,    # หรือ ทับพื้นที่ net อย่างน้อยกี่ px (กรณี pad ที่หลุดออกมาเดี่ยวๆ)
    min_gap_px=3,        # ช่องขาดบนเส้นกลางต้องยาวอย่างน้อยกี่ px
    min_short_overlap=12,# ทองแดงต้องทับ net อื่นอย่างน้อยกี่ px จึงนับว่าแตะ
    min_extra_area=60,   # ทองแดงเกิน (ไม่ช็อต) ขนาดเท่าไรจึงเตือน
    min_missing_area=60, # ทองแดงแหว่ง (ไม่ขาด) ขนาดเท่าไรจึงเตือน
    border_ignore=6,     # ไม่สนใจขอบบอร์ดกี่ px
)


def _boxes(mask01, min_px=1, pad=4):
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask01.astype(np.uint8), connectivity=8)
    out = []
    for k in range(1, n):
        if st[k, cv2.CC_STAT_AREA] >= min_px:
            x, y, w, h = st[k, :4]
            out.append([int(x - pad), int(y - pad), int(w + 2 * pad), int(h + 2 * pad), int(st[k, 4])])
    return out


def compare_copper(golden_mask, test_mask, **kw):
    p = {**DEFAULT_CMP, **kw}
    tol = p["tol_px"]
    g = (golden_mask > 127).astype(np.uint8)
    t = (test_mask > 127).astype(np.uint8)
    H, W = g.shape
    b = p["border_ignore"]
    if b > 0:
        valid = np.zeros_like(g)
        valid[b:H - b, b:W - b] = 1
        g &= valid
        t &= valid
    g = remove_small(g, p["min_net_area"])
    t = remove_small(t, max(5, p["min_net_area"] // 3))

    n_g, g_lab = cv2.connectedComponents(g, connectivity=8)
    n_t, t_lab = cv2.connectedComponents(t, connectivity=8)
    g_dt = cv2.distanceTransform(g, cv2.DIST_L2, 3)
    g_core = ero(g, 1)
    g_core_lab = g_lab * g_core
    t_cov = dil(t, 1)
    g_tol = dil(g, tol)
    t_tol = dil(t, tol)

    defects, nets = [], []
    open_zone = np.zeros_like(g)

    # ---------- OPEN: ตรวจทีละ net ----------
    for i in range(1, n_g):
        net = (g_lab == i).astype(np.uint8)
        skel = skeletonize(net > 0).astype(np.uint8)
        skel &= (g_dt >= 1.5).astype(np.uint8)            # ตัดปลายกิ่งเล็กๆ ที่มุม (ไม่ใช่เส้นจริง)
        skel_len = int(skel.sum())
        if skel_len < p["min_frag_skel"]:
            continue
        region = dil(net, tol) & (1 - (g & (1 - net)))      # รอบ net นี้ แต่ไม่รวม net อื่น
        t_in = t & region
        n_c, c_lab = cv2.connectedComponents(t_in, connectivity=8)
        c_lab_d = cv2.dilate(c_lab.astype(np.uint16), disk(1))
        counts = np.bincount(c_lab_d[skel > 0].astype(np.int64), minlength=n_c)
        counts[0] = 0
        area_on_net = np.bincount(c_lab[ero(net, 1) > 0].astype(np.int64), minlength=n_c)
        area_on_net[0] = 0
        # นับเป็น "ท่อน" ถ้าคลุมเส้นกลางยาวพอ หรือ ทับพื้นที่ net มากพอ (เช่น pad กลมที่ skeleton สั้น)
        frags = [c for c in range(1, n_c)
                 if counts[c] >= p["min_frag_skel"] or area_on_net[c] >= p["min_frag_area"]]
        covered = int((skel & t_cov).sum())
        coverage = covered / max(1, skel_len)

        gap = (skel & (1 - t_cov)).astype(np.uint8)
        gap_boxes = [bx for bx in _boxes(dil(gap, 2) & dil(net, 1), 1, pad=6)]
        # เก็บเฉพาะช่องที่ยาวพอ (นับจากจุด skeleton ในกล่อง)
        good_gaps = []
        for (x, y, w, h, _) in gap_boxes:
            x0, y0 = max(0, x), max(0, y)
            if gap[y0:y + h, x0:x + w].sum() >= p["min_gap_px"]:
                good_gaps.append([x, y, w, h])

        status = "OK"
        if len(frags) == 0:
            status = "MISSING_NET"
            ys, xs = np.nonzero(net)
            defects.append(dict(type="MISSING_NET", severity="FAIL", net=i,
                                bbox=[int(xs.min()), int(ys.min()), int(np.ptp(xs) + 1), int(np.ptp(ys) + 1)]))
        elif len(frags) >= 2:
            status = "OPEN"
            if not good_gaps:                               # หาไม่เจอ → ใช้จุดที่ skeleton ไม่ถูกคลุม
                good_gaps = [bx[:4] for bx in _boxes(dil(gap, 2), 1, pad=6)][:3]
            for bx in good_gaps:
                defects.append(dict(type="OPEN", severity="FAIL", net=i, bbox=bx,
                                    fragments=len(frags)))
                x, y, w, h = bx
                open_zone[max(0, y):y + h, max(0, x):x + w] = 1
        elif good_gaps:
            status = "NICK"
            for bx in good_gaps:
                defects.append(dict(type="NICK", severity="WARN", net=i, bbox=bx))
                x, y, w, h = bx
                open_zone[max(0, y):y + h, max(0, x):x + w] = 1
        nets.append(dict(net=i, area=int(net.sum()), skeleton_px=skel_len,
                         fragments=len(frags), coverage=round(coverage, 3), status=status))

    # ---------- SHORT: ทองแดงก้อนเดียวแตะหลาย net ----------
    short_zone = np.zeros_like(g)
    sel = (t_lab > 0) & (g_core_lab > 0)
    pair = t_lab[sel].astype(np.int64) * (n_g + 1) + g_core_lab[sel].astype(np.int64)
    uniq, cnt = np.unique(pair, return_counts=True)
    touch = {}
    for u, c in zip(uniq, cnt):
        if c >= p["min_short_overlap"]:
            j, i = int(u // (n_g + 1)), int(u % (n_g + 1))
            touch.setdefault(j, set()).add(i)
    for j, nset in touch.items():
        if len(nset) < 2:
            continue
        comp = (t_lab == j).astype(np.uint8)
        bridge = comp & (1 - dil(g, 1))
        reported = False
        nb, bl, st, _ = cv2.connectedComponentsWithStats(bridge, connectivity=8)
        for k in range(1, nb):
            piece = (bl == k).astype(np.uint8)
            near = dil(piece, tol + 2) & g
            touched = set(np.unique(g_lab[near > 0]).tolist()) & nset
            if len(touched) >= 2:
                x, y, w, h = st[k, :4]
                bx = [int(x - 6), int(y - 6), int(w + 12), int(h + 12)]
                defects.append(dict(type="SHORT", severity="FAIL", nets=sorted(touched), bbox=bx))
                short_zone |= piece
                reported = True
        if not reported:                                    # net ชิดกันมาก หา bridge ไม่เจอ
            ys, xs = np.nonzero(comp & (1 - g))
            if len(xs) == 0:
                ys, xs = np.nonzero(comp)
            bx = [int(xs.min() - 6), int(ys.min() - 6), int(np.ptp(xs) + 12), int(np.ptp(ys) + 12)]
            defects.append(dict(type="SHORT", severity="FAIL", nets=sorted(nset), bbox=bx))

    # ---------- เตือน: ทองแดงเกิน / แหว่ง (ไม่ถึงขั้น open/short) ----------
    extra = t & (1 - g_tol) & (1 - dil(short_zone, 3))
    for x, y, w, h, a in _boxes(extra, p["min_extra_area"], pad=4):
        defects.append(dict(type="EXTRA_COPPER", severity="WARN", bbox=[x, y, w, h], area=a))
    missing = g_core & (1 - t_tol) & (1 - dil(open_zone, 3))
    for x, y, w, h, a in _boxes(missing, p["min_missing_area"], pad=4):
        defects.append(dict(type="MISSING_COPPER", severity="WARN", bbox=[x, y, w, h], area=a))

    n_fail = sum(d["severity"] == "FAIL" for d in defects)
    n_warn = sum(d["severity"] == "WARN" for d in defects)
    verdict = "FAIL" if n_fail else ("WARN" if n_warn else "PASS")
    return dict(
        verdict=verdict,
        n_fail=n_fail, n_warn=n_warn,
        counts={k: sum(d["type"] == k for d in defects)
                for k in ["OPEN", "MISSING_NET", "SHORT", "NICK", "EXTRA_COPPER", "MISSING_COPPER"]},
        golden_nets=n_g - 1, test_components=n_t - 1,
        iou=round(mask_iou(golden_mask, test_mask), 4),
        iou_tol=round(mask_iou(golden_mask, test_mask, r=tol), 4),
        defects=defects, nets=nets, params=p,
    )


# ==========================================================
# ส่วนที่ 5: วาดผล + ฟังก์ชันระดับสูง (สร้างต้นแบบ / ตรวจบอร์ด)
# ==========================================================
DEFECT_COLORS = {  # BGR
    "OPEN": (0, 0, 255), "MISSING_NET": (0, 128, 255), "SHORT": (255, 0, 255),
    "NICK": (0, 255, 255), "EXTRA_COPPER": (255, 255, 0), "MISSING_COPPER": (0, 200, 255),
}


def draw_result(board_bgr, golden_mask, test_mask, result, thickness=2):
    """
    สีพื้น: เขียว = ตรงกัน, แดง = ต้นแบบมีแต่บอร์ดทดสอบไม่มี, ฟ้า = บอร์ดทดสอบมีเกิน
    กรอบ: OPEN แดง, SHORT ม่วง, MISSING_NET ส้ม, คำเตือนสีเหลือง/ฟ้า
    """
    g = golden_mask > 127
    t = test_mask > 127
    vis = (board_bgr.astype(np.float32) * 0.45).astype(np.uint8)
    col = np.zeros_like(vis)
    col[g & t] = (0, 170, 0)
    col[g & ~t] = (0, 0, 230)
    col[~g & t] = (230, 160, 0)
    vis = cv2.addWeighted(vis, 1.0, col, 0.6, 0)
    for d in result["defects"]:
        x, y, w, h = d["bbox"]
        c = DEFECT_COLORS.get(d["type"], (255, 255, 255))
        cv2.rectangle(vis, (x, y), (x + w, y + h), c, thickness)
        cv2.putText(vis, d["type"], (x, max(12, y - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, c, 1, cv2.LINE_AA)
    cv2.putText(vis, result["verdict"], (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.8,
                (0, 0, 255) if result["verdict"] == "FAIL" else
                ((0, 255, 255) if result["verdict"] == "WARN" else (0, 255, 0)), 2, cv2.LINE_AA)
    return vis


def select_board(img_bgr, board_index=None):
    boards = find_boards(img_bgr)
    if not boards:
        raise ValueError("ไม่พบบอร์ด PCB ในภาพ")
    if board_index is None:                         # เลือกแผ่นใหญ่สุด
        return max(boards, key=lambda b: b["area"]), boards
    return boards[board_index], boards


def load_design_mask(path, size, mirror=False, invert=None):
    """
    โหลด mask จากไฟล์ออกแบบ (เช่น export ชั้นทองแดงจาก KiCad/EasyEDA เป็น PNG ขาว-ดำ)
    size=(W,H) ของบอร์ดต้นแบบหลัง warp, mirror=True สำหรับ layer ด้านล่าง (B.Cu) ที่มองจากใต้บอร์ด
    """
    m = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    _, m = cv2.threshold(m, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if invert is None:                              # ทองแดงส่วนใหญ่มักน้อยกว่าพื้น
        invert = (m > 127).mean() > 0.6
    if invert:
        m = 255 - m
    if mirror:
        m = cv2.flip(m, 1)
    return cv2.resize(m, size, interpolation=cv2.INTER_NEAREST)


def build_golden(images_bgr, segmenter, board_index=None, long_side=BOARD_LONG_SIDE, design_mask_path=None,
                 design_mirror=False):
    """
    สร้างต้นแบบจากภาพบอร์ดดี 1 ภาพหรือหลายภาพ (หลายภาพ = เฉลี่ย probability → mask นิ่งกว่า)
    ถ้ามีไฟล์ออกแบบ (design_mask_path) จะใช้เป็น mask ต้นแบบ ซึ่งแม่นที่สุด
    """
    if isinstance(images_bgr, np.ndarray):
        images_bgr = [images_bgr]
    ref_board, ref_mask, probs = None, None, []
    for img in images_bgr:
        bd, _ = select_board(img, board_index)
        if ref_board is None:
            board, _ = warp_board(img, bd["quad"], long_side=long_side)
            ref_board = board
            size = (board.shape[1], board.shape[0])
            prob = segmenter.predict_prob(board)
            ref_mask = ((prob >= 0.5) * 255).astype(np.uint8)
            probs.append(prob)
            continue
        board, _ = warp_board(img, bd["quad"], out_size=size)
        m = segmenter.predict_mask(board)
        board, m, k, _ = best_rotation(ref_mask, board, m)
        prob = segmenter.predict_prob(board)
        _, _, warp, _ = refine_alignment(ref_mask, m)
        if warp is not None:
            prob = cv2.warpAffine(prob, warp, size, flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP)
        probs.append(prob)
    prob = np.mean(probs, axis=0)
    mask = ((prob >= 0.5) * 255).astype(np.uint8)
    mask = remove_small((mask > 0).astype(np.uint8), 20) * 255
    if design_mask_path:
        mask = load_design_mask(design_mask_path, size, mirror=design_mirror)
        # จัด design ให้ตรงกับภาพจริง (หมุน + ECC)
        _, dm, k, _ = best_rotation(((prob >= 0.5) * 255).astype(np.uint8), mask, mask)
        dm2, _, _, _ = refine_alignment(((prob >= 0.5) * 255).astype(np.uint8), dm)
        mask = dm2
    return dict(board=ref_board, mask=mask.astype(np.uint8), size=size, n_images=len(images_bgr))


def inspect(golden, image_bgr, segmenter, board_index=None, align=True, **cmp_kw):
    """ตรวจบอร์ด 1 แผ่นเทียบกับต้นแบบ → (result dict, ภาพผล, dict ข้อมูลกลางทาง)"""
    if isinstance(image_bgr, (list, tuple)):              # หลายเฟรม → เลือกเฟรมคมสุด
        image_bgr, _, _ = pick_sharpest(list(image_bgr))
    bd, boards = select_board(image_bgr, board_index)
    board, _ = warp_board(image_bgr, bd["quad"], out_size=golden["size"])
    tmask = segmenter.predict_mask(board)
    board, tmask, k, rot_score = best_rotation(golden["mask"], board, tmask)
    ecc = 0.0
    if align:
        tmask2, board2, warp, ecc = refine_alignment(golden["mask"], tmask, board)
        if warp is not None:
            tmask, board = tmask2, board2
    result = compare_copper(golden["mask"], tmask, **cmp_kw)
    result.update(rotation_deg=int(k * 90), rotation_score=round(rot_score, 4), ecc=round(ecc, 4),
                  segmenter=segmenter.mode, sharpness=round(sharpness(board), 1))
    vis = draw_result(board, golden["mask"], tmask, result)
    return result, vis, dict(board=board, mask=tmask, quad=bd["quad"])


def save_golden(golden, path):
    np.savez_compressed(path, board=golden["board"], mask=golden["mask"],
                        size=np.array(golden["size"]), n_images=golden.get("n_images", 1))


def load_golden(path):
    z = np.load(path)
    return dict(board=z["board"], mask=z["mask"], size=tuple(int(v) for v in z["size"]),
                n_images=int(z["n_images"]))
