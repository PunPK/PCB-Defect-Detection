#!/usr/bin/env python3
"""
train_unet.py - Standalone Training & Inference CLI for TinyUNet Copper Trace Detection
======================================================================================
This script provides the complete training, evaluation, inference, and ONNX export
pipeline for the PCB Copper Trace Segmentation model (TinyUNet, ~1.94M parameters).
Replaces the need for train_unet.ipynb so that cloned repositories can run normally.

Usage Examples:
  1. Train from dataset:
     python models/train_unet.py --mode train --data-dir dataset_v4 --epochs 50

  2. Evaluate existing checkpoint:
     python models/train_unet.py --mode eval --model-path models/copper_unet.pt

  3. Export model to ONNX:
     python models/train_unet.py --mode export-onnx --model-path models/copper_unet.pt --output-onnx models/copper_unet.onnx

  4. Run inference on a PCB image:
     python models/train_unet.py --mode predict --input-image path/to/board.png --output-mask output_mask.png
"""

import os
import sys
import glob
import time
import argparse
from pathlib import Path
from typing import Optional, Tuple, List

import cv2
import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from torch.utils.data import Dataset, DataLoader
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

NORM_MEAN = 0.5
NORM_STD = 0.25


# ==============================================================================
# 1. TinyUNet Architecture (~1.94M parameters)
# ==============================================================================
if HAS_TORCH:
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

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            skips = [self.inc(x)]
            for d in self.downs:
                skips.append(d(self.pool(skips[-1])))
            x = self.drop(skips.pop())
            for up, dec in zip(self.ups, self.decs):
                x = dec(torch.cat([up(x), skips.pop()], dim=1))
            return self.head(x)


