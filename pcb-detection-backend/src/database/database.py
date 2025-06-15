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
):
    # contents = await file.read()
    db_pcb = model.PCB()
    db.add(db_pcb)
    db.commit()
    db.refresh(db_pcb)
    return db_pcb


async def update_pcb(
    db: Session,
    image_id: int,
):
    db_pcb = model.PCB(image_id=image_id)
    db.add(db_pcb)
    db.commit()
    db.refresh(db_pcb)
    return db_pcb


async def upload_and_create_pcb(
    file: UploadFile,
    db: Session,
):

    contents = await file.read()

    # Create image record
    db_image = model.ImagePCB(
        filename=file.filename, image_data=contents, uploaded_at=datetime.utcnow()
    )
    db.add(db_image)
    db.commit()
    db.refresh(db_image)

    db_pcb = model.PCB(originalPcb=db_image.image_id)
    db.add(db_pcb)
    db.commit()
    db.refresh(db_pcb)

    db_image.pcb_id = db_pcb.id
    db.commit()

    return {
        "pcb_id": db_pcb.id,
        "image_id": db_image.image_id,
        "filename": db_image.filename,
    }


async def create_pcb_result(
    db: Session,
    prepare_result: dict,
    pcb_id: int,
):
    def print_dict_structure(d, indent=0):
        for key, value in d.items():
            print("  " * indent + str(key), end="")
            if isinstance(value, dict):
                print(" (dict):")
                print_dict_structure(value, indent + 1)
            else:
                print(":", type(value))

    print("Dictionary structure:")
    print_dict_structure(prepare_result)

    print("Creating PCB result in database...")
    print(prepare_result.result)
    db_result = model.Result(
        accuracy=prepare_result.accuracy,
        description=prepare_result.result,
        template_image=prepare_result.images.template,
        defective_image=prepare_result.images.defective,
        aligned_image=prepare_result.images.aligned,
        diff_image=prepare_result.images.diff,
        cleaned_image=prepare_result.images.cleaned,
        result_image=prepare_result.images.result,
    )
    db.add(db_result)
    db.commit()
    db.refresh(db_result)

    pcb = db.query(model.PCB).filter(model.PCB.id == pcb_id).first()
    if pcb:
        pcb.result_id = db_result.results_id
        db.commit()
        db.refresh(pcb)

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
    image_data = (
        db.query(model.ImagePCB.image_data)
        .join(model.PCB, model.ImagePCB.image_id == model.PCB.originalPcb)
        .filter(model.PCB.id == pcb_id)
        .scalar()
    )

    return image_data
    # return db.query(model.PCB.originalPcb).filter(model.PCB.id == pcb_id).scalar()


def get_pcb_images(db: Session, pcb_id: int):
    return db.query(model.ImagePCB).filter(model.ImagePCB.pcb_id == pcb_id).all()
