import cv2
import numpy as np
import matplotlib.pyplot as plt

# โหลดภาพ
image_path = "test_functions/testpcb.jpg"
image_pcb = cv2.imread(image_path)
image_rgb = cv2.cvtColor(image_pcb, cv2.COLOR_BGR2RGB)

# แปลงภาพเป็น HSV เพื่อคัดกรองสี
hsv = cv2.cvtColor(image_pcb, cv2.COLOR_BGR2HSV)

# กำหนดช่วงค่าสำหรับ "สีน้ำตาลเข้ม" (Hue โดยประมาณระหว่าง 10-30)
lower_brown = np.array([15, 50, 20])
upper_brown = np.array([30, 255, 100])

# สร้าง mask สำหรับสีน้ำตาลเข้ม
brown_mask = cv2.inRange(hsv, lower_brown, upper_brown)

# แสดงเฉพาะบริเวณสีน้ำตาลเข้มในภาพ RGB
brown_only = cv2.bitwise_and(image_rgb, image_rgb, mask=brown_mask)

# แสดงผลลัพธ์
plt.figure(figsize=(15, 5))
plt.subplot(1, 3, 1), plt.imshow(image_rgb), plt.title("Original Image")
plt.subplot(1, 3, 2), plt.imshow(brown_mask, cmap="gray"), plt.title("Brown Mask")
plt.subplot(1, 3, 3), plt.imshow(brown_only), plt.title("Brown Only")
plt.show()
