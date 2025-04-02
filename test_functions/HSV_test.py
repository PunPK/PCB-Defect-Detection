import cv2
import numpy as np
import matplotlib.pyplot as plt

# 📌 โหลดภาพต้นฉบับ
image_path = "test_functions/test.png"
image = cv2.imread(image_path)
hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

# 📌 กำหนดช่วงสีเทาใน HSV
lower_gray = np.array([0, 0, 50])     # ค่า HSV ต่ำสุด (H=0, S=0, V=50)
upper_gray = np.array([180, 50, 200]) # ค่า HSV สูงสุด (H=180, S=50, V=200)

# 📌 ใช้ inRange() เพื่อสร้าง Mask ของสีเทา
mask = cv2.inRange(hsv, lower_gray, upper_gray)

# 📌 ใช้ Mask ดึงเฉพาะส่วนที่เป็นสีเทา
gray_part = cv2.bitwise_and(image, image, mask=mask)

# 📌 แสดงผล
plt.figure(figsize=(10,5))
plt.subplot(1, 2, 1)
plt.imshow(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
plt.title("Original Image")
plt.axis("off")

plt.subplot(1, 2, 2)
plt.imshow(cv2.cvtColor(gray_part, cv2.COLOR_BGR2RGB))
plt.title("Extracted Gray Areas")
plt.axis("off")

plt.show()
