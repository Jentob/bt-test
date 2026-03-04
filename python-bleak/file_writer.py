import time
from io import TextIOWrapper
from pathlib import Path
from typing import Callable, NoReturn, Optional

WriteLineFunction = Callable[[int | str, float, int | str], None | NoReturn]
CloseFunction = Callable[[], None]


class FileWriter:
    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        self.file: Optional[TextIOWrapper] = None
        self.closed = False

    async def init(self) -> "FileWriter":
        if self.closed:
            raise RuntimeError("Cannot initialize a closed FileWriter.")

        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self.file = open(self.file_path, "a", encoding="utf-8", buffering=1)

        if self.file_path.stat().st_size == 0:
            self.file.write("timestamp,heart_rate_bpm,rr_interval\n")

        return self

    def write_line(
        self,
        heart_rate: int | str,
        rr_interval: int | str,
        timestamp: Optional[int | str] = None,
    ) -> None:
        if self.closed:
            raise RuntimeError("Cannot write to a closed FileWriter.")

        if timestamp is None:
            timestamp = int(time.time())

        if self.file:
            self.file.write(f"{timestamp},{heart_rate},{rr_interval}\n")
        else:
            raise RuntimeError("File is not initialized.")

    def close_file(self) -> None:
        if self.closed and self.file is None:
            return
        self.closed = True

        if self.file:
            self.file.close()
            self.file = None

    async def __aenter__(self) -> "FileWriter":
        return await self.init()

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close_file()
