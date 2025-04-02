import cv2
import numpy as np
import matplotlib.pyplot as plt

# 📌 โหลดภาพ PCB
image_path = "test_functions/test2.png"
image = cv2.imread(image_path)
hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

# 📌 1. กำหนดช่วงสีแต่ละส่วนของบอร์ด
color_ranges = {
    "Copper": (np.array([10, 50, 50]), np.array([30, 255, 255])),  # ทองแดง
    "Background": (np.array([20, 0, 200]), np.array([40, 50, 255])),  # สีพื้นหลัง
    "Solder Points": (np.array([0, 0, 150]), np.array([180, 50, 255]))  # จุดเชื่อม
}

# 📌 2. ดึงแต่ละสีออกจากภาพ
masks = {name: cv2.inRange(hsv, lower, upper) for name, (lower, upper) in color_ranges.items()}
extracted = {name: cv2.bitwise_and(image, image, mask=mask) for name, mask in masks.items()}

# 📌 3. แสดงผล
plt.figure(figsize=(15,5))
for i, (name, img) in enumerate(extracted.items()):
    plt.subplot(1, len(extracted), i+1)
    plt.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    plt.title(name)
    plt.axis("off")

plt.show()
