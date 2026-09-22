import os
import time
from datetime import datetime
import base64
import asyncio
import logging
from typing import Optional, Any, Dict, List, Tuple

import cv2
import numpy as np
from fastapi import (
    APIRouter,
    WebSocket,
    UploadFile,
    File,
    HTTPException,
    Depends,
    Form,
    Query,
)
from fastapi.responses import JSONResponse
from starlette.websockets import WebSocketDisconnect, WebSocketState
from sqlalchemy.orm import Session

from ..database import database, model
from ..function.withRaspberrypi import NanoController
from ..function.pcb_ai import (
    CopperTraceExtractor,
    PCBDefectAnalyzer,
    extract_pcb_board,
)

logger = logging.getLogger(__name__)

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAVE_DIR = os.path.join(BASE_DIR, "..", "..", "database.db", "tmp")
os.makedirs(SAVE_DIR, exist_ok=True)
UPLOAD_DIR = "./tmp"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def save_image_bytes(image_bytes: bytes, filename: str) -> str:
    save_path = os.path.join(SAVE_DIR, filename)
    with open(save_path, "wb") as f:
        f.write(image_bytes)
    return save_path


def generate_filename(name: str) -> str:
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    return f"{name}_{timestamp}.jpg"


class CameraManager:
    def __init__(self):
        self.camera: Optional[cv2.VideoCapture] = None
        self.active_connections = 0
        self.lock = asyncio.Lock()
        self.frame_interval = 0.06  # ~16 FPS

    async def get_camera(self):
        async with self.lock:
            if self.camera is None or not self.camera.isOpened():
                for cam_idx in [0, 1, 2]:
                    cap = cv2.VideoCapture(cam_idx)
                    if cap.isOpened():
                        self.camera = cap
                        break

                if self.camera is None or not self.camera.isOpened():
                    logger.error("Failed to open any camera")
                    return None

                self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self.camera.set(cv2.CAP_PROP_FPS, 20)
                logger.info("Camera opened (640x480)")
            return self.camera

    async def reconnect_camera(self):
        async with self.lock:
            if self.camera:
                try:
                    self.camera.release()
                except Exception:
                    pass
                self.camera = None

            for cam_idx in [0, 1, 2]:
                cap = cv2.VideoCapture(cam_idx)
                if cap.isOpened():
                    self.camera = cap
                    self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    self.camera.set(cv2.CAP_PROP_FPS, 20)
                    logger.info(f"Camera reconnected on index {cam_idx}")
                    return self.camera
            logger.error("Reconnection failed: no camera found")
            return None

    async def release_camera(self):
        async with self.lock:
            if self.camera and self.camera.isOpened():
                self.camera.release()
                self.camera = None
                logger.info("Camera released")


camera_manager = CameraManager()


# ==============================================================================
# Helper: สร้างภาพจำลองสำหรับรูปที่ 4 ระหว่างรอดำเนินการวิเคราะห์ใน Background
# ==============================================================================
def create_interim_result_image(warped_pcb: np.ndarray, trace_view: np.ndarray) -> np.ndarray:
    """สร้างภาพผลลัพธ์จำลองสำหรับรูปที่ 4 ระหว่างที่กำลังรันโมเดลวิเคราะห์จุดบกพร่องใน Background"""
    h, w = warped_pcb.shape[:2]
    base = trace_view.copy() if trace_view is not None else warped_pcb.copy()
    dimmed = cv2.addWeighted(base, 0.45, np.zeros_like(base), 0.55, 0)

    card_w = min(220, w - 20)
    card_h = 70
    cx, cy = w // 2, h // 2
    x0, y0 = cx - card_w // 2, cy - card_h // 2
    x1, y1 = cx + card_w // 2, cy + card_h // 2

    cv2.rectangle(dimmed, (x0, y0), (x1, y1), (25, 20, 20), -1)
    cv2.rectangle(dimmed, (x0, y0), (x1, y1), (0, 180, 255), 2)

    cv2.putText(dimmed, "AI DEFECT ANALYSIS", (x0 + 12, y0 + 26), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 200, 255), 1)
    cv2.putText(dimmed, "Analyzing Short/Open...", (x0 + 12, y0 + 46), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (220, 220, 220), 1)
    cv2.putText(dimmed, "Conveyor Resumed", (x0 + 12, y0 + 62), cv2.FONT_HERSHEY_SIMPLEX, 0.34, (0, 255, 120), 1)

    return dimmed


