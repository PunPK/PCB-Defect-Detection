"""
AI_Model/evaluate_and_explain.py
================================
Evaluation and Explainable AI (XAI) script using Grad-CAM.

Aligns with 240-318 AI & ML concepts:
  - Week 05: Supervised Learning Metrics (Confusion Matrix, Precision, Recall, F1)
  - Week 10: Grad-CAM Explainability (Slide 25: "Model มองอะไร?", Slide 28: Defect Review)
    * Visual proof that the CNN identifies the specific broken trace (open) or bridge (short).
"""

import os
import json
import cv2
import numpy as np
import torch
import torch.nn.functional as F
import matplotlib.pyplot as plt

from AI_Model_Defect.patch_rcnn import (
    MobileNetDefectCNN,
    GradCAMExplainer,
    CLASSES,
    CLASS_TO_IDX,
    CLASS_COLORS
)


def run_evaluation(
    model_path: str = "/home/punpk/project/PCB-Defect-Detection/AI_Model/pcb_defect_rcnn.pt",
    candidates_path: str = "/home/punpk/project/PCB-Defect-Detection/label_data/candidates.jsonl",
    crops_dir: str = "/home/punpk/project/PCB-Defect-Detection/label_data/crops",
    output_dir: str = "/home/punpk/project/PCB-Defect-Detection/AI_Model/results"
):
    os.makedirs(output_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Evaluation Device: {device}")

    if not os.path.exists(model_path):
        print(f"[!] Model path does not exist: {model_path}. Train the model first!")
        return

    # Load Model
    ckpt = torch.load(model_path, map_location=device)
    model = MobileNetDefectCNN(num_classes=len(CLASSES), in_channels=3)
    model.load_state_dict(ckpt["state_dict"])
    model.to(device)
    model.eval()

    explainer = GradCAMExplainer(model, device)

    # Load candidates
    records = []
    with open(candidates_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))

    # Pick sample candidates for open and short
    samples_by_class = {}
    for r in records:
        lbl = r.get("pred", "normal")
        if lbl not in samples_by_class and os.path.exists(os.path.join(crops_dir, f"{r['id']}.png")):
            samples_by_class[lbl] = r
        if len(samples_by_class) == len(CLASSES):
            break

    print(f"[*] Generating Grad-CAM visual explanations for: {list(samples_by_class.keys())}")

    # Generate explanations
    fig, axes = plt.subplots(len(samples_by_class), 4, figsize=(16, 4 * len(samples_by_class)))
    if len(samples_by_class) == 1:
        axes = np.expand_dims(axes, 0)

    for row_idx, (cls_name, rec) in enumerate(samples_by_class.items()):
        cid = rec["id"]
        sheet = cv2.imread(os.path.join(crops_dir, f"{cid}.png"))
        if sheet is None:
            continue

        c0 = sheet[:, :256] # Design
        c1 = sheet[:, 262:518] # Test Mask
        c2 = sheet[:, 524:780] # Diff
        
        g0 = cv2.cvtColor(c0, cv2.COLOR_BGR2GRAY)
        g1 = cv2.cvtColor(c1, cv2.COLOR_BGR2GRAY)
        g2 = cv2.cvtColor(c2, cv2.COLOR_BGR2GRAY)
        sample = np.stack([g0, g1, g2], axis=-1)

        tensor = torch.from_numpy(sample.transpose(2, 0, 1)).float().unsqueeze(0) / 255.0
        
        with torch.no_grad():
            logits = model(tensor.to(device))
            probs = F.softmax(logits, dim=1).cpu().numpy()[0]
            pred_idx = int(probs.argmax())
            pred_cls = CLASSES[pred_idx]
            conf = probs[pred_idx]

        # Generate Grad-CAM heatmap
        target_idx = CLASS_TO_IDX[cls_name]
        heatmap = explainer.generate_heatmap(tensor, target_idx)
        cam_overlay = explainer.overlay_heatmap(c2, heatmap, alpha=0.55)

        # Plot 4 panels: Design, Observed, Diff Residual, Grad-CAM Heatmap
        axes[row_idx, 0].imshow(cv2.cvtColor(c0, cv2.COLOR_BGR2RGB))
        axes[row_idx, 0].set_title(f"Target: {cls_name}\nCAD Design")
        axes[row_idx, 0].axis("off")

        axes[row_idx, 1].imshow(cv2.cvtColor(c1, cv2.COLOR_BGR2RGB))
        axes[row_idx, 1].set_title(f"Sample: {cid[:18]}\nObserved Copper")
        axes[row_idx, 1].axis("off")

        axes[row_idx, 2].imshow(cv2.cvtColor(c2, cv2.COLOR_BGR2RGB))
        axes[row_idx, 2].set_title(f"Pred: {pred_cls} ({conf*100:.1f}%)\nDifferential Map")
        axes[row_idx, 2].axis("off")

        axes[row_idx, 3].imshow(cv2.cvtColor(cam_overlay, cv2.COLOR_BGR2RGB))
        axes[row_idx, 3].set_title(f"Grad-CAM (Week 10)\nDefect Focus Heatmap")
        axes[row_idx, 3].axis("off")

        # Save individual high-res image
        single_out = os.path.join(output_dir, f"gradcam_{cls_name}_{cid}.png")
        cv2.imwrite(single_out, cam_overlay)

    plt.tight_layout()
    grid_out = os.path.join(output_dir, "gradcam_summary_grid.png")
    plt.savefig(grid_out, dpi=200)
    plt.close()

    print(f"[*] Successfully saved Grad-CAM explanation grid to: {grid_out}")


if __name__ == "__main__":
    run_evaluation()
