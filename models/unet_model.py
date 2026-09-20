"""
unet_model.py  (UX-overhaul version)
=====================================
สถาปัตยกรรม TinyUNet + Ground Truth Studio ที่ใช้งานได้คล่องขึ้น

การเปลี่ยนแปลงหลัก (UX overhaul):
  - Brush mode เป็น default (คลิกลากวาดทันที ไม่ต้องคลิก 2 จุด)
  - Line mode: คลิกลากค้างเลย ปล่อยเมาส์ถึงวาด (เหมือน Photoshop)
    + กด SHIFT ล็อคมุม 0/45/90°, ต่อเส้นต่อเนื่องกด CTRL ค้าง
  - Eraser: คลิกลากค้างลบได้เลย
  - Fill (Bucket) [F]: flood-fill จุดคลิก — ปิดช่องโหว่กลางพื้นที่ทองแดงได้ทันที
  - Brush size: scroll wheel ขึ้น/ลง (ไม่ต้องกด [W] วนรอบ)
  - Pan template: กลาง-คลิกค้างลาก (หรือ SPACE+drag แบบ Photoshop)
  - Arrow keys ใช้เลื่อน template offset โดยไม่ชนกับ mode keys
  - Visual HUD แสดง mode/size/shortcut ตลอดเวลา ไม่ต้องจำ
  - waitKey(8) แทน waitKeyEx(20) → preview cursor ลื่นขึ้น
  - รองรับ undo หลายระดับ (สูงสุด 30 ขั้น)
"""

import os
import sys
import glob
import argparse
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple

import cv2
import numpy as np

# ── PyTorch (optional) ────────────────────────────────────────────────────────
try:
    import torch
    import torch.nn as nn
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    torch = None
    nn = None

# ==============================================================================
# Part 1: TinyUNet Architecture  (ไม่เปลี่ยนแปลง — ใช้ร่วมกับ train_unet.ipynb)
# ==============================================================================
if HAS_TORCH:
    class ConvBNReLU(nn.Sequential):
        def __init__(self, cin, cout):
            super().__init__(
                nn.Conv2d(cin, cout, 3, padding=1, bias=False),
                nn.BatchNorm2d(cout),
                nn.ReLU(inplace=True),
            )

    class DoubleConv(nn.Sequential):
        def __init__(self, cin, cout):
            super().__init__(ConvBNReLU(cin, cout), ConvBNReLU(cout, cout))

    class TinyUNet(nn.Module):
        def __init__(self, in_channels=3, out_channels=1, base=16, depth=4):
            super().__init__()
            self.base = base
            self.depth = depth
            ch = [base * (2 ** i) for i in range(depth + 1)]
            self.inc = DoubleConv(in_channels, ch[0])
            self.pool = nn.MaxPool2d(2)
            self.downs = nn.ModuleList([DoubleConv(ch[i], ch[i+1]) for i in range(depth)])
            self.ups   = nn.ModuleList([nn.ConvTranspose2d(ch[i+1], ch[i], 2, stride=2)
                                        for i in reversed(range(depth))])
            self.decs  = nn.ModuleList([DoubleConv(ch[i]*2, ch[i])
                                        for i in reversed(range(depth))])
            self.drop  = nn.Dropout2d(0.1)
            self.head  = nn.Conv2d(ch[0], out_channels, 1)

        def forward(self, x):
            skips = [self.inc(x)]
            for d in self.downs:
                skips.append(d(self.pool(skips[-1])))
            x = self.drop(skips.pop())
            for up, dec in zip(self.ups, self.decs):
                x = dec(torch.cat([up(x), skips.pop()], dim=1))
            return self.head(x)


def create_model(base=16, depth=4, device=None):
    if not HAS_TORCH:
        raise ImportError("ต้องติดตั้ง PyTorch")
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    return TinyUNet(base=base, depth=depth).to(device), device


def count_parameters(model):
    return sum(p.numel() for p in model.parameters() if p.requires_grad) / 1e6


