from fastapi import (
    FastAPI,
    UploadFile,
    File,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
    APIRouter,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import cv2
import numpy as np
import asyncio
import uvicorn
import time
import os
from typing import Optional
import logging
import base64

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


def expand_contour(contour, percentage):
    """Expand contour boundaries by given percentage"""
    M = cv2.moments(contour)
    if M["m00"] == 0:
        return contour

    cx = int(M["m10"] / M["m00"])
    cy = int(M["m01"] / M["m00"])

    expanded = []
    for point in contour:
        x, y = point[0]
        dir_x = x - cx
        dir_y = y - cy
        new_x = cx + (1 + percentage) * dir_x
        new_y = cy + (1 + percentage) * dir_y
        expanded.append([[int(new_x), int(new_y)]])

    return np.array(expanded, dtype=np.int32)


def order_points(pts):
    """Order 4 points as: top-left, top-right, bottom-right, bottom-left"""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def four_point_transform(image, pts):
    """Perform perspective transform using 4 points"""
    (tl, tr, br, bl) = pts
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    dst = np.array(
        [[0, 0], [maxWidth - 1, 0], [maxWidth - 1, maxHeight - 1], [0, maxHeight - 1]],
        dtype="float32",
    )

    M = cv2.getPerspectiveTransform(pts, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    return warped


class CameraManager:
    def __init__(self):
        self.camera: Optional[cv2.VideoCapture] = None
        self.active_connections = 0
        self.lock = asyncio.Lock()
        self.frame_interval = 0.08

    async def get_camera(self):
        async with self.lock:
            if self.camera is None or not self.camera.isOpened():
                self.camera = cv2.VideoCapture(0)
                if not self.camera.isOpened():
                    logger.error("Failed to open camera")
                    return None
                # Optimize for Raspberry Pi
                self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self.camera.set(cv2.CAP_PROP_FPS, 10)
                logger.info("Camera opened (640x480 @ 10FPS)")
            return self.camera

    async def release_camera(self):
        async with self.lock:
            if self.camera and self.camera.isOpened():
                self.camera.release()
                self.camera = None
                logger.info("Camera released")


camera_manager = CameraManager()


def image_preprocess(img):
    img = cv2.GaussianBlur(img, (5, 5), 0)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(img)


def image_to_base64(image):
    _, buffer = cv2.imencode(".jpg", image)
    return base64.b64encode(buffer).decode("utf-8")


@router.get("/")
async def check_api():
    return {"status": "OK", "service": "PCB Detection Service"}


@router.post("/pcb-detection/image")
async def detect_pcb_from_image(file: UploadFile = File(...)):
    try:

        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return {"error": "Could not decode image"}

        # Process the image
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        lower_copper = np.array([3, 0, 0])
        upper_copper = np.array([45, 255, 255])
        mask = cv2.inRange(hsv, lower_copper, upper_copper)

        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        display_frame = frame.copy()
        pcb_frame = None
        result = {"detected": False}

        if contours:
            largest_contour = max(contours, key=cv2.contourArea)
            hull = cv2.convexHull(largest_contour)
            cv2.drawContours(display_frame, [hull], -1, (0, 255, 0), 3)

            epsilon = 0.02 * cv2.arcLength(hull, True)
            approx = cv2.approxPolyDP(hull, epsilon, True)

            if len(approx) == 4:
                approx = order_points(approx.reshape(4, 2))
                pcb_frame = four_point_transform(frame, approx)
                result["detected"] = True

        result["display_image"] = image_to_base64(display_frame)

        if pcb_frame is not None:
            result["pcb_image"] = image_to_base64(pcb_frame)
        else:
            # Create empty black image if no PCB detected
            empty_frame = np.zeros((100, 100, 3), dtype=np.uint8)
            result["pcb_image"] = image_to_base64(empty_frame)

        return JSONResponse(content=result)

    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/prepare")
async def analysis_pcb_prepare(files: list[UploadFile] = File(...)):
    try:
        if len(files) != 2:
            raise HTTPException(
                status_code=400,
                detail="Exactly 2 files (template and analysis) are required",
            )

        images = []
        for file in files:
            contents = await file.read()
            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise HTTPException(
                    status_code=400, detail=f"Could not decode image {file.filename}"
                )
            images.append(img)

        template = cv2.cvtColor(images[0], cv2.COLOR_BGR2GRAY)
        defective = cv2.cvtColor(images[1], cv2.COLOR_BGR2GRAY)

        _, template = cv2.threshold(
            template, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )
        _, defective = cv2.threshold(
            defective, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )

        min_height = min(template.shape[0], defective.shape[0])
        min_width = min(template.shape[1], defective.shape[1])
        template = cv2.resize(template, (min_width, min_height))
        defective = cv2.resize(defective, (min_width, min_height))

        original_template = template.copy()
        original_defective = defective.copy()

        template_proc = image_preprocess(template)
        defective_proc = image_preprocess(defective)

        orb = cv2.ORB_create(
            nfeatures=20000, scaleFactor=1.2, nlevels=8, edgeThreshold=15, patchSize=31
        )
        kp1, des1 = orb.detectAndCompute(template_proc, None)
        kp2, des2 = orb.detectAndCompute(defective_proc, None)

        if des1 is None or des2 is None or len(des1) < 2 or len(des2) < 2:
            return {
                "detected": False,
                "message": "Not enough features for matching",
                "images": {
                    "template": image_to_base64(
                        cv2.cvtColor(original_template, cv2.COLOR_GRAY2BGR)
                    ),
                    "defective": image_to_base64(
                        cv2.cvtColor(original_defective, cv2.COLOR_GRAY2BGR)
                    ),
                },
            }

        # Feature Matching and Homography calculation
        FLANN_INDEX_LSH = 6
        index_params = dict(
            algorithm=FLANN_INDEX_LSH, table_number=6, key_size=12, multi_probe_level=1
        )
        search_params = dict(checks=50)
        flann = cv2.FlannBasedMatcher(index_params, search_params)
        matches = flann.knnMatch(des1, des2, k=2)
        good_matches = [m for m, n in matches if m.distance < 0.7 * n.distance][:200]

        if len(good_matches) < 10:
            return {
                "detected": False,
                "message": "Not enough good matches for alignment",
                "images": {
                    "template": image_to_base64(
                        cv2.cvtColor(original_template, cv2.COLOR_GRAY2BGR)
                    ),
                    "defective": image_to_base64(
                        cv2.cvtColor(original_defective, cv2.COLOR_GRAY2BGR)
                    ),
                },
            }

        src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(
            -1, 1, 2
        )
        dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(
            -1, 1, 2
        )

        H, _ = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 5.0)
        aligned = cv2.warpPerspective(
            defective, H, (template.shape[1], template.shape[0])
        )

        # Calculate difference
        diff = cv2.absdiff(template, aligned)

        mask = cv2.inRange(diff, 50, 225)
        specific_gray = cv2.bitwise_and(diff, diff, mask=mask)

        # Thresholding
        _, thresh_otsu = cv2.threshold(
            diff, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )
        thresh_range = cv2.inRange(diff, 100, 255)
        combined_thresh = cv2.bitwise_or(thresh_otsu, thresh_range)

        # Morphology operations
        kernel = np.ones((3, 3), np.uint8)
        cleaned = cv2.morphologyEx(
            combined_thresh, cv2.MORPH_OPEN, kernel, iterations=1
        )
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=2)

        # Find contours
        contours, _ = cv2.findContours(
            cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        # Create result image
        mask_diff = np.zeros_like(cleaned)
        cv2.drawContours(mask_diff, contours, -1, (255), thickness=cv2.FILLED)
        result = cv2.bitwise_and(aligned, aligned, mask=mask_diff)

        white_pixels = np.sum(result == 0)
        total_pixels = result.shape[0] * result.shape[1]

        accuracy_percentage = (white_pixels / total_pixels) * 100

        accuracy_result = ""
        if accuracy_percentage <= 80:
            accuracy_result = "The PCB picture does not match or is incorrect."
        elif accuracy_percentage <= 97:
            accuracy_result = "The PCB picture has many errors."
        elif accuracy_percentage > 97:
            accuracy_result = "The PCB picture has some errors."

        # Convert all images to BGR for consistent display in React
        template_bgr = cv2.cvtColor(template, cv2.COLOR_GRAY2BGR)
        defective_bgr = cv2.cvtColor(defective, cv2.COLOR_GRAY2BGR)
        aligned_bgr = cv2.cvtColor(aligned, cv2.COLOR_GRAY2BGR)
        diff_bgr = cv2.cvtColor(diff, cv2.COLOR_GRAY2BGR)
        cleaned_bgr = cv2.cvtColor(specific_gray, cv2.COLOR_GRAY2BGR)
        result_bgr = cv2.cvtColor(result, cv2.COLOR_GRAY2BGR)

        return {
            "detected": True,
            "message": "PCB analysis completed successfully",
            "accuracy": accuracy_percentage,
            "result": accuracy_result,
            "images": {
                "template": image_to_base64(template_bgr),
                "defective": image_to_base64(defective_bgr),
                "aligned": image_to_base64(aligned_bgr),
                "diff": image_to_base64(diff_bgr),
                "cleaned": image_to_base64(cleaned_bgr),
                "result": image_to_base64(result_bgr),
            },
        }

    except Exception as e:
        logger.error(f"Error processing images: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
