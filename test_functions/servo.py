from gpiozero import Servo
from time import sleep

servo = Servo(14, min_pulse_width=0.5/1000, max_pulse_width=2.5/1000)

try:
    print("Starting... Press Ctrl+C to stop")
    while True:
        print("Position: Center")
        # servo.mid()
        servo.value = -0.2
        sleep(0.5)   
        
        servo.value = None 
        sleep(1.0)        

        print("Position: Slightly Left")
        servo.value = -0.51  
        sleep(1)

        servo.value = None 
        sleep(1.0)        

        print("Position: Center")
        servo.value = -0.2
        sleep(0.5)       
        
        servo.value = None 
        sleep(1.0)         

        print("Position: Slightly Right")
        servo.value = 0.1   
        sleep(1.5)

        servo.value = None
        sleep(1.0)         

except KeyboardInterrupt:
    print("\nProgram stopped")
    servo.detach()