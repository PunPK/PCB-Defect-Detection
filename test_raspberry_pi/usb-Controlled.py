# sudo apt-get install libusb-1.0-0-dev
# git clone https://github.com/mvp/uhubctl
# cd uhubctl
# make
# sudo make install

# sudo uhubctl -l 1-1 -p 2 -a on
# sudo uhubctl -l 1-1 -p 2 -a off
# sudo uhubctl -l 1-1 -p 2 -a toggle

# https://www.makerspace-online.com/power-point/

import subprocess


def control_usb_power(bus, port, action):
    subprocess.run(["sudo", "uhubctl", "-l", str(bus), "-p", str(port), "-a", action])


# Example usage:
control_usb_power(1, 2, "off")  # Turn off port 2 on bus 1
control_usb_power(1, 2, "on")  # Turn on port 2 on bus 1