# ==============================================================================
# Helper: สกัดลายทองแดงและบันทึกผลเบื้องต้นลงฐานข้อมูลอย่างรวดเร็ว (ไม่หน่วงสายพาน)
# ==============================================================================
def save_initial_pcb_result(
    warped_pcb: np.ndarray,
    original_bytes: Optional[bytes],
    copper_extractor: CopperTraceExtractor,
    pcb_id: int,
    db: Session,
) -> dict:
    # 1. รัน Model TinyUNet สกัดลายทองแดง
    copper_mask, trace_view = copper_extractor.predict_overlay(
        warped_pcb, conf_thresh=0.5, color=(0, 255, 200), alpha=0.55
    )

    # 2. สร้างภาพแสดงผลเบื้องต้นสำหรับรูปที่ 4 (สถานะรอดำเนินการวิเคราะห์)
    interim_result = create_interim_result_image(warped_pcb, trace_view)

    # 3. บันทึกรูปภาพทั้ง 4 รูปลงดิสก์
    images = {}
    if original_bytes:
        tpl_fn = generate_filename("template")
        tpl_path = save_image_bytes(original_bytes, tpl_fn)
        images["template"] = {"filename": tpl_fn, "filepath": tpl_path}
    else:
        tpl_fn = generate_filename("template")
        tpl_path = save_image_bytes(cv2.imencode(".jpg", warped_pcb)[1].tobytes(), tpl_fn)
        images["template"] = {"filename": tpl_fn, "filepath": tpl_path}

    def_fn = generate_filename("defective")
    def_path = save_image_bytes(cv2.imencode(".jpg", warped_pcb)[1].tobytes(), def_fn)
    images["defective"] = {"filename": def_fn, "filepath": def_path}

    trace_fn = generate_filename("trace")
    trace_path = save_image_bytes(cv2.imencode(".jpg", trace_view)[1].tobytes(), trace_fn)
    images["aligned"] = {"filename": trace_fn, "filepath": trace_path}

    res_fn = generate_filename("result_interim")
    res_path = save_image_bytes(cv2.imencode(".jpg", interim_result)[1].tobytes(), res_fn)
    images["result"] = {"filename": res_fn, "filepath": res_path}

    # 4. บันทึกลง SQLite
    def add_image_and_get_id(filepath: str, filename: str) -> int:
        img_rec = model.ImagePCB(
            filepath=filepath,
            filename=filename,
            uploaded_at=datetime.utcnow(),
        )
        db.add(img_rec)
        db.commit()
        db.refresh(img_rec)
        return img_rec.image_id

    image_ids = {}
    for key in ["template", "defective", "aligned", "result"]:
        img_info = images.get(key)
        if img_info:
            image_ids[key] = add_image_and_get_id(img_info["filepath"], img_info["filename"])
        else:
            image_ids[key] = None

    initial_desc = "AI Defect Analysis in progress... | Open: 0, Short: 0, Minor: 0"
    db_result = model.Result(
        accuracy=95.0,
        pcb_result_id=pcb_id,
        description=initial_desc,
        template_image=image_ids["template"],
        defective_image=image_ids["defective"],
        aligned_image=image_ids["aligned"],
        diff_image=None,
        cleaned_image=None,
        result_image=image_ids["result"],
    )
    db.add(db_result)
    db.commit()
    db.refresh(db_result)

    return {
        "result_id": db_result.results_id,
        "copper_mask": copper_mask,
        "trace_view": trace_view,
    }


