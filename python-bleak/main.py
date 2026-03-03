#!/usr/bin/env python3
import asyncio
import signal
import sys
from typing import Optional, Callable, List
from bleak import BleakClient, BleakScanner
from bleak.exc import BleakError

HR_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb"
HR_MEASUREMENT_UUID = "00002a37-0000-1000-8000-00805f9b34fb"

client: Optional[BleakClient] = None
shutdown_event: asyncio.Event = asyncio.Event()
on_hr_data_callback: Optional[Callable[[int, List[float]], None]] = None


def get_hr_data(data: bytes) -> tuple[int, List[float]]:
    """ChatGPT funksjon"""
    flags = data[0]
    hr_16bit = flags & 0x01
    energy_present = flags & 0x08
    rr_present = flags & 0x10

    offset = 1
    if hr_16bit:
        heart_rate = int.from_bytes(data[offset:offset+2], "little")
        offset += 2
    else:
        heart_rate = data[offset]
        offset += 1

    if energy_present:
        offset += 2

    rr_intervals: List[float] = []
    if rr_present:
        while offset + 1 < len(data):
            rr_raw = int.from_bytes(data[offset:offset+2], "little")
            rr_ms = (rr_raw * 1000) / 1024
            rr_intervals.append(round(rr_ms, 2))
            offset += 2

    return heart_rate, rr_intervals


async def notify_hr_handler(sender: int, data: bytes):
    try:
        heart_rate, rr_intervals = get_hr_data(data)
        if on_hr_data_callback:
            on_hr_data_callback(heart_rate, rr_intervals)
        print(f"Heart Rate: {heart_rate} BPM | RR Intervals: {rr_intervals} ms")
    except Exception as e:
        print(f"Error parsing HR data: {e}")


async def find_polar_device(timeout: float = 20.0) -> Optional[str]:
    print(f"Scanning for Polar devices (timeout: {timeout}s)...")

    def filter_polar(device, adv):
        name = device.name or ""
        return "polar" in name.lower()

    try:
        device = await BleakScanner.find_device_by_filter(filter_polar, timeout=timeout)
        if device:
            print(f"Found: {device.name} [{device.address}]")
            return device.address
        else:
            print("No Polar device found during scan.")
    except Exception as e:
        print(f"Error during scanning: {e}")
    return None


async def connect_and_stream_hr(address: str) -> bool:
    global client

    client = BleakClient(address)

    def on_disconnect(client):
        print("HR Sensor disconnected!")
        if on_hr_data_callback:
            on_hr_data_callback(None, [])
        shutdown_event.set()  # Trigger shutdown

    client.set_disconnected_callback(on_disconnect)

    try:
        await client.connect()
        print(f"Connected to {address}")

        if not client.is_connected:
            print("Failed to connect.")
            return False

        # Discover services and characteristics
        # Bleak allows direct UUID access without explicit discovery
        await client.start_notify(HR_MEASUREMENT_UUID, notify_hr_handler)
        print("Subscribed to Heart Rate Measurement characteristic.")

        # Keep connection alive until shutdown
        await shutdown_event.wait()
        return True

    except BleakError as e:
        print(f"Bleak error: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False
    finally:
        await client.disconnect()
        print("Disconnected and cleaned up.")


def setup_signal_handlers():
    """
    Register signal handlers for graceful shutdown.
    """
    def signal_handler():
        print("\nShutting down...")
        shutdown_event.set()

    signal.signal(signal.SIGINT, lambda s, f: signal_handler())
    signal.signal(signal.SIGTERM, lambda s, f: signal_handler())


# Example callback function to simulate `wsPublish`
def ws_publish_hr(hr_bpm: Optional[int], rr_intervals: Optional[List[float]] = None):
    if rr_intervals is None:
        rr_intervals = []
    status = "null" if hr_bpm is None else f"{hr_bpm} BPM"
    print(f"wsPublish('hr', {{ hrBpm: {status}, rrIntervals: {rr_intervals} }})")


async def main():
    global on_hr_data_callback

    # Set your desired callback
    on_hr_data_callback = lambda hr, rr: ws_publish_hr(hr, rr)

    setup_signal_handlers()

    device_address = await find_polar_device(timeout=20.0)
    if not device_address:
        print("No device found. Exiting.")
        return 1

    success = await connect_and_stream_hr(device_address)
    return 0 if success else 1


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)