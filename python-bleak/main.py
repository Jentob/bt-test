import asyncio
import threading
from pathlib import Path
from typing import Optional

import customtkinter as ctk
from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice
from bleak.backends.scanner import AdvertisementData

from file_writer import FileWriter

HR_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb"
HR_MEASUREMENT_UUID = "00002a37-0000-1000-8000-00805f9b34fb"


ctk.set_appearance_mode("dark")


class HeartRateApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Heart Rate Monitor")
        self.geometry("400x300")

        self.hr_label = ctk.CTkLabel(self, text="Heart Rate: -- bpm")
        self.hr_label.pack(pady=20)

        self.status = ctk.CTkLabel(self, text="Starting...")
        self.status.pack()

        self.loop = asyncio.new_event_loop()
        self.client = None

        self.filename_entry = ctk.CTkEntry(self, placeholder_text="filename")
        self.filename_entry.pack(pady=5)

        self.record_button = ctk.CTkButton(
            self,
            text="Start Recording",
            command=self.toggle_recording,
        )
        self.record_button.pack(pady=5)

        self.recording = False
        self.file_writer: Optional[FileWriter] = None

        threading.Thread(target=self.start_loop, daemon=True).start()
        asyncio.run_coroutine_threadsafe(self.main(), self.loop)

    def start_loop(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    async def main(self):
        self.after(0, self.update_status, "Scanning for heart rate device...")
        device = await self.get_hr_device()

        if not device:
            self.after(0, self.update_status, "No heart rate device found.")
            return

        self.after(0, self.update_status, f"Connecting to {device.name}...")

        def onDisconnect(_: BleakClient):
            self.after(0, self.update_status, "Disconnected")
            self.client = None

        self.client = BleakClient(device, disconnected_callback=onDisconnect)

        try:
            await self.client.connect()
            self.after(0, self.update_status, "Connected")

            await self.client.start_notify(
                HR_MEASUREMENT_UUID, self.notification_handler
            )
        except Exception as e:
            self.after(0, self.update_status, f"Error: {e}")

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
            offset = 3
        else:
            hr = data[1]
            offset = 2

        rr_interval = ""

        if flags & 0x10:  # RR interval present
            rr_values = []
            while offset + 1 < len(data):
                rr = int.from_bytes(data[offset : offset + 2], byteorder="little")
                rr_values.append(rr)
                offset += 2
            rr_interval = ";".join(map(str, rr_values))

        if self.recording and self.file_writer:
            try:
                self.file_writer.write_line(hr, rr_interval)
            except Exception:
                pass

        self.after(0, self.update_hr_label, hr)

    def update_hr_label(self, hr: str | int):
        self.hr_label.configure(text=f"Heart Rate: {hr} bpm")

    def update_status(self, text):
        self.status.configure(text=text)

    def toggle_recording(self):
        if not self.recording:
            filename = self.filename_entry.get().strip()
            if not filename:
                self.update_status("Enter a filename.")
                return

            path = Path("data") / f"{filename}.csv"

            asyncio.run_coroutine_threadsafe(
                self.start_recording(str(path)),
                self.loop,
            )
        else:
            self.stop_recording()

    async def start_recording(self, path: str):
        try:
            self.file_writer = await FileWriter(path).init()
            self.recording = True
            self.after(0, lambda: self.record_button.configure(text="Stop Recording"))
            self.after(0, self.update_status, "Recording...")
        except Exception as e:
            self.after(0, self.update_status, f"Recording error: {e}")

    def stop_recording(self):
        if self.file_writer:
            self.file_writer.close_file()
            self.file_writer = None

        self.recording = False
        self.record_button.configure(text="Start Recording")
        self.update_status("Recording stopped.")


if __name__ == "__main__":
    app = HeartRateApp()
    app.mainloop()
