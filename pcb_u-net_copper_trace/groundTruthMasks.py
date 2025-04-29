import os
import cv2
import numpy as np

# 🟡 กำหนดค่าต่างๆ
input_dir = "pcb_u-net_copper_trace\dataset\Raw_images"
output_images_dir = "pcb_u-net_copper_trace\dataset\images"
output_masks_dir = "pcb_u-net_copper_trace\dataset\masks"
output_size = (256, 256)

# สีทองแดงใน HSV (อาจต้องปรับ)
lower_copper = np.array([10, 50, 50])
upper_copper = np.array([30, 255, 255])

# 🔧 สร้างโฟลเดอร์ output ถ้ายังไม่มี
os.makedirs(output_images_dir, exist_ok=True)
os.makedirs(output_masks_dir, exist_ok=True)

# 📁 วนลูปผ่านทุกภาพ
for idx, filename in enumerate(sorted(os.listdir(input_dir))):
    if not filename.lower().endswith((".png", ".jpg", ".jpeg")):
        continue

    path = os.path.join(input_dir, filename)
    img = cv2.imread(path)
    if img is None:
        print(f"⛔️ Couldn't read {filename}")
        continue

    # Resize
    img_resized = cv2.resize(img, output_size)

    # สร้าง mask (ทองแดง)
    hsv = cv2.cvtColor(img_resized, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, lower_copper, upper_copper)

    # Save image และ mask
    img_name = f"img_{idx:03d}.png"
    cv2.imwrite(os.path.join(output_images_dir, img_name), img_resized)
    cv2.imwrite(os.path.join(output_masks_dir, img_name), mask)

    print(f"✅ Saved: {img_name}")

print("\n🎉 Dataset preparation complete!")
