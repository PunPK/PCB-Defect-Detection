"""
pcb_ai.py — โมดูล AI สำหรับตรวจจับ PCB, สกัดลายเส้นทองแดง (TinyUNet) และวิเคราะห์ตำหนิ (pcb_compare + RandomForest)
"""

import os
import sys
import glob
import time
import logging
from pathlib import Path
from typing import Optional, Tuple, Dict, Any, List

import cv2
import numpy as np
import torch
import torch.nn as nn

# Add project root to sys.path to easily import pcb_compare
ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    import pcb_compare as pc
except ImportError:
    pc = None

logger = logging.getLogger(__name__)

# Model Paths
MODEL_UNET_PATH = os.getenv("COPPER_UNET_PATH", str(ROOT_DIR / "models" / "copper_unet.pt"))
if not os.path.exists(MODEL_UNET_PATH):
    MODEL_UNET_PATH = str(ROOT_DIR / "train_ai_pcb" / "models" / "copper_unet.pt")

MODEL_RF_PATH = os.getenv("DEFECT_RF_PATH", str(ROOT_DIR / "models" / "defect_rf.joblib"))
if not os.path.exists(MODEL_RF_PATH):
    MODEL_RF_PATH = str(ROOT_DIR / "train_ai_compare" / "models" / "defect_rf.joblib")

DESIGN_DIR = str(ROOT_DIR / "designs")


# ==============================================================================
# TinyUNet Architecture (ตรงตาม train_unet.ipynb)
# ==============================================================================
class ConvBNReLU(nn.Sequential):
    def __init__(self, cin: int, cout: int):
        super().__init__(
            nn.Conv2d(cin, cout, 3, padding=1, bias=False),
            nn.BatchNorm2d(cout),
            nn.ReLU(inplace=True),
        )


class DoubleConv(nn.Sequential):
    def __init__(self, cin: int, cout: int):
        super().__init__(
            ConvBNReLU(cin, cout),
            ConvBNReLU(cout, cout),
        )


class TinyUNet(nn.Module):
    def __init__(self, in_channels: int = 3, out_channels: int = 1, base: int = 16, depth: int = 4):
        super().__init__()
        self.base = base
        self.depth = depth
        ch = [base * (2 ** i) for i in range(depth + 1)]

        self.inc = DoubleConv(in_channels, ch[0])
        self.pool = nn.MaxPool2d(2)
        self.downs = nn.ModuleList([DoubleConv(ch[i], ch[i + 1]) for i in range(depth)])
        self.ups = nn.ModuleList([
            nn.ConvTranspose2d(ch[i + 1], ch[i], 2, stride=2)
            for i in reversed(range(depth))
        ])
        self.decs = nn.ModuleList([
            DoubleConv(ch[i] * 2, ch[i])
            for i in reversed(range(depth))
        ])
        self.drop = nn.Dropout2d(0.1)
        self.head = nn.Conv2d(ch[0], out_channels, 1)

    def forward(self, x):
        skips = [self.inc(x)]
        for d in self.downs:
            skips.append(d(self.pool(skips[-1])))
        x = self.drop(skips.pop())
        for up, dec in zip(self.ups, self.decs):
            x = dec(torch.cat([up(x), skips.pop()], dim=1))
        return self.head(x)


