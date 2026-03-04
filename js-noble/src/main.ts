import path from "node:path";
import { sValidator } from "@hono/standard-validator";
import noble, { type Characteristic, type Peripheral } from "@stoprocent/noble";
import { Hono } from "hono";
import client from "src/client/index.html";
import { z } from "zod";
import { getHRCharacteristic, getHRData, getHRPeripheral } from "./lib/ble";
import { fileWritingHelper } from "./lib/file";
import { registerShutdownFunction, shutdown } from "./lib/shutdown";
import { type WsOutgoing, webSocketHelper } from "./lib/ws";

await noble.waitForPoweredOnAsync();

let peripheral: Peripheral | null = null;
let hrCharacteristic: Characteristic | null = null;

registerShutdownFunction(async () => {
    if (hrCharacteristic) await hrCharacteristic.unsubscribeAsync();
    if (peripheral?.state === "connected") await peripheral.disconnectAsync();
});

export const phases = {
    calibration: "Calibration",
    "stresser(news)": "Stresser (News)",
    "relaxation(news)": "Relaxation (News)",
    "stresser(tiktok)": "Stresser (TikTok)",
    "relaxation(tiktok)": "Relaxation (TikTok)",
    "stresser(breathing)": "Stresser (Breathing)",
    "relaxation(breathing)": "Relaxation (Breathing)",
} as const;

let isRecording = false;
let recordingId = "";
let phase: keyof typeof phases = "calibration";
let file: Awaited<ReturnType<typeof fileWritingHelper>> | null = null;

const recordApi = new Hono()
    .post(
        "/start",
        sValidator(
            "json",
            z.object({
                id: z.string(),
                phase: z.enum(Object.keys(phases) as (keyof typeof phases)[]),
            }),
        ),
        async (c) => {
            if (isRecording) return c.json({ isRecording, recordingId, phase }, 409);
            ({ id: recordingId, phase } = c.req.valid("json"));
            isRecording = true;
            file = await fileWritingHelper(path.join("data", `${Date.now()}-${recordingId}-${phase}.csv`));

            return c.json({ isRecording, recordingId, phase });
        },
    )
    .post("/stop", async (c) => {
        if (!isRecording) return c.json({ message: "No active recording" }, 400);

        if (file) {
            await file.end();
            file = null;
        }
        isRecording = false;
        const stoppedId = recordingId;
        recordingId = "";
        phase = "calibration";

        return c.json({ isRecording, recordingId: stoppedId, phase });
    })
    .post("/status", async (c) => c.json({ isRecording, recordingId, phase }));

const app = new Hono()
    .onError((err, c) => {
        console.error("Error in route:", err);
        return c.json({ message: "Internal Server Error" }, 500);
    })
    .notFound((c) => c.json({ message: "Not Found" }, 404))
    .route("/api/record", recordApi);

export type HonoType = typeof app;

const server = Bun.serve({
    port: 3000,
    development: process.env.NODE_ENV === "development" && {
        hmr: false,
        console: true,
    },
    routes: {
        "/": client,
    },
    fetch: app.fetch,
    error(error) {
        console.error(error);
        return Response.json({ message: "Internal Server Error" }, { status: 500 });
    },
    websocket: {
        open: () => console.log("Client connected"),
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
                            } satisfies WsOutgoing),
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
                            } satisfies WsOutgoing),
                        );
                        ws.send(
                            JSON.stringify({
                                channel: "hr",
                                type: "state",
                                data: {
                                    isHrSensorConnected: peripheral?.state === "connected",
                                    isRecording,
                                    recordingId,
                                    phase,
                                },
                                timestamp: Date.now(),
                            } satisfies WsOutgoing),
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
if (!peripheral) throw await shutdown();
await peripheral.connectAsync();
hrCharacteristic = await getHRCharacteristic(peripheral);
if (!hrCharacteristic) throw await shutdown();
await hrCharacteristic.subscribeAsync();

peripheral.on("disconnect", () => {
    wsPublish("hr", { hrBpm: null });
    console.error("HR Sensor disconnected!");
});

hrCharacteristic.on("data", async (data) => {
    const { heartRate, rrIntervals } = getHRData(data);

    wsPublish("hr", { hrBpm: heartRate });

    if (isRecording && file) {
        for (const rrInterval of rrIntervals) {
            await file.writeLine(heartRate, rrInterval);
        }
    }
});
