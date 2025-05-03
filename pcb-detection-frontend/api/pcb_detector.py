# backend/main.py
import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
import logging
from typing import Optional

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

class CameraManager:
    def __init__(self):
        self.camera: Optional[cv2.VideoCapture] = None
        self.active_connections = set()
        self.frame_interval = 0.1  # ~10 FPS
        self.lock = asyncio.Lock()

    async def get_camera(self):
        async with self.lock:
            if self.camera is None or not self.camera.isOpened():
                self.camera = cv2.VideoCapture(0)
                if not self.camera.isOpened():
                    logger.error("Failed to open camera")
                    return None
                logger.info("Camera opened successfully")
            return self.camera

    async def release_camera(self):
        async with self.lock:
            if self.camera and self.camera.isOpened():
                self.camera.release()
                self.camera = None
                logger.info("Camera released")

    async def process_frame(self, frame):
        """ใช้โค้ดตรวจจับ PCB ของคุณที่นี่"""
        # แปลงภาพเป็น HSV สำหรับการตรวจจับสีทองแดง
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        lower_copper = np.array([5, 50, 50])
        upper_copper = np.array([45, 255, 255])
        mask = cv2.inRange(hsv, lower_copper, upper_copper)
        
        # Morphological operations
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        
        # หา contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        display_frame = frame.copy()
        pcb_frame = None
        
        if contours:
            largest_contour = max(contours, key=cv2.contourArea)
            hull = cv2.convexHull(largest_contour)
            cv2.drawContours(display_frame, [hull], -1, (0, 255, 0), 2)
            
            # ตรวจจับ PCB และตัดส่วนที่ต้องการ
            epsilon = 0.02 * cv2.arcLength(hull, True)
            approx = cv2.approxPolyDP(hull, epsilon, True)
            
            if len(approx) == 4:
                # เรียงลำดับจุดและทำ perspective transform
                approx = approx.reshape(4, 2)
                ordered = np.zeros((4, 2), dtype="float32")
                s = approx.sum(axis=1)
                ordered[0] = approx[np.argmin(s)]
                ordered[2] = approx[np.argmax(s)]
                diff = np.diff(approx, axis=1)
                ordered[1] = approx[np.argmin(diff)]
                ordered[3] = approx[np.argmax(diff)]
                
                # ทำ perspective transform
                pcb_frame = self.four_point_transform(frame, ordered)
        
        return display_frame, pcb_frame

    def four_point_transform(self, image, pts):
        """ฟังก์ชันแปลง perspective"""
        (tl, tr, br, bl) = pts
        widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2)
        widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2)
        maxWidth = max(int(widthA), int(widthB))

        heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2)
        heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2)
        maxHeight = max(int(heightA), int(heightB))

        dst = np.array([
            [0, 0],
            [maxWidth - 1, 0],
            [maxWidth - 1, maxHeight - 1],
            [0, maxHeight - 1]], dtype="float32")

        M = cv2.getPerspectiveTransform(pts, dst)
        warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
        return warped

camera_manager = CameraManager()

@app.websocket("/ws/pcb-detection")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    camera_manager.active_connections.add(websocket)
    logger.info(f"New connection. Total: {len(camera_manager.active_connections)}")

    try:
        camera = await camera_manager.get_camera()
        if not camera:
            await websocket.close()
            return

        while True:
            ret, frame = camera.read()
            if not ret:
                logger.error("Failed to capture frame")
                break

            display_frame, pcb_frame = await camera_manager.process_frame(frame)

            # ส่งผลลัพธ์ไปยัง client
            _, buffer = cv2.imencode('.jpg', display_frame)
            result = {
                "type": "camera_feed",
                "data": buffer.tobytes().hex()  # ส่งเป็น hex string เพื่อป้องกัน encoding issues
            }

            if pcb_frame is not None:
                _, pcb_buffer = cv2.imencode('.jpg', pcb_frame)
                result["pcb_data"] = pcb_buffer.tobytes().hex()

            await websocket.send_json(result)
            await asyncio.sleep(camera_manager.frame_interval)

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        camera_manager.active_connections.remove(websocket)
        logger.info(f"Remaining connections: {len(camera_manager.active_connections)}")
        
        # ปิดกล้องถ้าไม่มี client ที่เชื่อมต่ออยู่
        if len(camera_manager.active_connections) == 0:
            await camera_manager.release_camera()

if __name__ == "__main__":
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        # ปรับแต่งสำหรับ Raspberry Pi
        workers=1,  # ใช้ worker เดียวเพื่อลด memory usage
        ws_ping_interval=20,
        ws_ping_timeout=20,
        log_level="info"
    )