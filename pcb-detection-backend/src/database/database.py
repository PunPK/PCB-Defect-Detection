import os
from sqlalchemy.orm import Session
from . import model, schemas
from datetime import datetime
from fastapi import UploadFile
import uuid


def save_uploaded_file(file: UploadFile, upload_dir: str = "uploads"):
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)

    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(upload_dir, unique_filename)

    with open(file_path, "wb") as buffer:
        buffer.write(file.file.read())

    return unique_filename, file_path


async def create_pcb(
    db: Session,
    file: UploadFile,
):
    contents = await file.read()
    db_pcb = model.PCB(original_filename=file.filename, originalPcb_data=contents)
    db.add(db_pcb)
    db.commit()
    db.refresh(db_pcb)
    return db_pcb


def create_result(db: Session, result: schemas.ResultCreate):
    db_result = model.Result(**result.dict())
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    return db_result


async def create_pcb_image(db: Session, file: UploadFile, pcb_id: int):
    contents = await file.read()
    db_image = model.ImagePCB(
        filename=file.filename, image_data=contents, pcb_id=pcb_id
    )
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image


def get_pcb(db: Session, pcb_id: int):
    return db.query(model.PCB).filter(model.PCB.id == pcb_id).first()


def get_pcb_images(db: Session, pcb_id: int):
    return db.query(model.ImagePCB).filter(model.ImagePCB.pcb_id == pcb_id).all()
