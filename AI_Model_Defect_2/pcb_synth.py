# ==========================================================================================
# pcb_synth.py — สร้างข้อมูลจำลองสำหรับทดสอบ/เทรนเบื้องต้น
#   - ใส่ตำหนิลงใน design (open / short / minor) โดยตรวจ topology ว่าเป็นชนิดนั้นจริง
#   - จำลอง "mask จากโมเดล": หมุน/กลับด้าน/ย่อ/perspective/ขอบขรุขระ/noise
# ==========================================================================================
import math
import cv2
import numpy as np
from skimage.morphology import skeletonize
import pcb_compare as pc


def make_trace_design(seed=0, W=420, H=380):
    """ลายวงจรแบบเส้น (ไม่มี ground pour) สุ่มขึ้นมา — ขาว(1)=ทองแดง"""
    rng = np.random.default_rng(seed)
    m = np.zeros((H, W), np.uint8)
    gx = np.linspace(50, W - 50, 6).astype(int)
    gy = np.linspace(50, H - 50, 5).astype(int)
    pads = [(int(x + rng.integers(-10, 11)), int(y + rng.integers(-10, 11))) for x in gx for y in gy]
    rng.shuffle(pads)
    used = pads[:22]
    for i in range(0, len(used) - 1, 2):
        (x1, y1), (x2, y2) = used[i], used[i + 1]
        th = int(rng.integers(6, 10))
        d = min(abs(x2 - x1), abs(y2 - y1))
        sx, sy = np.sign(x2 - x1), np.sign(y2 - y1)
        pts = [(x1, y1), (x1 + sx * d, y1 + sy * d), (x2, y2)] if rng.random() < 0.5 else [(x1, y1), (x2, y1), (x2, y2)]
        cv2.polylines(m, [np.array(pts, np.int32)], False, 1, th)
    for (x, y) in used:
        cv2.circle(m, (x, y), 11, 1, -1)
        cv2.circle(m, (x, y), 3, 0, -1)
    for (x, y) in [(20, 20), (W - 20, 20), (20, H - 20), (W - 20, H - 20)]:
        cv2.circle(m, (x, y), 13, 1, -1)
        cv2.circle(m, (x, y), 6, 0, -1)
    return m


def _ncomp(m):
    return cv2.connectedComponents(m.astype(np.uint8), connectivity=8)[0] - 1


def topo_class(before, after):
    """ชนิดตำหนิตามนิยาม: จำนวน net เพิ่ม = open, ลด = short, เท่าเดิม = minor"""
    nb, na = _ncomp(before), _ncomp(after)
    if na < nb:
        return "short"
    if na > nb:
        return "open"
    return "minor"


def _bbox(mask):
    ys, xs = np.nonzero(mask)
    return [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]