# ==============================================================================
# Part 2: Built-in copper extractor & image utils  (ไม่เปลี่ยน API)
# ==============================================================================
def internal_extract_copper_mask(board_bgr, min_area=10):
    h, w = board_bgr.shape[:2]
    b, g, r = cv2.split(board_bgr)
    hsv = cv2.cvtColor(board_bgr, cv2.COLOR_BGR2HSV)
    H, S, V = cv2.split(hsv)

    is_yellow = (H >= 17) & (H <= 43) & (S >= 40) & (V >= 80) & \
                (g.astype(int) - b.astype(int) > 20) & (r.astype(int) - b.astype(int) > 25)
    sub_u8 = is_yellow.astype(np.uint8) * 255
    sub_cl = cv2.morphologyEx(sub_u8, cv2.MORPH_OPEN,
                               cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    k = max(15, int(round(min(h, w) * 0.08))) | 1
    board_cl = cv2.morphologyEx(sub_cl, cv2.MORPH_CLOSE,
                                 cv2.getStructuringElement(cv2.MORPH_RECT, (k, k)))
    cnts, _ = cv2.findContours(board_cl, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    board_mask = np.zeros((h, w), dtype=np.uint8)
    if cnts:
        c = max(cnts, key=cv2.contourArea)
        if cv2.contourArea(c) > 0.05 * h * w:
            cv2.fillPoly(board_mask, [cv2.convexHull(c)], 255)
            board_mask = cv2.erode(board_mask,
                                   cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
        else:
            board_mask[:] = 255
    else:
        board_mask[:] = 255

    sub_px = is_yellow & (board_mask > 0)
    is_backlit = sub_px.sum() > 0.08 * max(1, board_mask.sum() // 255)
    gray = cv2.cvtColor(board_bgr, cv2.COLOR_BGR2GRAY)
    filt = cv2.bilateralFilter(gray, 7, 50, 7)

    if is_backlit:
        bp = filt[board_mask > 0]
        t_val = max(60, min(int(cv2.threshold(bp, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[0]) - 12, 115)) if len(bp) > 50 else 110
        copper_raw = (filt < t_val) & (board_mask > 0)
    else:
        rd = np.clip(r.astype(int) - b.astype(int), 0, 255).astype(np.uint8)
        bp = rd[board_mask > 0]
        t_val = max(30, int(cv2.threshold(bp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0])) if len(bp) > 50 else 40
        copper_raw = (rd > t_val) & (board_mask > 0)

    m = cv2.medianBlur(copper_raw.astype(np.uint8) * 255, 3) // 255
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    keep = np.zeros(n, np.uint8); keep[1:] = (st[1:, cv2.CC_STAT_AREA] >= min_area)
    out = (keep[lab] * 255).astype(np.uint8)
    out[board_mask == 0] = 0
    return out


def internal_pad_to_multiple(img, m=32):
    h, w = img.shape[:2]
    ph, pw = (-h) % m, (-w) % m
    if ph or pw:
        img = cv2.copyMakeBorder(img, 0, ph, 0, pw, cv2.BORDER_REFLECT_101)
    return img, (h, w)


def internal_preprocess_for_ai(img_bgr):
    x = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    x = (x - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
    return np.ascontiguousarray(x.transpose(2, 0, 1))


# ==============================================================================
# Part 3: PCBTraceDrawer  (UX overhaul)
# ==============================================================================
MAX_UNDO = 30   # จำนวน undo สูงสุด
_SNAP_ANGLES = np.array([0, 45, 90, 135, 180, -45, -90, -135, -180], dtype=float)


def _snap_point(p1, p2_raw):
    """ล็อคมุมเป็น 0/45/90/135° (ใช้เมื่อกด SHIFT)"""
    dx, dy = p2_raw[0] - p1[0], p2_raw[1] - p1[1]
    angle  = np.degrees(np.arctan2(dy, dx))
    snapped = _SNAP_ANGLES[np.argmin(np.abs(_SNAP_ANGLES - angle))] * np.pi / 180
    dist = np.hypot(dx, dy)
    return (int(round(p1[0] + dist * np.cos(snapped))),
            int(round(p1[1] + dist * np.sin(snapped))))


def _flood_fill(mask, seed_xy, fill_val=255):
    """Bucket fill แบบ connected component (ไม่ใช้ cv2.floodFill เพื่อหลีกเลี่ยงขอบปัญหา)"""
    x, y = seed_xy
    if mask[y, x] == fill_val:
        return mask  # คลิกบนพื้นที่ที่ fill แล้ว — เปลี่ยนเป็นลบออก
    h, w = mask.shape
    seed_val = int(mask[y, x])
    # ใช้ floodFill ของ OpenCV บน copy แล้วเอา diff มา XOR
    flood = mask.copy()
    flood_pad = cv2.copyMakeBorder(flood, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=128)
    cv2.floodFill(flood_pad, None, (x + 1, y + 1), 200,
                  loDiff=1, upDiff=1,
                  flags=cv2.FLOODFILL_FIXED_RANGE | 4)
    flood_result = flood_pad[1:-1, 1:-1]
    changed = (flood_result == 200)
    out = mask.copy()
    out[changed] = fill_val
    return out


class PCBTraceDrawer:
    """
    Ground Truth Studio & Trace Drawer — UX-overhauled version

    Modes
    -----
    brush   [B]  : คลิกลากวาด (DEFAULT)
    line    [L]  : คลิกลากค้าง → ปล่อยวาดเส้น, SHIFT=ล็อคมุม, CTRL=ต่อเนื่อง
    eraser  [E]  : คลิกลากลบ
    fill    [F]  : คลิกจุดเดียว flood-fill
    pad     [P]  : คลิกจุดเดียว stamp วงกลม (via/pad)
    move    [M]  : ลาก template (ไม่วาด mask)

    Brush size
    ----------
    Scroll wheel ขึ้น/ลง ปรับขนาด brush/eraser ทันที

    Template controls
    -----------------
    [1-4]        : เลือก template
    [R]          : หมุน 90°
    [H]          : flip แนวนอน
    [V]          : flip แนวตั้ง
    Arrow keys   : เลื่อน offset ±2px (ใน move mode ±5px)
    Scroll wheel : scale ทั้งคู่ (ใน move mode)
    [0]          : reset transform
    [SPACE/Enter]: lock template → mask

    File controls
    -------------
    [S]          : save
    [N]          : save + next image
    [Prev]       : save + previous image  (mapped to comma [,] or left arrow when in move)
    [Ctrl+Z]/[Z] : undo  (สูงสุด 30 ขั้น)
    [Delete/C]   : clear mask
    [A]          : auto-detect (OpenCV)
    [T]          : AI predict (TinyUNet)
    [O]          : หมุนภาพจริง 90°
    [+/-]        : zoom canvas
    [Q/ESC]      : save + quit
    """

    def __init__(self,
                 images_dir=None,
                 masks_dir=None,
                 templates_dir=None,
                 model_path=None):

        # ── ค้นหาโฟลเดอร์อัตโนมัติ ──────────────────────────────────────────
        if images_dir is None:
            for c in ["train_ai_pcb/dataset_v4/images", "dataset_v4/images",
                      "train_ai_pcb/dataset/images", "dataset/images"]:
                if os.path.exists(c) and glob.glob(os.path.join(c, "*.png")):
                    images_dir = c; break
            if images_dir is None:
                images_dir = "train_ai_pcb/dataset_v4/images"

        if masks_dir is None:
            masks_dir = os.path.join(os.path.dirname(images_dir), "masks")

        if templates_dir is None:
            for c in ["train_ai_pcb/dataset_v2/real-pcb", "dataset_v2/real-pcb",
                      "train_ai_pcb/real-pcb", "test_functions"]:
                if os.path.exists(c) and glob.glob(os.path.join(c, "*.png")):
                    templates_dir = c; break
            if templates_dir is None:
                templates_dir = "train_ai_pcb/dataset_v2/real-pcb"

        if model_path is None:
            for c in ["train_ai_pcb/models/copper_unet.pt", "models/copper_unet.pt"]:
                if os.path.exists(c):
                    model_path = c; break
            if model_path is None:
                model_path = "train_ai_pcb/models/copper_unet.pt"

        self.images_dir    = images_dir
        self.masks_dir     = masks_dir
        self.templates_dir = templates_dir
        self.model_path    = model_path
        self.model         = None
        self.device        = "cuda" if (HAS_TORCH and torch.cuda.is_available()) else "cpu"
        os.makedirs(masks_dir, exist_ok=True)

        self.image_paths = sorted(
            glob.glob(os.path.join(images_dir, "*.png")) +
            glob.glob(os.path.join(images_dir, "*.jpg")))
        if not self.image_paths:
            raise RuntimeError(f"ไม่พบภาพใน: {images_dir}")

        # ── Drawing state ────────────────────────────────────────────────────
        self.curr_idx      = 0
        self.mode          = "brush"         # DEFAULT = brush
        self.brush_size    = 0.5             # ขนาดเริ่มต้น 0.5 px (ช่วง 0.1 - 2.0 px)
        self.brush_sizes   = [0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0]
        self.pad_radius    = 6
        self.scale         = 1.15            # canvas zoom
        self._lbutton      = False
        self._line_p1      = None            # จุดเริ่มต้น drag ของ line mode
        self._line_snap    = False
        self._line_continuous = False        # CTRL+click ต่อเนื่อง
        self._prev_brush   = None            # จุดก่อนหน้าของ brush (interpolation)
        self._mid_pan      = False           # กลาง-คลิก pan
        self._mid_pan_start = None
        self._mid_pan_off  = (0, 0)
        self.mouse_xy      = (0, 0)          # ตำแหน่ง mouse ปัจจุบัน (image coords)

        # ── Template state ───────────────────────────────────────────────────
        self.templates:    Dict[str, Any] = {}
        self._load_templates()
        self.tpl_keys      = sorted(self.templates.keys())
        self.active_tpl    = self.tpl_keys[0] if self.tpl_keys else None
        self.t_rot         = 0
        self.t_flip_h      = False
        self.t_flip_v      = False
        self.t_off_x       = 0
        self.t_off_y       = 0
        self.t_sx          = 1.0
        self.t_sy          = 1.0

        # ── History (undo stack) ─────────────────────────────────────────────
        self._history: List[np.ndarray] = []
        self._dirty   = False               # มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก

        self._load_image()

    # ─────────────────────────────────────────────────────────────────────────
    # Image / Template loading
    # ─────────────────────────────────────────────────────────────────────────
    def _load_templates(self):
        if not os.path.exists(self.templates_dir):
            return
        for p in sorted(glob.glob(os.path.join(self.templates_dir, "*.png")) +
                        glob.glob(os.path.join(self.templates_dir, "*.jpg"))):
            stem = Path(p).stem.lower()
            img  = cv2.imread(p, cv2.IMREAD_GRAYSCALE)
            if img is not None:
                self.templates[stem] = {
                    "orig":  img,
                    "copper": np.where(img < 128, 255, 0).astype(np.uint8),
                }
        print(f"โหลด template ได้ {len(self.templates)} แบบ: {list(self.templates.keys())}")

    def _load_image(self):
        p = self.image_paths[self.curr_idx]
        self.orig_img = cv2.imread(p)
        if self.orig_img is None:
            raise RuntimeError(f"เปิดภาพไม่ได้: {p}")
        self.h0, self.w0 = self.orig_img.shape[:2]

        mp = os.path.join(self.masks_dir,
                          Path(p).stem + ".png")
        if os.path.exists(mp):
            m = cv2.imread(mp, cv2.IMREAD_GRAYSCALE)
            self.mask = cv2.resize(m, (self.w0, self.h0), interpolation=cv2.INTER_NEAREST) \
                        if m is not None and m.shape[:2] != (self.h0, self.w0) \
                        else (m if m is not None else np.zeros((self.h0, self.w0), np.uint8))
        else:
            self.mask = np.zeros((self.h0, self.w0), np.uint8)

        self._history = [self.mask.copy()]
        self._dirty   = False
        self._line_p1 = None

        # เดา template จากชื่อไฟล์
        fname = Path(p).stem.lower()
        for k in self.tpl_keys:
            if k in fname:
                self.active_tpl = k; break

        print(f"เปิดภาพ [{self.curr_idx+1}/{len(self.image_paths)}]: {Path(p).name} "
              f"| template: {(self.active_tpl or 'none').upper()}")

    # ─────────────────────────────────────────────────────────────────────────
    # Template transform
    # ─────────────────────────────────────────────────────────────────────────
    def _get_template(self):
        """คืน (copper_mask, gray_img) ที่ transform แล้ว หรือ (None, None)"""
        if not self.active_tpl or self.active_tpl not in self.templates:
            return None, None
        td = self.templates[self.active_tpl]
        m  = td["copper"].copy()
        g  = td["orig"].copy()
        if self.t_flip_h: m = cv2.flip(m, 1); g = cv2.flip(g, 1)
        if self.t_flip_v: m = cv2.flip(m, 0); g = cv2.flip(g, 0)
        rot_map = {90: cv2.ROTATE_90_CLOCKWISE, 180: cv2.ROTATE_180, 270: cv2.ROTATE_90_COUNTERCLOCKWISE}
        if self.t_rot in rot_map:
            m = cv2.rotate(m, rot_map[self.t_rot])
            g = cv2.rotate(g, rot_map[self.t_rot])
        m = cv2.resize(m, (self.w0, self.h0), interpolation=cv2.INTER_NEAREST)
        g = cv2.resize(g, (self.w0, self.h0), interpolation=cv2.INTER_LINEAR)
        cx, cy = self.w0 / 2.0, self.h0 / 2.0
        M = np.float32([[self.t_sx, 0, (1 - self.t_sx) * cx + self.t_off_x],
                        [0, self.t_sy, (1 - self.t_sy) * cy + self.t_off_y]])
        m = cv2.warpAffine(m, M, (self.w0, self.h0), borderValue=0)
        g = cv2.warpAffine(g, M, (self.w0, self.h0), borderValue=255)
        return m, g

    # ─────────────────────────────────────────────────────────────────────────
    # Undo / History
    # ─────────────────────────────────────────────────────────────────────────
    def _push_history(self):
        self._history.append(self.mask.copy())
        if len(self._history) > MAX_UNDO + 1:
            self._history.pop(0)
        self._dirty = True

    def _undo(self):
        if len(self._history) > 1:
            self._history.pop()
            self.mask = self._history[-1].copy()
            self._line_p1 = None
            print(f"undo ({len(self._history)-1} ขั้นที่ยังย้อนได้)")
        else:
            print("undo ไม่ได้แล้ว (ไม่มี history)")

    # ─────────────────────────────────────────────────────────────────────────
    # Coordinate helpers
    # ─────────────────────────────────────────────────────────────────────────
    def _to_img(self, x, y):
        """display coords → image coords (เฉพาะจอซ้าย)"""
        ix = int(round(x / self.scale))
        iy = int(round(y / self.scale))
        return (max(0, min(ix, self.w0 - 1)),
                max(0, min(iy, self.h0 - 1)))

    # ─────────────────────────────────────────────────────────────────────────
    # Drawing primitives
    # ─────────────────────────────────────────────────────────────────────────
    def _draw_brush(self, p, color=255):
        # รองรับขนาดหัวแปรงละเอียด 0.1px - 2.0px
        line_th = 1 if self.brush_size <= 1.2 else 2
        r_dab = 0 if self.brush_size <= 0.8 else 1

        if self._prev_brush is not None:
            cv2.line(self.mask, self._prev_brush, p, color, line_th)

        if r_dab == 0:
            self.mask[p[1], p[0]] = color
        else:
            cv2.circle(self.mask, p, r_dab, color, -1)

        self._prev_brush = p
        self._dirty = True

    def _draw_line(self, p1, p2, color=255):
        line_th = 1 if self.brush_size <= 1.2 else 2
        cv2.line(self.mask, p1, p2, color, line_th)
        self._dirty = True

    def _draw_pad(self, p, color=255):
        cv2.circle(self.mask, p, self.pad_radius, color, -1)
        self._dirty = True

    def _do_fill(self, p, color=255):
        self._push_history()
        self.mask = _flood_fill(self.mask, p, fill_val=color)
        self._dirty = True

    # ─────────────────────────────────────────────────────────────────────────
    # Mouse callback (simplified, all modes)
    # ─────────────────────────────────────────────────────────────────────────
    def _mouse(self, event, x, y, flags, param):
        # ไม่รับ input ถ้าคลิกอยู่บนจอขวา (template panel)
        half_w = int(self.w0 * self.scale) + 4
        if x >= half_w:
            return

        cx, cy = self._to_img(x, y)
        self.mouse_xy = (cx, cy)

        # ── กลาง-คลิก: pan template ───────────────────────────────────────
        if event == cv2.EVENT_MBUTTONDOWN:
            self._mid_pan = True
            self._mid_pan_start = (x, y)
            self._mid_pan_off   = (self.t_off_x, self.t_off_y)
            return
        if event == cv2.EVENT_MOUSEMOVE and self._mid_pan:
            if self._mid_pan_start:
                dx = int(round((x - self._mid_pan_start[0]) / self.scale))
                dy = int(round((y - self._mid_pan_start[1]) / self.scale))
                self.t_off_x = self._mid_pan_off[0] + dx
                self.t_off_y = self._mid_pan_off[1] + dy
            return
        if event == cv2.EVENT_MBUTTONUP:
            self._mid_pan = False
            return

        # ── Scroll wheel: brush size หรือ template scale ──────────────────
        if event == cv2.EVENT_MOUSEWHEEL:
            delta = 1 if (flags & 0x80000000) == 0 else -1   # บน=+1, ล่าง=-1
            if self.mode == "move":
                factor = 0.02 * delta
                if flags & cv2.EVENT_FLAG_SHIFTKEY:
                    self.t_sx = round(max(0.3, min(3.0, self.t_sx + factor)), 3)
                elif flags & cv2.EVENT_FLAG_CTRLKEY:
                    self.t_sy = round(max(0.3, min(3.0, self.t_sy + factor)), 3)
                else:
                    self.t_sx = round(max(0.3, min(3.0, self.t_sx + factor)), 3)
                    self.t_sy = self.t_sx
            else:
                d = 1 if delta > 0 else -1
                idx = min(range(len(self.brush_sizes)), key=lambda i: abs(self.brush_sizes[i] - self.brush_size))
                new_idx = max(0, min(len(self.brush_sizes) - 1, idx + d))
                self.brush_size = self.brush_sizes[new_idx]
                print(f"📏 ขนาดหัวแปรง / ยางลบ: {self.brush_size:.1f} px")
            return

        # ── คลิกขวา: undo / ยกเลิก line point ────────────────────────────
        if event == cv2.EVENT_RBUTTONDOWN:
            if self._line_p1 is not None:
                self._line_p1 = None   # ยกเลิกจุดเริ่มต้นเส้น
            else:
                self._undo()
            return

        # ── MOVE mode: drag เลื่อน template ──────────────────────────────
        if self.mode == "move":
            if event == cv2.EVENT_LBUTTONDOWN:
                self._lbutton = True
                self._mid_pan_start = (x, y)
                self._mid_pan_off   = (self.t_off_x, self.t_off_y)
            elif event == cv2.EVENT_MOUSEMOVE and self._lbutton:
                if self._mid_pan_start:
                    dx = int(round((x - self._mid_pan_start[0]) / self.scale))
                    dy = int(round((y - self._mid_pan_start[1]) / self.scale))
                    self.t_off_x = self._mid_pan_off[0] + dx
                    self.t_off_y = self._mid_pan_off[1] + dy
            elif event == cv2.EVENT_LBUTTONUP:
                self._lbutton = False
            return

        # ── FILL mode ─────────────────────────────────────────────────────
        if self.mode == "fill":
            if event == cv2.EVENT_LBUTTONDOWN:
                self._do_fill((cx, cy))
            return

        # ── PAD mode ──────────────────────────────────────────────────────
        if self.mode == "pad":
            if event == cv2.EVENT_LBUTTONDOWN:
                self._push_history()
                self._draw_pad((cx, cy))
            return

        # ── ERASER mode ───────────────────────────────────────────────────
        if self.mode == "eraser":
            if event == cv2.EVENT_LBUTTONDOWN:
                self._push_history()
                self._lbutton = True
                self._prev_brush = None
                self._draw_brush((cx, cy), color=0)
            elif event == cv2.EVENT_MOUSEMOVE and self._lbutton:
                self._draw_brush((cx, cy), color=0)
            elif event == cv2.EVENT_LBUTTONUP:
                self._lbutton = False
                self._prev_brush = None
            return

        # ── BRUSH mode ────────────────────────────────────────────────────
        if self.mode == "brush":
            if event == cv2.EVENT_LBUTTONDOWN:
                self._push_history()
                self._lbutton = True
                self._prev_brush = None
                self._draw_brush((cx, cy))
            elif event == cv2.EVENT_MOUSEMOVE and self._lbutton:
                self._draw_brush((cx, cy))
            elif event == cv2.EVENT_LBUTTONUP:
                self._lbutton = False
                self._prev_brush = None
            return

        # ── LINE mode ─────────────────────────────────────────────────────
        # คลิกลากค้าง → ปล่อยเมาส์ถึงวาด (ไม่ต้องคลิก 2 จุดแยกกัน)
        if self.mode == "line":
            snap = bool(flags & cv2.EVENT_FLAG_SHIFTKEY)
            cont = bool(flags & cv2.EVENT_FLAG_CTRLKEY)   # ต่อเนื่องจากปลายเส้นเดิม

            if event == cv2.EVENT_LBUTTONDOWN:
                self._lbutton = True
                if self._line_p1 is None or not cont:
                    self._line_p1 = (cx, cy)
                self._line_snap = snap

            elif event == cv2.EVENT_MOUSEMOVE and self._lbutton:
                # preview อยู่ใน render loop แล้ว ไม่ต้องทำอะไรที่นี่
                self._line_snap = snap

            elif event == cv2.EVENT_LBUTTONUP:
                if self._line_p1 is not None and self._lbutton:
                    p2 = _snap_point(self._line_p1, (cx, cy)) if self._line_snap else (cx, cy)
                    if p2 != self._line_p1:   # ป้องกันคลิกเดียวโดยไม่ขยับ
                        self._push_history()
                        self._draw_line(self._line_p1, p2)
                        if cont:
                            self._line_p1 = p2  # ต่อเส้นจากปลาย
                        else:
                            self._line_p1 = None
                self._lbutton = False

    # ─────────────────────────────────────────────────────────────────────────
    # AI / Auto detect
    # ─────────────────────────────────────────────────────────────────────────
    def _auto_detect(self):
        print("Auto-detect (OpenCV)...")
        self._push_history()
        self.mask = cv2.bitwise_or(self.mask, internal_extract_copper_mask(self.orig_img))
        print("done")

    def _ai_predict(self, thr=0.5):
        if not HAS_TORCH:
            print("ต้องติดตั้ง PyTorch"); return
        if self.model is None:
            if not os.path.exists(self.model_path):
                print(f"ไม่พบโมเดล: {self.model_path}"); return
            ck = torch.load(self.model_path, map_location=self.device)
            self.model = TinyUNet(base=ck.get("base", 16)).to(self.device)
            self.model.load_state_dict(ck["model"])
            self.model.eval()
        print("AI predict...")
        self._push_history()
        im, (h, w) = internal_pad_to_multiple(self.orig_img, 32)
        inp = torch.from_numpy(internal_preprocess_for_ai(im))[None].to(self.device)
        with torch.no_grad():
            p = torch.sigmoid(self.model(inp))[0, 0].float().cpu().numpy()
        self.mask = ((p[:h, :w] >= thr) * 255).astype(np.uint8)
        self._line_p1 = None
        print("done")

    # ─────────────────────────────────────────────────────────────────────────
    # Save
    # ─────────────────────────────────────────────────────────────────────────
    def _save(self):
        fname = Path(self.image_paths[self.curr_idx]).stem + ".png"
        out   = os.path.join(self.masks_dir, fname)
        cv2.imwrite(out, self.mask)
        bk    = os.path.join(os.path.dirname(self.masks_dir), "masks_backup")
        os.makedirs(bk, exist_ok=True)
        cv2.imwrite(os.path.join(bk, fname), self.mask)
        self._dirty = False
        print(f"บันทึก: {fname}")

    # ─────────────────────────────────────────────────────────────────────────
    # HUD (On-screen display)
    # ─────────────────────────────────────────────────────────────────────────
    def _draw_hud(self, canvas):
        """วาด HUD แสดง mode/size/shortcut ด้านล่าง canvas"""
        h, w = canvas.shape[:2]
        bar_h = 80
        bar   = np.zeros((bar_h, w, 3), np.uint8)

        mode_color = {
            "brush": (0, 220, 0), "line": (0, 200, 255),
            "eraser": (0, 60, 255), "fill": (255, 180, 0),
            "pad": (200, 0, 255), "move": (0, 255, 255),
        }
        mc = mode_color.get(self.mode, (200, 200, 200))

        fname = Path(self.image_paths[self.curr_idx]).name
        dirty_mark = " *" if self._dirty else ""
        tpl_name = (self.active_tpl or "none").upper()
        l1 = (f"[{self.curr_idx+1}/{len(self.image_paths)}] {fname}{dirty_mark}"
              f"  |  MODE: {self.mode.upper()}  |  SIZE: {self.brush_size:.1f}px"
              f"  |  ZOOM: {self.scale:.1f}x  |  TPL: {tpl_name}")
        l2 = (f"TPL offset:({self.t_off_x:+d},{self.t_off_y:+d})"
              f"  scale:({self.t_sx:.2f},{self.t_sy:.2f})"
              f"  rot:{self.t_rot}°  flip:{'H' if self.t_flip_h else '-'}{'V' if self.t_flip_v else '-'}")
        l3 = ("[B]rush [L]ine [E]raser [F]ill [P]ad [M]ove | [W]/Wheel=size (0.1-2.0px) | RClick=undo"
              " | [S]ave [N]ext [,]Prev | [A]uto [T]AI | [SPACE]=lock tpl | [Q]uit")

        cv2.putText(bar, l1, (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.44, mc,       1, cv2.LINE_AA)
        cv2.putText(bar, l2, (8, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (150,230,230), 1, cv2.LINE_AA)
        cv2.putText(bar, l3, (8, 64), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (170,255,160), 1, cv2.LINE_AA)

        return np.vstack([canvas, bar])

    # ─────────────────────────────────────────────────────────────────────────
    # Render one frame
    # ─────────────────────────────────────────────────────────────────────────
    def _render(self):
        tpl_mask, tpl_gray = self._get_template()
        cx, cy = self.mouse_xy

        # ── จอซ้าย: ภาพ + mask overlay ──────────────────────────────────────
        left = self.orig_img.copy()
        green_layer = left.copy()

        if self.mode == "move" and tpl_mask is not None:
            green_layer[tpl_mask > 127] = (0, 220, 220)
        else:
            green_layer[self.mask > 127] = (0, 220, 0)

        left = cv2.addWeighted(left, 0.45, green_layer, 0.55, 0)

        # cursor preview
        mode_colors = {"brush": (0,220,0), "eraser": (0,60,255),
                       "line": (0,180,255), "fill": (255,160,0),
                       "pad": (200,0,255), "move": (0,220,220)}
        cc = mode_colors.get(self.mode, (200,200,200))

        if self.mode in ("brush", "eraser"):
            r_cur = 1 if self.brush_size <= 1.0 else 2
            cv2.circle(left, (cx, cy), r_cur, cc, 1, cv2.LINE_AA)
            cv2.drawMarker(left, (cx, cy), cc, cv2.MARKER_CROSS, 4, 1, cv2.LINE_AA)

        elif self.mode == "line":
            cv2.drawMarker(left, (cx, cy), cc, cv2.MARKER_CROSS, 6, 1, cv2.LINE_AA)
            if self._line_p1 is not None:
                p2_prev = _snap_point(self._line_p1, (cx, cy)) if self._line_snap else (cx, cy)
                line_th = 1 if self.brush_size <= 1.2 else 2
                cv2.line(left, self._line_p1, p2_prev, cc, line_th, cv2.LINE_AA)
                cv2.circle(left, self._line_p1, 3, (0,0,255), -1)

        elif self.mode == "pad":
            cv2.circle(left, (cx, cy), self.pad_radius, cc, 1, cv2.LINE_AA)

        elif self.mode == "fill":
            cv2.drawMarker(left, (cx, cy), cc, cv2.MARKER_TILTED_CROSS, 10, 2, cv2.LINE_AA)

        # mode label บนภาพ
        cv2.putText(left, self.mode.upper(), (6, 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, cc, 2, cv2.LINE_AA)

        # ── จอขวา: template ──────────────────────────────────────────────────
        if tpl_gray is not None:
            right = cv2.cvtColor(tpl_gray, cv2.COLOR_GRAY2BGR)
            # แสดง copper overlay สีเขียวบน template
            if tpl_mask is not None:
                ov = right.copy(); ov[tpl_mask > 127] = (0, 180, 0)
                right = cv2.addWeighted(right, 0.5, ov, 0.5, 0)
            lbl = (f"{(self.active_tpl or '').upper()} | {self.t_rot}° | "
                   f"[SPACE]=lock | [R]ot [H/V]flip [0]=reset | Arrows=move | Wheel(move)=scale")
            cv2.putText(right, lbl, (6, 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.40, (0,255,180), 1, cv2.LINE_AA)
        else:
            right = np.zeros_like(self.orig_img)
            cv2.putText(right, "Press [1-4] to select template",
                        (10, self.h0 // 2), cv2.FONT_HERSHEY_SIMPLEX,
                        0.55, (0,255,255), 1, cv2.LINE_AA)

        # scale & combine
        wd = int(self.w0 * self.scale)
        hd = int(self.h0 * self.scale)
        left_d  = cv2.resize(left,  (wd, hd), interpolation=cv2.INTER_LINEAR)
        right_d = cv2.resize(right, (wd, hd), interpolation=cv2.INTER_LINEAR)
        div     = np.full((hd, 4, 3), 70, np.uint8)
        canvas  = np.hstack([left_d, div, right_d])
        return self._draw_hud(canvas)

    # ─────────────────────────────────────────────────────────────────────────
    # Main loop
    # ─────────────────────────────────────────────────────────────────────────
    def run(self):
        WIN = "PCB Ground Truth Studio"
        cv2.namedWindow(WIN, cv2.WINDOW_NORMAL)
        cv2.setMouseCallback(WIN, self._mouse)

        print("\n" + "="*66)
        print("  PCB Ground Truth Studio — UX Edition")
        print("="*66)
        print("  [B] Brush (DEFAULT) — คลิกลากวาดทันที")
        print("  [L] Line  — คลิกลากค้าง/ปล่อยวาด  SHIFT=ล็อคมุม  CTRL=ต่อเส้น")
        print("  [E] Eraser — คลิกลากลบ")
        print("  [F] Fill  — flood-fill จุดคลิก (ปิดช่องโหว่ทันที)")
        print("  [P] Pad   — stamp วงกลม via/pad")
        print("  [M] Move  — ลาก template  Wheel=scale  Arrows=เลื่อน")
        print("  Scroll wheel (นอก move mode) = ปรับขนาด brush/eraser")
        print("  กลาง-คลิกลาก = pan template (ทุก mode)")
        print("  คลิกขวา = undo / ยกเลิก line point")
        print("  [1-4] เลือก template | [R] หมุน | [H/V] flip | [0] reset")
        print("  [SPACE/Enter] lock template → mask")
        print("  [S] save  [N] next  [,] prev  [Ctrl+Z/Z] undo  [C/Del] clear")
        print("  [A] auto-detect  [T] AI predict  [O] หมุนภาพ")
        print("  [+/-] zoom  [Q/ESC] save+quit")
        print("="*66 + "\n")

        while True:
            cv2.imshow(WIN, self._render())
            key = cv2.waitKey(8) & 0xFF     # 8ms ≈ 125 fps → cursor ลื่น

            if key == 255:  # no key
                continue

            # ── Mode keys ─────────────────────────────────────────────────
            if   key == ord('b'): self.mode = "brush";  self._line_p1 = None; print("mode: BRUSH")
            elif key == ord('l'): self.mode = "line";   self._line_p1 = None; print("mode: LINE")
            elif key == ord('e'): self.mode = "eraser"; self._line_p1 = None; print("mode: ERASER")
            elif key == ord('f'): self.mode = "fill";   self._line_p1 = None; print("mode: FILL")
            elif key == ord('p'): self.mode = "pad";    self._line_p1 = None; print("mode: PAD")
            elif key == ord('m'): self.mode = "move";   self._line_p1 = None; print("mode: MOVE")

            # ── Brush size (W / Shift+W หรือ [ / ]) ─────────────────────
            elif key == ord('w'):
                idx = min(range(len(self.brush_sizes)), key=lambda i: abs(self.brush_sizes[i] - self.brush_size))
                self.brush_size = self.brush_sizes[(idx + 1) % len(self.brush_sizes)]
                print(f"📏 ขนาดหัวแปรง / ยางลบ: {self.brush_size:.1f} px")
            elif key in (ord('W'), ord('[')):
                idx = min(range(len(self.brush_sizes)), key=lambda i: abs(self.brush_sizes[i] - self.brush_size))
                self.brush_size = self.brush_sizes[(idx - 1) % len(self.brush_sizes)]
                print(f"📏 ขนาดหัวแปรง / ยางลบ: {self.brush_size:.1f} px")
            elif key == ord(']'):
                idx = min(range(len(self.brush_sizes)), key=lambda i: abs(self.brush_sizes[i] - self.brush_size))
                self.brush_size = self.brush_sizes[min(len(self.brush_sizes) - 1, idx + 1)]
                print(f"📏 ขนาดหัวแปรง / ยางลบ: {self.brush_size:.1f} px")

            # ── Template controls ──────────────────────────────────────────
            elif key == ord('1') and len(self.tpl_keys) >= 1: self.active_tpl = self.tpl_keys[0]; print(f"template: {self.active_tpl.upper()}")
            elif key == ord('2') and len(self.tpl_keys) >= 2: self.active_tpl = self.tpl_keys[1]; print(f"template: {self.active_tpl.upper()}")
            elif key == ord('3') and len(self.tpl_keys) >= 3: self.active_tpl = self.tpl_keys[2]; print(f"template: {self.active_tpl.upper()}")
            elif key == ord('4') and len(self.tpl_keys) >= 4: self.active_tpl = self.tpl_keys[3]; print(f"template: {self.active_tpl.upper()}")
            elif key == ord('r'): self.t_rot = (self.t_rot + 90) % 360; print(f"rot: {self.t_rot}°")
            elif key == ord('h'): self.t_flip_h = not self.t_flip_h; print(f"flip H: {self.t_flip_h}")
            elif key == ord('v'): self.t_flip_v = not self.t_flip_v; print(f"flip V: {self.t_flip_v}")
            elif key == ord('0'):
                self.t_off_x = self.t_off_y = 0
                self.t_sx = self.t_sy = 1.0
                print("reset template transform")

            # Arrow keys (template offset)
            elif key == 81 or key == ord('j'): self.t_off_x -= (5 if self.mode == "move" else 2)
            elif key == 83 or key == ord('k'): self.t_off_x += (5 if self.mode == "move" else 2)
            elif key == 82 or key == ord('i'): self.t_off_y -= (5 if self.mode == "move" else 2)
            elif key == 84 or key == ord(',') - 27: self.t_off_y += (5 if self.mode == "move" else 2)

            elif key in (32, 13):  # SPACE / Enter → lock template
                tm, _ = self._get_template()
                if tm is not None:
                    self._push_history()
                    self.mask = tm.copy()
                    self._line_p1 = None
                    print(f"lock template: {(self.active_tpl or '').upper()}")

            # ── File/Edit ──────────────────────────────────────────────────
            elif key == ord('s'): self._save()
            elif key == ord('n'):
                self._save()
                if self.curr_idx < len(self.image_paths) - 1:
                    self.curr_idx += 1; self._load_image()
                else: print("ครบทุกภาพแล้ว")
            elif key == ord(','):
                self._save()
                if self.curr_idx > 0:
                    self.curr_idx -= 1; self._load_image()
            elif key in (26, ord('z')):   # Ctrl+Z หรือ z
                self._undo()
            elif key in (127, ord('c')):  # Delete หรือ c
                self._push_history()
                self.mask = np.zeros((self.h0, self.w0), np.uint8)
                self._line_p1 = None
                print("clear mask")
            elif key == ord('a'): self._auto_detect()
            elif key == ord('t'): self._ai_predict()
            elif key == ord('o'):          # หมุนภาพจริง
                self._push_history()
                self.orig_img = cv2.rotate(self.orig_img, cv2.ROTATE_90_CLOCKWISE)
                self.mask     = cv2.rotate(self.mask,     cv2.ROTATE_90_CLOCKWISE)
                self.h0, self.w0 = self.orig_img.shape[:2]
                cv2.imwrite(self.image_paths[self.curr_idx], self.orig_img)
                self._save()
                print("หมุนภาพ 90°")
            elif key in (ord('+'), ord('=')):
                self.scale = min(3.0, self.scale + 0.1)
            elif key in (ord('-'), ord('_')):
                self.scale = max(0.4, self.scale - 0.1)
            elif key in (ord('q'), 27):    # Q / ESC
                self._save(); break

        cv2.destroyAllWindows()


# ==============================================================================
# Part 4: Public API & Entry point
# ==============================================================================
def run_trace_drawer(dataset_dir=None, images_dir=None, masks_dir=None,
                     templates_dir=None, model_path=None):
    if dataset_dir is not None:
        images_dir = os.path.join(dataset_dir, "images")
        masks_dir  = os.path.join(dataset_dir, "masks")
    PCBTraceDrawer(images_dir=images_dir, masks_dir=masks_dir,
                   templates_dir=templates_dir, model_path=model_path).run()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dataset",   default="train_ai_pcb/dataset_v4")
    p.add_argument("--images",    default=None)
    p.add_argument("--masks",     default=None)
    p.add_argument("--templates", default=None)
    p.add_argument("--model",     default=None)
    a = p.parse_args()
    run_trace_drawer(dataset_dir=a.dataset, images_dir=a.images, masks_dir=a.masks,
                     templates_dir=a.templates, model_path=a.model)


if __name__ == "__main__":
    main()