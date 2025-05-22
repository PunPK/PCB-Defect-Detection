import cv2
import numpy as np
import matplotlib.pyplot as plt


def load_and_resize_images(template_path, defective_path):
    """โหลดและปรับขนาดภาพให้เท่ากัน"""
    template = cv2.imread(template_path, cv2.IMREAD_GRAYSCALE)
    defective = cv2.imread(defective_path, cv2.IMREAD_GRAYSCALE)

    if template is None or defective is None:
        raise ValueError("ไม่สามารถโหลดภาพได้ ตรวจสอบ path อีกครั้ง")

    # ปรับขนาดให้เท่ากันโดยใช้ขนาดของภาพที่เล็กกว่า
    min_height = min(template.shape[0], defective.shape[0])
    min_width = min(template.shape[1], defective.shape[1])

    template = cv2.resize(template, (min_width, min_height))
    defective = cv2.resize(defective, (min_width, min_height))

    return template, defective


def enhanced_preprocess(img):
    """ปรับปรุงภาพก่อนประมวลผล"""
    # CLAHE สำหรับปรับความคมชัด
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    img = clahe.apply(img)

    # Gaussian Blur เพื่อลด noise
    img = cv2.GaussianBlur(img, (5, 5), 0)

    return img


def align_images(template, defective):
    """จัดตำแหน่งภาพโดยใช้ feature matching"""
    # สร้าง ORB detector
    orb = cv2.ORB_create(
        nfeatures=10000, scaleFactor=1.2, nlevels=8, edgeThreshold=15, patchSize=31
    )

    # หาจุดสำคัญและคำอธิบาย
    kp1, des1 = orb.detectAndCompute(template, None)
    kp2, des2 = orb.detectAndCompute(defective, None)

    # Feature Matching
    FLANN_INDEX_LSH = 6
    index_params = dict(
        algorithm=FLANN_INDEX_LSH, table_number=6, key_size=12, multi_probe_level=1
    )
    search_params = dict(checks=50)
    flann = cv2.FlannBasedMatcher(index_params, search_params)
    matches = flann.knnMatch(des1, des2, k=2)

    # เลือกเฉพาะ good matches โดยใช้ Lowe's ratio test
    good_matches = []
    for m, n in matches:
        if m.distance < 0.7 * n.distance:
            good_matches.append(m)

    # หา Homography matrix
    if len(good_matches) > 10:
        src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(
            -1, 1, 2
        )
        dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(
            -1, 1, 2
        )
        H, mask = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 5.0)
        aligned = cv2.warpPerspective(
            defective, H, (template.shape[1], template.shape[0])
        )
        return aligned, H, good_matches
    else:
        raise ValueError(f"ไม่พบจุดที่匹配กันเพียงพอ ({len(good_matches)}/10)")


def detect_defects(template, aligned):
    """ตรวจจับข้อบกพร่องโดยเปรียบเทียบกับ template"""
    # หาความแตกต่างระหว่างภาพ
    diff = cv2.absdiff(template, aligned)

    # Thresholding แบบผสม
    _, thresh_otsu = cv2.threshold(diff, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    thresh_range = cv2.inRange(diff, 100, 255)
    combined_thresh = cv2.bitwise_or(thresh_otsu, thresh_range)

    # Morphological operations เพื่อลบ noise
    kernel = np.ones((3, 3), np.uint8)
    cleaned = cv2.morphologyEx(combined_thresh, cv2.MORPH_OPEN, kernel, iterations=1)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=2)

    # หา contours ของข้อบกพร่อง
    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # กรอง contours ที่เล็กเกินไป (อาจเป็น noise)
    min_contour_area = 50
    filtered_contours = [c for c in contours if cv2.contourArea(c) > min_contour_area]

    return diff, cleaned, filtered_contours


def visualize_results(template, defective, aligned, diff, cleaned, contours):
    """แสดงผลลัพธ์"""
    # สร้างภาพที่มีการทำเครื่องหมายข้อบกพร่อง
    result = cv2.cvtColor(aligned, cv2.COLOR_GRAY2BGR)
    cv2.drawContours(result, contours, -1, (0, 0, 255), 2)

    # แสดงภาพทั้งหมด
    plt.figure(figsize=(18, 12))

    plt.subplot(2, 3, 1)
    plt.imshow(template, cmap="gray")
    plt.title("Template Image")
    plt.axis("off")

    plt.subplot(2, 3, 2)
    plt.imshow(defective, cmap="gray")
    plt.title("Defective Image")
    plt.axis("off")

    plt.subplot(2, 3, 3)
    plt.imshow(aligned, cmap="gray")
    plt.title("Aligned Image")
    plt.axis("off")

    plt.subplot(2, 3, 4)
    plt.imshow(diff, cmap="gray")
    plt.title("Difference Map")
    plt.axis("off")

    plt.subplot(2, 3, 5)
    plt.imshow(cleaned, cmap="gray")
    plt.title("Thresholded Difference")
    plt.axis("off")

    plt.subplot(2, 3, 6)
    plt.imshow(result)
    plt.title("Detected Defects (Red)")
    plt.axis("off")

    plt.tight_layout()
    plt.show()


def main():
    # ระบุ path ของภาพ
    template_path = "pcb-dataset/pcb/pcb_test2.png"
    defective_path = "pcb-dataset/pcb/4_pcb_output2371.jpg"

    try:
        # โหลดและปรับขนาดภาพ
        template, defective = load_and_resize_images(template_path, defective_path)

        # ปรับปรุงภาพก่อนประมวลผล
        template_proc = enhanced_preprocess(template)
        defective_proc = enhanced_preprocess(defective)

        # จัดตำแหน่งภาพ
        aligned, H, good_matches = align_images(template_proc, defective_proc)

        # ตรวจจับข้อบกพร่อง
        diff, cleaned, contours = detect_defects(template_proc, aligned)

        # แสดงผลลัพธ์
        visualize_results(
            template_proc, defective_proc, aligned, diff, cleaned, contours
        )

        # แสดงจำนวนข้อบกพร่องที่พบ
        print(f"พบข้อบกพร่องทั้งหมด: {len(contours)} จุด")

    except Exception as e:
        print(f"เกิดข้อผิดพลาด: {e}")


if __name__ == "__main__":
    main()
