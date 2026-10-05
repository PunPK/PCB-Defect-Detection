"""
make_notebook.py
================
Builds the comprehensive PCB_Defect_Patch_RCNN_Walkthrough.ipynb notebook.
"""

import json
import os

notebook = {
    "cells": [],
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3 (pcb-env)",
            "language": "python",
            "name": "python3"
        },
        "language_info": {
            "name": "python",
            "version": "3.12.3"
        }
    },
    "nbformat": 4,
    "nbformat_minor": 5
}

def md(source):
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [line + "\n" for line in source.strip().split("\n")]
    })

def code(source):
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [line + "\n" for line in source.strip().split("\n")]
    })

# Header
md("""# 🔍 PCB Defect Detection: Patch-Based Region CNN (Patch-RCNN)
### สถาปัตยกรรมและกระบวนการตรวจจับข้อบกพร่อง Open & Short บนแผ่นวงจรพิมพ์ด้วย AI
**วิชาอ้างอิง:** 240-318 AI & ML (ผู้สอน: รศ.ดร.อนันต์ โชคสุริวงศ์)  
**จัดทำสำหรับ:** การนำเสนอโครงงานและอธิบายหลักการทางคณิตศาสตร์ / โมเดล Deep Learning ต่ออาจารย์ผู้เชี่ยวชาญ

---
### 📌 วัตถุประสงค์ของสมุดงานนี้ (Notebook Objectives):
1. **สาธิตแนวคิด Patch-Based R-CNN:** ทำไมการแบ่งภาพเป็นหลาย Segment (Tiling) แล้วนำมา Join กันด้วย NMS จึงแก้ปัญหาการตรวจจับแผ่น PCB ได้ดีกว่า CNN ปกติ
2. **การบูรณาการหลักการจากรายวิชา 240-318 AI & ML:**
   - **Week 02:** Mathematics for ML (Affine Coordinate Projection & Softmax)
   - **Week 03:** Data Preprocessing, Stratified Split & Augmentation
   - **Week 05:** Supervised Learning (Cost-Asymmetric Decision Thresholds, Confusion Matrix)
   - **Week 09:** Neural Networks (AdamW Optimizer, Cosine Annealing, Dropout Regularization)
   - **Week 10:** CNNs (MobileNetV2 Inverted Residuals, GAP, Receptive Field, Grad-CAM Explainability, Defect Detection Workflow)
3. **การทดลองจริงแบบ Interactive:** ดูการทำงานของ Input Tensor, Grid Slicing, NMS, และ Heatmap จาก Grad-CAM
""")

# Section 1
md("""## 1. ปัญหาทางวิศวกรรม: ทำไมต้องใช้ Patch-Based Slicing แทน Full-Image CNN?
ในอุตสาหกรรมผลิต PCB:
- ภาพถ่ายบอร์ดมีความละเอียดสูงมาก เช่น $2000 \\times 2000$ ถึง $4000 \\times 3000$ พิกเซล
- แต่รอยขาด (**Open Circuit**) หรือสะพานช็อต (**Short Circuit**) มีความกว้างเพียง $3 - 10$ พิกเซล ($< 0.5\\%$ ของความกว้างภาพ)

> ⚠️ **The Small Object Dilution Problem:**  
> หากนำภาพทั้งแผ่นมาย่อขนาด (Downsampling) ให้เหลือ $224 \\times 224$ เพื่อป้อนเข้า CNN ทั่วไป รอยตำหนิเล็กๆ จะสูญหายไปทันทีตามทฤษฎีการชักตัวอย่างของไนควิสต์-แชนนอน (Nyquist-Shannon Sampling Theorem)  
> 
> ✅ **ทางออกเชิงวิชาการ:**  
> การทำ **Patch-Based Slicing (Grid Tiling with Overlap)** ทำให้โมเดล CNN ทำงานที่ **Native Optical Resolution $1\\times$** เสมอ ทำให้เก็บรายละเอียดเส้นทองแดงได้อย่างแม่นยำระดับพิกเซล!
""")

