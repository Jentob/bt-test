import asyncio
import threading
from typing import Optional

import customtkinter as ctk
from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice
from bleak.backends.scanner import AdvertisementData

HR_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb"
HR_MEASUREMENT_UUID = "00002a37-0000-1000-8000-00805f9b34fb"


class HeartRateApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Heart Rate Monitor")

        self.label = ctk.CTkLabel(self, text="Heart Rate: -- bpm")
        self.label.pack(pady=20)

        self.status = ctk.CTkLabel(self, text="Starting...")
        self.status.pack()

        self.loop = asyncio.new_event_loop()
        self.client = None

        threading.Thread(target=self.start_loop, daemon=True).start()
        asyncio.run_coroutine_threadsafe(self.main(), self.loop)

    def start_loop(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    async def main(self):
        self.update_status("Scanning for heart rate device...")
        device = await self.get_hr_device()

        if not device:
            self.update_status("No HR device found")
            return

        self.update_status(f"Connecting to {device.name}...")
        self.client = BleakClient(
            device, disconnected_callback=lambda _: self.update_status("Disconnected")
        )

        try:
            await self.client.connect()
            self.update_status("Connected")

            await self.client.start_notify(
                HR_MEASUREMENT_UUID, self.notification_handler
            )
        except Exception as e:
            self.update_status(f"Error: {e}")

    async def get_hr_device(
        self, timeout: float = 20.0, nameFilter: str = "polar"
    ) -> Optional[BLEDevice]:
        print(f"Scanning for HR device (timeout: {timeout}s)...")

        def filter_device(
            device: BLEDevice, advertisement_data: AdvertisementData
        ) -> bool:
            return (
                nameFilter.lower() in (device.name or "").lower()
                and HR_SERVICE_UUID in advertisement_data.service_uuids
            )

        try:
            device = await BleakScanner.find_device_by_filter(
                filter_device, timeout=timeout
            )
            if device:
                print(f"Found: {device.name} [{device.address}]")
                return device
            else:
                print("No HR device found during scan.")
        except Exception as e:
            print(f"Error during scanning: {e}")
        return None

    def notification_handler(self, sender, data):
        flags = data[0]
        hr_16bit = flags & 0x01

        if hr_16bit:
            hr = int.from_bytes(data[1:3], byteorder="little")
        else:
            hr = data[1]

        self.after(0, self.update_hr, hr)

    def update_hr(self, hr: str | int):
        self.label.configure(text=f"Heart Rate: {hr} bpm")

    def update_status(self, text):
        self.status.configure(text=text)


if __name__ == "__main__":
    app = HeartRateApp()
    app.mainloop()
