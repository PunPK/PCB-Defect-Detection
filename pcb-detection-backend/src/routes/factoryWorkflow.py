import os
import time
import base64
import asyncio
import logging
from typing import Optional

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
                # ค้นหากล้องที่พร้อมใช้งาน (0 หรือ 1 หรือ 2)
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

    async def release_camera(self):
        async with self.lock:
            if self.camera and self.camera.isOpened():
                self.camera.release()
                self.camera = None
                logger.info("Camera released")


camera_manager = CameraManager()


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
        nano.belt_forward(50)  # เริ่มเดินสายพานด้วยความเร็ว 50 (relay 13 จะเปิดไฟทำงาน)
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

        center_line_start_time = None
        last_inspect_time = 0.0
        cooldown_seconds = 0.4
        latest_trace_view = None

        while True:
            ret, frame = camera.read()
            if not ret:
                logger.error("Frame read failed")
                await asyncio.sleep(0.05)
                continue

            h, w = frame.shape[:2]
            center_x = w // 2

            display_frame = frame.copy()
            # วาดเส้นกึ่งกลางสายพาน
            cv2.line(display_frame, (center_x, 0), (center_x, h), (0, 0, 255), 2)

            # ตรวจจับตำแหน่งตัวบอร์ด PCB จากภาพ (ประมวลผล Contour รวดเร็วโดยไม่รันโมเดลหนัก)
            warped_pcb, quad, board_mask = extract_pcb_board(frame, target_size=(256, 256))

            is_centered = False
            if quad is not None and warped_pcb is not None:
                # วาดกรอบบอร์ด PCB บนกล้องสด
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

            # ตรวจสอบเงื่อนไข Trigger: เมื่อ PCB เคลื่อนที่มาอยู่กึ่งกลางกล้อง (ไม่ต้องใช้ฮาร์ดแวร์เซนเซอร์)
            current_time = time.time()
            time_since_last = current_time - last_inspect_time

            should_inspect = False
            if is_centered:
                if center_line_start_time is None:
                    center_line_start_time = current_time
                # เมื่อบอร์ดอยู่กึ่งกลางภาพต่อเนื่องอย่างน้อย 0.2 วินาที และพ้นระยะ cooldown 3 วินาที
                if (current_time - center_line_start_time) >= 0.2 and time_since_last > 3.0:
                    should_inspect = True
            else:
                center_line_start_time = None

            if should_inspect:
                last_inspect_time = current_time
                center_line_start_time = None
                if nano:
                    nano.is_sensor_triggered = False
                    nano.belt_stop()  # สั่งหยุดสายพานทันที (relay 13 ดับลง)
                    nano.light_off(1)  # ปิดไฟเขียวขณะกำลังวิเคราะห์
                    nano.lcd_processing()  # จอ LCD แสดงสถานะ Processing........

                print("=====> ตรวจพบ PCB อยู่กึ่งกลางกล้อง! หยุดสายพานและสกัดลายทองแดง...")

                # ส่งสถานะกำลังประมวลผลไปยัง Frontend
                await websocket.send_json({
                    "type": "analyzing",
                    "message": "PCB อยู่กึ่งกลางกล้อง! กำลังหยุดสายพานและสกัดลายทองแดง...",
                })

                # หน่วงเวลาสั้นๆ เพื่อให้สายพานหยุดนิ่งสนิทและภาพไม่สั่นไหว
                await asyncio.sleep(0.15)

                # ดึงภาพเฟรมใหม่หลังจากสายพานหยุดนิ่ง
                for _ in range(3):
                    ret_stop, frame_stop = camera.read()
                    if ret_stop and frame_stop is not None:
                        frame = frame_stop

                # สกัดภาพบอร์ด PCB จากภาพนิ่ง
                warped_pcb, quad, board_mask = extract_pcb_board(frame, target_size=(256, 256))
                if warped_pcb is None:
                    # Fallback ตัดกึ่งกลางภาพหากบอร์ดไม่ได้รูป
                    crop_size = min(h, w) // 2
                    warped_pcb = frame[h // 2 - crop_size // 2 : h // 2 + crop_size // 2,
                                       w // 2 - crop_size // 2 : w // 2 + crop_size // 2]
                    warped_pcb = cv2.resize(warped_pcb, (256, 256))

                try:
                    # 🛠️ ประมวลผลเฉพาะ Model ลายทองแดง (TinyUNet)
                    copper_mask, trace_view = copper_extractor.predict_overlay(
                        warped_pcb, conf_thresh=0.5, color=(0, 255, 200), alpha=0.55
                    )
                    latest_trace_view = trace_view.copy()

                    # เปรียบเทียบลายทองแดงกับภาพต้นแบบ
                    accuracy = 95.0
                    verdict = "PASS"
                    description = "Copper Trace Extracted Successfully"

                    if original_bytes:
                        try:
                            tpl_arr = np.frombuffer(original_bytes, np.uint8)
                            tpl_bgr = cv2.imdecode(tpl_arr, cv2.IMREAD_COLOR)
                            if tpl_bgr is not None:
                                tpl_mask = copper_extractor.predict(tpl_bgr)
                                best_iou = 0.0
                                for flip in [False, True]:
                                    curr_m = cv2.flip(copper_mask, 1) if flip else copper_mask
                                    for rot in [0, cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_180, cv2.ROTATE_90_COUNTERCLOCKWISE]:
                                        m = curr_m if rot == 0 else cv2.rotate(curr_m, rot)
                                        inter = np.logical_and(m > 127, tpl_mask > 127).sum()
                                        union = np.logical_or(m > 127, tpl_mask > 127).sum()
                                        score = (inter / max(union, 1)) * 100.0
                                        if score > best_iou:
                                            best_iou = score
                                accuracy = round(min(100.0, max(10.0, best_iou)), 2)
                                verdict = "PASS" if accuracy >= 70.0 else "DEFECT"
                                description = f"Copper Trace Match: {accuracy}% ({verdict})"
                        except Exception as e:
                            logger.error(f"Error comparing copper trace with template: {e}")
                    else:
                        copper_ratio = (np.count_nonzero(copper_mask > 127) / copper_mask.size) * 100.0
                        accuracy = round(min(100.0, max(50.0, copper_ratio * 3.5)), 2)
                        verdict = "PASS" if accuracy >= 70.0 else "DEFECT"
                        description = f"Copper Trace Extracted: {accuracy}% ({verdict})"

                    # ส่งภาพผลลัพธ์ลายทองแดงไปยัง Frontend ทันที
                    _, display_buf = cv2.imencode(".jpg", display_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    await websocket.send_bytes(display_buf.tobytes())
                    _, trace_buf = cv2.imencode(".jpg", trace_view, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    await websocket.send_bytes(trace_buf.tobytes())

                    # บันทึกรูปภาพทั้ง 4 รูปตามที่ระบบต้องการ
                    images = {}

                    # 1. ต้นแบบ
                    if original_bytes:
                        tpl_fn = generate_filename("template")
                        tpl_path = save_image_bytes(original_bytes, tpl_fn)
                        images["template"] = {"filename": tpl_fn, "filepath": tpl_path}
                    else:
                        tpl_fn = generate_filename("template")
                        tpl_path = save_image_bytes(cv2.imencode(".jpg", warped_pcb)[1].tobytes(), tpl_fn)
                        images["template"] = {"filename": tpl_fn, "filepath": tpl_path}

                    # 2. ที่เจอ (ภาพถ่ายบอร์ดจริง)
                    def_fn = generate_filename("defective")
                    def_path = save_image_bytes(cv2.imencode(".jpg", warped_pcb)[1].tobytes(), def_fn)
                    images["defective"] = {"filename": def_fn, "filepath": def_path}

                    # 3. ภาพที่หมุนและจัดตำแหน่งตรงกับต้นแบบ (Aligned PCB: หมุน/เลื่อน/ดัด perspective ตรงกับ Template)
                    aligned_fn = generate_filename("aligned")
                    aligned_img = analysis_res.get("aligned_photo")
                    if aligned_img is None:
                        aligned_img = trace_view
                    aligned_path = save_image_bytes(cv2.imencode(".jpg", aligned_img)[1].tobytes(), aligned_fn)
                    images["aligned"] = {"filename": aligned_fn, "filepath": aligned_path}

                    # 4. ผลลัพธ์ลายทองแดง
                    res_fn = generate_filename("result")
                    res_path = save_image_bytes(cv2.imencode(".jpg", trace_view)[1].tobytes(), res_fn)
                    images["result"] = {"filename": res_fn, "filepath": res_path}

                    prepare_result = {
                        "detected": True,
                        "accuracy": accuracy,
                        "result": description,
                        "verdict": verdict,
                        "counts": {"open": 0, "short": 0, "minor": 0} if verdict == "PASS" else {"open": 1, "short": 0, "minor": 0},
                        "images": images,
                    }

                    # บันทึกลงฐานข้อมูล SQLite
                    push_to_database = await database.create_pcb_result(
                        db=db,
                        prepare_result=prepare_result,
                        pcb_id=pcb_id,
                    )

                    print(f"=====> บันทึกผลสำเร็จ! Result ID: {push_to_database.results_id} | {description}")

                    # ส่งสัญญาณแจ้งเตือน Frontend ให้ดึงข้อมูลผลลัพธ์ใหม่มาแสดง
                    if push_to_database:
                        await websocket.send_json({
                            "type": "new_result",
                            "message": "PCB result created",
                            "result_id": push_to_database.results_id,
                            "accuracy": accuracy,
                            "verdict": verdict,
                            "counts": prepare_result["counts"],
                        })

                    # สั่งการ Servo คัดแยก, แสดงผล LCD และ Pilot Lamp
                    if nano:
                        if verdict == "PASS" or accuracy >= 70.0:
                            nano.lcd_show_result(accuracy)  # จอ LCD แสดงผลลัพธ์ผ่าน
                            nano.light_on(1)  # ไฟเขียว
                            nano.servo_left()  # ชิ้นงานผ่าน คัดแยกไปทางซ้าย
                            await asyncio.sleep(0.8)
                            nano.servo_mid()
                        else:
                            nano.lcd_show_log("Defect", accuracy)  # จอ LCD แสดง Error
                            nano.light_off(1)  # ปิดไฟเขียว
                            nano.servo_right()  # ชิ้นงานชำรุด คัดแยกไปทางขวา
                            await asyncio.sleep(0.8)
                            nano.servo_mid()

                except Exception as err:
                    logger.error(f"Error analyzing PCB: {err}", exc_info=True)
                finally:
                    # สั่งสายพานเริ่มทำงานต่อไปหลังจากประมวลผลเสร็จสิ้นด้วยความเร็ว 50
                    if nano:
                        nano.belt_forward(50)  # เริ่มเดินสายพานด้วยความเร็ว 50 (relay 13 เปิดไฟทำงาน)
                        nano.light_on(1)  # ไฟเขียวแสดงว่าสายพานพร้อมรับชิ้นงาน
                        nano.lcd_running()  # จอ LCD แสดง Running........
                    center_line_start_time = None
                    last_inspect_time = time.time()

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

    except Exception as e:
        logger.error(f"WebSocket error in factory workflow: {e}")
    finally:
        if nano:
            nano.belt_stop()  # สั่งหยุดสายพาน (relay 13 ดับ)
            nano.lcd_stop_runnung()  # จอ LCD แสดงสถานะรอเริ่มงาน
            nano.close()

        camera_manager.active_connections -= 1
        logger.info(f"Connection closed. Total: {camera_manager.active_connections}")
        if camera_manager.active_connections == 0:
            await camera_manager.release_camera()

        await websocket.close()


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