# ==============================================================================
# Helper: รันโมเดลวิเคราะห์ตำหนิ (Defect Analyzer) ใน Background Task แบบไม่บล็อก
# ==============================================================================
async def run_background_defect_analysis(
    result_id: int,
    warped_pcb: np.ndarray,
    copper_mask: np.ndarray,
    original_bytes: Optional[bytes],
    pcb_id: int,
    websocket: WebSocket,
    nano: Optional[Any],
):
    """
    วิเคราะห์ Short / Open Circuit ด้วยโมเดล Random Forest ใน Background Worker Thread
    โดยไม่กระทบต่อการหมุนของสายพานและวิดีโอสตรีมมิ่งสด
    """
    try:
        analyzer = PCBDefectAnalyzer.get_instance()
        # รันการคำนวณ Random Forest และหา Defect ใน Thread Pool
        defect_data = await asyncio.to_thread(
            analyzer.analyze,
            copper_mask=copper_mask,
            template_bytes=original_bytes,
            photo_bgr=warped_pcb,
        )

        vis_result = defect_data["vis_result"]
        aligned_img = defect_data.get("aligned_trace_view")
        if aligned_img is None:
            aligned_img = defect_data.get("aligned_photo")
        accuracy = defect_data["accuracy"]
        verdict = defect_data["verdict"]
        description = defect_data["description"]
        counts = defect_data["counts"]

        # บันทึกรูปภาพผลลัพธ์จริง (รูปที่ 4 - Defect Analysis ในทิศทางเดียวกับ Template)
        res_fn = generate_filename("result")
        res_path = save_image_bytes(cv2.imencode(".jpg", vis_result)[1].tobytes(), res_fn)

        # บันทึกรูปภาพชิ้นงานที่หมุน/เลื่อนตรงกับ Template (รูปที่ 3 - Aligned Trace View)
        al_fn = None
        al_path = None
        if aligned_img is not None:
            al_fn = generate_filename("aligned_final")
            al_path = save_image_bytes(cv2.imencode(".jpg", aligned_img)[1].tobytes(), al_fn)

        # อัปเดตข้อมูลผลลัพธ์ในฐานข้อมูล SQLite
        db_gen = model.get_db()
        db_session = next(db_gen)
        try:
            img_rec = model.ImagePCB(
                filepath=res_path,
                filename=res_fn,
                uploaded_at=datetime.utcnow(),
            )
            db_session.add(img_rec)
            db_session.commit()
            db_session.refresh(img_rec)

            al_img_rec = None
            if al_path is not None:
                al_img_rec = model.ImagePCB(
                    filepath=al_path,
                    filename=al_fn,
                    uploaded_at=datetime.utcnow(),
                )
                db_session.add(al_img_rec)
                db_session.commit()
                db_session.refresh(al_img_rec)

            res_rec = (
                db_session.query(model.Result)
                .filter(model.Result.results_id == result_id)
                .first()
            )
            if res_rec:
                res_rec.result_image = img_rec.image_id
                if al_img_rec is not None:
                    res_rec.aligned_image = al_img_rec.image_id
                res_rec.accuracy = float(accuracy)
                res_rec.description = description
                db_session.commit()
        finally:
            db_session.close()

        logger.info(f"✅ Background Defect Analysis เสร็จสิ้น! Result ID: {result_id} | {description}")
        print(f"=====> Defect Analysis สำเร็จ! Result ID {result_id}: {description}")

        # แจ้งเตือน Frontend ให้ดึงข้อมูลที่สมบูรณ์มาอัปเดตรูปที่ 4 และสถิติ
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_json({
                    "type": "new_result",
                    "message": "PCB defect analysis complete",
                    "result_id": result_id,
                    "accuracy": accuracy,
                    "verdict": verdict,
                    "counts": counts,
                })
        except Exception:
            pass

        # สั่งการ Servo คัดแยก, แสดงผล LCD และ Pilot Lamp ตามผลวิเคราะห์
        # กฎ: แผ่นสมบูรณ์ -> ลง CENTER (nano.servo_mid)
        #     แผ่นมีตำหนิ -> ไปทางขวา (nano.servo_right) แล้วหมุนกลับ center
        if nano:
            try:
                if verdict == "PASS" or verdict == "WARN" or accuracy >= 70.0:
                    nano.lcd_show_result(accuracy)
                    nano.light_on(1)
                    nano.servo_mid()  # ชิ้นงานสมบูรณ์ -> อยู่/ลงกึ่งกลาง
                else:
                    nano.lcd_show_log("Defect", accuracy)
                    nano.light_off(1)
                    nano.servo_right()  # ชิ้นงานมีตำหนิ -> ปัดไปทางขวา
                    await asyncio.sleep(1.2)
                    nano.servo_mid()  # หมุนกลับมารอกึ่งกลางสำหรับชิ้นถัดไป
            except Exception as e:
                logger.warning(f"Error actuating sorting hardware: {e}")

    except Exception as err:
        logger.error(f"❌ Error in background defect analysis for Result ID {result_id}: {err}", exc_info=True)



