from gpiozero import OutputDevice,Device
from gpiozero.pins.lgpio import LGPIOFactory
import time
import numpy as np

# Explicitly set the pin factory
Device.pin_factory = LGPIOFactory()

# belt = OutputDevice(17, active_high=False, initial_value=False)


import asyncio
from gpiozero import OutputDevice
from RPLCD.i2c import CharLCD



class Belt:
    def __init__(self):
        self.belt = OutputDevice(17, active_high=False, initial_value=False)
        self._running = False
        self._task = False
        

    async def _loop(self):
        print("Belt async loop started")
        while self._running:
            await asyncio.sleep(0.1)
        print("Belt async loop stopped")

    def run_for(self, duration):
        print(f"Belt ON for {duration} seconds")
        self.belt.on()
        time.sleep(duration)
        # self.belt.off()
        # print("Belt OFF")

    def on(self):
        if not self._running:
            print("Belt ON")
            self.belt.on()
            self._running = True
            self._task = asyncio.create_task(self._loop())
           

    def off(self):
        if self._running:
            print("Belt OFF")
            self._running = False
            self.belt.off()

    def close(self):
        self.off()
        self.belt.close()

    def __del__(self):
        self.close()

    def is_on(self):
        return self._running

    def test_log(self,massage):
        print(f"Belt test log: {massage}")

    def Waitting(self):
        self.belt.off()
        self._running = False
        # while self._task:
        #     # self._task.cancel()
        #     self._task = False
        #     self.belt.on()
        #     time.sleep(2)

    def Stop_Waitting(self):
        self.belt.on()
        # if not self._task :
        #     print("Belt Stop Waitting")
        #     self._task = True

class Lcd(Belt) :
    def __init__(self):
        self.lcd = CharLCD('PCF8574', 0x27, cols=16, rows=2, charmap='A02')

    def lcd_running(self):
        self.lcd.clear()
        self.lcd.write_string('Running........')
        self.lcd.cursor_pos = (1, 0)
        

    def lcd_processing(self):
        self.lcd.clear()
        self.lcd.write_string('Processing........')
        self.lcd.cursor_pos = (1, 0)

    def lcd_stop_runnung(self):
        self.lcd.clear()
        self.lcd.write_string('Waitting for start........')
        self.lcd.cursor_pos = (1, 0)

    def lcd_show_result(self, message):
        if isinstance(message, (int, float, np.float64)):
            message_str = f"{message:.2f}"
        else:
            message_str = str(message)

        self.lcd.write_string(f"Quality = {message_str}%")
        self.lcd.cursor_pos = (1, 0)

    def lcd_show_log(self,log, message):

        self.lcd.clear()

        if isinstance(message, (int, float, np.float64)):
            message_str = f"{message:.2f}"
        else:
            message_str = str(message)

        self.lcd.write_string(f"Error {str(log)} : {message_str}%")
        self.lcd.cursor_pos = (1, 0)


    def close(self):
        self.lcd.close()


class Pilotlamp :
    def __init__(self):
        self.red = OutputDevice(24, active_high=False, initial_value=False)
        self.green = OutputDevice(23, active_high=False, initial_value=False)

    def running(self):
        self.green.on()
        self.red.off()
    
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
        self.green.off()
        self.red.off()
        self.green.close()
        self.red.close()

    def __del__(self):
        self.close()

