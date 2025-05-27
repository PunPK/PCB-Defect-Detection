import cv2
import os
import random
from tkinter import Tk, filedialog

Tk().withdraw()
file_path = filedialog.askopenfilename(title="Select an image file", filetypes=[("Image files", "*.jpg *.png *.jpeg")])

if not file_path:
    print("No image selected.")
    exit()

# โหลดรูปภาพ
image = cv2.imread(file_path)
if image is None:
    print("Failed to load image.")
    exit()

output_folder = "pcb-dataset/pcb"
os.makedirs(output_folder, exist_ok=True)

print("Instructions:")
print("1. Drag to select ROI (region to crop)")
print("2. Press 's' to save cropped image (can do multiple times)")
print("3. Press 'q' to quit")

while True:
    # ให้เลือกพื้นที่ที่ต้องการ crop
    roi = cv2.selectROI("Select area to crop", image, False, False)
    cv2.destroyWindow("Select area to crop")

    if roi == (0, 0, 0, 0):
        print("No area selected. Exiting...")
        break

    x, y, w, h = roi
    cropped = image[y:y+h, x:x+w]
    cv2.imshow("Cropped Image", cropped)

    key = cv2.waitKey(0)

    if key == ord("s"):
        # สุ่มเลข 4 หลัก
        num = random.randint(1000, 9999)
        save_path = os.path.join(output_folder, f"้hole_{num}.jpg")
        cv2.imwrite(save_path, cropped)
        print(f"Cropped image saved to {save_path}")

    elif key == ord("q"):
        print("Quitting...")
        break

cv2.destroyAllWindows()
