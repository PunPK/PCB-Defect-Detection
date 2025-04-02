import cv2
import numpy as np
import matplotlib.pyplot as plt

# 📌 โหลดภาพ PCB
image_path = "test_functions/test2.png"
image = cv2.imread(image_path)
image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

# 📌 1. ใช้ Canny Edge Detection ดึงเส้นทองแดง
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
edges = cv2.Canny(gray, 50, 150)

# 📌 2. ใช้ HSV Color Thresholding แยกทองแดงออกจากพื้นหลัง
hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
lower_copper = np.array([10, 50, 50])   # ค่าต่ำสุดของทองแดงใน HSV
upper_copper = np.array([30, 255, 255]) # ค่าสูงสุดของทองแดงใน HSV
mask = cv2.inRange(hsv, lower_copper, upper_copper)
copper_only = cv2.bitwise_and(image, image, mask=mask)

# 📌 3. ใช้ Morphological Transformations กำจัด Noise
kernel = np.ones((3,3), np.uint8)
cleaned_mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=3)
copper_only_cleaned = cv2.bitwise_and(image, image, mask=cleaned_mask)

# 📌 แสดงผล
plt.figure(figsize=(15,5))
plt.subplot(1,3,1), plt.imshow(edges, cmap="gray"), plt.title("Copper Edge Detection")
plt.subplot(1,3,2), plt.imshow(cv2.cvtColor(copper_only, cv2.COLOR_BGR2RGB)), plt.title("Raw Copper Mask")
plt.subplot(1,3,3), plt.imshow(cv2.cvtColor(copper_only_cleaned, cv2.COLOR_BGR2RGB)), plt.title("Cleaned Copper Mask")
plt.show()