# ==============================================================================
# 2. Topology-Preserving Loss Functions (BCE + Dice + clDice)
# ==============================================================================
if HAS_TORCH:
    def soft_erode(x: torch.Tensor) -> torch.Tensor:
        p1 = -F.max_pool2d(-x, (3, 1), 1, (1, 0))
        p2 = -F.max_pool2d(-x, (1, 3), 1, (0, 1))
        return torch.min(p1, p2)

    def soft_dilate(x: torch.Tensor) -> torch.Tensor:
        return F.max_pool2d(x, 3, 1, 1)

    def soft_open(x: torch.Tensor) -> torch.Tensor:
        return soft_dilate(soft_erode(x))

    def soft_skel(x: torch.Tensor, iters: int = 10) -> torch.Tensor:
        skel = F.relu(x - soft_open(x))
        for _ in range(iters):
            x = soft_erode(x)
            skel = skel + F.relu(x - soft_open(x))
        return torch.clamp(skel, 0.0, 1.0)

    def cldice_loss(pred_prob: torch.Tensor, target: torch.Tensor, smooth: float = 1.0) -> torch.Tensor:
        skel_pred = soft_skel(pred_prob)
        skel_target = soft_skel(target)
        t_prec = (torch.sum(skel_pred * target) + smooth) / (torch.sum(skel_pred) + smooth)
        t_sens = (torch.sum(pred_prob * skel_target) + smooth) / (torch.sum(skel_target) + smooth)
        cl_dice = (2.0 * t_prec * t_sens) / (t_prec + t_sens + 1e-7)
        return 1.0 - cl_dice

    def masked_bce_loss(logits: torch.Tensor, target: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
        loss = F.binary_cross_entropy_with_logits(logits, target, reduction="none")
        return (loss * mask).sum() / (mask.sum() + 1e-7)

    def masked_dice_loss(pred_prob: torch.Tensor, target: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
        p = pred_prob * mask
        t = target * mask
        num = 2.0 * (p * t).sum() + 1.0
        den = (p ** 2).sum() + (t ** 2).sum() + 1.0
        return 1.0 - (num / den)

    def total_loss(logits: torch.Tensor, target_255: torch.Tensor, epoch: int = 1, w_cldice: float = 0.5, cl_warmup: int = 10) -> torch.Tensor:
        valid_mask = (target_255 != 128).float()
        target_bin = (target_255 == 255).float()
        pred_prob = torch.sigmoid(logits)

        l_bce = masked_bce_loss(logits, target_bin, valid_mask)
        l_dice = masked_dice_loss(pred_prob, target_bin, valid_mask)

        if epoch >= cl_warmup:
            l_cl = cldice_loss(pred_prob * valid_mask, target_bin * valid_mask)
            return l_bce + l_dice + w_cldice * l_cl
        return l_bce + l_dice


# ==============================================================================
# 3. Preprocessing & Dataset Loader
# ==============================================================================
def preprocess(img_bgr: np.ndarray) -> np.ndarray:
    x = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    x = (x - NORM_MEAN) / NORM_STD
    return np.ascontiguousarray(x.transpose(2, 0, 1))

def quantize_label(lab: np.ndarray) -> np.ndarray:
    return np.where(lab >= 192, 255, np.where(lab <= 64, 0, 128)).astype(np.uint8)

def pad_to_multiple(img: np.ndarray, m: int = 32) -> Tuple[np.ndarray, Tuple[int, int]]:
    h, w = img.shape[:2]
    ph, pw = (-h) % m, (-w) % m
    if ph or pw:
        img = cv2.copyMakeBorder(img, 0, ph, 0, pw, cv2.BORDER_REFLECT_101)
    return img, (h, w)

if HAS_TORCH:
    class PCBDataset(Dataset):
        def __init__(self, pairs: List[Tuple[str, str]], crop_size: int = 256, is_train: bool = True):
            self.pairs = pairs
            self.crop_size = crop_size
            self.is_train = is_train

        def __len__(self) -> int:
            return len(self.pairs)

        def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
            img_path, mask_path = self.pairs[idx]
            img = cv2.imread(img_path)
            mask = cv2.imread(mask_path, cv2.IMREAD_UNCHANGED)

            if img is None:
                img = np.zeros((self.crop_size, self.crop_size, 3), dtype=np.uint8)
            if mask is None:
                mask = np.zeros((self.crop_size, self.crop_size), dtype=np.uint8)

            if img.shape[:2] != (self.crop_size, self.crop_size):
                img = cv2.resize(img, (self.crop_size, self.crop_size))
                mask = cv2.resize(mask, (self.crop_size, self.crop_size), interpolation=cv2.INTER_NEAREST)

            mask = quantize_label(mask)

            if self.is_train:
                if np.random.rand() < 0.5:
                    img = np.fliplr(img).copy()
                    mask = np.fliplr(mask).copy()
                if np.random.rand() < 0.5:
                    img = np.flipud(img).copy()
                    mask = np.flipud(mask).copy()
                k = np.random.choice([0, 1, 2, 3])
                if k > 0:
                    img = np.rot90(img, k).copy()
                    mask = np.rot90(mask, k).copy()

            x = preprocess(img)
            y = mask.astype(np.float32)[None]
            return torch.from_numpy(x), torch.from_numpy(y)


# ==============================================================================
# 4. Training, Evaluation, and Export Procedures
# ==============================================================================
def resolve_model_path(path_str: str) -> str:
    p = Path(path_str)
    if p.exists():
        return str(p)
    candidates = [
        Path("models") / "copper_unet.pt",
        Path("AI_Model_Detect_Copper") / "models" / "copper_unet.pt",
        Path("train_ai_pcb") / "models" / "copper_unet.pt",
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return path_str

def train_model(args):
    if not HAS_TORCH:
        print("❌ PyTorch is required to train the model.")
        sys.exit(1)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"🚀 Device: {device.upper()}")

    data_dir = args.data_dir
    img_dir = os.path.join(data_dir, "images")
    mask_dir = os.path.join(data_dir, "masks")

    if not os.path.exists(img_dir) or not os.path.exists(mask_dir):
        # Auto-detect standard dataset directories
        for cand in ["dataset_v4", "AI_Model_Detect_Copper/dataset_v4", "train_ai_pcb/dataset_v4"]:
            if os.path.exists(os.path.join(cand, "images")):
                data_dir = cand
                img_dir = os.path.join(data_dir, "images")
                mask_dir = os.path.join(data_dir, "masks")
                break

    img_files = sorted(glob.glob(os.path.join(img_dir, "*.png")))
    pairs = []
    for ip in img_files:
        fn = os.path.basename(ip)
        mp = os.path.join(mask_dir, fn)
        if os.path.exists(mp):
            pairs.append((ip, mp))

    if not pairs:
        print(f"❌ No image-mask pairs found in {data_dir}")
        return

    np.random.seed(42)
    np.random.shuffle(pairs)
    n_val = max(1, int(len(pairs) * args.val_ratio))
    val_pairs = pairs[:n_val]
    train_pairs = pairs[n_val:]

    print(f"📊 Dataset: {len(pairs)} pairs (Train: {len(train_pairs)}, Val: {len(val_pairs)})")

    train_ds = PCBDataset(train_pairs, crop_size=args.crop, is_train=True)
    val_ds = PCBDataset(val_pairs, crop_size=args.crop, is_train=False)

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=2, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False)

    model = TinyUNet(base=args.base).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    total_steps = max(1, len(train_loader)) * args.epochs
    scheduler = torch.optim.lr_scheduler.OneCycleLR(optimizer, max_lr=args.lr, total_steps=total_steps, pct_start=0.15)

    best_val_dice = 0.0
    os.makedirs(os.path.dirname(os.path.abspath(args.model_path)), exist_ok=True)

    print(f"🎯 Training for {args.epochs} Epochs...")
    for epoch in range(1, args.epochs + 1):
        model.train()
        train_loss = 0.0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            logits = model(x)
            loss = total_loss(logits, y, epoch=epoch, w_cldice=args.w_cldice, cl_warmup=args.cl_warmup)
            loss.backward()
            optimizer.step()
            scheduler.step()
            train_loss += loss.item()

        train_loss /= max(1, len(train_loader))

        # Evaluate validation Dice
        model.eval()
        val_dices = []
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                logits = model(x)
                prob = torch.sigmoid(logits)
                pred = (prob > 0.5).float()
                target_bin = (y == 255).float()
                valid_mask = (y != 128).float()

                p = pred * valid_mask
                t = target_bin * valid_mask
                dice = (2.0 * (p * t).sum() + 1.0) / (p.sum() + t.sum() + 1.0)
                val_dices.append(dice.item())

        mean_val_dice = float(np.mean(val_dices))
        is_best = mean_val_dice > best_val_dice

        if is_best:
            best_val_dice = mean_val_dice
            torch.save({
                "model": model.state_dict(),
                "base": args.base,
                "epoch": epoch,
                "dice": best_val_dice,
            }, args.model_path)
            star = "⭐ Best Model Saved!"
        else:
            star = ""

        if epoch % 5 == 0 or is_best or epoch == args.epochs:
            print(f"Epoch [{epoch:02d}/{args.epochs}] | Loss: {train_loss:.4f} | Val Dice: {mean_val_dice:.4f} {star}")

    print(f"\n🎉 Training complete! Best Validation Dice: {best_val_dice:.4f}")
    print(f"💾 Checkpoint: {args.model_path}")

    if args.export_onnx:
        export_onnx(args.model_path, args.output_onnx, base=args.base)


def evaluate_model(args):
    if not HAS_TORCH:
        print("❌ PyTorch is required for evaluation.")
        sys.exit(1)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model_path = resolve_model_path(args.model_path)
    if not os.path.exists(model_path):
        print(f"❌ Model checkpoint not found at: {model_path}")
        return

    ckpt = torch.load(model_path, map_location=device)
    base = ckpt.get("base", args.base) if isinstance(ckpt, dict) else args.base
    model = TinyUNet(base=base).to(device)
    state = ckpt["model"] if isinstance(ckpt, dict) and "model" in ckpt else ckpt
    model.load_state_dict(state)
    model.eval()

    print(f"✅ Loaded checkpoint from: {model_path} (base={base})")

    data_dir = args.data_dir
    img_dir = os.path.join(data_dir, "images")
    mask_dir = os.path.join(data_dir, "masks")
    if not os.path.exists(img_dir):
        for cand in ["dataset_v4", "AI_Model_Detect_Copper/dataset_v4", "train_ai_pcb/dataset_v4"]:
            if os.path.exists(os.path.join(cand, "images")):
                img_dir = os.path.join(cand, "images")
                mask_dir = os.path.join(cand, "masks")
                break

    imgs = sorted(glob.glob(os.path.join(img_dir, "*.png")))
    tp, fp, tn, fn = 0, 0, 0, 0
    dices, ious = [], []

    with torch.no_grad():
        for ip in imgs:
            fn_base = os.path.basename(ip)
            mp = os.path.join(mask_dir, fn_base)
            if not os.path.exists(mp): continue
            img = cv2.imread(ip)
            gt = cv2.imread(mp, cv2.IMREAD_UNCHANGED)
            if img is None or gt is None: continue

            if img.shape[:2] != (256, 256):
                img = cv2.resize(img, (256, 256))
                gt = cv2.resize(gt, (256, 256), interpolation=cv2.INTER_NEAREST)

            x = preprocess(img)
            t = torch.from_numpy(x).unsqueeze(0).to(device)
            out = model(t)
            prob = torch.sigmoid(out).squeeze().cpu().numpy()
            pred = (prob > 0.5).astype(np.uint8)

            valid = (gt != 128)
            gt_bin = (gt == 255).astype(np.uint8)

            cur_tp = int(np.logical_and(pred == 1, gt_bin == 1)[valid].sum())
            cur_fp = int(np.logical_and(pred == 1, gt_bin == 0)[valid].sum())
            cur_tn = int(np.logical_and(pred == 0, gt_bin == 0)[valid].sum())
            cur_fn = int(np.logical_and(pred == 0, gt_bin == 1)[valid].sum())

            tp += cur_tp; fp += cur_fp; tn += cur_tn; fn += cur_fn
            cur_iou = cur_tp / max(1, cur_tp + cur_fp + cur_fn)
            cur_dice = (2 * cur_tp) / max(1, 2 * cur_tp + cur_fp + cur_fn)
            ious.append(cur_iou)
            dices.append(cur_dice)

    acc = (tp + tn) / max(1, tp + tn + fp + fn)
    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    f1 = (2 * precision * recall) / max(1e-7, precision + recall)

    print("\n" + "=" * 50)
    print(f"📊 Quantitative Evaluation Results ({len(ious)} samples):")
    print("=" * 50)
    print(f"  Pixel Accuracy : {acc * 100:.2f}%")
    print(f"  Precision      : {precision * 100:.2f}%")
    print(f"  Recall (Sens)  : {recall * 100:.2f}%")
    print(f"  Sørensen-Dice  : {f1 * 100:.2f}% (Mean per-patch: {np.mean(dices)*100:.2f}%)")
    print(f"  Jaccard (IoU)  : {np.mean(ious) * 100:.2f}%")
    print("=" * 50)


def export_onnx(model_path: str, output_onnx: str, base: int = 16):
    if not HAS_TORCH:
        print("❌ PyTorch is required to export ONNX.")
        return

    model_path = resolve_model_path(model_path)
    if not os.path.exists(model_path):
        print(f"❌ Cannot export ONNX: checkpoint not found at {model_path}")
        return

    ckpt = torch.load(model_path, map_location="cpu")
    base_val = ckpt.get("base", base) if isinstance(ckpt, dict) else base
    model = TinyUNet(base=base_val)
    state = ckpt["model"] if isinstance(ckpt, dict) and "model" in ckpt else ckpt
    model.load_state_dict(state)
    model.eval()

    dummy_input = torch.randn(1, 3, 256, 256)
    os.makedirs(os.path.dirname(os.path.abspath(output_onnx)), exist_ok=True)

    torch.onnx.export(
        model,
        dummy_input,
        output_onnx,
        input_names=["image"],
        output_names=["logits"],
        opset_version=17,
        dynamic_axes={"image": {0: "batch", 2: "height", 3: "width"}, "logits": {0: "batch", 2: "height", 3: "width"}},
    )
    print(f"✅ ONNX exported successfully: {output_onnx}")


def predict_image(args):
    if not HAS_TORCH:
        print("❌ PyTorch is required for prediction.")
        return

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model_path = resolve_model_path(args.model_path)
    if not os.path.exists(model_path):
        print(f"❌ Model not found: {model_path}")
        return

    ckpt = torch.load(model_path, map_location=device)
    base = ckpt.get("base", args.base) if isinstance(ckpt, dict) else args.base
    model = TinyUNet(base=base).to(device)
    state = ckpt["model"] if isinstance(ckpt, dict) and "model" in ckpt else ckpt
    model.load_state_dict(state)
    model.eval()

    img = cv2.imread(args.input_image)
    if img is None:
        print(f"❌ Could not read image: {args.input_image}")
        return

    orig_h, orig_w = img.shape[:2]
    resized = cv2.resize(img, (256, 256))
    x = preprocess(resized)
    t = torch.from_numpy(x).unsqueeze(0).to(device)

    with torch.no_grad():
        out = model(t)
        prob = torch.sigmoid(out).squeeze().cpu().numpy()

    mask = (prob > args.conf_thresh).astype(np.uint8) * 255
    if (orig_h, orig_w) != (256, 256):
        mask = cv2.resize(mask, (orig_w, orig_h), interpolation=cv2.INTER_NEAREST)

    out_path = args.output_mask or "predicted_mask.png"
    cv2.imwrite(out_path, mask)
    print(f"✅ Prediction saved to: {out_path}")


def main():
    parser = argparse.ArgumentParser(description="TinyUNet PCB Copper Trace Detection CLI")
    parser.add_argument("--mode", choices=["train", "eval", "export-onnx", "predict"], default="eval", help="Execution mode")
    parser.add_argument("--data-dir", default="dataset_v4", help="Path to dataset directory (containing images/ and masks/)")
    parser.add_argument("--model-path", default="models/copper_unet.pt", help="Path to PyTorch checkpoint")
    parser.add_argument("--output-onnx", default="models/copper_unet.onnx", help="Path for exported ONNX file")
    parser.add_argument("--input-image", default=None, help="Input image for predict mode")
    parser.add_argument("--output-mask", default=None, help="Output mask path for predict mode")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size")
    parser.add_argument("--lr", type=float, default=2e-3, help="Learning rate")
    parser.add_argument("--crop", type=int, default=256, help="Crop resolution (256x256)")
    parser.add_argument("--base", type=int, default=16, help="Base channels for TinyUNet (16)")
    parser.add_argument("--w-cldice", type=float, default=0.5, help="Weight of clDice loss")
    parser.add_argument("--cl-warmup", type=int, default=10, help="Epoch to activate clDice loss")
    parser.add_argument("--val-ratio", type=float, default=0.15, help="Validation split ratio")
    parser.add_argument("--conf-thresh", type=float, default=0.5, help="Confidence threshold for binarization")
    parser.add_argument("--export-onnx", action="store_true", help="Auto export ONNX after training")

    args = parser.parse_args()

    if args.mode == "train":
        train_model(args)
    elif args.mode == "eval":
        evaluate_model(args)
    elif args.mode == "export-onnx":
        export_onnx(args.model_path, args.output_onnx, base=args.base)
    elif args.mode == "predict":
        if not args.input_image:
            print("❌ Please specify --input-image for predict mode.")
            sys.exit(1)
        predict_image(args)


if __name__ == "__main__":
    main()
