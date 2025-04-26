import cv2
import numpy as np
import matplotlib.pyplot as plt


def detect_copper_wires(image_pcb):
    # โหลดภาพและแปลงสี
    # image = cv2.imread(image_path)
    image_rgb = cv2.cvtColor(image_pcb, cv2.COLOR_BGR2RGB)

    # แปลงเป็น HSV สำหรับการตรวจจับสีที่ดีขึ้น
    hsv = cv2.cvtColor(image_pcb, cv2.COLOR_BGR2HSV)

    # กำหนดช่วงสีทองแดงใน HSV
    lower_copper = np.array([10, 100, 100])
    upper_copper = np.array([20, 255, 255])

    # สร้าง mask สำหรับสีทองแดง
    mask = cv2.inRange(hsv, lower_copper, upper_copper)

    # ลบ noise ด้วย morphological operations
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    # หาเส้น轮廓
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # วาดเส้น轮廓ที่พบ
    result = image_rgb.copy()
    cv2.drawContours(result, contours, -1, (0, 255, 0), 2)

    # ตรวจสอบและทำเครื่องหมายรู (holes)
    gray = cv2.cvtColor(image_pcb, cv2.COLOR_BGR2GRAY)
    corners = cv2.goodFeaturesToTrack(gray, 200, 0.05, 10)

    if corners is not None:
        corners = np.int0(corners)
        holes = []
        for i in range(len(corners)):
            for j in range(i + 1, len(corners)):
                x1, y1 = corners[i].ravel()
                x2, y2 = corners[j].ravel()
                if abs(x1 - x2) <= 30 and abs(y1 - y2) <= 30:
                    holes.append((int((x1 + x2) / 2), int((y1 + y2) / 2)))

        # วาดรูที่พบ
        for hole in holes:
            cv2.circle(result, hole, 7, (255, 0, 255), -1)

    # แสดงผลลัพธ์
    plt.figure(figsize=(15, 10))

    plt.subplot(2, 2, 1)
    plt.imshow(image_rgb)
    plt.title("Original Image")

    plt.subplot(2, 2, 2)
    plt.imshow(mask, cmap="gray")
    plt.title("Copper Mask")

    plt.subplot(2, 2, 3)
    plt.imshow(result)
    plt.title("Detected Wires & Holes")

    plt.tight_layout()
    plt.show()

    return result


# เรียกใช้ฟังก์ชัน
if __name__ == "__main__":
    img = cv2.imread("test_functions/test.png")
    result_image = detect_copper_wires(img)

    # แสดงผลใน OpenCV window
    cv2.imshow(
        "Detected Copper Wires and Holes", cv2.cvtColor(result_image, cv2.COLOR_RGB2BGR)
    )
    cv2.waitKey(0)
    cv2.destroyAllWindows()
