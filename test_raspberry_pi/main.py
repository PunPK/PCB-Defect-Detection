import network
from microdot import Microdot, send_file
import machine

ledGreen = machine.Pin(0, machine.Pin.OUT)
ledRed = machine.Pin(1, machine.Pin.OUT)


def connect_to_wifi():
    sta = network.WLAN(network.STA_IF)
    if not sta.isconnected():
        print("Connecting to the WiFi...")
        sta.active(True)
        sta.connect("YOUR_SSID", "YOUR_PASSWORD")
        while not sta.isconnected():
            pass
    print("Connected to WiFi ", sta.ifconfig()[0])


connect_to_wifi()

app = Microdot()


@app.route("/")
async def home(request):
    return send_file("index.html")


@app.route("/api/led", methods=["POST"])
async def controlLED(request):
    ledGreen.value(request.json["ledGreen"])
    ledRed.value(request.json["ledRed"])
    return {"success": True}


app.run(port=80)
