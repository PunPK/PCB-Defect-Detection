#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ==========================================
// ตั้งค่าจอ LCD I2C (Address มักจะเป็น 0x27 หรือ 0x3F)
// ==========================================
LiquidCrystal_I2C lcd(0x27, 16, 2); 

Servo myServo;
const int servoPin = 2; // ขาควบคุม Servo

// กำหนดองศาของ Servo
const int angleMid = 85;
const int angleLeft = 35; 
const int angleRight = 130;

// ตัวแปรสำหรับปลด Servo แบบไม่ใช้ delay()
unsigned long servoTimer = 0;
bool isServoAttached = false;
const unsigned long SERVO_TIMEOUT = 1000;

// ขาควบคุมมอเตอร์สายพาน (L298N)
const int IN1 = 4;
const int IN2 = 5;
const int EN1 = 11; 

// ==========================================
// ส่วนควบคุม Relay / Pilot Lamp
// ==========================================
const int RELAY_ON = LOW;  
const int RELAY_OFF = HIGH; 

const int relayGreen = 10; 
const int relayRed = 13;   // ขา 13 (ไฟแดง / Built-in LED / Relay 13)
const int relayExtra = 12; 

// ตัวแปรสำหรับระบบหน่วงเวลา (Delay) ไฟขา 13 โดยไม่ใช้คำสั่ง delay()
bool isRedDelaying = false;
unsigned long redDelayTimer = 0;
unsigned long redDelayDuration = 0;
// ==========================================

// ขา Sensor E18-D80NK (NPN)
const int irSensorPin = 3;  
bool isBeltRunning = false; 

// ระบบข้ามการตรวจจับชั่วคราว
bool ignoreSensor = false; 
unsigned long ignoreTimer = 0;
const unsigned long IGNORE_DURATION = 1500; 

// ประกาศฟังก์ชันล่วงหน้า
void stopBelt();
void updateLCD(String line1, String line2);
void processCommand(String cmd);

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(50); // ป้องกันไม่ให้ Serial.readStringUntil ค้างบล็อกการทำงาน

  // เริ่มการทำงานจอ LCD
  lcd.begin();
  lcd.backlight();
  updateLCD("System Ready", "Waiting for Pi");

  // ตั้งค่าขา สายพาน
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(EN1, OUTPUT);
  stopBelt(); // เริ่มต้นด้วยการหยุดสายพาน

  // ตั้งค่าขา Relay ไฟ Pilot Lamp
  pinMode(relayGreen, OUTPUT);
  pinMode(relayRed, OUTPUT);
  pinMode(relayExtra, OUTPUT);
  
  digitalWrite(relayGreen, RELAY_OFF);
  digitalWrite(relayRed, RELAY_OFF);
  digitalWrite(relayExtra, RELAY_OFF);

  // ตั้งค่าขา Sensor
  pinMode(irSensorPin, INPUT_PULLUP);

  // ตั้งค่าเริ่มต้น Servo
  myServo.attach(servoPin);
  myServo.write(angleMid);
  delay(1000); 
  myServo.detach();
}

void loop() {
  // 1. รับคำสั่งจาก Raspberry Pi
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n'); 
    command.trim(); 
    
    if (command.length() > 0) {
      processCommand(command);
    }
  }

  // 2. ตรวจสอบการชนจาก Sensor E18-D80NK (เมื่อสายพานกำลังทำงาน)
  if (isBeltRunning && !ignoreSensor) {
    int sensorState = digitalRead(irSensorPin);
    
    if (sensorState == LOW) {
      stopBelt(); // 🛑 หยุดสายพานและเบรกทันที
      Serial.println("SENSOR_DETECTED"); // ส่งแจ้งเตือนไปยัง Raspberry Pi
      updateLCD("PCB DETECTED!", "Waiting AI..."); // อัปเดตจอเมื่อเจอชิ้นงาน
    }
  }

  // 3. ปลดล็อกเซนเซอร์: เมื่อชิ้นงานพ้นเซนเซอร์ไปแล้ว (HIGH) หรือครบเวลากันตรวจจับซ้ำ
  if (ignoreSensor && (digitalRead(irSensorPin) == HIGH || (millis() - ignoreTimer >= IGNORE_DURATION))) {
    ignoreSensor = false;
  }

  // 4. ปลดการเชื่อมต่อ Servo อัตโนมัติ
  if (isServoAttached && (millis() - servoTimer >= SERVO_TIMEOUT)) {
    myServo.detach();
    isServoAttached = false;
  }

  // 5. ระบบจับเวลาหน่วงสำหรับเปิดไฟขา 13 (Red Relay)
  if (isRedDelaying && (millis() - redDelayTimer >= redDelayDuration)) {
    digitalWrite(relayRed, RELAY_ON); // สั่งเปิดไฟเมื่อครบเวลาที่กำหนด
    isRedDelaying = false;            // ปิดระบบจับเวลา
  }
}

// ฟังก์ชันสำหรับจัดการข้อความบนจอ LCD
void updateLCD(String line1, String line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  if (line1.length() > 16) line1 = line1.substring(0, 16);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  if (line2.length() > 16) line2 = line2.substring(0, 16);
  lcd.print(line2);
}