# Section 2: Setup
md("""## 2. การเตรียมสภาพแวดล้อมและโหลดโมดูล (Environment Setup)""")
code("""import os
import sys
import math
import json
import time
import cv2
import numpy as np
import matplotlib.pyplot as plt
import torch
import torch.nn as nn
import torch.nn.functional as F

# นำเข้าโมดูลจากแพ็กเกจ AI_Model
from AI_Model.patch_rcnn import (
    PatchDecomposer,
    PatchJoiner,
    MobileNetDefectCNN,
    GradCAMExplainer,
    PatchRCNNClassifier,
    PCBDefectRCNN,
    CLASSES,
    CLASS_COLORS
)

print(f"PyTorch Version: {torch.__version__}")
print(f"CUDA Available: {torch.cuda.is_available()}")
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Execution Device: {device}")
print(f"Target Classes: {CLASSES}")
""")

# Section 3: Data Representation
md("""## 3. สถาปัตยกรรมข้อมูล: 3-Channel Differential Representation
เพื่อช่วยให้ CNN เรียนรู้ความแตกต่างระหว่าง **แบบแปลน CAD (Design Ground Truth)** กับ **แผ่นงานจริง (Observed PCB)** เราไม่ได้ป้อนแค่ภาพถ่ายสี RGB ทั่วไป แต่ใช้ **Siamese-Differential 3-Channel Tensor**:
1. **Channel 0:** CAD Design Nominal Mask ($D$) — โครงสร้างเรขาคณิตที่ถูกต้อง
2. **Channel 1:** Physical Inspected Copper Mask ($T$) — ลายทองแดงที่ผลิตจริง
3. **Channel 2:** Differential Residual ($|D - T|$) — บริเวณที่เกิดความผิดปกติ

**หลักการทำงานของ Convolution Kernels (Week 10):**
- **Open (วงจรขาด):** Channel 0 มีค่าสูง, Channel 1 เป็น 0, Channel 2 มีค่าสูง $\\rightarrow$ กระตุ้น Activation ของคลาส Open
- **Short (วงจรช็อต):** Channel 0 เป็น 0, Channel 1 มีค่าสูง, Channel 2 มีค่าสูง $\\rightarrow$ กระตุ้น Activation ของคลาส Short
- **Normal (ขอบกัดขรุขระตามธรรมชาติ):** มีค่ากระจัดกระจายแบบสมมาตร $\\rightarrow$ ถูกกรองออกโดย Convolution Layers ระดับลึก
""")

code("""# พล็อตตัวอย่างภาพจากชุดข้อมูลจริงใน label_data/crops
crops_dir = "label_data/crops"
candidates_file = "label_data/candidates.jsonl"

sample_crops = {}
with open(candidates_file, "r") as f:
    for line in f:
        item = json.loads(line)
        lbl = item.get("pred", "normal")
        cid = item.get("id")
        img_p = os.path.join(crops_dir, f"{cid}.png")
        if lbl not in sample_crops and os.path.exists(img_p):
            sample_crops[lbl] = (cid, img_p)
        if len(sample_crops) == len(CLASSES):
            break

fig, axes = plt.subplots(len(sample_crops), 3, figsize=(12, 4 * len(sample_crops)))
for idx, (lbl, (cid, path)) in enumerate(sample_crops.items()):
    sheet = cv2.imread(path)
    c0 = sheet[:, :256]          # Channel 0: Design CAD
    c1 = sheet[:, 259:515]       # Channel 1: Observed PCB
    c2 = sheet[:, 518:774]       # Channel 2: Diff Overlay
    
    axes[idx, 0].imshow(cv2.cvtColor(c0, cv2.COLOR_BGR2RGB))
    axes[idx, 0].set_title(f"[{lbl.upper()}] Channel 0: CAD Design")
    axes[idx, 0].axis("off")
    
    axes[idx, 1].imshow(cv2.cvtColor(c1, cv2.COLOR_BGR2RGB))
    axes[idx, 1].set_title(f"[{lbl.upper()}] Channel 1: Observed Copper")
    axes[idx, 1].axis("off")
    
    axes[idx, 2].imshow(cv2.cvtColor(c2, cv2.COLOR_BGR2RGB))
    axes[idx, 2].set_title(f"[{lbl.upper()}] Channel 2: Diff Residual Map")
    axes[idx, 2].axis("off")

plt.tight_layout()
plt.show()
""")

