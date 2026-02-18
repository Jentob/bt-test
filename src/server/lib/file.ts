import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { registerShutdownFunction } from "./shutdown";

export const fileWritingHelper = async (filePath: string) => {
    mkdirSync(dirname(filePath), { recursive: true });
    const recordFile = Bun.file(filePath).writer();
    if (!existsSync(filePath) || Bun.file(filePath).size === 0) await recordFile.write("timestamp,heart_rate_bpm\n");

    const removeShutdownFunction = registerShutdownFunction(async () => {
        await recordFile.end();
    });

    return {
        writeLine: async (timeStamp: number | string, heartRate: number | string) =>
            recordFile.write(`${timeStamp},${heartRate}\n`),

        end: async () => {
            removeShutdownFunction();
            return recordFile.end();
        },
    };
};
