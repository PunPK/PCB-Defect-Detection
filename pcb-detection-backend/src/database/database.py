import os
from sqlalchemy.orm import Session
from . import model, schemas
from datetime import datetime
from fastapi import UploadFile
import uuid
import base64
from sqlalchemy import func


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
    filename: str,
    filepath: str,
    db: Session,
):

    # contents = await file.read()

    # Create image record
    db_image = model.ImagePCB(
        filename=filename,
        filepath=filepath,
        # filename=file.filename, image_data=contents,
        uploaded_at=datetime.utcnow(),
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
    # def print_dict_structure(d, indent=0):
    #     for key, value in d.items():
    #         print("  " * indent + str(key), end="")
    #         if isinstance(value, dict):
    #             print(" (dict):")
    #             print_dict_structure(value, indent + 1)
    #         else:
    #             print(":", type(value))

    # print("Dictionary structure:")
    # print_dict_structure(prepare_result)

    # print("Creating PCB result in database...")
    # print(prepare_result["result"])

    images_data = prepare_result["images"]

    def add_image_and_get_id(db: Session, filepath: str, filename: str) -> int:
        image = model.ImagePCB(
            filepath=filepath,
            filename=filename,
            uploaded_at=datetime.utcnow(),
        )
        db.add(image)
        db.commit()
        db.refresh(image)
        return image.image_id

    image_ids = {}
    for key in ["template", "defective", "aligned", "diff", "cleaned", "result"]:
        image_info = images_data[key]
        image_ids[key] = add_image_and_get_id(
            db, image_info["filepath"], image_info["filename"]
        )

    db_result = model.Result(
        accuracy=float(prepare_result["accuracy"]),
        pcb_result_id=pcb_id,
        description=prepare_result["result"],
        template_image=image_ids["template"],
        defective_image=image_ids["defective"],
        aligned_image=image_ids["aligned"],
        diff_image=image_ids["diff"],
        cleaned_image=image_ids["cleaned"],
        result_image=image_ids["result"],
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
    # db_image = model.ImagePCB(
    #     filename=file.filename, image_data=contents, pcb_id=pcb_id
    # )
    # db.add(db_image)
    # db.commit()
    # db.refresh(db_image)
    # return db_image


def get_pcb(db: Session, pcb_id: int):

    image_path = (
        db.query(model.ImagePCB.filepath)
        .join(model.PCB, model.ImagePCB.image_id == model.PCB.originalPcb)
        .filter(model.PCB.id == pcb_id)
        .scalar()
    )
    # print(f"Image data for PCB id {pcb_id}: {image_path}")

    if image_path is None:
        raise FileNotFoundError(f"No image path found for PCB id: {pcb_id}")

    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found at: {image_path}")

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    imageData = (
        db.query(model.ImagePCB)
        .join(model.PCB, model.ImagePCB.image_id == model.PCB.originalPcb)
        .filter(model.PCB.id == pcb_id)
        .first()
    )

    # print(f"Image data for PCB id {pcb_id}: {imageData}")
    # print("==========================================================")
    # print(imageData.

    return {
        "image_id": imageData.image_id,
        "filename": imageData.filename,
        "filepath": imageData.filepath,
        "uploaded_at": (
            imageData.uploaded_at.isoformat() if imageData.uploaded_at else None
        ),
        "image_data": image_bytes,
    }

    # return image_bytes

    # return db.query(model.PCB.originalPcb).filter(model.PCB.id == pcb_id).scalar()


def get_pcb_images(db: Session, pcb_id: int):
    return db.query(model.ImagePCB).filter(model.ImagePCB.pcb_id == pcb_id).all()


def get_pcb_original_images(db: Session, pcb_id: int):
    image_path = (
        db.query(model.ImagePCB.filepath)
        .join(model.PCB, model.ImagePCB.image_id == model.PCB.originalPcb)
        .filter(model.PCB.id == pcb_id)
        .scalar()
    )

    if image_path is None:
        raise FileNotFoundError(f"No image path found for PCB id: {pcb_id}")

    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found at: {image_path}")

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    return image_bytes


def get_pcb_result(db: Session, pcb_id: int):

    pcbData = db.query(model.PCB).filter(model.PCB.id == pcb_id).first()

    # print(pcbData.__dict__)

    resultData = (
        db.query(model.Result)
        .join(model.PCB, model.Result.results_id == model.PCB.result_id)
        .filter(model.PCB.id == pcb_id)
        .scalar()
    )

    imageList = {
        "template_image": None,
        "defective_image": None,
        "aligned_image": None,
        "diff_image": None,
        "cleaned_image": None,
        "result_image": None,
    }

    for key in imageList.keys():
        image_id = getattr(resultData, key, None)
        image = db.query(model.ImagePCB).filter_by(image_id=image_id).first()
        if image and os.path.exists(image.filepath):
            with open(image.filepath, "rb") as f:
                imageList[key] = {
                    "image_id": image.image_id,
                    "filename": image.filename,
                    "filepath": image.filepath,
                    "uploaded_at": (
                        image.uploaded_at.isoformat() if image.uploaded_at else None
                    ),
                    "image_data": base64.b64encode(f.read()).decode("utf-8"),
                }

    return {
        "results_id": resultData.results_id,
        "pcb_result_id": resultData.pcb_result_id,
        "accuracy": float(getattr(resultData, "accuracy", 0)),
        "description": resultData.description,
        "imageList": imageList,
    }


def get_pcb_result_working(db: Session, pcb_id: int):

    pcbData = db.query(model.PCB).filter(model.PCB.id == pcb_id).first()

    result_List = []

    for result_id in pcbData.result_ids:

        resultData = (
            db.query(model.Result)
            # .join(model.PCB, model.Result.results_id == model.PCB.result_id)
            .filter(model.Result.results_id == result_id).scalar()
        )

        # print(resultData.__dict__)

        image_id = getattr(resultData, "result_image", None)
        image = db.query(model.ImagePCB).filter_by(image_id=image_id).first()
        if image and os.path.exists(image.filepath):
            with open(image.filepath, "rb") as f:
                result_image = {
                    "image_id": image.image_id,
                    "filename": image.filename,
                    "filepath": image.filepath,
                    "uploaded_at": (
                        image.uploaded_at.isoformat() if image.uploaded_at else None
                    ),
                    "image_data": base64.b64encode(f.read()).decode("utf-8"),
                }

            result = {
                "results_id": resultData.results_id,
                "pcb_result_id": resultData.pcb_result_id,
                "accuracy": float(getattr(resultData, "accuracy", 0)),
                "description": resultData.description,
                "imageList": result_image,
            }
            result_List.append(result)

    # print("Result List:", result_List)
    return {
        "pcb_id": pcbData.id,
        "result_List": result_List,
    }


def delete_pcb(db: Session, pcb_id: int):
    pcb = db.query(model.PCB).filter(model.PCB.id == pcb_id).first()
    if not pcb:
        return None

    results = db.query(model.Result).filter(model.Result.pcb_result_id == pcb_id).all()

    image_keys = [
        "template_image",
        "defective_image",
        "aligned_image",
        "diff_image",
        "cleaned_image",
        "result_image",
    ]

    for result in results:
        for key in image_keys:
            image_id = getattr(result, key, None)
            if image_id:
                image = db.query(model.ImagePCB).filter_by(image_id=image_id).first()
                if image:
                    db.delete(image)

        db.delete(result)
    db.query(model.ImagePCB).filter(model.ImagePCB.pcb_id == pcb_id).delete()

    db.delete(pcb)
    db.commit()

    return True


def get_result(db: Session, result_id: int):

    resultData = (
        db.query(model.Result).filter(model.Result.results_id == result_id).scalar()
    )

    imageList = {
        "template_image": None,
        "defective_image": None,
        "aligned_image": None,
        "diff_image": None,
        "cleaned_image": None,
        "result_image": None,
    }

    for key in imageList.keys():
        image_id = getattr(resultData, key, None)
        image = db.query(model.ImagePCB).filter_by(image_id=image_id).first()
        if image and os.path.exists(image.filepath):
            with open(image.filepath, "rb") as f:
                imageList[key] = {
                    "image_id": image.image_id,
                    "filename": image.filename,
                    "filepath": image.filepath,
                    "uploaded_at": (
                        image.uploaded_at.isoformat() if image.uploaded_at else None
                    ),
                    "image_data": base64.b64encode(f.read()).decode("utf-8"),
                }

    return {
        "results_id": resultData.results_id,
        "pcb_result_id": resultData.pcb_result_id,
        "accuracy": float(getattr(resultData, "accuracy", 0)),
        "description": resultData.description,
        "imageList": imageList,
    }


def get_all_pcb_results(db: Session):

    pcb_data = db.query(model.PCB).all()
    pcbList = []
    try:
        for pcb in pcb_data:

            pcb_dict = {
                "pcb_id": pcb.id,
                "originalPcb": pcb.originalPcb,
                "result_ids": pcb.result_ids,
            }

            image = db.query(model.ImagePCB).filter_by(image_id=pcb.originalPcb).first()
            if image and os.path.exists(image.filepath):
                with open(image.filepath, "rb") as f:
                    imageList = {
                        "image_id": image.image_id,
                        "filename": image.filename,
                        "filepath": image.filepath,
                        "uploaded_at": (
                            image.uploaded_at.isoformat() if image.uploaded_at else None
                        ),
                        "image_data": base64.b64encode(f.read()).decode("utf-8"),
                    }

                pcb_dict["originalPcb"] = imageList

            resultData = (
                db.query(func.avg(model.Result.accuracy))
                .filter(model.Result.results_id.in_(pcb.result_ids))
                .scalar()
            )

            pcb_dict["sum_accuracy"] = resultData

            pcbList.append(pcb_dict)

    except Exception as e:
        print(f"Error processing PCB data: {e}")
        return {"error": "Failed to retrieve PCB data"}

    return pcbList


def delete_result(db: Session, result_id: int):
    result = db.query(model.Result).filter(model.Result.results_id == result_id).first()
    if not result:
        return None

    image_keys = [
        "template_image",
        "defective_image",
        "aligned_image",
        "diff_image",
        "cleaned_image",
        "result_image",
    ]

    for key in image_keys:
        image_id = getattr(result, key, None)
        if image_id:
            image = db.query(model.ImagePCB).filter_by(image_id=image_id).first()
            if image:
                db.delete(image)

    db.delete(result)

    db.commit()

    return True
