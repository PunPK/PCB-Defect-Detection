from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import pcb_detection, websocket, upload, factoryWorkflow

app = FastAPI()

origins = [
    "http://localhost:3000",            # กรณีเปิดจากตัวเครื่องเอง
    "http://192.168.121.253:3000",      # กรณีเปิดจาก LAN / มือถือ
]

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
app.include_router(factoryWorkflow.router, prefix="/factory")
