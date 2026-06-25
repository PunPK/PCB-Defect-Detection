from gpiozero import OutputDevice, Device
from gpiozero.pins.lgpio import LGPIOFactory
Device.pin_factory = LGPIOFactory()
from RPLCD.i2c import CharLCD
import time

class Pilotlamp:
    def __init__(self):
        self.red = OutputDevice(24, active_high=False, initial_value=False)
        self.green = OutputDevice(23, active_high=False, initial_value=False)

    def running(self):
        print("============================================================================>Pilotlamp running")
        self.green.on()
        # FIX: Changed .close() to .off(). You want to turn the light off, not destroy the pin object.
        self.red.off() 
    
    def testing(self):
        print("============================================================================>Pilotlamp testing")
        self.green.off()
        self.red.on()
    
    # def processing(self):
    #     self.red.off()
    #     for _ in range(3):
    #         self.green.on()
    #         time.sleep(0.5)
    #         self.green.off()
    #         time.sleep(0.5)

    def error(self):
        self.green.off()
        self.red.on()

    def close(self):
        # FIX: Check if the device is already closed before attempting to turn it off or close it
        if hasattr(self, 'green') and not self.green.closed:
            self.green.off()
            self.green.close()
            
        if hasattr(self, 'red') and not self.red.closed:
            self.red.off()
            self.red.close()

    def __del__(self):
        self.close()

if __name__ == "__main__":
    pilotlamp = Pilotlamp()
    pilotlamp.testing()
    
    # Optional: A short delay so you can actually see the lights turn on before the script exits
    time.sleep(2)