import path from "node:path";
import noble, { type Characteristic, type Peripheral } from "@stoprocent/noble";
import client from "src/client/index.html";
import { getHRCharacteristic, getHRPeripheral } from "./lib/ble";
import { fileWritingHelper } from "./lib/file";
import { registerShutdownFunction, shutdown } from "./lib/shutdown";
import { json } from "./lib/utils";
import { webSocketHelper, type wsOutgoing } from "./lib/ws";

const main = async () => {
    await noble.waitForPoweredOnAsync();

    let peripheral: Peripheral | null = null;
    let hrCharacteristic: Characteristic | null = null;

    registerShutdownFunction(async () => {
        if (hrCharacteristic) await hrCharacteristic.unsubscribeAsync();
        if (peripheral?.state === "connected") await peripheral.disconnectAsync();
    });

    let isRecording = false;
    let recordingId = "";
    let file: Awaited<ReturnType<typeof filewritingHelper>> | null = null;

    const server = Bun.serve({
        port: 3000,
        development: process.env.NODE_ENV === "development" && {
            hmr: false,
            console: true,
        },

        routes: {
            "/": client,
            "/api/record/start": {
                async POST(request) {
                    if (isRecording) return json({ isRecording, recordingId }, 409);

                    try {
                        const data = await request.json();
                        recordingId = data.id;
                    } catch (error) {
                        console.error("Invalid JSON in request body:\n", error);
                        return json({ message: "Invalid request body" }, 400);
                    }
                    if (!recordingId) return json({ message: "Missing id" }, 400);

                    isRecording = true;

                    file = await fileWritingHelper(path.join("data", `${recordingId}.csv`));

                    return json({ isRecording, recordingId });
                },
            },
            "/api/record/stop": {
                async POST() {
                    if (!isRecording) return json({ message: "No active recording" }, 400);

                    if (file) {
                        await file.end();
                        file = null;
                    }
                    isRecording = false;
                    const stoppedId = recordingId;
                    recordingId = "";

                    return json({ isRecording, recordingId: stoppedId });
                },
            },
            "/api/record/status": {
                GET() {
                    return json({ isRecording: isRecording, recordingId });
                },
            },
        },

        fetch(request) {
            if (server.upgrade(request)) return;
            return json({ status: "Not found" }, 404);
        },

        error(error) {
            console.error(error);
            return json({ status: "Internal Server Error" }, 500);
        },

        websocket: {
            open() {
                console.log("Client connected");
            },
            message(ws, message) {
                try {
                    const data = JSON.parse(message.toString());
                    console.log("Received:", message);
                    if (data.type === "unsubscribe") {
                        if (data.channel === "hr") {
                            ws.unsubscribe("hr");
                            ws.send(
                                JSON.stringify({
                                    channel: "hr",
                                    type: "unsubscribed",
                                    data: null,
                                    timestamp: Date.now(),
                                } satisfies wsOutgoing),
                            );
                            return;
                        }
                    }
                    if (data.type === "subscribe") {
                        if (data.channel === "hr") {
                            ws.subscribe("hr");
                            ws.send(
                                JSON.stringify({
                                    channel: "hr",
                                    type: "subscribed",
                                    data: null,
                                    timestamp: Date.now(),
                                } satisfies wsOutgoing),
                            );
                            ws.send(
                                JSON.stringify({
                                    channel: "hr",
                                    type: "state",
                                    data: {
                                        isHrSensorConnected: peripheral?.state === "connected",
                                        isRecording,
                                        recordingId,
                                    },
                                    timestamp: Date.now(),
                                } satisfies wsOutgoing),
                            );
                            return;
                        }
                    }
                } catch (error) {
                    console.error("Error processing websocket message:", error);
                }
            },
            close(ws) {
                console.log("Client disconnected");
                ws.unsubscribe("hr");
            },
        },
    });

    console.log(`Server running at ${server.url}`);
    registerShutdownFunction(async () => server.stop(true));

    const { publish: wsPublish } = webSocketHelper(server);

    peripheral = await getHRPeripheral({ nameFilter: "Polar" });
    if (!peripheral) return shutdown();
    await peripheral.connectAsync();
    hrCharacteristic = await getHRCharacteristic(peripheral);
    if (!hrCharacteristic) return shutdown();
    await hrCharacteristic.subscribeAsync();

    peripheral.on("disconnect", () => wsPublish("hr", { data: { hrBpm: null } }));

    hrCharacteristic.on("data", async (data) => {
        //ChatGPT funksjon
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

        wsPublish("hr", { data: { hrBpm: heartRate, rrIntervals } });

        if (isRecording && file) await file.writeLine(Date.now(), heartRate);
    });
};

await main().catch(async () => await shutdown());
