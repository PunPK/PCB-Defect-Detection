import cv2
import numpy as np
import matplotlib.pyplot as plt

def detect_broken_wires(original_path, broken_path):
    # โหลดภาพต้นฉบับและภาพที่เส้นขาด
    original = cv2.imread(original_path)
    broken = cv2.imread(broken_path)
    
    # ตรวจสอบว่าภาพถูกโหลดมาถูกต้องหรือไม่
    if original is None or broken is None:
        print("Error: Could not load images")
        return None
    
    # ทำให้ภาพทั้งสองมีขนาดเท่ากัน
    height = min(original.shape[0], broken.shape[0])
    width = min(original.shape[1], broken.shape[1])
    original = cv2.resize(original, (width, height))
    broken = cv2.resize(broken, (width, height))
    
    # แปลงเป็น RGB สำหรับการแสดงผล
    original_rgb = cv2.cvtColor(original, cv2.COLOR_BGR2RGB)
    broken_rgb = cv2.cvtColor(broken, cv2.COLOR_BGR2RGB)
    
    # แปลงเป็น HSV สำหรับการตรวจจับสีทองแดง
    original_hsv = cv2.cvtColor(original, cv2.COLOR_BGR2HSV)
    broken_hsv = cv2.cvtColor(broken, cv2.COLOR_BGR2HSV)
    
    # ช่วงสีทองแดงใน HSV (อาจต้องปรับค่าเหล่านี้ตามภาพจริง)
    lower_copper = np.array([10, 100, 100])
    upper_copper = np.array([20, 255, 255])
    
    # สร้าง mask สำหรับเส้นทองแดง
    original_mask = cv2.inRange(original_hsv, lower_copper, upper_copper)
    broken_mask = cv2.inRange(broken_hsv, lower_copper, upper_copper)
    
    # ประมวลผล mask เพื่อลด noise
    kernel = np.ones((3,3), np.uint8)
    original_mask = cv2.morphologyEx(original_mask, cv2.MORPH_OPEN, kernel, iterations=2)
    original_mask = cv2.morphologyEx(original_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    broken_mask = cv2.morphologyEx(broken_mask, cv2.MORPH_OPEN, kernel, iterations=2)
    broken_mask = cv2.morphologyEx(broken_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    # หาความแตกต่างระหว่าง mask สองภาพ
    diff_mask = cv2.absdiff(original_mask, broken_mask)
    diff_mask = cv2.threshold(diff_mask, 50, 255, cv2.THRESH_BINARY)[1]
    
    # หา contours ของส่วนที่แตกต่าง
    contours, _ = cv2.findContours(diff_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # สร้างภาพผลลัพธ์
    result = broken_rgb.copy()
    
    # วาดวงกลมรอบจุดที่เส้นขาด
    for cnt in contours:
        if cv2.contourArea(cnt) > 50:  # กรองพื้นที่เล็กๆออก
            (x, y, w, h) = cv2.boundingRect(cnt)
            center = (int(x + w/2), int(y + h/2))
            radius = int((w + h)/4)
            cv2.circle(result, center, radius, (255, 0, 0), 3)
            cv2.putText(result, "Broken", (x, y-10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)
    
    # แสดงผลลัพธ์
    plt.figure(figsize=(18, 12))
    
    plt.subplot(2, 2, 1)
    plt.imshow(original_rgb)
    plt.title("Original Image")
    
    plt.subplot(2, 2, 2)
    plt.imshow(broken_rgb)
    plt.title("Broken Image")
    
    plt.subplot(2, 2, 3)
    plt.imshow(diff_mask, cmap='gray')
    plt.title("Difference Mask")
    
    plt.subplot(2, 2, 4)
    plt.imshow(result)
    plt.title("Detection Result (Broken Areas in Blue)")
    
    plt.tight_layout()
    plt.show()
    
    return result

# เรียกใช้ฟังก์ชัน (เปลี่ยนชื่อไฟล์ตามที่คุณมี)
result_image = detect_broken_wires("test_functions/original_test.png", "test_functions/hole_test.png")

# แสดงผลใน OpenCV window
if result_image is not None:
    cv2.imshow('Broken Wires Detection', cv2.cvtColor(result_image, cv2.COLOR_RGB2BGR))
    cv2.waitKey(0)
    cv2.destroyAllWindows()