import cv2
import numpy as np
import matplotlib.pyplot as plt

# โหลดภาพ grayscale
template = cv2.imread("pcb-dataset/pcb/2_pcb_output8954.jpg", cv2.IMREAD_GRAYSCALE)
defective = cv2.imread("pcb-dataset/pcb/4_pcb_output2371.jpg", cv2.IMREAD_GRAYSCALE)

# ตรวจสอบว่าภาพโหลดสำเร็จหรือไม่
if template is None or defective is None:
    raise IOError("ไม่พบภาพ ตรวจสอบชื่อไฟล์อีกครั้ง")

# สร้าง ORB detector (แม่นยำสูงสุด)
orb = cv2.ORB_create(nfeatures=10000)

# ค้นหา keypoints และ descriptors
kp1, des1 = orb.detectAndCompute(template, None)
kp2, des2 = orb.detectAndCompute(defective, None)

# ใช้ KNN Matching + Lowe’s Ratio Test
bf = cv2.BFMatcher(cv2.NORM_HAMMING)
knn_matches = bf.knnMatch(des1, des2, k=2)

# ใช้ Lowe’s ratio test เพื่อเลือก match ที่ดี
good_matches = []
for m, n in knn_matches:
    if m.distance < 0.75 * n.distance:
        good_matches.append(m)

print(f"จำนวน matches ที่ผ่าน ratio test: {len(good_matches)}")

# ต้องมี match อย่างน้อย 4 จุดถึงจะหา homography ได้
if len(good_matches) < 4:
    raise ValueError("จุด match ไม่เพียงพอสำหรับการคำนวณ Homography")

# ดึงพิกัดของจุดที่ match
src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

# คำนวณ Homography ด้วย RANSAC
H, mask = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 4.0)

# Warp ภาพ defective ให้ตรงกับ template
h, w = template.shape
aligned = cv2.warpPerspective(defective, H, (w, h))

# เปรียบเทียบภาพ (Image Subtraction)
diff = cv2.absdiff(template, aligned)

# ใช้ threshold เพื่อแปลงเป็นภาพ Binary (1 = defect)
_, thresh = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)

# ใช้ Morphology ล้าง noise เล็ก ๆ
kernel = np.ones((3, 3), np.uint8)
cleaned = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)
cleaned = cv2.dilate(cleaned, kernel, iterations=1)

# แสดงผลลัพธ์ทั้งหมด
plt.figure(figsize=(12, 6))
plt.subplot(1, 4, 1), plt.imshow(template, cmap="gray"), plt.title("Template")
plt.subplot(1, 4, 2), plt.imshow(defective, cmap="gray"), plt.title("Defective")
plt.subplot(1, 4, 3), plt.imshow(aligned, cmap="gray"), plt.title("Aligned Image")
plt.subplot(1, 4, 4), plt.imshow(cleaned, cmap="gray"), plt.title("Detected Defects")
plt.tight_layout()
plt.show()
