import noble, { type Characteristic, type Peripheral } from "@stoprocent/noble";
import { registerShutdownFunction } from "./shutdown";

const HR_SERVICE_UUID = "180d";
const HR_MEASUREMENT_CHARACTERISTIC_UUID = "2a37";

await noble.waitForPoweredOnAsync();

export const getHRPeripheral = async ({
    timeoutMs = 20 * 1000,
    nameFilter = "",
}: {
    timeoutMs?: number;
    nameFilter?: string;
} = {}): Promise<Peripheral | null> => {
    const onSigint = async () => {
        await noble.stopScanningAsync();
    };
    const removeShutdownFunction = registerShutdownFunction(onSigint);

    console.log(`Scanning for peripherals (timeout: ${timeoutMs}ms)...`);
    try {
        await noble.startScanningAsync([HR_SERVICE_UUID], false);
        return await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.error("Scanning timed out, no peripheral found");
                resolve(null);
            }, timeoutMs);

            noble.on("discover", (peripheral) => {
                if (peripheral.advertisement.localName?.toLowerCase().includes(nameFilter.toLowerCase())) {
                    console.log(`Found peripheral: ${peripheral.advertisement.localName}, id: ${peripheral.id}`);
                    clearTimeout(timeout);
                    resolve(peripheral);
                }
            });
        });
    } catch (error) {
        console.error("Error scanning for peripherals:\n", error);
    } finally {
        noble.removeAllListeners("discover");
        await noble.stopScanningAsync();
        removeShutdownFunction();
    }
    return null;
};

export const getHRCharacteristic = async (peripheral: Peripheral): Promise<Characteristic | null> => {
    try {
        if (peripheral.state !== "connected") return null;
        const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            [HR_SERVICE_UUID],
            [HR_MEASUREMENT_CHARACTERISTIC_UUID],
        );
        return characteristics[0];
    } catch (error) {
        console.error("Error getting HR characteristic:\n", error);
    }
    return null;
};

// ChatGPT funksjon
export const getHRData = (data: Buffer) => {
    const flags = data.readUInt8(0);

    const hr16 = flags & 0x01;
    const rrPresent = flags & 0x10;

    let offset = 1;

    let heartRate: number;
    if (hr16) {
        heartRate = data.readUInt16LE(offset);
        offset += 2;
    } else {
        heartRate = data.readUInt8(offset);
        offset += 1;
    }

    const energyPresent = flags & 0x08;
    if (energyPresent) offset += 2;

    const rrIntervals: number[] = [];

    if (rrPresent) {
        while (offset + 1 < data.length) {
            const rrRaw = data.readUInt16LE(offset);
            const rrMs = (rrRaw * 1000) / 1024;
            rrIntervals.push(rrMs);
            offset += 2;
        }
    }

    return { heartRate, rrIntervals };
};
