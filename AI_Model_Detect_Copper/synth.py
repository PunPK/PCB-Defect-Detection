import cv2
import numpy as np
from scipy import ndimage as ndi
from skimage.morphology import skeletonize
import pcb_core as pc

FR4_BGR = (70, 185, 205)       # เหลือง FR4
COPPER_BGR = (95, 120, 200)    # ทองแดงอมชมพู


def make_design(seed=0, W=400, H=520):
    """สร้างลายวงจรสุ่ม (mask ทองแดง) ขนาด W x H"""
    rng = np.random.default_rng(seed)
    m = np.zeros((H, W), np.uint8)
    # รูยึด 4 มุม
    for (x, y) in [(22, 22), (W - 22, 22), (22, H - 22), (W - 22, H - 22)]:
        cv2.circle(m, (x, y), 14, 255, -1)
        cv2.circle(m, (x, y), 6, 0, -1)
    # pad กริด
    gx = np.linspace(70, W - 70, 5).astype(int)
    gy = np.linspace(70, H - 70, 7).astype(int)
    pads = [(int(x + rng.integers(-8, 9)), int(y + rng.integers(-8, 9))) for x in gx for y in gy]
    rng.shuffle(pads)
    used = pads[:24]
    # เชื่อม pad เป็นคู่ๆ ด้วยเส้นแบบ manhattan / 45°
    for i in range(0, len(used) - 1, 2):
        (x1, y1), (x2, y2) = used[i], used[i + 1]
        th = int(rng.integers(5, 9))
        if rng.random() < 0.5:
            pts = [(x1, y1), (x2, y1), (x2, y2)]
        else:
            d = min(abs(x2 - x1), abs(y2 - y1))
            sx, sy = np.sign(x2 - x1), np.sign(y2 - y1)
            pts = [(x1, y1), (x1 + sx * d, y1 + sy * d), (x2, y2)]
        cv2.polylines(m, [np.array(pts, np.int32)], False, 255, th, cv2.LINE_AA)
    for (x, y) in used:
        cv2.circle(m, (x, y), 10, 255, -1)
        cv2.circle(m, (x, y), 3, 0, -1)
    # ground pour บางส่วน
    cv2.rectangle(m, (40, H - 60), (W // 2 - 10, H - 40), 255, -1)
    return (m > 127).astype(np.uint8) * 255


def rough_edges(mask, rng, amount=1.2):
    """ทำขอบลายให้ขรุขระเหมือนบอร์ดกัดเอง"""
    f = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 1.2)
    noise = cv2.GaussianBlur(rng.normal(0, 1, mask.shape).astype(np.float32), (0, 0), 1.5)
    return ((f + 0.12 * amount * noise) > 0.5).astype(np.uint8) * 255


def render_board(mask, rng, jitter=False):
    """วาดภาพบอร์ดจาก mask  (jitter=True → สุ่มโทนสี FR4/ทองแดง เพื่อใช้เป็นข้อมูลเทรน)"""
    H, W = mask.shape
    fr4 = np.array(FR4_BGR, np.float32)
    copper = np.array(COPPER_BGR, np.float32)
    if jitter:
        fr4 = fr4 + rng.normal(0, 10, 3)
        copper = (copper if rng.random() < 0.5 else np.array([70, 92, 145], np.float32)) + rng.normal(0, 12, 3)
    img = np.zeros((H, W, 3), np.float32)
    img[:] = fr4
    tex = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 2) * 10
    cop = copper + tex[..., None] * np.array([0.6, 0.8, 1.0])
    m = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 0.8)[..., None]
    img = img * (1 - m) + cop * m
    img += rng.normal(0, 4, img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)


