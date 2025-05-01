# main.py
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import uvicorn
from typing import Optional

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable to store camera instance
camera: Optional[cv2.VideoCapture] = None


@app.post("/capture")
async def capture_image():
    global camera

    # Initialize camera if not already open
    if camera is None or not camera.isOpened():
        camera = cv2.VideoCapture(0)
        if not camera.isOpened():
            return Response(status_code=500, content="Could not open camera")

    # Capture frame
    ret, frame = camera.read()
    if not ret:
        return Response(status_code=500, content="Could not capture frame")

    # Convert to JPEG
    ret, buffer = cv2.imencode(".jpg", frame)
    if not ret:
        return Response(status_code=500, content="Could not encode image")

    # Release camera after capture
    camera.release()
    camera = None

    # Return the image
    return Response(content=buffer.tobytes(), media_type="image/jpeg")


@app.post("/process")
async def process_pcb():
    """Process uploaded PCB image"""
    global camera

    # Initialize camera if not already open
    if camera is None or not camera.isOpened():
        camera = cv2.VideoCapture(0)
        if not camera.isOpened():
            return Response(status_code=500, content="Could not open camera")

    # Capture frame
    ret, frame = camera.read()
    if not ret:
        return Response(status_code=500, content="Could not capture frame")

    # Convert to JPEG
    ret, buffer = cv2.imencode(".jpg", frame)
    if not ret:
        return Response(status_code=500, content="Could not encode image")

    while True:
        contents = camera.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Your processing code here
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, binary = cv2.threshold(gray, 110, 255, cv2.THRESH_BINARY)

        # Convert result to JPEG
        _, buffer = cv2.imencode(".jpg", binary)
        return Response(content=buffer.tobytes(), media_type="image/jpeg")


@app.on_event("shutdown")
def shutdown_event():
    global camera
    if camera is not None and camera.isOpened():
        camera.release()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
