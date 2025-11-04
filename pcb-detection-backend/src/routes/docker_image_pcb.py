from fastapi import FastAPI, File, UploadFile, APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
import os
from random import randint
import uuid
from sqlalchemy.orm import Session
from . import models, schemas, crud
from ..database import SessionLocal, engine
import os

IMAGEDIR = "../images/"

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/pcb/", response_model=schemas.PCB)
def create_pcb(pcb: schemas.PCBCreate, db: Session = Depends(get_db)):
    return crud.create_pcb(db=db, pcb=pcb)


@router.post("/result/", response_model=schemas.Result)
def create_result(result: schemas.ResultCreate, db: Session = Depends(get_db)):
    return crud.create_result(db=db, result=result)


@router.post("/pcb/{pcb_id}/images/", response_model=schemas.ImagePCB)
def upload_pcb_image(
    pcb_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    db_pcb = crud.get_pcb(db, pcb_id=pcb_id)
    if db_pcb is None:
        raise HTTPException(status_code=404, detail="PCB not found")
    return crud.create_pcb_image(db=db, file=file, pcb_id=pcb_id)


@router.get("/pcb/{pcb_id}/images/", response_model=list[schemas.ImagePCB])
def get_images(pcb_id: int, db: Session = Depends(get_db)):
    db_pcb = crud.get_pcb(db, pcb_id=pcb_id)
    if db_pcb is None:
        raise HTTPException(status_code=404, detail="PCB not found")
    return crud.get_pcb_images(db=db, pcb_id=pcb_id)
