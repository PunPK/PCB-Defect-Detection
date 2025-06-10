from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import pcb_detection, websocket, upload

app = FastAPI()

origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pcb_detection.router, prefix="/api")
app.include_router(websocket.router, prefix="/ws")
app.include_router(upload.router, prefix="/api/image")
# app.include_router(docker_image_pcb.router, prefix="/upload")