def add_defects(design, seed=1):
    """ใส่ OPEN 1 จุด, SHORT 1 จุด, ทองแดงเกิน 1 จุด → คืน (mask ใหม่, ตำแหน่งจริง)"""
    rng = np.random.default_rng(seed)
    m = design.copy()
    g = (design > 127).astype(np.uint8)
    n, lab = cv2.connectedComponents(g, connectivity=8)
    dt = cv2.distanceTransform(g, cv2.DIST_L2, 3)
    truth = {}
    # OPEN: ตัดเส้นลายที่แคบ
    sk = skeletonize(g > 0) & (dt >= 2) & (dt <= 4.5)
    ys, xs = np.nonzero(sk)
    for _ in range(200):
        k = rng.integers(len(xs))
        x, y = int(xs[k]), int(ys[k])
        test = m.copy()
        cv2.circle(test, (x, y), 7, 0, -1)
        net = (lab == lab[y, x]).astype(np.uint8) & (test > 127)
        if cv2.connectedComponents(net, connectivity=8)[0] - 1 >= 2:
            m = test
            truth["OPEN"] = (x, y)
            break
    # SHORT: ลากทองแดงระหว่าง 2 net ที่ใกล้กันที่สุด
    best = None
    for i in range(1, n):
        a = lab == i
        d, idx = ndi.distance_transform_edt(~((lab > 0) & ~a), return_indices=True)
        dd = np.where(a, d, np.inf)
        k = np.unravel_index(np.argmin(dd), dd.shape)
        if 8 < dd[k] < 45 and (best is None or dd[k] < best[0]):
            best = (dd[k], (k[1], k[0]), (idx[1][k], idx[0][k]))
    if best:
        _, p1, p2 = best
        cv2.line(m, tuple(map(int, p1)), tuple(map(int, p2)), 255, 5)
        truth["SHORT"] = ((p1[0] + p2[0]) // 2, (p1[1] + p2[1]) // 2)
    # ทองแดงเกินลอยๆ
    H, W = m.shape
    for _ in range(200):
        x, y = int(rng.integers(40, W - 40)), int(rng.integers(40, H - 40))
        if dt[y, x] == 0 and cv2.distanceTransform((1 - g).astype(np.uint8), cv2.DIST_L2, 3)[y, x] > 18:
            cv2.ellipse(m, (x, y), (8, 5), 30, 0, 360, 255, -1)
            truth["EXTRA_COPPER"] = (x, y)
            break
    return m, truth


def photograph(board_img, rng, frame=(900, 1200), rot180=False, blur=1.2, light=0.35):
    """วางบอร์ดบนสายพานสีขาว + perspective + แสงไม่เท่ากัน + เบลอ + noise"""
    if rot180:
        board_img = cv2.rotate(board_img, cv2.ROTATE_180)
    Hf, Wf = frame
    table = np.full((Hf, Wf, 3), (205, 208, 212), np.float32)
    table += rng.normal(0, 3, table.shape)
    h, w = board_img.shape[:2]
    s = 1.1
    cx, cy = Wf / 2 + rng.uniform(-80, 80), Hf / 2 + rng.uniform(-60, 60)
    ang = np.radians(rng.uniform(-12, 12))
    R = np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]])
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    base = (np.float32([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) * s) @ R.T
    dst = (base + [cx, cy] + rng.uniform(-15, 15, (4, 2))).astype(np.float32)
    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(board_img, M, (Wf, Hf)).astype(np.float32)
    a = cv2.warpPerspective(np.ones((h, w), np.float32), M, (Wf, Hf))[..., None]
    img = table * (1 - a) + warped * a
    # แสงไม่เท่ากัน
    yy, xx = np.mgrid[0:Hf, 0:Wf].astype(np.float32)
    gx, gy = rng.uniform(-1, 1, 2)
    grad = 1 + light * ((xx / Wf - 0.5) * gx + (yy / Hf - 0.5) * gy) * 2
    img *= grad[..., None]
    # เงา
    sh = np.zeros((Hf, Wf), np.float32)
    cv2.circle(sh, (int(cx + rng.uniform(-150, 150)), int(cy + rng.uniform(-150, 150))), 160, 1, -1)
    sh = cv2.GaussianBlur(sh, (0, 0), 40)
    img *= (1 - 0.3 * sh)[..., None]
    # เบลอจากการเคลื่อนที่
    if blur > 0:
        k = np.zeros((9, 9), np.float32)
        k[4, :] = 1
        k /= k.sum()
        img = cv2.filter2D(img, -1, k)
        img = cv2.GaussianBlur(img, (0, 0), blur)
    img += rng.normal(0, 3, img.shape)
    img = np.clip(img, 0, 255).astype(np.uint8)
    ok, enc = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return cv2.imdecode(enc, cv2.IMREAD_COLOR)
