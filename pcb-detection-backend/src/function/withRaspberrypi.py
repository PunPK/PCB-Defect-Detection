import os
import time
import threading
import logging
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import serial
    HAS_SERIAL = True
except ImportError:
    HAS_SERIAL = False
    serial = None


class NanoController:
    """
    คอนโทรลเลอร์สำหรับสื่อสารกับ Arduino Nano ผ่าน Serial Port (USB)
    - รับสัญญาณเซนเซอร์ SENSOR_DETECTED จาก Arduino
    - สั่งการเซอร์โว (S M, S L, S R)
    - สั่งการสายพาน (B F <speed>, B B <speed>, B S)
    - สั่งการไฟสถานะและ Relay 13 (L 1 1/0 = เขียว, L 2 1/0 = Relay 13/แดง, L 3 1/0 = สำรอง, L 2 2 <ms> = หน่วงเวลา)
    - สั่งการแสดงผลจอ LCD I2C ผ่าน Arduino (P <Line1>|<Line2> หรือ P <Message>)
    """

    def __init__(self, port: Optional[str] = None, baudrate: int = 115200):
        self.running = True
        self.is_sensor_triggered = False
        self.ser = None
        self.port = port or self._detect_port()

        if not HAS_SERIAL:
            logger.warning("[NanoController] pyserial is not installed. Running in simulation mode.")
            return

        if self.port:
            try:
                self.ser = serial.Serial(self.port, baudrate, timeout=0.1)
                time.sleep(2)  # รอ Arduino Reset
                logger.info(f"[NanoController] เชื่อมต่อ Arduino Nano สำเร็จที่พอร์ต {self.port}")
                print(f"[System] เชื่อมต่อ Arduino Nano สำเร็จที่พอร์ต {self.port}")

                self.listener_thread = threading.Thread(target=self._listen_serial, daemon=True)
                self.listener_thread.start()
            except Exception as e:
                logger.warning(f"[NanoController] เชื่อมต่อพอร์ต {self.port} ไม่สำเร็จ: {e}. ใช้โหมดจำลอง")
                print(f"[Warning] ไม่สามารถเปิดการเชื่อมต่อ Arduino Nano: {e}")
                self.ser = None
        else:
            logger.info("[NanoController] ไม่พบพอร์ต USB/ACM ของ Arduino Nano. รันในโหมดจำลอง (Simulation Mode)")

    def _detect_port(self) -> Optional[str]:
        candidate_ports = ["/dev/ttyUSB0", "/dev/ttyUSB1", "/dev/ttyACM0", "/dev/ttyACM1"]
        for p in candidate_ports:
            if os.path.exists(p):
                return p
        return None

    def _listen_serial(self):
        """ทำงานเบื้องหลัง คอยดักฟังข้อความจาก Arduino Nano"""
        while self.running and self.ser:
            try:
                if self.ser.in_waiting > 0:
                    line = self.ser.readline().decode("utf-8", errors="ignore").strip()
                    if line:
                        logger.debug(f"[Arduino] {line}")
                        print(f"[Arduino] {line}")
                        if "SENSOR_DETECTED" in line:
                            self.is_sensor_triggered = True
                            print("[NanoController] เซนเซอร์ตรวจพบชิ้นงาน! SENSOR_DETECTED")
            except Exception as e:
                logger.debug(f"[NanoController] Serial read error: {e}")
            time.sleep(0.01)

    def _send_command(self, cmd: str):
        """ส่งคำสั่งพร้อมขึ้นบรรทัดใหม่ไปยัง Arduino Nano"""
        if self.ser:
            try:
                self.ser.write(f"{cmd}\n".encode("utf-8"))
                self.ser.flush()
            except Exception as e:
                logger.error(f"[NanoController] ส่งคำสั่ง '{cmd}' ล้มเหลว: {e}")
        else:
            logger.debug(f"[NanoController-Sim] Command: {cmd}")

    # ====== หมวด Servo ======
    def servo_mid(self):
        self._send_command("S M")

    def servo_left(self):
        self._send_command("S L")

    def servo_right(self):
        self._send_command("S R")

    # ====== หมวด สายพาน (Belt) ======
    def belt_forward(self, speed: int = 100):
        self._send_command(f"B F {speed}")

    def belt_backward(self, speed: int = 100):
        self._send_command(f"B B {speed}")

    def belt_stop(self):
        self._send_command("B S")

    # ====== หมวด ไฟสถานะ (Pilot Lamp) & Relay 13 ======
    # 1=เขียว (Green, pin 10), 2=แดง/Relay 13 (pin 13), 3=สำรอง (pin 12)
    def light_on(self, num: int):
        self._send_command(f"L {num} 1")

    def light_off(self, num: int):
        self._send_command(f"L {num} 0")

    def relay13_on(self):
        """เปิด Relay 13 (ไฟสายพานเริ่มงาน)"""
        self.light_on(2)

    def relay13_off(self):
        """ปิด Relay 13"""
        self.light_off(2)

    def relay13_delay(self, delay_ms: int = 1000):
        """สั่งเปิด Relay 13 แบบมี Delay (ms)"""
        self._send_command(f"L 2 2 {delay_ms}")

    # ====== หมวด จอ LCD (LiquidCrystal I2C ผ่าน Arduino) ======
    def lcd_print(self, line1: str, line2: str = ""):
        """ส่งข้อความขึ้นจอ LCD (บรรทัดที่ 1 และ 2)"""
        if line2:
            self._send_command(f"P {line1}|{line2}")
        else:
            self._send_command(f"P {line1}")

    def lcd_running(self):
        """แสดงสถานะสายพานกำลังทำงานบนจอ LCD"""
        self.lcd_print("Running........", "Conveyor Active")

    def lcd_processing(self):
        """แสดงสถานะกำลังวิเคราะห์บนจอ LCD"""
        self.lcd_print("Processing......", "AI Analyzing...")

    def lcd_stop_runnung(self):
        """แสดงสถานะรอเริ่มงาน (คงชื่อฟังก์ชันเดิมเพื่อ backward compatibility)"""
        self.lcd_print("Waitting start..", "System Ready")

    def lcd_stop_running(self):
        self.lcd_stop_runnung()

    def lcd_show_result(self, message):
        """แสดงผลลัพธ์คุณภาพเปอร์เซ็นต์บนจอ LCD"""
        if isinstance(message, (int, float)):
            message_str = f"{message:.2f}"
        else:
            message_str = str(message)
        self.lcd_print("Inspection PASS", f"Quality = {message_str}%")

    def lcd_show_log(self, log, message):
        """แสดง Log ข้อผิดพลาดและคะแนนบนจอ LCD"""
        if isinstance(message, (int, float)):
            message_str = f"{message:.2f}"
        else:
            message_str = str(message)
        self.lcd_print(f"Error {str(log)[:8]}", f"Quality = {message_str}%")

    def is_connected(self) -> bool:
        return self.ser is not None

    def close(self):
        self.running = False
        if self.ser:
            try:
                self.belt_stop()
                time.sleep(0.05)
                self.light_off(1)
                self.light_off(2)
                self.light_off(3)
                self.lcd_print("System Stopped", "Waiting for Pi")
                time.sleep(0.05)
                self.ser.close()
                print("[System] ปิดการเชื่อมต่อ Arduino Nano เรียบร้อย")
            except Exception:
                pass
            self.ser = None


