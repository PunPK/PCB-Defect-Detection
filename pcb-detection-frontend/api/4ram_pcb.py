from fastapi import (
    FastAPI,
    UploadFile,
    File,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
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

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


def image_to_base64(image):
    _, buffer = cv2.imencode(".jpg", image)
    return base64.b64encode(buffer).decode("utf-8")


@app.get("/")
async def health_check():
    return {"status": "OK", "service": "PCB Detection Service"}


@app.post("/api/pcb-detection/image")
async def detect_pcb_from_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return {"error": "Could not decode image"}

        # Process the image
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        lower_copper = np.array([5, 30, 30])
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


@app.websocket("/ws/test-cam")
async def websocket_endpoint(websocket: WebSocket):
    # Accept the WebSocket connection explicitly
    await websocket.accept()

    camera_manager.active_connections += 1
    logger.info(f"New connection. Total: {camera_manager.active_connections}")

    camera = await camera_manager.get_camera()
    if not camera:
        await websocket.close()
        return

    try:
        while True:
            ret, frame = camera.read()
            if not ret:
                logger.error("Frame read failed")
                break

            ret, buffer = cv2.imencode(
                ".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80]
            )

            if not ret:
                logger.error("Frame encoding failed")
                continue

            await websocket.send_bytes(buffer.tobytes())
            await asyncio.sleep(camera_manager.frame_interval)

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        camera_manager.active_connections -= 1
        logger.info(
            f"Connection closed. Remaining: {camera_manager.active_connections}"
        )

        if camera_manager.active_connections <= 0:
            camera_manager.release_camera()


@app.websocket("/ws/pcb-detection")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    camera_manager.active_connections += 1
    logger.info(f"New connection. Total: {camera_manager.active_connections}")

    try:
        camera = await camera_manager.get_camera()
        if not camera:
            await websocket.close()
            return

        while True:
            ret, frame = camera.read()
            if not ret:
                logger.error("Frame read failed")
                break

            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            lower_copper = np.array([5, 30, 30])
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

            if contours:
                largest_contour = max(contours, key=cv2.contourArea)
                expanded_contour = expand_contour(largest_contour, 0.05)
                hull = cv2.convexHull(expanded_contour)

                cv2.drawContours(display_frame, [hull], -1, (0, 255, 0), 3)

                epsilon = 0.02 * cv2.arcLength(hull, True)
                approx = cv2.approxPolyDP(hull, epsilon, True)

                if len(approx) == 4:
                    approx = order_points(approx.reshape(4, 2))
                    pcb_frame = four_point_transform(frame, approx)

            _, display_buffer = cv2.imencode(".jpg", display_frame)
            await websocket.send_bytes(display_buffer.tobytes())

            if pcb_frame is not None:
                _, pcb_buffer = cv2.imencode(".jpg", pcb_frame)
                await websocket.send_bytes(pcb_buffer.tobytes())
            else:

                empty_frame = np.zeros(
                    (100, 100, 3), dtype=np.uint8
                )  # Send empty frame if no PCB detected
                _, empty_buffer = cv2.imencode(".jpg", empty_frame)
                await websocket.send_bytes(empty_buffer.tobytes())

            await asyncio.sleep(camera_manager.frame_interval)

    except WebSocketDisconnect:
        logger.info("Client disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        camera_manager.active_connections -= 1
        logger.info(f"Connection closed. Total: {camera_manager.active_connections}")

        if camera_manager.active_connections == 0:
            await camera_manager.release_camera()

        await websocket.close()


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        workers=1,  # ใช้ 1 worker เพราะเหมาะสำหรับ Raspberry Pi
        ws_ping_interval=30,
        ws_ping_timeout=30,
    )
