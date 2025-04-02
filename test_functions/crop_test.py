import cv2
import numpy as np
import matplotlib.pyplot as plt

# 📌 โหลดภาพต้นฉบับ
image_path = "test_functions/test3.png"
image = cv2.imread(image_path)
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

# 📌 1. ใช้ Canny Edge Detection หาขอบของ PCB
edges = cv2.Canny(gray, 50, 150)

# 📌 2. หาขอบเขตของวัตถุ (Contours)
contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# 📌 3. หา Contour ที่ใหญ่ที่สุด (คาดว่าเป็น PCB)
if contours:
    largest_contour = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(largest_contour)  # หาสี่เหลี่ยมครอบ PCB
    
    # 📌 4. Crop เอาเฉพาะ PCB
    cropped_pcb = image[y:y+h, x:x+w]

    # 📌 5. แสดงผล
    plt.figure(figsize=(10,5))
    plt.subplot(1, 2, 1)
    plt.imshow(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    plt.title("Original Image")
    plt.axis("off")

    plt.subplot(1, 2, 2)
    plt.imshow(cv2.cvtColor(cropped_pcb, cv2.COLOR_BGR2RGB))
    plt.title("Cropped PCB")
    plt.axis("off")

    plt.show()
else:
    print("❌ ไม่พบ PCB ในภาพ")
