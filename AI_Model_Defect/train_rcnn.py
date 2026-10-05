"""
AI_Model/train_rcnn.py
======================
High-Performance In-Memory Training Pipeline for Patch-RCNN PCB Defect Classifier.

Aligns with 240-318 AI & ML concepts:
  - Week 03: Data Preprocessing, Stratified Split, Fast In-Memory Pipeline, Data Augmentation
  - Week 05: Class Imbalance Weights, Confusion Matrix, Precision/Recall/F1 metrics
  - Week 09: AdamW Optimizer, Cosine Annealing LR Schedule, Weight Decay Regularization
  - Week 10: Transfer Learning with MobileNetV2 (Slide 21-22), FN-penalty cost matrix (Slide 28)
"""

import os
import sys
import json
import time
import random
import argparse
from typing import Dict, Any, List, Tuple

import cv2
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

from AI_Model_Defect.patch_rcnn import MobileNetDefectCNN, CLASSES, CLASS_TO_IDX, IDX_TO_CLASS

# Optimize CPU threads
torch.set_num_threads(8)


# ==============================================================================
# 1. In-Memory Cached Dataset Class for PCB Defect Crops
# ==============================================================================
class FastPCBCropDataset(Dataset):
    """
    Preloads and caches candidate defect crops in RAM to eliminate disk I/O bottlenecks.
    Parses the 3-panel differential representation:
      - Channel 0: Nominal CAD Design Mask
      - Channel 1: Observed Physical Board Copper Mask
      - Channel 2: Differential Residual Map (D xor T)
    """
    def __init__(self, records: List[Dict[str, Any]], crops_dir: str, augment: bool = False,
                 target_size: Tuple[int, int] = (128, 128)):
        self.records = records
        self.augment = augment
        self.target_size = target_size
        self.data_cache = []

        print(f"[*] Preloading {len(records)} crops into RAM (target_size={target_size})...")
        t0 = time.time()
        for rec in records:
            cid = rec["id"]
            label_str = rec.get("pred", "normal")
            target_idx = CLASS_TO_IDX.get(label_str, CLASS_TO_IDX["normal"])

            img_path = os.path.join(crops_dir, f"{cid}.png")
            sheet = cv2.imread(img_path)
            if sheet is None:
                sample = np.zeros((target_size[0], target_size[1], 3), dtype=np.uint8)
            else:
                c0 = sheet[:, :256]
                c1 = sheet[:, 262:518] if sheet.shape[1] >= 518 else c0
                c2 = sheet[:, 524:780] if sheet.shape[1] >= 780 else c0

                g0 = cv2.cvtColor(c0, cv2.COLOR_BGR2GRAY)
                g1 = cv2.cvtColor(c1, cv2.COLOR_BGR2GRAY)
                g2 = cv2.cvtColor(c2, cv2.COLOR_BGR2GRAY)

                g0 = cv2.resize(g0, target_size, interpolation=cv2.INTER_AREA)
                g1 = cv2.resize(g1, target_size, interpolation=cv2.INTER_AREA)
                g2 = cv2.resize(g2, target_size, interpolation=cv2.INTER_AREA)

                sample = np.stack([g0, g1, g2], axis=-1)

            self.data_cache.append((sample, target_idx, cid))

        print(f"[*] Preloading completed in {time.time() - t0:.2f}s.")

    def __len__(self) -> int:
        return len(self.data_cache)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int, str]:
        sample, target_idx, cid = self.data_cache[idx]
        img = sample.copy()

        # Data Augmentation (Week 03 & Week 10)
        if self.augment:
            if random.random() > 0.5:
                img = np.fliplr(img)
            if random.random() > 0.5:
                img = np.flipud(img)
            k = random.choice([0, 1, 2, 3])
            if k > 0:
                img = np.rot90(img, k)

        tensor = torch.from_numpy(np.ascontiguousarray(img.transpose(2, 0, 1))).float() / 255.0
        return tensor, target_idx, cid


