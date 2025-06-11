import cv2
import base64
import numpy as np
import sqlite3
import asyncio
from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import logging
import time
import uvicorn
from fastapi.middleware.cors import CORSMiddleware


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# app.mount("/static", StaticFiles(directory="static"), name="static")


def init_db():
    conn = sqlite3.connect("database.db/images.db")
    c = conn.cursor()
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            image BLOB,
            detection_type TEXT
        )
    """
    )
    conn.commit()
    conn.close()


init_db()


class ImageSaveRequest(BaseModel):
    image_base64: str
    detection_type: str = "pcb"


class CameraManager:
    def __init__(self):
        self.camera: Optional[cv2.VideoCapture] = None
        self.active_connections = 0
        self.lock = asyncio.Lock()
        self.frame_interval = 0.08  # ~12 FPS
        self.last_save_time = 0
        self.save_cooldown = 3

    async def get_camera(self):
        async with self.lock:
            if self.camera is None or not self.camera.isOpened():
                self.camera = cv2.VideoCapture(0)
                if not self.camera.isOpened():
                    logger.error("Failed to open camera")
                    return None
                # Optimize camera settings
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

    def can_save_image(self):
        current_time = time.time()
        if current_time - self.last_save_time > self.save_cooldown:
            self.last_save_time = current_time
            return True
        return False


camera_manager = CameraManager()


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


def save_image_to_db(image_data, detection_type="pcb"):
    try:
        conn = sqlite3.connect("database.db/images.db")
        c = conn.cursor()
        c.execute(
            "INSERT INTO images (timestamp, image, detection_type) VALUES (?, ?, ?)",
            (datetime.now().isoformat(), image_data, detection_type),
        )
        conn.commit()
        conn.close()
        logger.info(f"Image saved to DB (type: {detection_type})")
        return True
    except Exception as e:
        logger.error(f"Error saving image to DB: {str(e)}")
        return False


@app.websocket("/ws/factory-workflow")
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

            # PCB detection
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            lower_copper = np.array([3, 0, 0])
            upper_copper = np.array([70, 255, 255])
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
                cv2.drawContours(display_frame, [hull], -1, (0, 255, 0), 3)

                epsilon = 0.02 * cv2.arcLength(hull, True)
                approx = cv2.approxPolyDP(hull, epsilon, True)

                if len(approx) == 4:
                    approx = order_points(approx.reshape(4, 2))
                    pcb_frame = four_point_transform(frame, approx)

                    # Check if PCB is centered (simple version - check if center line is within PCB)
                    x, y, w, h = cv2.boundingRect(hull)
                    if x < center_x < x + w:
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

                        # Save image if cooldown has passed
                        if pcb_frame is not None and camera_manager.can_save_image():
                            _, buffer = cv2.imencode(".jpg", pcb_frame)
                            image_data = buffer.tobytes()
                            save_image_to_db(image_data, "centered_pcb")

            # Send display frame with annotations
            _, display_buffer = cv2.imencode(".jpg", display_frame)
            await websocket.send_bytes(display_buffer.tobytes())

            # Send processed PCB frame if available
            if pcb_frame is not None:
                _, pcb_buffer = cv2.imencode(".jpg", pcb_frame)
                await websocket.send_bytes(pcb_buffer.tobytes())
            else:
                # Send empty frame if no PCB detected
                empty_frame = np.zeros((100, 100, 3), dtype=np.uint8)
                _, empty_buffer = cv2.imencode(".jpg", empty_frame)
                await websocket.send_bytes(empty_buffer.tobytes())

            await asyncio.sleep(camera_manager.frame_interval)

    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        camera_manager.active_connections -= 1
        logger.info(f"Connection closed. Total: {camera_manager.active_connections}")

        if camera_manager.active_connections == 0:
            await camera_manager.release_camera()

        await websocket.close()


@app.get("/get_images")
def get_images(limit: int = 10):
    try:
        conn = sqlite3.connect("database.db/images.db")
        c = conn.cursor()
        c.execute(
            "SELECT timestamp, image, detection_type FROM images ORDER BY timestamp DESC LIMIT ?",
            (limit,),
        )
        rows = c.fetchall()
        conn.close()

        images = []
        for row in rows:
            images.append(
                {
                    "timestamp": row[0],
                    "image_data": base64.b64encode(row[1]).decode("utf-8"),
                    "detection_type": row[2],
                }
            )

        return {"images": images}
    except Exception as e:
        logger.error(f"Error fetching images: {str(e)}")
        return {"message": "Failed to fetch images", "error": str(e)}


@app.post("/save_image")
def save_image(data: ImageSaveRequest):
    try:
        image_data = base64.b64decode(data.image_base64)
        save_image_to_db(image_data, data.detection_type)
        return {"message": "Image saved successfully"}
    except Exception as e:
        logger.error(f"Error saving image: {str(e)}")
        return {"message": "Failed to save image", "error": str(e)}


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        workers=1,  # ใช้ 1 worker เพราะเหมาะสำหรับ Raspberry Pi
        ws_ping_interval=30,
        ws_ping_timeout=30,
    )