# ==============================================================================
# WebSocket Endpoint สำหรับ Real-Time Camera & Copper Extraction & AI Inspection
# ==============================================================================
@router.websocket("/ws/factory-workflow")
async def websocket_endpoint(
    websocket: WebSocket, pcb_id: int = Query(...), db: Session = Depends(model.get_db)
):
    await websocket.accept()
    camera_manager.active_connections += 1
    logger.info(f"WebSocket connected. Total: {camera_manager.active_connections}")

    nano = None
    try:
        # 1. เริ่มต้นการเชื่อมต่อ Arduino Nano
        nano = NanoController()
        nano.light_on(1)  # ไฟเขียวแสดงว่าระบบพร้อมทำงาน
        nano.light_on(3)
        nano.servo_mid()
        nano.belt_forward(50)  # เริ่มเดินสายพานด้วยความเร็ว 50 (relay 13 เปิดไฟทำงาน)
        nano.lcd_running()  # จอ LCD แสดงสถานะ Running........

        # 2. เตรียมโมเดล AI
        copper_extractor = CopperTraceExtractor.get_instance()
        defect_analyzer = PCBDefectAnalyzer.get_instance()

        camera = await camera_manager.get_camera()
        if not camera:
            await websocket.close()
            return

        # 3. โหลดรูปภาพต้นแบบจากฐานข้อมูล
        original_bytes = None
        try:
            original_bytes = database.get_pcb_original_images(db=db, pcb_id=pcb_id)
        except Exception as e:
            logger.warning(f"No original PCB image in DB for pcb_id {pcb_id}: {e}")

        # State Machine สำหรับการทำงานแบบต่อเนื่อง (Continuous Operation)
        # "SEARCHING": สายพานวิ่ง 50 กำลังสแกนหาชิ้นงาน PCB ที่เข้ามาตรงกลาง
        # "INSPECTING": หยุดสายพาน รัน AI สกัดลายทองแดง ขยับเซอร์โว
        # "WAIT_EXIT": เดินสายพานต่อที่ 50 รอให้ชิ้นงานเดิมพ้นกึ่งกลางก่อนตรวจชิ้นถัดไป
        state = "SEARCHING"
        center_detect_start = None
        exit_detect_start = None
        latest_trace_view = None
        consecutive_read_failures = 0

        while True:
            ret, frame = camera.read()
            if not ret or frame is None:
                consecutive_read_failures += 1
                if consecutive_read_failures >= 15:
                    logger.warning("Camera read failed repeatedly. Attempting reconnect...")
                    camera = await camera_manager.reconnect_camera()
                    consecutive_read_failures = 0
                await asyncio.sleep(0.05)
                continue

            consecutive_read_failures = 0
            h, w = frame.shape[:2]
            center_x = w // 2

            display_frame = frame.copy()
            # วาดเส้นกึ่งกลางสายพาน
            cv2.line(display_frame, (center_x, 0), (center_x, h), (0, 0, 255), 2)

            # ตรวจจับตำแหน่งตัวบอร์ด PCB จากภาพ
            warped_pcb, quad, board_mask = extract_pcb_board(frame, target_size=(256, 256))

            is_centered = False
            if quad is not None and warped_pcb is not None:
                pts = quad.astype(np.int32).reshape((-1, 1, 2))
                cv2.polylines(display_frame, [pts], True, (0, 255, 0), 2)
                cv2.putText(
                    display_frame,
                    "PCB DETECTED",
                    (int(quad[0][0]), max(25, int(quad[0][1]) - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 0),
                    2,
                )

                # ตรวจสอบว่าแผ่น PCB เคลื่อนที่มาถึงกึ่งกลางสายพานหรือยัง
                cx = int(quad[:, 0].mean())
                if abs(cx - center_x) < 45:
                    is_centered = True
                    cv2.putText(
                        display_frame,
                        "CENTERED",
                        (center_x - 50, 35),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (0, 0, 255),
                        2,
                    )

            # ภาพสำหรับช่องที่ 2: แสดงภาพลายทองแดงล่าสุด หรือภาพตัวบอร์ดที่ตรวจพบ
            if latest_trace_view is not None:
                trace_view = latest_trace_view
            elif warped_pcb is not None:
                trace_view = warped_pcb.copy()
            else:
                trace_view = np.zeros((256, 256, 3), dtype=np.uint8)
                cv2.putText(
                    trace_view,
                    "Waiting for PCB...",
                    (25, 130),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (140, 140, 140),
                    1,
                )

            now = time.time()

            # --- จัดการ State Machine ---
            if state == "SEARCHING":
                if is_centered:
                    # ตรวจพบแผ่น PCB อยู่กึ่งกลาง -> เข้าสู่โหมด INSPECTING ทันที ไม่รอหน่วงเวลา เพื่อให้เบรกตรงกลางพอดี
                    state = "INSPECTING"
                    center_detect_start = None
                else:
                    center_detect_start = None

            elif state == "WAIT_EXIT":
                # อยู่ในระยะที่ชิ้นงานที่ตรวจเสร็จแล้วกำลังเคลื่อนที่ออกจากจุดตรวจ
                # ต้องรอให้เวลาผ่านไปอย่างน้อย 2.5 วินาที เพื่อให้แผ่นเดิมเคลื่อนที่พ้นขอบเขตกล้อง
                # และตรวจสอบว่าไม่ได้อยู่กึ่งกลางแล้ว (not is_centered) เพื่อป้องกันการตรวจจับซ้ำชิ้นเดิม
                time_since_exit = now - exit_detect_start if exit_detect_start else 0
                if time_since_exit >= 2.5 and not is_centered:
                    # ชิ้นงานเดิมพ้นขอบเขตกล้องไปแล้วเรียบร้อย -> กลับสู่โหมด SEARCHING สำหรับชิ้นงานถัดไป
                    state = "SEARCHING"
                    exit_detect_start = None

            # --- เมื่อเข้าสู่โหมด INSPECTING ---
            if state == "INSPECTING":
                if nano:
                    nano.is_sensor_triggered = False
                    nano.belt_stop()  # สั่งหยุดสายพานและล็อคเบรกทันที
                    nano.light_off(1)  # ปิดไฟเขียวขณะกำลังวิเคราะห์
                    nano.lcd_processing()  # จอ LCD แสดงสถานะ Processing........

                print("=====> ตรวจพบ PCB อยู่กึ่งกลางกล้อง! หยุดสายพานและรอให้นิ่งสนิท...")

                # ส่งสถานะกำลังประมวลผลไปยัง Frontend
                await websocket.send_json({
                    "type": "analyzing",
                    "message": "PCB อยู่กึ่งกลางกล้อง! กำลังหยุดสายพานและรอให้นิ่งสนิท...",
                })

                # หน่วงเวลารอให้สายพานหยุดนิ่งสนิท 100% ปราศจากแรงสั่นสะเทือน (0.6 วินาที)
                await asyncio.sleep(0.6)

                # ล้างภาพเก่าที่ตกค้างใน Hardware Buffer ของกล้องออกทั้งหมด แล้วดึงภาพใหม่ที่คมชัดที่สุด
                for _ in range(5):
                    camera.grab()
                ret_stop, frame_stop = camera.read()
                if ret_stop and frame_stop is not None:
                    frame = frame_stop

                # สกัดภาพบอร์ด PCB จากภาพนิ่งแบบเต็มแผ่น (เผื่อขอบ 6% เพื่อไม่ให้ตัดลายทองแดง และคงสัดส่วน Aspect Ratio)
                warped_pcb, quad, board_mask = extract_pcb_board(frame, target_size=None, margin=0.06)
                if warped_pcb is None:
                    crop_w = int(w * 0.7)
                    crop_h = int(h * 0.7)
                    warped_pcb = frame[
                        max(0, h // 2 - crop_h // 2) : min(h, h // 2 + crop_h // 2),
                        max(0, w // 2 - crop_w // 2) : min(w, w // 2 + crop_w // 2),
                    ]

                try:
                    # 🛠️ สกัดลายทองแดงและบันทึกผลเบื้องต้นลงฐานข้อมูลใน Worker Thread อย่างรวดเร็ว (~40ms)
                    init_res = await asyncio.to_thread(
                        save_initial_pcb_result,
                        warped_pcb,
                        original_bytes,
                        copper_extractor,
                        pcb_id,
                        db,
                    )

                    latest_trace_view = init_res["trace_view"]
                    trace_view = latest_trace_view
                    current_result_id = init_res["result_id"]

                    print(f"=====> บันทึกผลเบื้องต้นสำเร็จ! Result ID: {current_result_id} | เริ่มเดินสายพานต่อทันที...")

                    # ส่งสัญญาณแจ้งเตือน Frontend ให้ดึงข้อมูลผลลัพธ์มาแสดง (รูปที่ 1, 2, 3 แสดงทันที, รูปที่ 4 ขึ้นสถานะรอดำเนินการ)
                    await websocket.send_json({
                        "type": "new_result",
                        "message": "PCB copper trace extracted",
                        "result_id": current_result_id,
                        "accuracy": 95.0,
                        "verdict": "PASS",
                        "counts": {"open": 0, "short": 0, "minor": 0},
                    })

                    # 🚀 รันโมเดลวิเคราะห์ Short / Open (รูปที่ 4) ใน Background Task โดยไม่บล็อกสายพานและวิดีโอสด!
                    asyncio.create_task(
                        run_background_defect_analysis(
                            result_id=current_result_id,
                            warped_pcb=warped_pcb,
                            copper_mask=init_res["copper_mask"],
                            original_bytes=original_bytes,
                            pcb_id=pcb_id,
                            websocket=websocket,
                            nano=nano,
                        )
                    )

                except Exception as err:
                    logger.error(f"Error saving initial PCB: {err}", exc_info=True)
                finally:
                    # สั่งสายพานเดินต่อทันทีด้วยความเร็ว 50 โดยไม่ต้องรอให้การวิเคราะห์ตำหนิเสร็จ!
                    if nano:
                        nano.belt_forward(50)
                        nano.light_on(1)
                        nano.lcd_running()
                    # เปลี่ยนสถานะเป็น WAIT_EXIT เพื่อรอให้ชิ้นนี้พ้นกึ่งกลางก่อนเริ่มตรวจชิ้นใหม่
                    state = "WAIT_EXIT"
                    exit_detect_start = time.time()

            # ส่งเฟรมภาพ 2 ภาพผ่าน WebSocket แบบ Binary
            # ภาพที่ 1: กล้องสดพร้อมกรอบบอร์ด (display_frame)
            _, display_buf = cv2.imencode(".jpg", display_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            await websocket.send_bytes(display_buf.tobytes())

            # ภาพที่ 2: ภาพการดึงลายทองแดง Real-Time (trace_view)
            if trace_view is not None:
                _, trace_buf = cv2.imencode(".jpg", trace_view, [cv2.IMWRITE_JPEG_QUALITY, 80])
                await websocket.send_bytes(trace_buf.tobytes())
            else:
                empty = np.zeros((100, 100, 3), dtype=np.uint8)
                _, empty_buf = cv2.imencode(".jpg", empty)
                await websocket.send_bytes(empty_buf.tobytes())

            await asyncio.sleep(camera_manager.frame_interval)

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally")
    except asyncio.CancelledError:
        logger.info("WebSocket task cancelled")
    except Exception as e:
        logger.error(f"WebSocket error in factory workflow: {e}", exc_info=True)
    finally:
        if nano:
            try:
                nano.close()
            except Exception:
                pass

        camera_manager.active_connections = max(0, camera_manager.active_connections - 1)
        logger.info(f"Connection closed. Total: {camera_manager.active_connections}")
        if camera_manager.active_connections == 0:
            await camera_manager.release_camera()

        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.close()
        except Exception:
            pass


# ==============================================================================
# REST API Endpoints
# ==============================================================================
@router.get("/get_images/{pcb_id}")
async def get_images(
    pcb_id: int,
    db: Session = Depends(model.get_db),
):
    image_list = database.get_pcb(db=db, pcb_id=pcb_id)
    if not image_list:
        raise HTTPException(status_code=404, detail="Image not found for this PCB ID")

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


@router.post("/create_pcb")
async def create_pcb(
    file: UploadFile = File(...),
    db: Session = Depends(model.get_db),
):
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
                "message": "Result deleted successfully",
                "result_id": result_id,
            },
        )
    except Exception as e:
        logger.error(f"Error deleting Result: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