# Section 4: Patch Decomposition
md("""## 4. กลไก Patch Decomposition (Grid Slicing with Overlap)
เมื่อต้องการตรวจสอบบอร์ดขนาดใหญ่:
- แบ่งภาพเป็นตารางขนาด $S \\times S$ (เช่น $256 \\times 256$ พิกเซล)
- กำหนดระยะเกยทับ (Overlap) $O = 64$ พิกเซล $\\rightarrow$ ระยะเลื่อน (Stride) $L = S - O = 192$ พิกเซล

> 💡 **การแก้ปัญหาขอบรอยต่อ (Seam Artifacts):**  
> การทับซ้อน 64 พิกเซล รับประกันว่าไม่มีข้อบกพร่องใดตกอยู่ตรงรอยตัดพอดีโดยไม่ถูกโมเดลเห็นเต็มชิ้น
""")

code("""decomposer = PatchDecomposer(patch_size=256, overlap=64)

# จำลองบอร์ดความละเอียดสูง 600x800 พิกเซล
dummy_board = np.zeros((600, 800, 3), dtype=np.uint8)
tiles = decomposer.split(dummy_board)

print(f"ภาพขนาด: {dummy_board.shape[:2]}")
print(f"จำนวน Patch ที่ตัดแบ่งได้: {len(tiles)} ชิ้น")
print(f"ตัวอย่างพิกัด Patch 3 ชิ้นแรก [x, y, w, h]: {[t['box'] for t in tiles[:3]]}")
""")

# Section 5: MobileNetV2 Architecture
md("""## 5. สถาปัตยกรรมโมเดล: MobileNetV2 Transfer Learning Backbone
อ้างอิงเนื้อหา **Week 10 สไลด์หน้า 21-22**:
- ใช้ **Inverted Residuals** และ **Depthwise Separable Convolutions** ช่วยลดพารามิเตอร์เหลือเพียง ~2.2 ล้านตัว (เทียบกับ ResNet-50 ที่มี 25 ล้านตัว)
- **Global Average Pooling (GAP) (Week 10 หน้า 18, 22):** ยุบรวม Feature Map เชิงพื้นที่ให้เป็น Feature Vector โดยไม่ใช้ Dense Layer ขนาดใหญ่
- **Dropout ($p = 0.20$):** ป้องกันการ Overfitting
- **Softmax Head:** ส่งออกค่าความน่าจะเป็น $P(y = c \\mid \\mathbf{x})$
""")

code("""cnn_model = MobileNetDefectCNN(num_classes=len(CLASSES), in_channels=3)
total_params = sum(p.numel() for p in cnn_model.parameters() if p.requires_grad)

print(f"จำนวนพารามิเตอร์ที่ Train ได้: {total_params / 1e6:.2f} ล้านพารามิเตอร์")
print("โมเดลพร้อมสำหรับการประมวลผลความเร็วสูง (Real-time) บน Raspberry Pi 5 / Edge AI")
""")

# Section 6: Patch Joining & NMS
md("""## 6. การรวมผลกลับสู่ภาพรวม และ Non-Maximum Suppression (NMS)
หลังจากทำนายผลในแต่ละ Patch:
1. **Affine Coordinate Projection:** แปลงพิกัด Local ของ Patch สู่พิกัด Global ของบอร์ด:
   $$x_{\\text{global}} = x_{\\text{local}} + x_{\\text{tile}}, \\quad y_{\\text{global}} = y_{\\text{local}} + y_{\\text{tile}}$$
2. **Non-Maximum Suppression (NMS):** คำนวณ Intersection over Union (IoU) ระหว่าง Bounding Box:
   $$\\text{IoU}(B_1, B_2) = \\frac{\\text{Area}(B_1 \\cap B_2)}{\\text{Area}(B_1 \\cup B_2)}$$
   หาก $\\text{IoU} \\ge 0.30$ กล่องที่มีความมั่นใจต่ำกว่าจะถูกยุบรวมเข้ากับกล่องหลักทันที เพื่อขจัด False Alarm บริเวณขอบรอยต่อ
""")

