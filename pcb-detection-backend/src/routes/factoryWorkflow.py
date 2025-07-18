import cv2
import base64
import numpy as np
import sqlite3
import asyncio
from fastapi import (
    FastAPI,
    WebSocket,
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    Depends,
    Form,
    Query,
)
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import logging
import time
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from ..database.database import (
    save_uploaded_file,
    get_pcb,
    get_pcb_images,
    create_pcb,
    create_pcb_image,
)
from ..database.model import ImagePCB, PCB, Result
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from ..database import database, model
from . import pcb_detection
import os
from datetime import datetime

from ..function.withRaspberrypi import Belt, Lcd, Pilotlamp


UPLOAD_DIR = "./tmp"

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


def decode_base64_image(base64_str):
    return base64.b64decode(base64_str)


@router.websocket("/ws/factory-workflow")
async def websocket_endpoint(
    websocket: WebSocket, pcb_id: int = Query(...), db: Session = Depends(model.get_db)
):
    await websocket.accept()
    camera_manager.active_connections += 1
    logger.info(f"New connection. Total: {camera_manager.active_connections}")

    belt = None
    lcd = None
    waitting = False
    pilotlamp = None
    try:
        lcd = Lcd()
        lcd.lcd_running()
        belt = Belt()
        belt.on()
        pilotlamp = Pilotlamp()
        pilotlamp.running()
        
        camera = await camera_manager.get_camera()
        if not camera:
            await websocket.close()
            return

        original_base64 = database.get_pcb_original_images(db=db, pcb_id=pcb_id)

        if not original_base64:
            await websocket.close()
            logger.error("No original PCB found")
            return


        # decoded_bytes = base64.b64decode(original_base64)
        # template_np = np.frombuffer(decoded_bytes, np.uint8)
        # template_image = cv2.imdecode(template_np, cv2.IMREAD_COLOR)

        center_line_start_time = None
        center_line_detected = False
        cooldown_seconds = 1

        while True:
            ret, frame = camera.read()
            if not ret:
                logger.error("Frame read failed")
                break

            # PCB detection
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            lower_copper = np.array([5, 30, 5])
            upper_copper = np.array([45, 255, 255])

            mask = cv2.inRange(hsv, lower_copper, upper_copper)

            kernel = np.ones((5, 5), np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

            contours, _ = cv2.findContours(
                mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )

            display_frame = frame.copy()
            pcb_frame = None
            center_line_detected = False

            height, width = frame.shape[:2]
            center_x = width // 2
            cv2.line(display_frame, (center_x, 0), (center_x, height), (0, 0, 255), 2)

            if contours:
             largest_contour = max(contours, key=cv2.contourArea)
             expanded_contour = expand_contour(largest_contour, 0.05)
             hull = cv2.convexHull(expanded_contour)

                # Draw green contour around PCB
             area = cv2.contourArea(hull)
             min_area_threshold = 5000
             if area >= min_area_threshold:
                cv2.drawContours(display_frame, [hull], -1, (0, 255, 0), 3)

                epsilon = 0.02 * cv2.arcLength(hull, True)
                approx = cv2.approxPolyDP(hull, epsilon, True)

                if len(approx) == 4:
                    approx = order_points(approx.reshape(4, 2))
                    pcb_frame = four_point_transform(frame, approx)

                    x, y, w, h = cv2.boundingRect(hull)
                    if area >= min_area_threshold and x < center_x < x + w:
                      if center_line_start_time is None:
                            center_line_start_time = time.time()
                      elapsed = time.time() - center_line_start_time
                      if not center_line_detected:
                            center_line_detected = True
                            cv2.putText(
                                display_frame,
                                "CENTERED",
                                (center_x - 50, 30),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.7,
                                (0, 0, 255),
                                2,
                            )
                      
                      if waitting is False:
                        belt.off()

                        if elapsed >= cooldown_seconds:

                            print("=====> Center line detected")

                            await asyncio.sleep(0.5)
                            if pcb_frame is not None:
                                print("=====> Belt off")
                                
                                
                                _, buffer = cv2.imencode(".jpg", pcb_frame)
                                image_data = buffer.tobytes()
                                #######################################################
                                prepare_result = await analysis_pcb_prepare(
                                    original_base64, image_data
                                )
                                print("=====> PCB analysis prepared")
                                if prepare_result["detected"]:
                                    print(prepare_result["detected"])
                                    push_to_database = await database.create_pcb_result(
                                        db=db,
                                        prepare_result=prepare_result,
                                        pcb_id=pcb_id,
                                    )
                                    print("===========================================>",prepare_result["accuracy"])
                                    print("=====> Database updated with PCB result")
                                    if push_to_database:
                                        await websocket.send_json(
                                            {
                                                "type": "new_result",
                                                "message": "PCB result created",
                                                "result_id": push_to_database.results_id,
                                            }
                                        )
                                    center_line_start_time = None
                                    center_line_detected = False

                                    # await asyncio.sleep(2)
                                    print("=====> ",prepare_result["accuracy"])
                                    belt.test_log(prepare_result["accuracy"])
                                    if prepare_result["accuracy"] >= 90 :
                                        lcd.lcd_show_result(prepare_result["accuracy"])
                                        belt.run_for(2)
                                    else:
                                        pilotlamp.error()
                                        belt.Waitting()
                                        lcd.lcd_show_log(prepare_result["result"], prepare_result["accuracy"])
                                        waitting = True
                                        print("=====> Waitting for start")
                                    # belt.on()
                                    
                                    # await asyncio.sleep(2)

                    else:
                        if waitting is True:
                            belt.Stop_Waitting()
                            pilotlamp.running()
                        center_line_start_time = None
                        center_line_detected = False

            _, display_buffer = cv2.imencode(".jpg", display_frame)
            await websocket.send_bytes(display_buffer.tobytes())

            if pcb_frame is not None:
                _, pcb_buffer = cv2.imencode(".jpg", pcb_frame)
                await websocket.send_bytes(pcb_buffer.tobytes())
            else:
                empty_frame = np.zeros((100, 100, 3), dtype=np.uint8)
                _, empty_buffer = cv2.imencode(".jpg", empty_frame)
                await websocket.send_bytes(empty_buffer.tobytes())

            await asyncio.sleep(camera_manager.frame_interval)

    except Exception as e:
        if belt:
            belt.off()
            belt.close()
        if lcd:
            lcd.lcd_stop_runnung()
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        camera_manager.active_connections -= 1
        logger.info(f"Connection closed. Total: {camera_manager.active_connections}")

        if camera_manager.active_connections == 0:
            await camera_manager.release_camera()

        if belt:
            belt.off()
            belt.close()
        if lcd:
            lcd.lcd_stop_runnung()

        await websocket.close()


@router.get("/get_images/{pcb_id}")
async def get_images(
    pcb_id: int,
    db: Session = Depends(model.get_db),
):
    image_list = database.get_pcb(db=db, pcb_id=pcb_id)

    if not image_list:
        raise HTTPException(status_code=404, detail="Image not found for this PCB ID")

    # print("=====> Image data retrieved from database", image_list)

    return JSONResponse(
        status_code=200,
        content={
            "status": "success",
            "image_id": image_list["image_id"],
            "filename": image_list["filename"],
            "uploaded_at": image_list["uploaded_at"],
            "image_data": (
                base64.b64encode(image_list["image_data"]).decode("utf-8")
                if image_list["image_data"]
                else None
            ),
        },
    )


async def get_images(db: Session = Depends(model.get_db), pcb_id: int = 1):
    try:
        rows = await database.get_pcb(db=db, pcb_id=pcb_id)
        images = []

        print("=================>" + rows)
        for row in rows:
            images.append(
                {
                    "timestamp": row[0],
                    "original_filename": row[1],
                    "image_data": base64.b64encode(row[2]).decode("utf-8"),
                    # "detection_type": row[2],
                }
            )
        print("=================>" + images)
        return {"images": images}
    except Exception as e:
        logger.error(f"Error fetching images: {str(e)}")
        return {"message": "Failed to fetch images", "error": str(e)}


def save_image_bytes(image_bytes: bytes, filename: str) -> str:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    save_dir = os.path.join(BASE_DIR, "../..", "database.db", "tmp")
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)
    save_path = os.path.join(save_dir, filename)
    with open(save_path, "wb") as f:
        f.write(image_bytes)
    return save_path