# ==============================================================================
# ตรวจจับแผ่น PCB และดึงขอบเขตบอร์ด (Board Extraction & Perspective Transform)
# ==============================================================================
def extract_pcb_board(
    frame: np.ndarray,
    target_size: Optional[Tuple[int, int]] = None,
    min_area_ratio: float = 0.03,
    margin: float = 0.06,
):
    """
    ตรวจจับขอบเขตบอร์ด PCB จากภาพกล้อง ตัดพื้นหลังออก และทำ Perspective Warp
    รักษาอัตราส่วนภาพ (Aspect Ratio) ของบอร์ดจริงตามธรรมชาติเพื่อความแม่นยำในการซ้อนทับ (Alignment)
    margin: เผื่อระยะขอบรอบแผ่นบอร์ด (เช่น 0.05 = เผื่อ 5%) ป้องกันการตัดลายทองแดงหรือรูเจาะริมบอร์ด
    คืนค่า: (warped_pcb, ordered_quad, board_mask_orig)
    """
    h, w = frame.shape[:2]
    b, g, r = cv2.split(frame)
    diff_rb = r.astype(int) - b.astype(int)
    diff_gb = g.astype(int) - b.astype(int)
    hsv = cv2.cvtColor(cv2.GaussianBlur(frame, (5, 5), 0), cv2.COLOR_BGR2HSV)
    H, S, V = cv2.split(hsv)

    # 1. ตรวจจับเนื้อบอร์ด (รองรับทั้งไฟส่องทะลุ Backlit และไฟส่องตรง Frontlit)
    is_sub_backlit = (H >= 17) & (H <= 43) & (S >= 35) & (V >= 70) & (diff_gb > 15) & (diff_rb > 20)
    is_frontlit = ((H <= 45) | (H >= 165)) & (S >= 35) & (V >= 50) & (diff_rb > 20)
    board_seed = (is_sub_backlit | is_frontlit).astype(np.uint8) * 255

    board_seed = cv2.morphologyEx(board_seed, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    k = max(21, int(round(min(h, w) * 0.08))) | 1
    board_closed = cv2.morphologyEx(board_seed, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (k, k)))

    cnts, _ = cv2.findContours(board_closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Fallback หากไม่พบลักษณะสี substrate ด้านบน ลองใช้ copper/general contour
    if not cnts:
        lower_copper = np.array([5, 30, 20])
        upper_copper = np.array([45, 255, 255])
        c_mask = cv2.inRange(hsv, lower_copper, upper_copper)
        c_mask = cv2.morphologyEx(c_mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        cnts, _ = cv2.findContours(c_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not cnts:
        return None, None, None

    largest = max(cnts, key=cv2.contourArea)
    area = cv2.contourArea(largest)
    total_area = h * w
    # กรองขนาดแผ่นบอร์ด: ต้องไม่เล็กเกินไป (< 4%) และต้องไม่กินพื้นที่ทั้งเฟรมภาพ (> 85% เช่น แสงสว่างจ้าคลุมทั้งสายพาน)
    if area < 0.04 * total_area or area > 0.85 * total_area:
        return None, None, None

    hull = cv2.convexHull(largest)
    hull_area = cv2.contourArea(hull)
    if hull_area <= 0 or (area / hull_area) < 0.70:
        return None, None, None

    rect = cv2.minAreaRect(hull)
    peri = cv2.arcLength(hull, True)
    approx = cv2.approxPolyDP(hull, 0.03 * peri, True)

    if len(approx) == 4:
        quad = approx.reshape(4, 2).astype(np.float32)
    else:
        quad = cv2.boxPoints(rect).astype(np.float32)

    s = quad.sum(axis=1)
    diff = np.diff(quad, axis=1)
    ordered = np.zeros((4, 2), dtype=np.float32)
    ordered[0] = quad[np.argmin(s)]
    ordered[2] = quad[np.argmax(s)]
    ordered[1] = quad[np.argmin(diff)]
    ordered[3] = quad[np.argmax(diff)]

    # ขยายกรอบออกตาม margin เพื่อให้เก็บครบทั้งแผ่น ไม่ตัดโดนขอบลายทองแดง
    if margin > 0:
        center = ordered.mean(axis=0)
        ordered = center + (ordered - center) * (1.0 + margin)
        ordered[:, 0] = np.clip(ordered[:, 0], 0, w - 1)
        ordered[:, 1] = np.clip(ordered[:, 1], 0, h - 1)

    if target_size is not None:
        tw, th = target_size
    else:
        w_top = np.linalg.norm(ordered[1] - ordered[0])
        w_bot = np.linalg.norm(ordered[2] - ordered[3])
        h_left = np.linalg.norm(ordered[3] - ordered[0])
        h_right = np.linalg.norm(ordered[2] - ordered[1])
        bw = max(32, int(round(max(w_top, w_bot))))
        bh = max(32, int(round(max(h_left, h_right))))
        scale_factor = 512.0 / max(bw, bh)
        tw = int(round(bw * scale_factor))
        th = int(round(bh * scale_factor))

    dst = np.array([[0, 0], [tw - 1, 0], [tw - 1, th - 1], [0, th - 1]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(ordered, dst)
    warped = cv2.warpPerspective(frame, M, (tw, th), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

    # กรองกรณีแสงสว่างจ้าบนสายพานเปล่า (Empty Overexposed Light / Glare):
    # แผ่น PCB จริงจะต้องมีเส้นลายทองแดง รูเจาะ หรือมาร์กิ้งที่มี contrast และ edge_density
    # ขณะที่แสงสว่างเปล่าจะเรียบเนียนเกือบไร้เส้นขอบ (edge_density < 0.010)
    gray_warped = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    contrast = float(np.std(gray_warped))
    edges = cv2.Canny(gray_warped, 40, 120)
    edge_density = float(np.count_nonzero(edges) / edges.size)
    if contrast < 16.0 or edge_density < 0.010:
        return None, None, None

    board_mask_orig = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(board_mask_orig, [ordered.astype(np.int32)], 255)

    return warped, ordered, board_mask_orig


# ==============================================================================
# ตัวสกัดลายเส้นทองแดง (Copper Trace Extractor)
# ==============================================================================
class CopperTraceExtractor:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self, model_path: str = MODEL_UNET_PATH):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None

        if os.path.exists(model_path):
            try:
                ckpt = torch.load(model_path, map_location=self.device)
                base = ckpt.get("base", 16) if isinstance(ckpt, dict) else 16
                self.model = TinyUNet(base=base).to(self.device)
                state_dict = ckpt["model"] if isinstance(ckpt, dict) and "model" in ckpt else ckpt
                self.model.load_state_dict(state_dict)
                self.model.eval()
                logger.info(f"✅ โหลดโมเดล TinyUNet สำเร็จจาก: {model_path} บน {self.device}")
                print(f"[CopperTraceExtractor] โหลดโมเดล TinyUNet สำเร็จ ({self.device})")
            except Exception as e:
                logger.error(f"❌ โหลดโมเดล TinyUNet ไม่สำเร็จ: {e}")
                self.model = None
        else:
            logger.warning(f"⚠️ ไม่พบไฟล์โมเดล TinyUNet ที่: {model_path}")

    def predict(self, img_bgr: np.ndarray, conf_thresh: float = 0.5) -> np.ndarray:
        """
        ทำนาย Mask ลายทองแดง (255=ทองแดง, 0=พื้นหลัง)
        รองรับทั้งบอร์ดที่ใช้ไฟส่องทะลุ (Backlit) และไฟส่องตรง (Frontlit / Reflective Copper)
        พร้อมการตรวจสอบขั้วสี (Auto-Polarity Validation) ป้องกันการสลับร่องกับลายทองแดง
        """
        if img_bgr is None or not hasattr(img_bgr, "shape") or img_bgr.size == 0:
            return np.zeros((256, 256), dtype=np.uint8)

        # แปลงภาพ 4 channels (RGBA) หรือ Grayscale ให้เป็น 3 channels BGR มาตรฐาน
        if img_bgr.ndim == 3 and img_bgr.shape[2] == 4:
            a = img_bgr[..., 3:4].astype(np.float32) / 255.0
            img_bgr = (img_bgr[..., :3] * a + 255.0 * (1.0 - a)).astype(np.uint8)
        elif img_bgr.ndim == 2:
            img_bgr = cv2.cvtColor(img_bgr, cv2.COLOR_GRAY2BGR)

        orig_h, orig_w = img_bgr.shape[:2]
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        H, S, V = cv2.split(hsv)

        # 0. ตรวจสอบว่าภาพเป็น CAD / Gerber ขาวดำ หรือภาพดิจิทัลที่มีความต่างสีต่ำมาก (เช่น image copy.png)
        b, g, r = cv2.split(img_bgr)
        color_diff = float(np.mean(np.abs(b.astype(int) - g.astype(int))) + np.mean(np.abs(g.astype(int) - r.astype(int))))
        if color_diff < 18.0:
            t_otsu, thresh_cad = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            if cv2.countNonZero(thresh_cad) > 0.5 * thresh_cad.size:
                thresh_cad = cv2.bitwise_not(thresh_cad)
            return thresh_cad

        # 1. รันการทำนายด้วย Tiny U-Net
        unet_mask = None
        if self.model is not None:
            resized = cv2.resize(img_bgr, (256, 256))
            rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            norm = (rgb - 0.5) / 0.25
            inp = torch.from_numpy(np.ascontiguousarray(norm.transpose(2, 0, 1)))[None].to(self.device)

            with torch.no_grad():
                logits = self.model(inp)
                prob = torch.sigmoid(logits)[0, 0].cpu().numpy()

            mask_small = (prob >= conf_thresh).astype(np.uint8) * 255
            unet_mask = cv2.resize(mask_small, (orig_w, orig_h), interpolation=cv2.INTER_NEAREST)

        # 2. ตรวจสอบลักษณะแสง (Dual-Mode Polarity Check: Backlit vs Frontlit)
        # ตรวจสอบสัดส่วนพื้นที่มืดมาก (V < 50):
        # - Backlit: ทั้งแผ่นบอร์ดจะสว่างด้วยไฟส่องทะลุ พื้นที่มืด (V < 50) น้อยมาก (< 15%)
        # - Frontlit: พื้นบอร์ด FR4 จะมืดเข้ม (V < 50 เกิน 35%) และลายทองแดงจะสว่างสะท้อนแสงชัดเจน
        dark_frac = float((V < 50).mean())
        is_frontlit = dark_frac > 0.35

        if is_frontlit:
            # กรณีไฟส่องตรง: ลายทองแดงคือส่วนที่สว่างสะท้อนแสง
            t_otsu, thresh_v = cv2.threshold(V, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            thresh_v = cv2.morphologyEx(thresh_v, cv2.MORPH_OPEN, kernel)
            thresh_v = cv2.morphologyEx(thresh_v, cv2.MORPH_CLOSE, kernel)

            if unet_mask is not None:
                # ตรวจสอบว่า U-Net ให้ผลลัพธ์กลับขั้วหรือไม่
                fg_bright = float(V[unet_mask == 255].mean()) if (unet_mask == 255).any() else 0
                bg_bright = float(V[unet_mask == 0].mean()) if (unet_mask == 0).any() else 0
                # ถ้า U-Net พลาดไปเลือกส่วนมืดเป็นทองแดง
                if fg_bright < bg_bright:
                    return thresh_v
                return unet_mask
            return thresh_v

        # กรณีไฟส่องทะลุ (Backlit)
        if unet_mask is not None:
            return unet_mask

        # Fallback หากไม่มีโมเดลบน Backlit
        t_otsu, thresh_inv = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        return thresh_inv

    def predict_overlay(
        self, img_bgr: np.ndarray, conf_thresh: float = 0.5, color=(0, 255, 0), alpha: float = 0.5
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        ส่งคืน (mask, blended_overlay) สำหรับแสดงผล Real-Time
        """
        mask = self.predict(img_bgr, conf_thresh=conf_thresh)
        overlay = img_bgr.copy()
        overlay[mask > 127] = color
        blended = cv2.addWeighted(img_bgr, 1.0 - alpha, overlay, alpha, 0)
        return mask, blended


# ==============================================================================
# ตัววิเคราะห์ตำหนิ (PCB Defect Analyzer)
# ==============================================================================
class PCBDefectAnalyzer:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self, model_path: str = MODEL_RF_PATH, designs_dir: str = DESIGN_DIR):
        self.clf = None
        if pc is not None:
            if os.path.exists(model_path):
                try:
                    self.clf = pc.DefectClassifier.load(model_path)
                    logger.info(f"✅ โหลดโมเดล DefectClassifier สำเร็จจาก {model_path}")
                    print(f"[PCBDefectAnalyzer] โหลดโมเดล DefectClassifier สำเร็จ (Classes: {getattr(self.clf, 'classes', [])})")
                except Exception as e:
                    logger.warning(f"⚠️ โหลด {model_path} ไม่สำเร็จ: {e}. ใช้ Rule-based classifier")
                    self.clf = getattr(pc, "DefectClassifier", lambda: None)()
            else:
                logger.warning(f"⚠️ ไม่พบโมเดล {model_path}. ใช้ Rule-based classifier")
                self.clf = getattr(pc, "DefectClassifier", lambda: None)()
        else:
            logger.info("ℹ️ pcb_compare ไม่ได้ถูกติดตั้ง. DefectClassifier ทำงานในโหมดพื้นฐาน")

        self.designs_dir = designs_dir
        self.designs_cache = {}
        self._cached_template_bytes = None
        self._cached_design = None
        self._load_reference_designs()

    def _load_reference_designs(self):
        """โหลดไฟล์ต้นแบบ CAD / Gerber จาก designs/ เข้า Cache"""
        if pc is not None and os.path.exists(self.designs_dir):
            for p in sorted(glob.glob(os.path.join(self.designs_dir, "*.png"))):
                name = os.path.splitext(os.path.basename(p))[0]
                try:
                    self.designs_cache[name] = pc.load_design(p, copper="auto")
                except Exception as e:
                    logger.debug(f"Could not load design {p}: {e}")
            print(f"[PCBDefectAnalyzer] โหลดต้นแบบอ้างอิง {len(self.designs_cache)} แบบ: {list(self.designs_cache.keys())}")

    def _get_design_from_bytes(self, template_bytes: Optional[bytes] = None) -> Any:
        """แปลง template_bytes เป็น design object พร้อมระบบแคชเพื่อความเร็วสูงสุด"""
        if not template_bytes:
            return None
        if self._cached_template_bytes == template_bytes and self._cached_design is not None:
            return self._cached_design

        try:
            np_arr = np.frombuffer(template_bytes, np.uint8)
            tpl_img = cv2.imdecode(np_arr, cv2.IMREAD_UNCHANGED)
            if tpl_img is not None:
                if tpl_img.ndim == 3 and tpl_img.shape[2] == 4:
                    a = tpl_img[..., 3:4].astype(np.float32) / 255.0
                    tpl_img = (tpl_img[..., :3] * a + 255.0 * (1.0 - a)).astype(np.uint8)
                elif tpl_img.ndim == 2:
                    tpl_img = cv2.cvtColor(tpl_img, cv2.COLOR_GRAY2BGR)

                b, g, r = cv2.split(tpl_img)
                color_diff = float(np.mean(np.abs(b.astype(int) - g.astype(int))) + np.mean(np.abs(g.astype(int) - r.astype(int))))
                if color_diff < 18.0:
                    design = pc.load_design(tpl_img, copper="auto")
                else:
                    extractor = CopperTraceExtractor.get_instance()
                    tpl_mask = extractor.predict(tpl_img)
                    design = pc.load_design(tpl_mask, copper="white")
                self._cached_template_bytes = template_bytes
                self._cached_design = design
                return design
        except Exception as e:
            logger.error(f"Error parsing user template: {e}")
        return None

    def fast_check_similarity(
        self,
        copper_mask: np.ndarray,
        template_bytes: Optional[bytes] = None,
        threshold: float = 0.75,
    ) -> Tuple[bool, float, float]:
        """
        วัดความเหมือน/ต่างของ copper_mask กับ template อย่างรวดเร็ว (~60ms) เพื่อคัดแยกและสั่งงาน Servo แบบ Real-Time
        คืนค่า: (is_same_board: bool, similarity_score: float, elapsed_seconds: float)
        """
        t0 = time.time()
        design_to_compare = self._get_design_from_bytes(template_bytes)

        if design_to_compare is None:
            if self.designs_cache:
                first_key = next(iter(self.designs_cache))
                design_to_compare = self.designs_cache[first_key]
            elif pc is not None:
                design_to_compare = pc.load_design(copper_mask, copper="white")

        if pc is not None and hasattr(pc, "fast_pcb_similarity") and design_to_compare is not None:
            return pc.fast_pcb_similarity(copper_mask, design_to_compare, threshold=threshold)

        return True, 1.0, float(time.time() - t0)

    def analyze(
        self,
        copper_mask: np.ndarray,
        template_bytes: Optional[bytes] = None,
        photo_bgr: Optional[np.ndarray] = None,
        allow_mirror: bool = True,
    ) -> Dict[str, Any]:
        """
        เปรียบเทียบลายทองแดง copper_mask กับไฟล์ต้นแบบ
        template_bytes: ข้อมูลรูปภาพต้นแบบของ PCB ที่บันทึกไว้ในระบบ (ถ้ามี)
        photo_bgr: ภาพถ่ายจริงของแผ่นบอร์ด สำหรับใช้วาดกรอบและ overlay
        """
        t0 = time.time()
        design_to_compare = self._get_design_from_bytes(template_bytes)

        # ถ้าไม่มี template เฉพาะ หรือ parse ไม่สำเร็จ ให้ใช้ชุด reference designs หรือใช้ copper_mask ชั่วคราว
        if design_to_compare is None:
            if self.designs_cache:
                design_to_compare = self.designs_cache
            elif pc is not None:
                design_to_compare = pc.load_design(copper_mask, copper="white")
            else:
                design_to_compare = copper_mask

        # 2. รันฟังก์ชัน inspect จาก pcb_compare
        align_kw = dict(allow_mirror=allow_mirror, angle_step=4.0)
        res, ctx = pc.inspect(
            copper_mask,
            design_to_compare,
            classifier=self.clf,
            photo=photo_bgr,
            align_kw=align_kw,
            copper="auto",
        )

        # 3. สร้างภาพ Visualizations (ทั้งมุมมองเดิมของกล้อง และมุมมองที่หมุน/เลื่อนตรงกับ Template)
        al = ctx.get("align", {})
        vis_on_board = pc.draw_on_mask(res, ctx, show_normal=False)
        vis_canon = pc.draw_canon(res, ctx, show_normal=False)
        vis_aligned = pc.draw_aligned(res, ctx, show_normal=False) if hasattr(pc, "draw_aligned") else vis_on_board
        aligned_photo = pc.get_aligned_photo(ctx) if hasattr(pc, "get_aligned_photo") else None

        # สกัดภาพ Aligned Trace View (ชิ้นงานที่หมุน/เลื่อนตรงกับ Template พร้อมไฮไลท์ลายทองแดง)
        aligned_trace_view = None
        if aligned_photo is not None and "Tc" in al and al["Tc"] is not None:
            aligned_trace_view = aligned_photo.copy()
            tc_mask = (al["Tc"] > 0)
            if np.any(tc_mask):
                overlay = aligned_trace_view.copy()
                overlay[tc_mask] = (0, 255, 200)
                cv2.addWeighted(overlay, 0.55, aligned_trace_view, 0.45, 0, aligned_trace_view)
        elif aligned_photo is not None:
            aligned_trace_view = aligned_photo.copy()

        # 4. คำนวณเปอร์เซ็นต์ความถูกต้อง (Quality / Accuracy %)
        align_score = float(res["align"]["score"])
        counts = res["counts"]
        n_open = counts.get("open", 0)
        n_short = counts.get("short", 0)
        n_minor = counts.get("minor", 0)
        verdict = res["verdict"]

        if verdict == "PASS":
            accuracy = round(min(100.0, 95.0 + align_score * 5.0), 2)
        elif verdict == "WARN":
            accuracy = round(max(80.0, 90.0 - n_minor * 2.0), 2)
        elif verdict == "FAIL":
            deduction = n_open * 5.0 + n_short * 5.0 + n_minor * 1.0
            accuracy = round(max(10.0, min(79.0, 75.0 - deduction)), 2)
        else:  # NO_MATCH
            accuracy = round(max(0.0, align_score * 50.0), 2)

        description = f"Verdict: {verdict} | Open: {n_open}, Short: {n_short}, Minor: {n_minor} (Align: {align_score:.2f})"

        return {
            "verdict": verdict,
            "accuracy": accuracy,
            "description": description,
            "counts": counts,
            "defects": res.get("defects", []),
            "matched_design": res.get("matched_design", "Template"),
            "align_score": align_score,
            "time_s": round(time.time() - t0, 3),
            "vis_on_board": vis_on_board,
            "vis_canon": vis_canon,
            "vis_aligned": vis_aligned,
            "vis_result": vis_aligned if vis_aligned is not None else vis_canon,
            "aligned_photo": aligned_photo,
            "aligned_trace_view": aligned_trace_view if aligned_trace_view is not None else aligned_photo,
            "res": res,
            "ctx": ctx,
        }