def add_defects(D, rng, s_test, n_open=1, n_short=1, n_minor=2, tries=300):
    """
    ใส่ตำหนิลงใน D (กรอบ canon) — s_test = จำนวน px ของภาพทดสอบต่อ 1 px canon (ใช้กำหนดขนาดให้มองเห็นได้)
    คืน (D ใหม่, list ของ {cls, kind, bbox})
    """
    D = D.copy().astype(np.uint8)
    tw = pc.trace_width(D)
    u = 1.0 / max(s_test, 1e-3)                       # 1 px ของภาพทดสอบ = u px canon
    H, W = D.shape
    gts = []
    margin = int(2 * tw) + 4

    def inside(x, y):
        return margin < x < W - margin and margin < y < H - margin

    def far_from_gts(x, y):
        return all(abs(x - (g["bbox"][0] + g["bbox"][2] / 2)) + abs(y - (g["bbox"][1] + g["bbox"][3] / 2)) > 5 * tw
                   for g in gts)

    def commit(new, want, kind):
        nonlocal D
        cls = topo_class(D, new)
        if cls != want:
            return False
        diff = (new != D).astype(np.uint8)
        if diff.sum() < 2:
            return False
        gts.append(dict(cls=cls, kind=kind, bbox=_bbox(diff)))
        D = new
        return True

    # ---- OPEN: ตัดขวางเส้นลาย ----
    for _ in range(n_open):
        dt = cv2.distanceTransform(D, cv2.DIST_L2, 5)
        sk = skeletonize(D > 0) & (dt >= max(0.3 * tw, 1.4 * u)) & (dt <= max(0.75 * tw, 1.6 * u))
        ys, xs = np.nonzero(sk)
        for _t in range(tries):
            if len(xs) == 0:
                break
            k = rng.integers(len(xs))
            x, y = int(xs[k]), int(ys[k])
            if not inside(x, y) or not far_from_gts(x, y):
                continue
            win = sk[y - 4:y + 5, x - 4:x + 5]
            py, px = np.nonzero(win)
            if len(px) < 3:
                continue
            v = np.cov(np.stack([px, py]).astype(float))
            ev, evec = np.linalg.eigh(v)
            d = evec[:, -1]                              # ทิศของเส้น
            n = np.array([-d[1], d[0]])                  # ทิศตั้งฉาก
            half_len = dt[y, x] + 2 + 1.5 * u
            cut_w = rng.uniform(2.5, 5.5) * u
            p1 = np.array([x, y]) + n * half_len
            p2 = np.array([x, y]) - n * half_len
            new = D.copy()
            cv2.line(new, tuple(np.round(p1).astype(int)), tuple(np.round(p2).astype(int)), 0,
                     max(1, int(round(cut_w))))
            if commit(new, "open", "cut"):
                break

    # ---- SHORT: สะพานทองแดงข้ามช่องระหว่าง 2 net ----
    for _ in range(n_short):
        inv = (1 - D).astype(np.uint8)
        dto, lab = cv2.distanceTransformWithLabels(inv, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_CCOMP)
        # lab: net (ก้อนทองแดง) ที่ใกล้ที่สุด → เขตแดน Voronoi = กลางช่องระหว่างสอง net
        edge = np.zeros_like(D, bool)
        edge[:, 1:] |= lab[:, 1:] != lab[:, :-1]
        edge[1:, :] |= lab[1:, :] != lab[:-1, :]
        edge &= (inv > 0) & (dto <= max(2.2 * tw, 3 * u)) & (dto >= max(1.0, 1.1 * u))
        ys, xs = np.nonzero(edge)
        n_net, net = cv2.connectedComponents(D, connectivity=8)
        for _t in range(tries):
            if len(xs) == 0:
                break
            k = rng.integers(len(xs))
            x, y = int(xs[k]), int(ys[k])
            if not inside(x, y) or not far_from_gts(x, y):
                continue
            r = int(3 * tw)
            y0, y1, x0, x1 = max(0, y - r), min(H, y + r), max(0, x - r), min(W, x + r)
            nw = net[y0:y1, x0:x1]
            ids = [i for i in np.unique(nw) if i > 0]
            if len(ids) < 2:
                continue
            pts = []
            for i in ids:
                py, px = np.nonzero(nw == i)
                dd = (px + x0 - x) ** 2 + (py + y0 - y) ** 2
                j = dd.argmin()
                pts.append((dd[j], (int(px[j] + x0), int(py[j] + y0))))
            pts.sort()
            (_, pa), (_, pb) = pts[0], pts[1]
            th = max(2, int(round(rng.uniform(2.5, 5.0) * u)))
            new = D.copy()
            cv2.line(new, pa, pb, 1, th)
            if commit(new, "short", "bridge"):
                break

    # ---- MINOR: รอยแหว่ง / ปุ่มยื่น / รูเข็ม / เศษทองแดง ที่ไม่ทำให้ขาดหรือช็อต ----
    kinds = ["nick", "spur", "pinhole", "speck"]
    for _ in range(n_minor):
        kind = kinds[int(rng.integers(len(kinds)))]
        dt = cv2.distanceTransform(D, cv2.DIST_L2, 5)
        dto = cv2.distanceTransform((1 - D).astype(np.uint8), cv2.DIST_L2, 5)
        for _t in range(tries):
            new = D.copy()
            if kind == "nick":                                    # แหว่งที่ขอบเส้น ไม่ถึงครึ่ง
                ys, xs = np.nonzero((dt > 0) & (dt <= 1.2))
                k = rng.integers(len(xs))
                x, y = int(xs[k]), int(ys[k])
                r = max(2.5 * u, rng.uniform(0.25, 0.45) * tw)
                cv2.circle(new, (x, y), int(round(r)), 0, -1)
            elif kind == "spur":                                  # ปุ่มยื่นออกจากเส้น ไม่แตะเส้นอื่น
                ys, xs = np.nonzero((dto > 0) & (dto <= 1.2))
                k = rng.integers(len(xs))
                x, y = int(xs[k]), int(ys[k])
                r = max(2.5 * u, rng.uniform(0.25, 0.5) * tw)
                cv2.circle(new, (x, y), int(round(r)), 1, -1)
            elif kind == "pinhole":                               # รูในทองแดงกว้าง
                r = max(1.6 * u, rng.uniform(0.15, 0.35) * tw)
                ys, xs = np.nonzero(dt > r + 2.5 * u)
                if len(xs) == 0:
                    kind = "nick"
                    continue
                k = rng.integers(len(xs))
                x, y = int(xs[k]), int(ys[k])
                cv2.circle(new, (x, y), int(round(r)), 0, -1)
            else:                                                 # เศษทองแดงลอยในช่องว่าง
                r = max(1.6 * u, rng.uniform(0.2, 0.45) * tw)
                ys, xs = np.nonzero(dto > r + 3 * u)
                if len(xs) == 0:
                    kind = "spur"
                    continue
                k = rng.integers(len(xs))
                x, y = int(xs[k]), int(ys[k])
                cv2.ellipse(new, (x, y), (int(round(r * 1.4)), int(round(r))), float(rng.uniform(0, 180)), 0, 360, 1, -1)
            if not inside(x, y) or not far_from_gts(x, y):
                continue
            want = "minor"
            if kind == "speck":                                    # เศษลอย = เพิ่ม 1 ก้อน (ไม่ใช่ open)
                if _ncomp(new) == _ncomp(D) + 1 and (new & dil1(D)).sum() == (D & dil1(D)).sum():
                    diff = (new != D).astype(np.uint8)
                    gts.append(dict(cls="minor", kind=kind, bbox=_bbox(diff)))
                    D = new
                    break
                continue
            if kind == "nick":
                # ต้องไม่ทำให้เส้นเหลือบางกว่า ~ครึ่งหนึ่ง (ไม่งั้นกลายเป็นเกือบขาด)
                dtn = cv2.distanceTransform(new, cv2.DIST_L2, 5)
                sk = skeletonize(D > 0)
                loc = np.zeros_like(D)
                cv2.circle(loc, (x, y), int(tw), 1, -1)
                v = dtn[(sk > 0) & (loc > 0)]
                if len(v) == 0 or v.min() < 0.25 * tw:
                    continue
            if commit(new, want, kind):
                break
    return D, gts


