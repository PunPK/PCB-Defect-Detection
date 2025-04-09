import cv2
import numpy as np
import os


def detect_and_extract_pcb(expand_percentage=0.05):
    """
    Parameters:
    expand_percentage (float): เปอร์เซ็นต์การขยายขอบเขต (0.05 = 5%)
    """
    cap = cv2.VideoCapture(0)

    if not os.path.exists("pcb_images"):
        os.makedirs("pcb_images")

    photo_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("ไม่สามารถอ่านภาพจากกล้องได้")
            break

        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        lower_copper = np.array([10, 100, 100])
        upper_copper = np.array([20, 255, 255])
        mask = cv2.inRange(hsv, lower_copper, upper_copper)

        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        pcb_detected = False
        warped = None

        if contours:
            largest_contour = max(contours, key=cv2.contourArea)

            # ขยายขอบเขต contour
            expanded_contour = expand_contour(largest_contour, expand_percentage)

            hull = cv2.convexHull(expanded_contour)
            cv2.drawContours(frame, [hull], -1, (0, 255, 0), 3)

            epsilon = 0.02 * cv2.arcLength(hull, True)
            approx = cv2.approxPolyDP(hull, epsilon, True)

            if len(approx) == 4:
                pcb_detected = True
                approx = order_points(approx.reshape(4, 2))
                warped = four_point_transform(frame, approx)
                cv2.imshow("Extracted PCB", warped)

        cv2.imshow("Camera Feed", frame)

        key = cv2.waitKey(1) & 0xFF

        if key == ord("s"):
            if pcb_detected and warped is not None:
                photo_count += 1
                filename = f"pcb_images/pcb_{photo_count}.jpg"
                cv2.imwrite(filename, warped)
                print(f"บันทึกภาพ PCB เรียบร้อยแล้วที่ {filename}")
            else:
                print("ไม่พบ PCB ในภาพ กรุณาลองใหม่")
        elif key == ord("q"):
            break

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
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def four_point_transform(image, pts):
    (tl, tr, br, bl) = pts
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    dst = np.array(
        [[0, 0], [maxWidth - 1, 0], [maxWidth - 1, maxHeight - 1], [0, maxHeight - 1]],
        dtype="float32",
    )

    M = cv2.getPerspectiveTransform(pts, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    return warped


if __name__ == "__main__":
    print("คำแนะนำ:")
    print("1. กด 's' เพื่อถ่ายภาพและบันทึก PCB")
    print("2. กด 'q' เพื่อออกจากโปรแกรม")
    print("3. ปรับเปอร์เซ็นต์การขยายขอบเขตได้ในพารามิเตอร์ expand_percentage")

    # ตัวอย่างการเรียกใช้ด้วยการขยายขอบเขต 10%
    detect_and_extract_pcb(expand_percentage=0.10)
