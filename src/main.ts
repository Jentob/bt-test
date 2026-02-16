import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import noble, { type Characteristic, type Peripheral } from "@stoprocent/noble";
import client from "src/client/index.html";
import { getHRCharacteristic, getHRPeripheral } from "./lib/bt";
import { registerShutdownFunction, shutdown } from "./lib/shutdown";

let peripheral: Peripheral | null = null;
let hrCharacteristic: Characteristic | null = null;

let isRecording = false;
let recordingId = "";
let recordFile: Bun.FileSink | null = null;

const server = Bun.serve({
    port: 3000,
    routes: {
        "/": client,
        "/connection-status": () =>
            Response.json({ status: peripheral?.state === "connected" ? "connected" : "disconnected" }),
        "/record/start": async (request) => {
            if (request.method !== "POST") return Response.json({ message: "Method not allowed" }, { status: 405 });
            if (isRecording) return Response.json({ message: "Already recording" }, { status: 400 });

            try {
                const data = await request.json();
                recordingId = data.id;
            } catch (error) {
                console.error("Invalid JSON in request body:\n", error);
                return Response.json({ message: "Invalid request body" }, { status: 400 });
            }
            if (!recordingId) return Response.json({ message: "Missing id" }, { status: 400 });

            isRecording = true;

            mkdirSync("data", { recursive: true });
            const filePath = path.join("data", `${recordingId}.csv`);
            recordFile = Bun.file(filePath).writer();
            if (!existsSync(filePath) || Bun.file(filePath).size === 0)
                await recordFile.write("timestamp,heart_rate\n");

            return Response.json({ message: "Recording started", id: recordingId });
        },
        "/record/stop": async (request) => {
            if (request.method !== "POST") return Response.json({ message: "Method not allowed" }, { status: 405 });
            if (!isRecording) return Response.json({ message: "Not recording" }, { status: 400 });

            if (recordFile) {
                await recordFile.end();
                recordFile = null;
            }
            isRecording = false;
            const stoppedId = recordingId;
            recordingId = "";

            return Response.json({ message: "Recording stopped", id: stoppedId });
        },
        "/record/status": async () =>
            Response.json({
                recording: isRecording,
                id: recordingId,
            }),
    },
    fetch(request) {
        if (server.upgrade(request)) return;
        return Response.json({ status: "Not found" }, { status: 404 });
    },
    websocket: {
        open() {
            console.log("Client connected");
        },
        message(ws, message) {
            console.log("Received:", message);
            const data = JSON.parse(message.toString());
            if (data.type === "subscribe" && data.channel === "hr") {
                ws.subscribe("hr");
                return;
            }
        },
        close(ws) {
            console.log("Client disconnected");
            ws.unsubscribe("hr");
        },
    },
});
console.log(`Server running at ${server.url}`);

registerShutdownFunction(async () => {
    server.stop();
    if (hrCharacteristic) await hrCharacteristic.unsubscribeAsync();
    if (peripheral?.state === "connected") await peripheral.disconnectAsync();
});

await noble.waitForPoweredOnAsync();
peripheral = await getHRPeripheral();
if (peripheral) {
    try {
        await peripheral.connectAsync();
        peripheral.on("disconnect", () => server.publish("hr", JSON.stringify({ type: "hr", value: null })));
        hrCharacteristic = await getHRCharacteristic(peripheral);
        if (hrCharacteristic) {
            await hrCharacteristic.subscribeAsync();
            hrCharacteristic.on("data", async (data) => {
                const hr = data.readUInt8(1);
                server.publish("hr", JSON.stringify({ type: "hr", value: hr }));

                if (recordFile && isRecording && recordingId) {
                    await recordFile.write(`${Date.now()},${hr}\n`);
                }
            });
        } else {
            console.error("Heart rate characteristic not found");
        }
    } catch (error) {
        console.error("Error during connection or subscription:\n", error);
        await shutdown();
    }
} else {
    console.error("No heart rate peripheral found");
}
