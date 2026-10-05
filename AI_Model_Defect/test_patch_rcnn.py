"""
AI_Model/test_patch_rcnn.py
===========================
Verification script to test Patch-RCNN functionality, tiling, joining, NMS,
and compatibility with pcb_compare.py.
"""

import os
import sys
import numpy as np
import cv2

from AI_Model_Defect.patch_rcnn import (
    PatchDecomposer,
    PatchJoiner,
    PCBDefectRCNN,
    PatchRCNNClassifier,
    CLASSES
)


def test_tiling_and_joining():
    print("[1] Testing PatchDecomposer & PatchJoiner...")
    decomposer = PatchDecomposer(patch_size=256, overlap=64)
    canvas = np.zeros((600, 800, 3), dtype=np.uint8)
    tiles = decomposer.split(canvas)
    print(f"    Split {canvas.shape[:2]} into {len(tiles)} overlapping tiles.")
    assert len(tiles) > 0, "No tiles created"

    # Test coordinate mapping
    joiner = PatchJoiner()
    tile_box = (100, 150, 256, 256)
    local_box = (20, 30, 40, 50)
    gbox = joiner.local_to_global_bbox(local_box, tile_box)
    assert gbox == (120, 180, 40, 50), f"Incorrect global box: {gbox}"
    print(f"    Local {local_box} -> Global {gbox}: PASSED")

    # Test NMS
    dets = [
        {"bbox": [100, 100, 50, 50], "prob": 0.95, "cls": "open"},
        {"bbox": [102, 101, 48, 49], "prob": 0.85, "cls": "open"}, # High overlap -> should be suppressed
        {"bbox": [300, 300, 50, 50], "prob": 0.90, "cls": "short"}
    ]
    kept = joiner.apply_nms(dets, iou_threshold=0.30)
    assert len(kept) == 2, f"NMS expected 2 detections, got {len(kept)}"
    print("    Non-Maximum Suppression (NMS): PASSED")


def test_backward_compatibility():
    print("[2] Testing backward compatibility with pcb_compare DefectClassifier...")
    clf = PatchRCNNClassifier()
    # Mock features vector
    X = np.random.randn(5, 22)
    labs, probs, cls = clf.predict(X, critical_thr=0.35)
    assert len(labs) == 5, "Mismatch in prediction length"
    assert probs.shape == (5, 4), f"Incorrect probability shape: {probs.shape}"
    assert cls == CLASSES, f"Classes mismatch: {cls}"
    print(f"    Predicted labels: {labs}")
    print("    Backward compatibility with pcb_compare: PASSED")


if __name__ == "__main__":
    test_tiling_and_joining()
    test_backward_compatibility()
    print("\nAll unit tests passed successfully!")
