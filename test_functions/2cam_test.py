import cv2
import numpy as np


def detect_and_extract_pcb(expand_percentage=0.05):
    # เปิดการเชื่อมต่อกับกล้อง (0 คือกล้อง default)
    cap = cv2.VideoCapture(0)

    while True:
        # อ่านภาพจากกล้อง
        ret, frame = cap.read()
        if not ret:
            print("ไม่สามารถอ่านภาพจากกล้องได้")
            break

        # แปลงภาพเป็น HSV สำหรับการตรวจจับสีที่ดีกว่า
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        # กำหนดช่วงสีทองแดงใน HSV
        lower_copper = np.array([5, 0, 0])
        upper_copper = np.array([45, 255, 255])

        # สร้าง mask สำหรับสีทองแดง
        mask = cv2.inRange(hsv, lower_copper, upper_copper)

        # ทำ morphological operations เพื่อลด noise
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        # หา contours ใน mask
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if contours:
            # หา contour ที่ใหญ่ที่สุด (น่าจะเป็น PCB)
            largest_contour = max(contours, key=cv2.contourArea)

            expanded_contour = expand_contour(largest_contour, expand_percentage)

            hull = cv2.convexHull(expanded_contour)

            # วาด contour บนภาพต้นฉบับ (เพื่อแสดงผล)
            cv2.drawContours(frame, [hull], -1, (0, 255, 0), 3)

            # ประมาณรูปร่างของ PCB เป็นสี่เหลี่ยม
            epsilon = 0.02 * cv2.arcLength(hull, True)
            approx = cv2.approxPolyDP(hull, epsilon, True)

            # ถ้าเป็นสี่เหลี่ยม (มี 4 มุม)
            if len(approx) == 4:
                # เรียงลำดับจุดของสี่เหลี่ยม (สำหรับ perspective transform)
                approx = order_points(approx.reshape(4, 2))

                # สร้างภาพใหม่ที่ตัด PCB ออกมาและแก้ความเอียง
                warped = four_point_transform(frame, approx)

                # แสดงผลภาพที่ตัดแล้ว
                cv2.imshow("Extracted PCB", warped)

        # แสดงผลภาพต้นฉบับกับ contour
        cv2.imshow("Camera Feed", frame)

        # กด 'q' เพื่อออก
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    # ปิดการเชื่อมต่อกล้องและหน้าต่างทั้งหมด
    cap.release()
    cv2.destroyAllWindows()


def expand_contour(contour, percentage):
    """
    ขยายขอบเขต contour ด้วยเปอร์เซ็นต์ที่กำหนด
    """
    # หาจุดศูนย์กลางของ contour
    M = cv2.moments(contour)
    cx = int(M["m10"] / M["m00"])
    cy = int(M["m01"] / M["m00"])

    # ขยาย contour จากจุดศูนย์กลาง
    expanded = []
    for point in contour:
        x, y = point[0]
        # คำนวณทิศทางจากจุดศูนย์กลาง
        dir_x = x - cx
        dir_y = y - cy
        # ขยายตามทิศทางนั้น
        new_x = cx + (1 + percentage) * dir_x
        new_y = cy + (1 + percentage) * dir_y
        expanded.append([[new_x, new_y]])

    return np.array(expanded, dtype=np.int32)


def order_points(pts):
    # เรียงลำดับจุดเป็น: บนซ้าย, บนขวา, ล่างขวา, ล่างซ้าย
    rect = np.zeros((4, 2), dtype="float32")

    # ผลรวมของพิกัด (บนซ้ายจะมีผลรวมน้อยสุด, ล่างขวามากสุด)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    return rect


def four_point_transform(image, pts):
    # รับจุดทั้ง 4 จุดและคำนวณขนาดของภาพใหม่
    (tl, tr, br, bl) = pts

    # คำนวณความกว้างของภาพใหม่
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    # คำนวณความสูงของภาพใหม่
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    # กำหนดจุดปลายทางสำหรับ perspective transform
    dst = np.array(
        [[0, 0], [maxWidth - 1, 0], [maxWidth - 1, maxHeight - 1], [0, maxHeight - 1]],
        dtype="float32",
    )

    # คำนวณ matrix การแปลงและทำ perspective transform
    M = cv2.getPerspectiveTransform(pts, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))

    return warped


if __name__ == "__main__":
    detect_and_extract_pcb()
