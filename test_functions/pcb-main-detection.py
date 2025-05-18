import cv2
import numpy as np
import matplotlib.pyplot as plt

# 1. โหลดภาพ
template = cv2.imread("pcb-dataset/pcb/2_pcb_output8954.jpg", cv2.IMREAD_GRAYSCALE)
defective = cv2.imread("pcb-dataset/pcb/4_pcb_output2371.jpg", cv2.IMREAD_GRAYSCALE)

# 2. สร้าง ORB detector
orb = cv2.ORB_create(nfeatures=10000)

# 3. หาจุดเด่น (Keypoints) และคำอธิบาย (Descriptors)
kp1, des1 = orb.detectAndCompute(template, None)
kp2, des2 = orb.detectAndCompute(defective, None)

# 4. จับคู่ descriptors ด้วย BFMatcher
bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
matches = bf.match(des1, des2)

# เรียงตามคุณภาพของ match
matches = sorted(matches, key=lambda x: x.distance)

# 5. ใช้แค่ match ที่ดีที่สุดบางส่วน
good_matches = matches[:100]

# 6. ดึงตำแหน่งของจุดคู่ที่ตรงกัน
src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

# 7. คำนวณ Homography Matrix
H, mask = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 5.0)

# 8. Warp ภาพ defective ให้ตรงกับ template
h, w = template.shape
aligned = cv2.warpPerspective(defective, H, (w, h))

# ลบภาพเพื่อหาความต่าง
diff = cv2.absdiff(template, aligned)

# แปลงเป็น binary เพื่อดู defect ชัดเจน
_, thresh = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)


# 9. แสดงภาพ
plt.subplot(1, 4, 1), plt.imshow(template, cmap="gray"), plt.title("Template")
plt.subplot(1, 4, 2), plt.imshow(defective, cmap="gray"), plt.title("Defective")
plt.subplot(1, 4, 3), plt.imshow(aligned, cmap="gray"), plt.title("Aligned")
plt.subplot(1, 4, 4), plt.imshow(thresh, cmap="gray"), plt.title("Detected Defects")
plt.show()
