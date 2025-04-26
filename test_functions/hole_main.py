import cv2
import numpy as np
import matplotlib.pyplot as plt
import sys


def expand_contour(contour, percentage):
    """
    ขยายขอบเขต contour ด้วยเปอร์เซ็นต์ที่กำหนด

    Args:
        contour: Contour ที่ต้องการขยาย
        percentage: เปอร์เซ็นต์การขยาย (0.05 = 5%)

    Returns:
        expanded_contour: Contour ที่ขยายแล้ว
    """
    # หาจุดศูนย์กลางของ contour
    M = cv2.moments(contour)
    if M["m00"] == 0:
        return contour

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
        expanded.append([[int(new_x), int(new_y)]])

    return np.array(expanded, dtype=np.int32)


def order_points(pts):
    """
    เรียงลำดับจุด 4 จุดเป็น: บนซ้าย, บนขวา, ล่างขวา, ล่างซ้าย

    Args:
        pts: อาร์เรย์ของจุด

    Returns:
        rect: อาร์เรย์ของจุดที่เรียงลำดับแล้ว
    """
    rect = np.zeros((4, 2), dtype="float32")

    # ผลรวมของพิกัด (บนซ้ายจะมีผลรวมน้อยสุด, ล่างขวามากสุด)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    # ผลต่างของพิกัด (บนขวา y-x จะน้อยสุด, ล่างซ้าย y-x จะมากสุด)
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    return rect


def four_point_transform(image, pts):
    """
    ทำ perspective transform โดยใช้จุด 4 จุด

    Args:
        image: ภาพต้นฉบับ
        pts: จุด 4 จุดที่ต้องการ transform

    Returns:
        warped: ภาพที่ transform แล้ว
    """
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


def detect_and_extract_pcb(expand_percentage=0.05):
    """
    ตรวจจับ PCB จากกล้องและตัดเฉพาะส่วน PCB ออกมา

    Args:
        expand_percentage: เปอร์เซ็นต์การขยาย contour (default: 0.05)

    Returns:
        image_pcb: ภาพ PCB ที่ตัดแล้ว (หรือ None ถ้าไม่พบ PCB)
    """
    # ตั้งค่าการแสดงผลให้รองรับ Unicode
    try:
        # สำหรับ Windows
        if sys.platform.startswith("win"):
            # กำหนด encoding ของ stdout เป็น utf-8
            sys.stdout.reconfigure(encoding="utf-8")
    except:
        pass

    # เปิดการเชื่อมต่อกับกล้อง (0 คือกล้อง default)
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Cannot open camera")
        return None

    image_pcb = None  # ตัวแปรที่จะเก็บภาพ PCB ที่ตัดแล้ว

    while True:
        # อ่านภาพจากกล้อง
        ret, frame = cap.read()
        if not ret:
            print("Cannot read frame from camera")
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

        # สร้างภาพสำหรับแสดงผล (ไม่เปลี่ยนแปลงภาพต้นฉบับ)
        display_frame = frame.copy()

        # แสดงสถานะการทำงาน
        cv2.putText(
            display_frame,
            "Press 's' to save PCB image",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2,
        )
        cv2.putText(
            display_frame,
            "Press 'q' to quit",
            (10, 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 255),
            2,
        )

        if contours:
            # หา contour ที่ใหญ่ที่สุด (น่าจะเป็น PCB)
            largest_contour = max(contours, key=cv2.contourArea)

            # ขยาย contour เพื่อให้ครอบคลุม PCB ทั้งหมด
            expanded_contour = expand_contour(largest_contour, expand_percentage)

            # สร้าง convex hull เพื่อให้ขอบเรียบขึ้น
            hull = cv2.convexHull(expanded_contour)

            # วาด contour บนภาพแสดงผล
            cv2.drawContours(display_frame, [hull], -1, (0, 255, 0), 3)

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

                # เก็บภาพล่าสุดไว้ในตัวแปร image_pcb
                image_pcb = warped.copy()

        # แสดงผลภาพต้นฉบับกับ contour
        cv2.imshow("Camera Feed", display_frame)

        # รับค่าจากคีย์บอร์ด
        key = cv2.waitKey(1) & 0xFF

        # กด 'q' เพื่อออก
        if key == ord("q"):
            break
        # กด 's' เพื่อบันทึกภาพปัจจุบัน
        elif key == ord("s"):
            if image_pcb is not None:
                print("PCB image saved successfully")
                break
            else:
                print("No PCB detected to save")

    # ปิดการเชื่อมต่อกล้องและหน้าต่างทั้งหมด
    cap.release()
    cv2.destroyAllWindows()

    return image_pcb


def detect_copper_wires(image_pcb):
    # โหลดภาพและแปลงสี
    # image = cv2.imread(image_path)
    image_rgb = cv2.cvtColor(image_pcb, cv2.COLOR_BGR2RGB)

    # แปลงเป็น HSV สำหรับการตรวจจับสีที่ดีขึ้น
    hsv = cv2.cvtColor(image_pcb, cv2.COLOR_BGR2HSV)

    # กำหนดช่วงสีทองแดงใน HSV
    lower_copper = np.array([120, 50, 50])
    upper_copper = np.array([300, 255, 255])

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


if __name__ == "__main__":
    # ตรวจจับและตัดภาพ PCB จากกล้อง
    image_pcb = detect_and_extract_pcb(expand_percentage=0.05)

    # ประมวลผลภาพ PCB ที่ได้
    if image_pcb is not None:
        detect_copper_wires(image_pcb)
    else:
        print("Could not detect PCB")
