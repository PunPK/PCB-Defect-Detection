# Sample Dataset for PCB Defect Classification (Report & Presentation Samples)

ชุดข้อมูลตัวอย่างขนาดกะทัดรัดสำหรับการนำไปประกอบการเขียนรายงานและทำสไลด์นำเสนอ (รวม 19 ตัวอย่างตัวแทน ครอบคลุมทั้ง 4 คลาส)

## รายละเอียดแต่ละโฟลเดอร์
- `open/`: ตัวอย่างรอยวงจรขาด (Open Circuit Defect) - 5 ภาพ
- `short/`: ตัวอย่างรอยวงจรลัด/ต่อชน (Short Circuit Defect) - 4 ภาพ
- `minor/`: ตัวอย่างตำหนิเล็กน้อย (Minor Copper Spurious / Pinholes) - 5 ภาพ
- `normal/`: ตัวอย่างจุดปกติไม่มีตำหนิ (Normal Non-Defect Regions) - 5 ภาพ

## โครงสร้างแถบภาพตัวอย่าง (Crop Sheet Format)
แต่ละไฟล์ภาพ `.png` (ขนาด $256 \times 1124$ พิกเซล) บรรจุแถบข้อมูลภาพ 4 ช่องเรียงต่อกัน:
1. **ช่องที่ 1 (พิกเซล 0 ถึง 256):** Nominal CAD Reference ($D$) - ลายวงจรอุดมคติจากแบบแปลน
2. **ช่องที่ 2 (พิกเซล 262 ถึง 518):** Inspected Copper Trace ($T$) - ลายทองแดงจริงจากการตรวจจับกล้อง
3. **ช่องที่ 3 (พิกเซล 524 ถึง 780):** Differential Residual Map ($D \oplus T$) - แผนผังผลต่างความคลาดเคลื่อน
4. **ช่องที่ 4 (พิกเซล 786 เป็นต้นไป):** Board Context - บริบทโดยรอบบนแผ่นวงจรพิมพ์

## ไฟล์กำกับป้าย
- `sample_labels.csv`: บันทึก ID, ประเภทคลาส (label) และ path ของแต่ละไฟล์ตัวอย่าง
