from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class PCBBase(BaseModel):
    OriginalPcb: int
    result_id: int


class PCBCreate(PCBBase):
    pass


class PCB(PCBBase):
    id: int
    datetime: datetime

    class Config:
        from_attributes = True


class ResultBase(BaseModel):
    accuracy: float
    description: str
    pcb_analysis: int


class ResultCreate(ResultBase):
    pass


class Result(ResultBase):
    results_id: int

    class Config:
        from_attributes = True


class ImagePCBBase(BaseModel):
    filename: str
    pcb_id: int


class ImagePCBCreate(ImagePCBBase):
    pass


class ImagePCB(ImagePCBBase):
    id: int
    filepath: str
    uploaded_at: datetime

    class Config:
        from_attributes = True
