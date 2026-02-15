import noble, { type Characteristic, type Peripheral } from "@stoprocent/noble";

const HR_SERVICE_UUID = "180d";
const HR_MEASUREMENT_CHARACTERISTIC_UUID = "2a37";
const PERIPHERAL_NAME = "Polar";

const { registerShutdownFunction, shutdown } = (() => {
    const shutdownFunctions = new Set<() => Promise<void> | void>();
    let isShuttingDown = false;
    return {
        registerShutdownFunction: (fn: () => Promise<void> | void) => {
            shutdownFunctions.add(fn);
            return () => shutdownFunctions.delete(fn);
        },
        shutdown: async () => {
            if (isShuttingDown) return;
            isShuttingDown = true;
            console.log("Shutting down...");
            for (const fn of shutdownFunctions) {
                try {
                    await fn();
                } catch (error) {
                    console.error("Error during shutdown function:\n", error);
                    process.exitCode = 1;
                }
            }
            process.exit();
        },
    };
})();

export const getHRPeripheral = async (timeoutMs = 10 * 1000): Promise<Peripheral | null> => {
    await noble.waitForPoweredOnAsync();

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
                if (peripheral.advertisement.localName?.toLowerCase().includes(PERIPHERAL_NAME.toLocaleLowerCase())) {
                    console.log(`Found peripheral: ${peripheral.advertisement.localName}`);
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


const parseHeartRate = (data: Buffer) => {
    const hr = data.readUInt8(1);
    console.log(`Heart Rate: ${hr}`);
};

const main = async () => {
    let peripheral: Peripheral | null = null;
    let hrCharacteristic: Characteristic | null = null;
    const onSigint = async () => {
        if (hrCharacteristic) await hrCharacteristic.unsubscribeAsync();
        if (peripheral?.state === "connected") await peripheral.disconnectAsync();
    };
    registerShutdownFunction(onSigint);

    await noble.waitForPoweredOnAsync();
    peripheral = await getHRPeripheral();

    if (!peripheral) return;

    try {
        await peripheral.connectAsync();
        const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            [HR_SERVICE_UUID],
            [HR_MEASUREMENT_CHARACTERISTIC_UUID],
        );
        hrCharacteristic = characteristics[0];

        await hrCharacteristic.subscribeAsync();
        hrCharacteristic.on("data", parseHeartRate);
    } catch (error) {
        console.error("Error during connection or subscription:\n", error);
        await shutdown();
    }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await main();
