import time
import serial

class NanoController:
    def __init__(self, port='/dev/ttyUSB0', baudrate=115200):
        try:
            # เชื่อมต่อ Serial
            self.ser = serial.Serial(port, baudrate, timeout=1)
            time.sleep(2) # รอ Arduino Reset
            print("[System] เชื่อมต่อ Arduino Nano สำเร็จ")
        except Exception as e:
            print(f"[Error] เชื่อมต่อไม่ได้: {e}")
            self.ser = None

    def _send_command(self, cmd):
        """ ฟังก์ชันส่งข้อความพร้อมขึ้นบรรทัดใหม่ """
        if self.ser:
            self.ser.write(f"{cmd}\n".encode('utf-8'))
            self.ser.flush()

    # ====== หมวด Servo ======
    def servo_mid(self):
        self._send_command("S M")
    
    def servo_left(self):
        self._send_command("S L")
        
    def servo_right(self):
        self._send_command("S R")

    # ====== หมวด สายพาน (Belt) ======
    def belt_forward(self, speed=255):
        self._send_command(f"B F {speed}")
        
    def belt_backward(self, speed=255):
        self._send_command(f"B B {speed}")
        
    def belt_stop(self):
        self._send_command("B S")

    # ====== หมวด ไฟสถานะ (Lights) ======
    def light_on(self, num):
        self._send_command(f"L {num} 1")
        
    def light_off(self, num):
        self._send_command(f"L {num} 0")

    def close(self):
        if self.ser:
            self.belt_stop()
            self.ser.close()

# ==========================================
# ตัวอย่างการทดสอบ
# ==========================================
if __name__ == "__main__":
    # เช็คพอร์ตด้วย ls /dev/tty* ก่อน (บางที Nano อาจจะเป็น ttyUSB0 หรือ ttyUSB1)
    nano = NanoController(port='/dev/ttyUSB0') 

    try:
        # ทดสอบสายพาน (เดินหน้าความเร็ว 200 เป็นเวลา 3 วินาที)
        print("Belt Forward...")
        nano.belt_forward(200)
        
        # ระหว่างที่สายพานวิ่ง ลองสับ Servo ดู (สายพานจะไม่หยุดกระตุกแล้ว)
        time.sleep(1)
        nano.servo_left()
        
        time.sleep(2)
        nano.belt_stop()

        # ทดสอบไฟ (เปิดไฟดวงที่ 1 ค้างไว้ 2 วินาที แล้วปิด)
        print("Testing Light 1 with Delay")
        nano.light_on(1)
        time.sleep(2)  # การหน่วงเวลา (Delay) ควบคุมที่ Python สะดวกกว่ามาก
        nano.light_off(1)

    except KeyboardInterrupt:
        pass
    finally:
        nano.close()