code("""joiner = PatchJoiner()

# จำลองจุดตรวจจับที่มีการทับซ้อนกันบริเวณรอยต่อของ Patch
raw_detections = [
    {"bbox": [150, 200, 30, 25], "prob": 0.94, "cls": "open"},
    {"bbox": [152, 201, 28, 24], "prob": 0.81, "cls": "open"},  # ทับซ้อนกับกล่องแรก -> ต้องถูกยุบรวม
    {"bbox": [400, 350, 45, 40], "prob": 0.91, "cls": "short"}
]

filtered_detections = joiner.apply_nms(raw_detections, iou_threshold=0.30)

print(f"ก่อนทำ NMS: {len(raw_detections)} กล่อง")
print(f"หลังทำ NMS: {len(filtered_detections)} กล่อง")
for d in filtered_detections:
    print(f"  -> คลาส: {d['cls']}, ความมั่นใจ: {d['prob']*100:.1f}%, พิกัด: {d['bbox']}")
""")

# Section 7: Asymmetric Thresholding
md("""## 7. กลยุทธ์ Asymmetric Critical Thresholding (Week 05 & Week 10 หน้า 28)
> *"Focus on FN: False Negative (Defect $\\rightarrow$ OK) สำคัญ เพราะพลาด defect มีต้นทุนสูง"*

ในโรงงานผลิต PCB:
- การหลุดรอดของแผ่นเสีย (**False Negative**) มีต้นทุนเสียหายรุนแรงกว่าการเตือนซ้ำ (**False Positive**)
- เราจึงกำหนดเกณฑ์ตัดสิน Asymmetric Threshold: $\\tau_{\\text{crit}} = 0.35$ สำหรับ Open และ Short
""")

code("""critical_thr = 0.35

# สมมุติเวกเตอร์ Probability [open, short, minor, normal]
sample_probs = np.array([0.38, 0.05, 0.12, 0.45])

standard_pred = CLASSES[sample_probs.argmax()]
# Asymmetric Decision
if sample_probs[0] >= critical_thr:
    asymmetric_pred = "open"
elif sample_probs[1] >= critical_thr:
    asymmetric_pred = "short"
else:
    asymmetric_pred = standard_pred

print(f"ความน่าจะเป็น: Open={sample_probs[0]:.2f}, Normal={sample_probs[3]:.2f}")
print(f"คำตัดสินด้วย Argmax ปกติ (เกณฑ์ 0.50): {standard_pred} ❌ (เกิด False Negative!)")
print(f"คำตัดสินด้วย Asymmetric Thresholding (เกณฑ์ 0.35): {asymmetric_pred} ✅ (ปลอดภัยสำหรับโรงงาน)")
""")

# Section 8: Grad-CAM
md("""## 8. Explainable AI: การอธิบายผลด้วย Grad-CAM (Week 10 หน้า 25)
พิสูจน์ต่ออาจารย์ว่า **"โมเดลมองอะไร?" (What is the model looking at?)**:
- ใช้ความชันของคลาสเป้าหมาย $y^c$ เทียบกับ Feature Map $A^k$
- คำนวณ Heatmap:
  $$L_{\\text{Grad-CAM}}^c = \\text{ReLU}\\left( \\sum_k \\alpha_k^c A^k \\right)$$
""")

code("""# โหลดโมเดลเพื่อทดสอบ Grad-CAM
model_weights_path = "AI_Model/pcb_defect_rcnn.pt"

if os.path.exists(model_weights_path):
    ckpt = torch.load(model_weights_path, map_location=device)
    cnn_model.load_state_dict(ckpt["state_dict"])
    cnn_model.to(device)
    cnn_model.eval()
    
    explainer = GradCAMExplainer(cnn_model, device)
    
    # ทดสอบสร้าง Heatmap บนตัวอย่าง Open Defect
    if "open" in sample_crops:
        cid, path = sample_crops["open"]
        sheet = cv2.imread(path)
        c0 = sheet[:, :256]
        c1 = sheet[:, 259:515]
        c2 = sheet[:, 518:774]
        
        sample = np.stack([cv2.cvtColor(c0, cv2.COLOR_BGR2GRAY),
                          cv2.cvtColor(c1, cv2.COLOR_BGR2GRAY),
                          cv2.cvtColor(c2, cv2.COLOR_BGR2GRAY)], axis=-1)
        
        tensor = torch.from_numpy(sample.transpose(2, 0, 1)).float().unsqueeze(0) / 255.0
        heatmap = explainer.generate_heatmap(tensor, class_idx=0) # 0 = open
        cam_vis = explainer.overlay_heatmap(c2, heatmap, alpha=0.6)
        
        fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(14, 4))
        ax1.imshow(cv2.cvtColor(c0, cv2.COLOR_BGR2RGB))
        ax1.set_title("CAD Design")
        ax1.axis("off")
        
        ax2.imshow(cv2.cvtColor(c1, cv2.COLOR_BGR2RGB))
        ax2.set_title("Observed PCB (Broken Trace)")
        ax2.axis("off")
        
        ax3.imshow(cv2.cvtColor(cam_vis, cv2.COLOR_BGR2RGB))
        ax3.set_title("Grad-CAM Saliency Heatmap (Week 10)")
        ax3.axis("off")
        plt.tight_layout()
        plt.show()
else:
    print(f"หมายเหตุ: ไม่พบไฟล์ weights {model_weights_path} ให้รัน train_rcnn.py ก่อน")
""")

