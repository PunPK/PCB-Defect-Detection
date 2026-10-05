"""
compare_api.py — FastAPI สำหรับเปรียบเทียบลายทองแดงกับไฟล์ต้นแบบ (รันบน Raspberry Pi 5)
รัน:  uvicorn compare_api:app --host 0.0.0.0 --port 8001 --workers 1
เปิด  http://<ip-ของ-pi>:8001/docs  เพื่อทดสอบผ่านหน้าเว็บ

ลำดับการใช้งาน
  1) โมเดลแยกทองแดงของคุณทำนาย mask เสร็จ (ขาว = ทองแดง)
  2) POST /inspect  ส่ง mask + ไฟล์ต้นแบบ (หรือชื่อต้นแบบที่อัปโหลดไว้ด้วย POST /design/{name})
     + ภาพถ่าย (ไม่บังคับ ใช้วาดผล)  → ได้ JSON: verdict, รายการตำหนิ (open/short/minor) + ตำแหน่ง + ภาพผล
"""
import os
import time
import base64
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException

import pcb_compare as pc

MODEL_PATH = os.getenv("DEFECT_MODEL", "models/defect_rf.joblib")
DESIGN_DIR = os.getenv("DESIGN_DIR", "designs")
RESULT_DIR = os.getenv("RESULT_DIR", "results")
LABEL_DIR = os.getenv("LABEL_DIR", "label_data")
os.makedirs(DESIGN_DIR, exist_ok=True)
os.makedirs(RESULT_DIR, exist_ok=True)

app = FastAPI(title="PCB Design Compare")
CLF = pc.DefectClassifier.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else pc.DefectClassifier()
DESIGN_CACHE = {}


def _decode(upload: UploadFile, flags=cv2.IMREAD_UNCHANGED):
    data = np.frombuffer(upload.file.read(), np.uint8)
    img = cv2.imdecode(data, flags)
    if img is None:
        raise HTTPException(400, f"อ่านไฟล์ภาพไม่ได้: {upload.filename}")
    return img


def _b64(img, ext=".jpg"):
    ok, enc = cv2.imencode(ext, img, [cv2.IMWRITE_JPEG_QUALITY, 88] if ext == ".jpg" else [])
    return base64.b64encode(enc.tobytes()).decode()


def _get_design(name, copper):
    key = (name, copper)
    if key not in DESIGN_CACHE:
        path = os.path.join(DESIGN_DIR, name + ".png")
        if not os.path.exists(path):
            raise HTTPException(404, f"ไม่พบต้นแบบ '{name}' — อัปโหลดก่อนด้วย POST /design/{name}")
        DESIGN_CACHE[key] = pc.load_design(path, copper=copper)
    return DESIGN_CACHE[key]


@app.get("/health")
def health():
    return {"ok": True, "classifier": "rf" if CLF.model is not None else "rule",
            "classes": CLF.classes, "designs": sorted(f[:-4] for f in os.listdir(DESIGN_DIR) if f.endswith(".png"))}


@app.post("/design/{name}")
def upload_design(name: str, file: UploadFile = File(...), copper: str = Form("auto")):
    img = _decode(file, cv2.IMREAD_GRAYSCALE)
    cv2.imwrite(os.path.join(DESIGN_DIR, name + ".png"), img)
    for k in [k for k in DESIGN_CACHE if k[0] == name]:
        DESIGN_CACHE.pop(k)
    d = _get_design(name, copper)
    return {"name": name, "size": list(img.shape[::-1]), "variants": [v[0] for v in d["variants"]]}


@app.post("/inspect")
def inspect(mask: UploadFile = File(..., description="mask ทองแดงจากโมเดล (ขาว=ทองแดง)"),
            design: Optional[UploadFile] = File(None, description="ไฟล์ต้นแบบ (ถ้าไม่ส่ง ใช้ design_name)"),
            photo: Optional[UploadFile] = File(None, description="ภาพถ่ายกรอบเดียวกับ mask (ไม่บังคับ)"),
            design_name: Optional[str] = Form(None),
            copper: str = Form("auto", description="auto / black / white = สีของทองแดงในไฟล์ต้นแบบ"),
            allow_mirror: bool = Form(True),
            save_for_label: bool = Form(True),
            source: str = Form("board")):
    m = pc.load_mask(_decode(mask))
    if design is not None:
        des = pc.load_design(_decode(design), copper=copper)
    elif design_name:
        des = _get_design(design_name, copper)
    else:
        raise HTTPException(400, "ต้องส่งไฟล์ design หรือ design_name")
    ph = _decode(photo, cv2.IMREAD_COLOR) if photo is not None else None
    try:
        res, ctx = pc.inspect(m, des, classifier=CLF, photo=ph, align_kw=dict(allow_mirror=allow_mirror))
    except Exception as e:  # noqa
        raise HTTPException(422, f"ตรวจไม่สำเร็จ: {e}")
    vis = pc.draw_on_mask(res, ctx)
    vis_c = pc.draw_canon(res, ctx)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    cv2.imwrite(os.path.join(RESULT_DIR, f"{source}_{stamp}_{res['verdict']}.jpg"), vis)
    out = pc.result_to_json(res)
    if save_for_label and res["defects"]:
        out["label_ids"] = pc.save_candidates(res, ctx, LABEL_DIR, source=source)
    out["vis_photo_jpg_b64"] = _b64(vis)
    out["vis_design_png_b64"] = _b64(vis_c, ".png")
    return out


@app.post("/reload_model")
def reload_model():
    global CLF
    CLF = pc.DefectClassifier.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else pc.DefectClassifier()
    return {"classifier": "rf" if CLF.model is not None else "rule"}