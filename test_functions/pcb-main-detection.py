import cv2
import numpy as np
import matplotlib.pyplot as plt

# โหลดภาพและ preprocessing (เหมือนเดิม)C:\Users\ASUS\Desktop\pcb_detection\pcb-dataset\pcb\pcb_test2.png
# template = cv2.imread("pcb-dataset\pcb\pcb_test2.png", cv2.IMREAD_GRAYSCALE)
template = cv2.imread("pcb-dataset/pcb/3_pcb_output3069.jpg", cv2.IMREAD_GRAYSCALE)
defective = cv2.imread("pcb-dataset/pcb/4_pcb_output2371.jpg", cv2.IMREAD_GRAYSCALE)
# defective = cv2.imread("pcb-dataset/pcb/1_pcb_output4505.jpg", cv2.IMREAD_GRAYSCALE)

min_height = min(template.shape[0], defective.shape[0])
min_width = min(template.shape[1], defective.shape[1])

# Resize ทั้งสองภาพให้มีขนาดเท่ากันตามขนาดที่เล็กที่สุด
template = cv2.resize(template, (min_width, min_height))
defective = cv2.resize(defective, (min_width, min_height))


# Preprocessing
def preprocess(img):
    img = cv2.GaussianBlur(img, (5, 5), 0)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(img)


template_proc = preprocess(template)
defective_proc = preprocess(defective)

# หา Homography และ Align ภาพ (เหมือนเดิม)
orb = cv2.ORB_create(
    nfeatures=20000, scaleFactor=1.2, nlevels=8, edgeThreshold=15, patchSize=31
)
kp1, des1 = orb.detectAndCompute(template_proc, None)
kp2, des2 = orb.detectAndCompute(defective_proc, None)

# Feature Matching และคำนวณ Homography
FLANN_INDEX_LSH = 6
index_params = dict(
    algorithm=FLANN_INDEX_LSH, table_number=6, key_size=12, multi_probe_level=1
)
search_params = dict(checks=50)
flann = cv2.FlannBasedMatcher(index_params, search_params)
matches = flann.knnMatch(des1, des2, k=2)
good_matches = [m for m, n in matches if m.distance < 0.7 * n.distance][:200]

src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)
H, _ = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 5.0)
aligned = cv2.warpPerspective(defective, H, (template.shape[1], template.shape[0]))

# หาความแตกต่างแบบเน้นเฉพาะสีขาว/เทาอ่อนใน Difference
diff = cv2.absdiff(template, aligned)

_, thresh_otsu = cv2.threshold(diff, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

# Threshold ด้วยค่าช่วง
thresh_range = cv2.inRange(diff, 100, 255)

# รวมผลลัพธ์ทั้งสองแบบ
combined_thresh = cv2.bitwise_or(thresh_otsu, thresh_range)

# ทำ Morphology เพื่อกำจัดจุดรบกวน
kernel = np.ones((3, 3), np.uint8)
cleaned = cv2.morphologyEx(combined_thresh, cv2.MORPH_OPEN, kernel, iterations=1)
cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=2)

# ค้นหา contours ของส่วนที่แตกต่าง
contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# สร้าง mask เปล่า
mask_diff = np.zeros_like(cleaned)

# วาด contour ลงบน mask
cv2.drawContours(mask_diff, contours, -1, (255), thickness=cv2.FILLED)

# ใช้ mask เพื่อดึงเฉพาะส่วนที่ต่างออกจากภาพต้นฉบับ
result = cv2.bitwise_and(aligned, aligned, mask=mask_diff)

plt.figure(figsize=(18, 12))
plt.subplot(2, 3, 1), plt.imshow(template, cmap="gray"), plt.title("Template")
plt.subplot(2, 3, 2), plt.imshow(defective, cmap="gray"), plt.title("Defective")
plt.subplot(2, 3, 3), plt.imshow(aligned, cmap="gray"), plt.title("Aligned")
plt.subplot(2, 3, 4), plt.imshow(diff, cmap="gray"), plt.title("Difference")
plt.subplot(2, 3, 5), plt.imshow(cleaned, cmap="gray"), plt.title("White/Gray Areas")
plt.subplot(2, 3, 6), plt.imshow(result), plt.title("Detected Defects")
plt.tight_layout()
plt.show()
