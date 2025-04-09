import cv2
import numpy as np

# เปิดกล้อง (0 คือกล้องตัวแรก)
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise IOError("ไม่สามารถเปิดกล้องได้")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # ปรับขนาดเพื่อความเร็ว
    frame = cv2.resize(frame, (800, 600))

    # แปลงจาก BGR เป็น HSV
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # กำหนดช่วงสีทองแดงใน HSV (อาจต้องปรับตามกล้อง/แสง)
    lower_copper = np.array([5, 50, 50])
    upper_copper = np.array([25, 255, 255])

    # สร้าง mask
    mask = cv2.inRange(hsv, lower_copper, upper_copper)

    # กำจัด noise
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    # หา contour
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    result = frame.copy()
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area > 100000:  # กรองเฉพาะวัตถุขนาดใหญ่
            x, y, w, h = cv2.boundingRect(cnt)
            cv2.rectangle(result, (x, y), (x + w, y + h), (0, 255, 0), 2)
            cv2.putText(
                result,
                "PCB",
                (x, y - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.9,
                (0, 255, 0),
                2,
            )

    # แสดงผล
    cv2.imshow("PCB Detection", result)
    # cv2.imshow("Mask", mask)

    # กด 'q' เพื่อออก
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# ปิดกล้องและหน้าต่างทั้งหมด
cap.release()
cv2.destroyAllWindows()