# ==============================================================================
# 2. Training and Evaluation Function
# ==============================================================================
def train_model(
    candidates_path: str = "/home/punpk/project/PCB-Defect-Detection/label_data/candidates.jsonl",
    crops_dir: str = "/home/punpk/project/PCB-Defect-Detection/label_data/crops",
    output_dir: str = "/home/punpk/project/PCB-Defect-Detection/AI_Model",
    epochs: int = 15,
    batch_size: int = 32,
    lr: float = 5e-4,
    val_split: float = 0.20,
    seed: int = 42
):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Training Device: {device} (PyTorch threads: {torch.get_num_threads()})")

    # Load candidates
    records = []
    with open(candidates_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))

    print(f"[*] Total candidates loaded: {len(records)}")

    # Stratified Train/Val split (Week 03 & Week 10 Slide 23)
    labels = [r.get("pred", "normal") for r in records]
    train_recs, val_recs = train_test_split(records, test_size=val_split, random_state=seed, stratify=labels)
    print(f"[*] Training samples: {len(train_recs)}, Validation samples: {len(val_recs)}")

    # Compute Class Weights for Cost-Asymmetric Loss (Week 05 & Week 10 Slide 28)
    class_counts = {c: 0 for c in CLASSES}
    for r in train_recs:
        c = r.get("pred", "normal")
        if c in class_counts:
            class_counts[c] += 1

    total_samples = len(train_recs)
    num_classes = len(CLASSES)
    weights = []
    for c in CLASSES:
        cnt = max(1, class_counts[c])
        w = total_samples / (num_classes * cnt)
        # Asymmetric penalty for critical defects (open & short)
        if c in ("open", "short"):
            w *= 1.40
        weights.append(w)

    class_weights_tensor = torch.tensor(weights, dtype=torch.float32).to(device)
    print(f"[*] Class distribution in train set: {class_counts}")
    print(f"[*] Adjusted Class Weights (FN-penalized): {[round(w, 2) for w in weights]}")

    # Datasets & DataLoaders with In-Memory Caching
    train_ds = FastPCBCropDataset(train_recs, crops_dir, augment=True, target_size=(128, 128))
    val_ds = FastPCBCropDataset(val_recs, crops_dir, augment=False, target_size=(128, 128))

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    # Initialize MobileNetV2 Defect CNN (Week 10 Slide 21-22)
    model = MobileNetDefectCNN(num_classes=num_classes, in_channels=3, pretrained=True, freeze_backbone=True)
    model.to(device)

    # Loss function & Optimizer (Week 09: AdamW on trainable parameters)
    trainable_params = [p for p in model.parameters() if p.requires_grad]
    print(f"[*] Trainable parameters: {sum(p.numel() for p in trainable_params):,} / {sum(p.numel() for p in model.parameters()):,}")
    criterion = nn.CrossEntropyLoss(weight=class_weights_tensor)
    optimizer = torch.optim.AdamW(trainable_params, lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-5)

    best_val_f1 = -1.0
    best_weights_path = os.path.join(output_dir, "pcb_defect_rcnn.pt")
    os.makedirs(output_dir, exist_ok=True)

    history = {"train_loss": [], "val_loss": [], "val_acc": [], "val_f1": []}

    print("\n" + "="*70)
    print("Beginning Training: MobileNetV2 Patch-RCNN Defect Detector")
    print("="*70)

    for epoch in range(1, epochs + 1):
        t0 = time.time()
        # Train Loop
        model.train()
        train_loss_total = 0.0
        train_correct = 0
        train_total = 0

        for tensors, targets, _ in train_loader:
            tensors = tensors.to(device)
            targets = targets.to(device)

            optimizer.zero_grad()
            outputs = model(tensors)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()

            train_loss_total += loss.item() * tensors.size(0)
            preds = outputs.argmax(dim=1)
            train_correct += (preds == targets).sum().item()
            train_total += tensors.size(0)

        scheduler.step()
        train_loss = train_loss_total / max(1, train_total)
        train_acc = train_correct / max(1, train_total)

        # Validation Loop
        model.eval()
        val_loss_total = 0.0
        val_preds_all = []
        val_targets_all = []

        with torch.no_grad():
            for tensors, targets, _ in val_loader:
                tensors = tensors.to(device)
                targets = targets.to(device)
                outputs = model(tensors)
                loss = criterion(outputs, targets)

                val_loss_total += loss.item() * tensors.size(0)
                preds = outputs.argmax(dim=1)

                val_preds_all.extend(preds.cpu().numpy())
                val_targets_all.extend(targets.cpu().numpy())

        val_loss = val_loss_total / max(1, len(val_recs))
        val_acc = np.mean(np.array(val_preds_all) == np.array(val_targets_all))

        # Macro F1-score
        report = classification_report(val_targets_all, val_preds_all, target_names=CLASSES,
                                       output_dict=True, zero_division=0)
        macro_f1 = report["macro avg"]["f1-score"]

        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(float(val_acc))
        history["val_f1"].append(float(macro_f1))

        elapsed = time.time() - t0
        print(f"Epoch [{epoch:02d}/{epochs:02d}] ({elapsed:.2f}s) | "
              f"Train Loss: {train_loss:.4f} Acc: {train_acc*100:.1f}% | "
              f"Val Loss: {val_loss:.4f} Acc: {val_acc*100:.1f}% F1: {macro_f1:.4f}")

        # Checkpoint best model
        if macro_f1 > best_val_f1:
            best_val_f1 = macro_f1
            torch.save({
                "epoch": epoch,
                "state_dict": model.state_dict(),
                "classes": CLASSES,
                "val_acc": float(val_acc),
                "val_f1": float(macro_f1),
                "history": history
            }, best_weights_path)
            print(f"  --> Saved new best checkpoint to {best_weights_path} (F1: {macro_f1:.4f})")

    print("\n" + "="*70)
    print("Training Completed. Final Evaluation on Validation Set:")
    print("="*70)

    # Load best model for final evaluation
    best_ckpt = torch.load(best_weights_path, map_location=device)
    model.load_state_dict(best_ckpt["state_dict"])
    model.eval()

    val_preds_all = []
    val_targets_all = []
    with torch.no_grad():
        for tensors, targets, _ in val_loader:
            outputs = model(tensors.to(device))
            val_preds_all.extend(outputs.argmax(dim=1).cpu().numpy())
            val_targets_all.extend(targets.cpu().numpy())

    final_report = classification_report(val_targets_all, val_preds_all, target_names=CLASSES, zero_division=0)
    print(final_report)

    cm = confusion_matrix(val_targets_all, val_preds_all)
    print("Confusion Matrix:")
    print(f"Labels: {CLASSES}")
    print(cm)

    # Export ONNX model for Edge / Production deployment
    onnx_path = os.path.join(output_dir, "pcb_defect_rcnn.onnx")
    dummy_input = torch.randn(1, 3, 128, 128, device=device)
    try:
        torch.onnx.export(
            model,
            dummy_input,
            onnx_path,
            input_names=["input_tensor"],
            output_names=["logits"],
            dynamic_axes={"input_tensor": {0: "batch_size"}, "logits": {0: "batch_size"}},
            opset_version=14,
            dynamo=False
        )
        print(f"[*] Successfully exported ONNX model to: {onnx_path}")
    except Exception as e:
        print(f"[!] ONNX export note: {e}")

    # Save metrics JSON
    metrics_path = os.path.join(output_dir, "training_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump({
            "best_f1": float(best_val_f1),
            "final_accuracy": float(np.mean(np.array(val_preds_all) == np.array(val_targets_all))),
            "confusion_matrix": cm.tolist(),
            "classes": CLASSES,
            "history": history
        }, f, indent=2)
    print(f"[*] Saved metrics to: {metrics_path}")


if __name__ == "__main__":
    train_model()