def dil1(m):
    return cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8))


def simulate_mask(Dd, rng, out=256, fill=(0.7, 0.95), flip=None, angle=None, persp=0.03,
                  bias=(-0.08, 0.08), rough=0.10, specks=(0, 4), clutter=0.3):
    """
    จำลอง mask ที่โมเดลทำนายได้จากภาพกล้อง: หมุน/กลับด้าน/ย่อ/perspective + ขอบขรุขระ + noise
    คืน (mask uint8 0/255, A_true canon→mask, s_test)
    """
    Hc, Wc = Dd.shape
    flip = bool(rng.random() < 0.5) if flip is None else flip
    angle = float(rng.uniform(0, 360)) if angle is None else float(angle)
    M, (bw, bh) = pc._rot_canvas(Hc, Wc, angle, 1.0, flip)
    s = out * rng.uniform(*fill) / max(bw, bh)
    S = np.diag([s, s, 1.0])
    M = S @ M
    bw, bh = bw * s, bh * s
    tx, ty = rng.uniform(0, max(1, out - bw)), rng.uniform(0, max(1, out - bh))
    A = np.array([[1, 0, tx], [0, 1, ty], [0, 0, 1]]) @ M
    src = np.float32([[0, 0], [Wc, 0], [Wc, Hc], [0, Hc]])
    dst = cv2.perspectiveTransform(src[None].astype(np.float64), A)[0]
    dst = dst + rng.uniform(-persp, persp, dst.shape) * out
    A = cv2.getPerspectiveTransform(src, dst.astype(np.float32)).astype(np.float64)
    f = cv2.GaussianBlur(Dd.astype(np.float32), (0, 0), max(0.3, 0.45 / s))
    T = cv2.warpPerspective(f, A, (out, out), flags=cv2.INTER_LINEAR, borderValue=0)
    T = cv2.GaussianBlur(T, (0, 0), 0.7)
    noise = cv2.GaussianBlur(rng.normal(0, 1, T.shape).astype(np.float32), (0, 0), 1.2)
    lf = cv2.GaussianBlur(rng.normal(0, 1, T.shape).astype(np.float32), (0, 0), 25)
    lf = lf / (np.abs(lf).max() + 1e-6)
    thr = 0.5 - rng.uniform(*bias) + 0.06 * lf
    m = (T + rough * noise > thr).astype(np.uint8)
    for _ in range(int(rng.integers(specks[0], specks[1] + 1))):   # จุด noise เล็กๆ
        x, y = int(rng.integers(0, out)), int(rng.integers(0, out))
        cv2.circle(m, (x, y), int(rng.integers(1, 2)), int(rng.random() < 0.5), -1)
    if rng.random() < clutter:                                     # วัตถุแปลกปลอมที่ขอบภาพ
        x = int(rng.choice([rng.integers(0, 15), rng.integers(out - 15, out)]))
        y = int(rng.integers(0, out))
        cv2.ellipse(m, (x, y), (int(rng.integers(4, 12)), int(rng.integers(8, 25))), float(rng.uniform(0, 180)), 0, 360, 1, -1)
    return m * 255, A, s


