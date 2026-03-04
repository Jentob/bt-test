import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { registerShutdownFunction } from "./shutdown";

export const fileWritingHelper = async (filePath: string) => {
    mkdirSync(dirname(filePath), { recursive: true });

    const file = Bun.file(filePath);
    const recordFile = file.writer();
    let writerClosed = false;

    if (!(await file.exists()) || file.size === 0) await recordFile.write("timestamp,heart_rate_bpm,rr_interval\n");

    const removeShutdownFunction = registerShutdownFunction(async () => {
        await recordFile.end();
    });

    return {
        writeLine: async (heartRate: number | string, rrInterval: number, timeStamp: number | string = Date.now()) => {
            if (writerClosed) throw new Error("Cannot write to file, it has already been closed.");
            recordFile.write(`${timeStamp},${heartRate},${rrInterval}\n`);
        },
        end: async () => {
            if (writerClosed) return;
            writerClosed = true;
            removeShutdownFunction();
            return recordFile.end();
        },
    };
};
