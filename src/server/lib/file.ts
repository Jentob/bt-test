import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { registerShutdownFunction } from "./shutdown";

export async function filewritingHelper(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    const recordFile = Bun.file(filePath).writer();
    if (!existsSync(filePath) || Bun.file(filePath).size === 0) await recordFile.write("timestamp,heart_rate\n");

    const removeShutdownFunction = registerShutdownFunction(async () => {
        await recordFile.end();
    });

    const writeLine = async (timeStamp: number | string, heartRate: number | string) =>
        recordFile.write(`${timeStamp},${heartRate}\n`);

    const end = async () => {
        removeShutdownFunction();
        return recordFile.end();
    };

    return { writeLine, end };
}
