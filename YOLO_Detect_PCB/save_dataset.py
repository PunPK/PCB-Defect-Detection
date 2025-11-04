import cv2
import os
from datetime import datetime

SAVE_DIR = "dataset/pcb_images"
os.makedirs(SAVE_DIR, exist_ok=True)


# เรียงเลขลำดับจากไฟล์ที่มีอยู่แล้ว
def get_next_image_index():
    existing_files = [f for f in os.listdir(SAVE_DIR) if f.endswith(".jpg")]
    indices = []
    for f in existing_files:
        try:
            num = int(f.replace("pcb_", "").replace(".jpg", ""))
            indices.append(num)
        except ValueError:
            continue
    return max(indices) + 1 if indices else 1


# เปิดกล้อง
camera = cv2.VideoCapture(0)
if not camera.isOpened():
    print("❌ ไม่สามารถเปิดกล้องได้")
    exit()

print("✅ กล้องเปิดแล้ว - กด 's' เพื่อบันทึกรูป, 'q' เพื่อออก")

image_index = get_next_image_index()

while True:
    ret, frame = camera.read()
    if not ret:
        print("❌ ไม่สามารถอ่านภาพจากกล้องได้")
        break

    key = cv2.waitKey(1) & 0xFF

    if key == ord("s"):
        filename = f"pcb_{image_index:03}.jpg"
        filepath = os.path.join(SAVE_DIR, filename)
        cv2.imwrite(filepath, frame)
        print(f"✅ บันทึกภาพ: {filepath}")
        image_index += 1

    elif key == ord("q"):
        break

camera.release()
cv2.destroyAllWindows()