// ฟังก์ชันแยกแยะคำสั่ง
void processCommand(String cmd) {
  char type = cmd.charAt(0); 

  if (type == 'S') { 
    char dir = cmd.charAt(2);
    myServo.attach(servoPin);
    isServoAttached = true;
    servoTimer = millis(); 
    
    if (dir == 'M') { myServo.write(angleMid); updateLCD("Sorting:", "MIDDLE (PASS)"); }
    else if (dir == 'L') { myServo.write(angleLeft); updateLCD("Sorting:", "LEFT (DEFECT)"); }
    else if (dir == 'R') { myServo.write(angleRight); updateLCD("Sorting:", "RIGHT (DEFECT)"); }
  } 
  
  else if (type == 'B') { 
    char dir = cmd.charAt(2);
    int speed = 0;
    if (cmd.length() > 4) speed = cmd.substring(4).toInt(); 

    if (dir == 'F') { 
      digitalWrite(IN1, HIGH);
      digitalWrite(IN2, LOW);
      analogWrite(EN1, speed);
      isBeltRunning = true;

      // ถ้าชิ้นงานยังคงคาอยู่ที่เซนเซอร์ ให้กันการตรวจจับซ้ำจนกว่าจะเคลื่อนที่พ้นไป
      if (digitalRead(irSensorPin) == LOW) {
        ignoreSensor = true; 
        ignoreTimer = millis();
      } else {
        ignoreSensor = false;
      }

      // เปิดไฟ Relay 13 เมื่อสายพานเริ่มทำงาน
      digitalWrite(relayRed, RELAY_ON);
      isRedDelaying = false;
      updateLCD("Belt Status:", "RUNNING ->");
      
    } else if (dir == 'B') { 
      digitalWrite(IN1, LOW);
      digitalWrite(IN2, HIGH);
      analogWrite(EN1, speed);
      isBeltRunning = true;
      digitalWrite(relayRed, RELAY_ON);
      isRedDelaying = false;
      updateLCD("Belt Status:", "<- REVERSE");
      
    } else if (dir == 'S') { 
      stopBelt();
      updateLCD("Belt Status:", "STOPPED");
    }
  }
  
  else if (type == 'L') { 
    // รูปแบบ: "L <หมายเลขไฟ> <สถานะ> [เวลาหน่วง_ms]"
    int lightNum = cmd.substring(2, 3).toInt();
    int state = cmd.substring(4, 5).toInt(); 

    // หากเป็นขา 13 (ไฟแดง / Relay 13) และสั่งสถานะ 2 (เปิดแบบมี Delay)
    if (lightNum == 2 && state == 2) {
      int delayMs = 1000; // ค่าเริ่มต้นหน่วง 1 วินาที
      if (cmd.length() > 6) {
        delayMs = cmd.substring(6).toInt(); // ดึงค่าเวลาหน่วงจาก Python
      }
      isRedDelaying = true;           // เริ่มระบบหน่วง
      redDelayTimer = millis();       // จดจำเวลาเริ่ม
      redDelayDuration = delayMs;     // ตั้งเวลาเป้าหมาย
      return; // ออกจากเงื่อนไขทันที ไม่เปิดไฟตอนนี้
    }

    // สำหรับการเปิด-ปิดปกติ หรือไฟดวงอื่น
    int targetPin = -1;
    if (lightNum == 1) targetPin = relayGreen;
    else if (lightNum == 2) targetPin = relayRed;
    else if (lightNum == 3) targetPin = relayExtra;

    if (targetPin != -1) {
      digitalWrite(targetPin, (state == 1) ? RELAY_ON : RELAY_OFF);
      
      // ถ้าสั่งปิดไฟขา 13 ให้ยกเลิกการหน่วงเวลาด้วย (เผื่อสั่งปิดก่อนถึงเวลาเปิด)
      if (targetPin == relayRed && state == 0) {
        isRedDelaying = false; 
      }
    }
  }

  else if (type == 'P') { 
    // คำสั่งสำหรับพิมพ์ข้อความจาก Python ลงจอ LCD โดยตรง
    // รองรับ 2 รูปแบบ:
    // 1. "P <Line1>|<Line2>"  -> แสดง Line1 บรรทัดบน, Line2 บรรทัดล่าง
    // 2. "P <Message>"        -> แสดง "Msg from AI:" บรรทัดบน, Message บรรทัดล่าง
    String msg = cmd.substring(2);
    int sep = msg.indexOf('|');
    if (sep != -1) {
      updateLCD(msg.substring(0, sep), msg.substring(sep + 1));
    } else {
      updateLCD("Msg from AI:", msg);
    }
  }
}

void stopBelt() {
  // 1. สั่ง Active Brake ล็อคมอเตอร์ทันที เพื่อไม่ให้สายพานไหลตามแรงเฉื่อย
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, HIGH);
  analogWrite(EN1, 255);
  delay(80); // ล็อคเบรก 80ms ให้สายพานหยุดสนิททันที

  // 2. ตัดไฟออกจากมอเตอร์
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  analogWrite(EN1, 0);
  isBeltRunning = false;

  // 3. ปิดไฟ Relay 13 เมื่อสายพานหยุดทำงาน
  digitalWrite(relayRed, RELAY_OFF);
  isRedDelaying = false;
}