# ------------------------------------------------------------------------------------------
# ประเมินผล: จับคู่จุดที่ระบบเจอ กับ ตำหนิจริง
# ------------------------------------------------------------------------------------------
def gt_to_canon(gts, base_shape, canon_shape):
    sy_, sx_ = canon_shape[0] / base_shape[0], canon_shape[1] / base_shape[1]
    out = []
    for g in gts:
        x, y, w, h = g["bbox"]
        out.append(dict(g, bbox=[x * sx_, y * sy_, w * sx_, h * sy_]))
    return out


def _iou_box(a, b, grow=0.0):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ax, ay, aw, ah = ax - grow, ay - grow, aw + 2 * grow, ah + 2 * grow
    ix = max(0, min(ax + aw, bx + bw) - max(ax, bx))
    iy = max(0, min(ay + ah, by + bh) - max(ay, by))
    return ix * iy


def match_candidates(defects, gts_canon, tw):
    """คืน label ของแต่ละ candidate (ชนิดของตำหนิจริงที่ทับ หรือ normal) และ index ของ gt ที่ถูกพบ"""
    labels, found = [], set()
    for d in defects:
        best, bi = 0.0, -1
        for i, g in enumerate(gts_canon):
            ov = _iou_box(d["bbox"], g["bbox"], grow=0.75 * tw)
            if ov > best:
                best, bi = ov, i
        if bi >= 0:
            labels.append(gts_canon[bi]["cls"])
            found.add(bi)
        else:
            labels.append("normal")
    return labels, found


# ------------------------------------------------------------------------------------------
# สร้างชุดข้อมูลเทรนจากบอร์ดจำลอง
# ------------------------------------------------------------------------------------------
def make_training_set(designs, n_boards, seed=0, outs=(256, 320, 384, 512), verbose=True):
    """
    designs: list ของ (ชื่อ, design dict จาก pc.load_design) — ใช้หลายแบบลายจะดีกว่า
    คืน X (N×F), y (N), meta (list) และสถิติการตรวจพบ
    """
    import time as _t
    rng = np.random.default_rng(seed)
    X, y, meta = [], [], []
    stat = {c: [0, 0] for c in ("open", "short", "minor")}
    t0 = _t.time()
    for b in range(n_boards):
        name, des = designs[b % len(designs)]
        pol, dm = des["variants"][0]
        base = pc.to_canon(dm, 512)
        out = int(rng.choice(outs))
        fill = float(rng.uniform(0.7, 0.95))
        Dd, gts = add_defects(base, rng, out * fill / 512, n_open=int(rng.integers(0, 3)),
                              n_short=int(rng.integers(0, 3)), n_minor=int(rng.integers(0, 4)))
        m, A, s = simulate_mask(Dd, rng, out=out, fill=(fill, fill))
        res, ctx = pc.inspect(m, dict(variants=[(pol, dm)], crop=des["crop"]))
        cm = ctx["cmp"]
        g2 = gt_to_canon(gts, base.shape, cm.D.shape)
        labs, found = match_candidates(res["defects"], g2, cm.tw)
        for i, g in enumerate(gts):
            stat[g["cls"]][0] += 1
            stat[g["cls"]][1] += int(i in found)
        for d, l in zip(res["defects"], labs):
            f = d["features"]
            # จุดที่ไม่ตรงกับตำหนิที่ใส่ แต่ mask จำลอง "ขาดจริง" จาก noise → กำกวม (เหมือน open ทุกอย่าง) ไม่ใช้เทรน
            if l == "normal" and (f["split_local"] >= 1 or f["width_min"] < 0.05):
                continue
            X.append(d["_x"])
            y.append(l)
            meta.append(dict(board=b, design=name, out=out, rule=d["rule"]))
        if verbose and (b + 1) % max(1, n_boards // 10) == 0:
            print(f"  {b + 1}/{n_boards} boards | samples {len(y)} | {_t.time() - t0:.0f}s")
    return np.array(X, np.float32), np.array(y), meta, stat