# Section 9: Defense FAQ
md("""## 9. สรุปและแนวทางการตอบคำถามอาจารย์ผู้เชี่ยวชาญ (Defense FAQ)

### ❓ คำถามที่ 1: ทำไมการหั่น Patch แล้วนำมา Join กัน ถึงดีกว่าการย่อภาพทั้งแผ่น?
> **คำตอบ:** ภาพ PCB เป็นปัญหาแบบ **High Resolution with Micro Defect** รอยขาดหรือช็อตมีขนาดเพียง $5 - 10$ px หากย่อภาพขนาดใหญ่ ($2000 \\times 2000$) ลงมาเหลือ $224 \\times 224$ ข้อมูลของรอยขาดจะถูกเฉลี่ยทิ้งจนหายไป การแบ่ง Patch ช่วยให้ CNN ทำงานที่ **Native Optical Resolution ($1\\times$)** เสมอ ทำให้เก็บรายละเอียดเส้นทองแดงได้อย่างแม่นยำ

### ❓ คำถามที่ 2: รอยต่อระหว่าง Patch มีปัญหาเรื่องข้อบกพร่องขาดออกจากกันหรือไม่?
> **คำตอบ:** ปัญหานี้ถูกกำจัดด้วย **Overlapping Stride ($O = 64$ px)** ทำให้ทุกบริเวณบนบอร์ดมีส่วนเกยทับกันอย่างน้อย 64 พิกเซล และใช้ **Spatial Non-Maximum Suppression (NMS, $\\text{IoU} \\ge 0.30$)** ในการยุบรวม Bounding Box ข้าม Patch กลับสู่พิกัด Global อย่างสมบูรณ์

### ❓ คำถามที่ 3: ทำไมเลือก MobileNetV2 เป็น Backbone?
> **คำตอบ:** อ้างอิงตามสไลด์ Week 10 หน้า 21-22 สถาปัตยกรรม **Inverted Residuals** และ **Depthwise Separable Convolutions** ช่วยลดจำนวนพารามิเตอร์ลงเหลือเพียง 2.2 ล้านตัว และใช้ Global Average Pooling (GAP) แทน Dense Layer ขนาดใหญ่ ทำให้โมเดลประมวลผลได้เร็วระดับ Real-time เหมาะสำหรับ Edge Computing บน Raspberry Pi 5 ในสายพานโรงงาน

### ❓ คำถามที่ 4: พิสูจน์ได้อย่างไรว่าโมเดลมองที่รอยขาดหรือช็อตจริง ไม่ได้ Overfit กับพื้นหลัง?
> **คำตอบ:** เราใช้ **Grad-CAM (Week 10 หน้า 25)** คำนวณ Gradient ย้อนกลับไปยัง Feature Map สุดท้าย ผลลัพธ์แสดงให้เห็นว่าบริเวณที่มีค่า Activation สูงสุดตรงกับจุดที่เส้นทองแดงขาดตอน (Open) และจุดสะพานเชื่อม (Short) อย่างชัดเจน
""")

out_path = "/home/punpk/project/PCB-Defect-Detection/AI_Model/PCB_Defect_Patch_RCNN_Walkthrough.ipynb"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(notebook, f, indent=1, ensure_ascii=False)

print(f"[*] Successfully created notebook: {out_path}")