# Wrapper classes เพื่อรองรับ interface เดิม หากมีการ import
class Belt:
    def __init__(self, nano: Optional[NanoController] = None):
        self.nano = nano

    def on(self):
        if self.nano:
            self.nano.belt_forward(50)

    def off(self):
        if self.nano:
            self.nano.belt_stop()

    def run_for(self, duration: float):
        self.on()
        time.sleep(duration)

    def close(self):
        self.off()


class Pilotlamp:
    def __init__(self, nano: Optional[NanoController] = None):
        self.nano = nano

    def running(self):
        if self.nano:
            self.nano.light_on(3)   # เปิด relayExtra (ไฟดวงที่ 3) พร้อมกันทันที
            self.nano.light_on(1)   # เปิด relayGreen (ไฟดวงที่ 1)
            self.nano.light_on(2)  # ปิด relayRed

    def error(self):
        if self.nano:
            self.nano.light_on(2)   # เปิด relayRed
            self.nano.light_on(1)  # ปิด relayGreen
            self.nano.light_on(3)  # ปิด relayExtra ด้วย (เพื่อให้เหลือแค่ไฟแดงตอน Error)

    def close(self):
        if self.nano:
            self.nano.light_on(1)  # ปิด relayGreen
            self.nano.light_on(2)  # ปิด relayRed
            self.nano.light_on(3)  # ปิด relayExtra ตอนปิดระบบ


class ServoController:
    def __init__(self, nano: Optional[NanoController] = None):
        self.nano = nano

    def mid(self):
        if self.nano:
            self.nano.servo_mid()

    def left(self):
        if self.nano:
            self.nano.servo_left()

    def right(self):
        if self.nano:
            self.nano.servo_right()


class Lcd:
    def __init__(self, nano: Optional[NanoController] = None):
        self.nano = nano
        self.rplcd = None
        if not self.nano:
            try:
                from RPLCD.i2c import CharLCD
                self.rplcd = CharLCD('PCF8574', 0x27, cols=16, rows=2, charmap='A02')
            except Exception:
                self.rplcd = None

    def lcd_running(self):
        if self.nano:
            self.nano.lcd_running()
        elif self.rplcd:
            try:
                self.rplcd.clear()
                self.rplcd.write_string('Running........')
                self.rplcd.cursor_pos = (1, 0)
            except Exception:
                pass

    def lcd_processing(self):
        if self.nano:
            self.nano.lcd_processing()
        elif self.rplcd:
            try:
                self.rplcd.clear()
                self.rplcd.write_string('Processing........')
                self.rplcd.cursor_pos = (1, 0)
            except Exception:
                pass

    def lcd_stop_runnung(self):
        if self.nano:
            self.nano.lcd_stop_runnung()
        elif self.rplcd:
            try:
                self.rplcd.clear()
                self.rplcd.write_string('Waitting for start........')
                self.rplcd.cursor_pos = (1, 0)
            except Exception:
                pass

    def lcd_stop_running(self):
        self.lcd_stop_runnung()

    def lcd_show_result(self, message):
        if self.nano:
            self.nano.lcd_show_result(message)
        elif self.rplcd:
            try:
                if isinstance(message, (int, float)):
                    message_str = f"{message:.2f}"
                else:
                    message_str = str(message)
                self.rplcd.clear()
                self.rplcd.write_string(f"Quality = {message_str}%")
                self.rplcd.cursor_pos = (1, 0)
            except Exception:
                pass

    def lcd_show_log(self, log, message):
        if self.nano:
            self.nano.lcd_show_log(log, message)
        elif self.rplcd:
            try:
                if isinstance(message, (int, float)):
                    message_str = f"{message:.2f}"
                else:
                    message_str = str(message)
                self.rplcd.clear()
                self.rplcd.write_string(f"Error {str(log)[:7]} : {message_str}%")
                self.rplcd.cursor_pos = (1, 0)
            except Exception:
                pass

    def close(self):
        if self.nano:
            self.nano.lcd_print("System Stopped", "")
        if self.rplcd:
            try:
                self.rplcd.close()
            except Exception:
                pass
