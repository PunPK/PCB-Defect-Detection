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
    - สั่งการไฟสถานะ (L 1 1/0 = เขียว, L 2 1/0 = แดง)
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
    def belt_forward(self, speed: int = 200):
        self._send_command(f"B F {speed}")

    def belt_backward(self, speed: int = 200):
        self._send_command(f"B B {speed}")

    def belt_stop(self):
        self._send_command("B S")

    # ====== หมวด ไฟสถานะ (Pilot Lamp) ======
    # 1=เขียว (Green), 2=แดง (Red), 3=สำรอง
    def light_on(self, num: int):
        self._send_command(f"L {num} 1")

    def light_off(self, num: int):
        self._send_command(f"L {num} 0")

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
            self.nano.belt_forward(200)

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
            self.nano.light_on(1)
            self.nano.light_off(2)

    def error(self):
        if self.nano:
            self.nano.light_on(2)
            self.nano.light_off(1)

    def close(self):
        if self.nano:
            self.nano.light_off(1)
            self.nano.light_off(2)


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
    def __init__(self):
        pass

    def lcd_running(self):
        pass

    def lcd_processing(self):
        pass

    def lcd_stop_runnung(self):
        pass

    def lcd_show_result(self, message):
        pass

    def lcd_show_log(self, log, message):
        pass

    def close(self):
        pass
