import cv2
import numpy as np
import matplotlib.pyplot as plt

# โหลดภาพ
image = cv2.imread("test_functions/test2.png")

# แปลงเป็น Grayscale
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

# ใช้ Threshold เพื่อแยกสีทองแดงออกมา
_, binary = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY_INV)

# แสดงผล
plt.figure(figsize=(10,5))
plt.subplot(1,3,1), plt.imshow(image), plt.title("Init Image")
plt.subplot(1,3,2), plt.imshow(gray, cmap='gray'), plt.title("Gray Image")
plt.subplot(1,3,3), plt.imshow(binary, cmap='gray'), plt.title("Binary Mask")
plt.show()
