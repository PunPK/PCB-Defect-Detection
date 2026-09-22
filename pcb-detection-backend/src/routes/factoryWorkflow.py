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
        nano.belt_forward(200)  # เริ่มเดินสายพาน (relay 13 จะเปิดไฟทำงาน)
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

            # ตรวจจับตำแหน่งตัวบอร์ด PCB จากภาพ
            warped_pcb, quad, board_mask = extract_pcb_board(frame, target_size=(256, 256))

            copper_mask = None
            trace_view = None
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

                # ดึงลายเส้นทองแดงแบบ Real-Time ด้วย TinyUNet!
                copper_mask, trace_view = copper_extractor.predict_overlay(
                    warped_pcb, conf_thresh=0.5, color=(0, 255, 200), alpha=0.55
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
            else:
                trace_view = np.zeros((256, 256, 3), dtype=np.uint8)
                cv2.putText(
                    trace_view,
                    "Waiting for PCB...",
                    (30, 130),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (140, 140, 140),
                    2,
                )

            # ตรวจสอบเงื่อนไข Trigger วิเคราะห์ตำหนิ (จากเซนเซอร์ Arduino หรือเมื่ออยู่กึ่งกลางภาพ)
            current_time = time.time()
            time_since_last = current_time - last_inspect_time

            sensor_triggered = nano.is_sensor_triggered if nano else False
            center_triggered = False

            if is_centered:
                if center_line_start_time is None:
                    center_line_start_time = current_time
                if (current_time - center_line_start_time) >= cooldown_seconds:
                    center_triggered = True
            else:
                center_line_start_time = None

            # เริ่มต้นการวิเคราะห์เมื่อเซนเซอร์ตรวจพบ หรือบอร์ดอยู่กึ่งกลาง
            if (sensor_triggered or center_triggered) and time_since_last > 4.0:
                last_inspect_time = current_time
                if nano:
                    nano.is_sensor_triggered = False
                    nano.belt_stop()  # สั่งหยุดสายพาน (relay 13 ดับลงเมื่อหยุดการทำงานสายพาน)
                    nano.light_off(1)  # ปิดไฟเขียวชั่วคราวขณะวิเคราะห์
                    nano.lcd_processing()  # จอ LCD แสดงสถานะ Processing........

                print("=====> เริ่มต้นการสกัดลายทองแดงและวิเคราะห์ตำหนิด้วย AI...")

                # ส่งสถานะกำลังประมวลผลไปยัง Frontend
                await websocket.send_json({
                    "type": "analyzing",
                    "message": "AI กำลังสกัดลายและวิเคราะห์เส้นทองแดง...",
                })

                if warped_pcb is None:
                    # Fallback ตัดกึ่งกลางภาพหากบอร์ดไม่ได้รูป
                    crop_size = min(h, w) // 2
                    warped_pcb = frame[h // 2 - crop_size // 2 : h // 2 + crop_size // 2,
                                       w // 2 - crop_size // 2 : w // 2 + crop_size // 2]
                    warped_pcb = cv2.resize(warped_pcb, (256, 256))
                    copper_mask, trace_view = copper_extractor.predict_overlay(warped_pcb)

                try:
                    # วิเคราะห์เปรียบเทียบลายเส้นทองแดงกับไฟล์ต้นแบบด้วย RandomForest + pcb_compare
                    analysis_res = defect_analyzer.analyze(
                        copper_mask=copper_mask,
                        template_bytes=original_bytes,
                        photo_bgr=warped_pcb,
                        allow_mirror=True,
                    )

                    # บันทึกเฉพาะ 4 รูปภาพตามที่ผู้ใช้กำหนด:
                    # 1. ต้นแบบ (Template PCB)
                    # 2. ที่เจอ (Detected PCB)
                    # 3. ดึงลาย (Extracted Copper Trace)
                    # 4. วิเคราะห์ลาย (Defect Analysis Result)
                    images = {}

                    # 1. ต้นแบบ
                    if original_bytes:
                        tpl_fn = generate_filename("template")
                        tpl_path = save_image_bytes(original_bytes, tpl_fn)
                        images["template"] = {"filename": tpl_fn, "filepath": tpl_path}
                    else:
                        tpl_bgr = cv2.cvtColor(analysis_res["vis_canon"], cv2.COLOR_RGB2BGR)
                        tpl_fn = generate_filename("template")
                        tpl_path = save_image_bytes(cv2.imencode(".jpg", tpl_bgr)[1].tobytes(), tpl_fn)
                        images["template"] = {"filename": tpl_fn, "filepath": tpl_path}

                    # 2. ที่เจอ (ภาพถ่ายบอร์ดจริง)
                    def_fn = generate_filename("defective")
                    def_path = save_image_bytes(cv2.imencode(".jpg", warped_pcb)[1].tobytes(), def_fn)
                    images["defective"] = {"filename": def_fn, "filepath": def_path}

                    # 3. ดึงลาย (ภาพสกัดลายทองแดง)
                    trace_fn = generate_filename("trace")
                    trace_path = save_image_bytes(cv2.imencode(".jpg", trace_view)[1].tobytes(), trace_fn)
                    images["aligned"] = {"filename": trace_fn, "filepath": trace_path}

                    # 4. วิเคราะห์ลาย (ภาพผลลัพธ์พร้อมกล่องตำหนิและสีไฮไลท์)
                    res_fn = generate_filename("result")
                    res_img = analysis_res["vis_on_board"]
                    res_path = save_image_bytes(cv2.imencode(".jpg", res_img)[1].tobytes(), res_fn)
                    images["result"] = {"filename": res_fn, "filepath": res_path}

                    prepare_result = {
                        "detected": True,
                        "accuracy": analysis_res["accuracy"],
                        "result": analysis_res["description"],
                        "verdict": analysis_res["verdict"],
                        "counts": analysis_res["counts"],
                        "images": images,
                    }

                    # บันทึกลงฐานข้อมูล SQLite
                    push_to_database = await database.create_pcb_result(
                        db=db,
                        prepare_result=prepare_result,
                        pcb_id=pcb_id,
                    )

                    print(f"=====> บันทึกผลสำเร็จ! Result ID: {push_to_database.results_id} | {analysis_res['description']}")

                    # ส่งสัญญาณแจ้งเตือน Frontend ให้ดึงข้อมูลผลลัพธ์ใหม่มาแสดง
                    if push_to_database:
                        await websocket.send_json({
                            "type": "new_result",
                            "message": "PCB result created",
                            "result_id": push_to_database.results_id,
                            "accuracy": analysis_res["accuracy"],
                            "verdict": analysis_res["verdict"],
                            "counts": analysis_res["counts"],
                        })

                    # สั่งการ Servo คัดแยก, แสดงผล LCD และ Pilot Lamp ผ่าน Arduino Nano
                    verdict = analysis_res["verdict"]
                    accuracy = analysis_res["accuracy"]
                    if nano:
                        if verdict == "PASS" or accuracy >= 80:
                            nano.lcd_show_result(accuracy)  # จอ LCD แสดงผลลัพธ์ผ่าน
                            nano.light_on(1)  # ไฟเขียว
                            nano.servo_left()  # ชิ้นงานผ่าน คัดแยกไปทางซ้าย
                            await asyncio.sleep(0.8)
                            nano.servo_mid()
                        else:
                            defect_desc = analysis_res.get("result", "DEFECT")
                            nano.lcd_show_log(defect_desc, accuracy)  # จอ LCD แสดง Error
                            nano.light_off(1)  # ปิดไฟเขียว
                            nano.servo_right()  # ชิ้นงานชำรุด คัดแยกไปทางขวา
                            await asyncio.sleep(0.8)
                            nano.servo_mid()

                except Exception as err:
                    logger.error(f"Error analyzing PCB: {err}", exc_info=True)
                finally:
                    # สั่งสายพานเดินหน้าต่อเพื่อรอรับชิ้นงานถัดไป
                    if nano:
                        nano.belt_forward(200)  # เริ่มเดินสายพาน (relay 13 เปิดไฟทำงาน)
                        nano.light_on(1)  # ไฟเขียวแสดงว่าสายพานพร้อมรับชิ้นงาน
                        nano.lcd_running()  # จอ LCD แสดง Running........
                    center_line_start_time = None

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