@router.post("/create_pcb")
async def create_pcb(
    file: UploadFile = File(...),
    db: Session = Depends(model.get_db),
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    image_bytes = await file.read()

    file_path = save_image_bytes(image_bytes, file.filename)
    if not file.filename.lower().endswith((".jpg", ".jpeg", ".png")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only JPG, JPEG, and PNG are allowed.",
        )

    result = await database.upload_and_create_pcb(
        db=db, filename=file.filename, filepath=file_path
    )

    return {"status": "success", "result": result}


@router.post("/create_pcb_image")
async def create_pcb_image(
    pcb_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(model.get_db),
):
    result = await database.create_pcb_image(db=db, file=file, pcb_id=pcb_id)
    return result


def generate_filename(name: str) -> str:
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    return f"{name}_{timestamp}.jpg"


async def analysis_pcb_prepare(original_bytes: bytes, image_bytes: bytes):
    try:
        template_np = np.frombuffer(original_bytes, np.uint8)
        template_img = cv2.imdecode(template_np, cv2.IMREAD_COLOR)

        defective_np = np.frombuffer(image_bytes, np.uint8)
        defective_img = cv2.imdecode(defective_np, cv2.IMREAD_COLOR)

        if template_img is None:
            raise ValueError("Template image decoding failed")
        if defective_img is None:
            raise ValueError("Defective image decoding failed")

        template_gray = cv2.cvtColor(template_img, cv2.COLOR_BGR2GRAY)
        defective_gray = cv2.cvtColor(defective_img, cv2.COLOR_BGR2GRAY)

        min_height = min(template_gray.shape[0], defective_gray.shape[0])
        min_width = min(template_gray.shape[1], defective_gray.shape[1])
        template_gray = cv2.resize(template_gray, (min_width, min_height))
        defective_gray = cv2.resize(defective_gray, (min_width, min_height))

        # === CLAHE for lighting compensation ===
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        template = clahe.apply(template_gray)
        defective = clahe.apply(defective_gray)

        # === Adaptive Threshold instead of Otsu ===
        template = cv2.adaptiveThreshold(
            template, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 2
        )
        defective = cv2.adaptiveThreshold(
            defective, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 2
        )

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
            }

        FLANN_INDEX_LSH = 6
        index_params = dict(
            algorithm=FLANN_INDEX_LSH, table_number=6, key_size=12, multi_probe_level=1
        )
        search_params = dict(checks=50)
        flann = cv2.FlannBasedMatcher(index_params, search_params)

        matches = flann.knnMatch(des1, des2, k=2)

        good_matches = []
        for m_n in matches:
            if len(m_n) == 2:
                m, n = m_n
                if m.distance < 0.7 * n.distance:
                    good_matches.append(m)

        if len(good_matches) < 1:
            return {
                "detected": False,
                "message": "Not enough good matches for alignment",
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

        # === Blur before diff to reduce lighting noise ===
        template_blur = cv2.GaussianBlur(template, (3, 3), 0)
        aligned_blur = cv2.GaussianBlur(aligned, (3, 3), 0)

        diff = cv2.absdiff(template_blur, aligned_blur)

        # Specific gray mask for defect highlight
        mask = cv2.inRange(diff, 50, 225)
        specific_gray = cv2.bitwise_and(diff, diff, mask=mask)

        # Thresholding combination
        _, thresh_otsu = cv2.threshold(
            diff, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )
        thresh_range = cv2.inRange(diff, 100, 255)
        combined_thresh = cv2.bitwise_or(thresh_otsu, thresh_range)

        # Morphology
        kernel = np.ones((3, 3), np.uint8)
        cleaned = cv2.morphologyEx(
            combined_thresh, cv2.MORPH_OPEN, kernel, iterations=1
        )
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=2)

        contours, _ = cv2.findContours(
            cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

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

        image_map = {
            "template": template,
            "defective": defective,
            "aligned": aligned,
            "diff": diff,
            "cleaned": specific_gray,
            "result": result,
        }

        images = {}
        for name, gray_image in image_map.items():
            bgr_image = cv2.cvtColor(gray_image, cv2.COLOR_GRAY2BGR)
            filename = generate_filename(name)
            filepath = save_image_bytes(
                cv2.imencode(".jpg", bgr_image)[1].tobytes(), filename
            )
            images[name] = {
                "filename": filename,
                "filepath": filepath,
            }

        return {
            "detected": True,
            "message": "PCB analysis completed successfully",
            "accuracy": accuracy_percentage,
            "result": accuracy_result,
            "images": images,
        }

    except Exception as e:
        logger.error(f"Error processing images: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/get_result_pcb/{pcb_id}")
async def get_result_pcb(
    pcb_id: int,
    db: Session = Depends(model.get_db),
):
    result = database.get_pcb_result(db=db, pcb_id=pcb_id)
    return JSONResponse(
        status_code=200,
        content={
            "status": "success",
            "results_id": result["results_id"],
            "pcb_result_id": result["pcb_result_id"],
            "accuracy": result["accuracy"],
            "description": result["description"],
            "imageList": result["imageList"],
        },
    )


@router.get("/get_result_pcb_working/{pcb_id}")
async def get_result_pcb_working(
    pcb_id: int,
    db: Session = Depends(model.get_db),
):
    result = database.get_pcb_result_working(db=db, pcb_id=pcb_id)
    return JSONResponse(
        status_code=200,
        content={
            "status": "success",
            "pcb_id": result["pcb_id"],
            "result_List": result["result_List"],
        },
    )


@router.delete("/delete_pcb/{pcb_id}")
async def delete_pcb(
    pcb_id: int,
    db: Session = Depends(model.get_db),
):
    try:
        database.delete_pcb(db=db, pcb_id=pcb_id)
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "PCB deleted successfully",
                "pcb_id": pcb_id,
            },
        )
    except Exception as e:
        logger.error(f"Error deleting PCB: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/get_result/{result_id}")
async def get_result(
    result_id: int,
    db: Session = Depends(model.get_db),
):
    result = database.get_result(db=db, result_id=result_id)
    return JSONResponse(
        status_code=200,
        content={
            "status": "success",
            "result_id": result_id,
            "result_List": result,
        },
    )


@router.get("/get_all_pcb_results")
async def get_all_pcb_results(
    db: Session = Depends(model.get_db),
):
    results = database.get_all_pcb_results(db=db)

    return JSONResponse(
        status_code=200,
        content={
            "status": "success",
            "results": results,
        },
    )


@router.delete("/delete_result/{result_id}")
async def delete_result(
    result_id: int,
    db: Session = Depends(model.get_db),
):
    try:
        database.delete_result(db=db, result_id=result_id)
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "PCB deleted successfully",
                "result_id": result_id,
            },
        )
    except Exception as e:
        logger.error(f"Error deleting PCB: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
