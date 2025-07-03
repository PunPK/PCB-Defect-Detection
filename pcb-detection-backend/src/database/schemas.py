from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ========================= ไม่ได้ใช้ =========================
class ImagePCB(BaseModel):
    image_id: int
    filename: str
    filepath: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ImagePCBCreate(BaseModel):
    filename: str
    filepath: str
    pcb_id: Optional[int] = None


class Result(BaseModel):
    results_id: int
    accuracy: float
    description: str

    class Config:
        from_attributes = True


class ResultCreate(BaseModel):
    accuracy: float
    description: str
    template_image: int
    defective_image: int
    aligned_image: int
    diff_image: int
    cleaned_image: int
    result_image: int
    pcb_id: Optional[int] = None


class PCB(BaseModel):
    id: int
    create_at: datetime
    originalPcb: Optional[int] = None
    result_id: Optional[int] = None

    class Config:
        from_attributes = True


class PCBCreate(BaseModel):
    originalPcb: Optional[int] = None
    result_id: Optional[int] = None
