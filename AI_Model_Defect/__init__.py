"""
AI_Model package
================
Patch-Based Region Convolutional Neural Network (Patch-RCNN) for PCB Defect Detection.
Designed for 240-318 AI & ML principles (Assoc. Prof. Dr. Anant Choksuriwong curriculum).
"""

from .patch_rcnn import (
    PatchDecomposer,
    PatchJoiner,
    MobileNetDefectCNN,
    GradCAMExplainer,
    PatchRCNNClassifier,
    PCBDefectRCNN,
    CLASSES,
    CLASS_COLORS
)

__all__ = [
    "PatchDecomposer",
    "PatchJoiner",
    "MobileNetDefectCNN",
    "GradCAMExplainer",
    "PatchRCNNClassifier",
    "PCBDefectRCNN",
    "CLASSES",
    "CLASS_COLORS"
]
