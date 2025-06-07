from fastapi import FastAPI, File, UploadFile, APIRouter
from fastapi.responses import FileResponse
import os
from random import randint
import uuid

IMAGEDIR = "../images/"

router = APIRouter()


@router.post("/upload/")
async def create_upload_file(file: UploadFile = File(...)):

    file.filename = f"{uuid.uuid4()}.jpg"
    contents = await file.read()

    # save the file
    with open(f"{IMAGEDIR}{file.filename}", "wb") as f:
        f.write(contents)

    return {"filename": file.filename}


@router.get("/show/")
async def read_random_file():

    # get random file from the image directory
    files = os.listdir(IMAGEDIR)
    random_index = randint(0, len(files) - 1)

    path = f"{IMAGEDIR}{files[random_index]}"

    return FileResponse(path)
