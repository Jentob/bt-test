import noble, { type Characteristic, type Peripheral } from "@stoprocent/noble";
import client from "src/client/index.html";
import { getHRCharacteristic, getHRPeripheral } from "./lib/bt";
import { registerShutdownFunction, shutdown } from "./lib/shutdown";

const server = Bun.serve({
    development: process.env.NODE_ENV === "development",
    port: 3000,
    routes: {
        "/": client,
    },
    fetch(request) {
        if (server.upgrade(request)) return;
        return new Response("Not found", { status: 404 });
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
            ws.send(JSON.stringify({ type: "echo", message }));
        },
        close(ws) {
            console.log("Client disconnected");
            ws.unsubscribe("hr");
        },
    },
});

registerShutdownFunction(async () => server.stop());

console.log(`Server running at ${server.url}`);

const parseHeartRate = (data: Buffer) => {
    const hr = data.readUInt8(1);
    console.log(`Heart Rate: ${hr}`);
    server.publish("hr", JSON.stringify({ type: "hr", value: hr }));
};

await (async () => {
    let peripheral: Peripheral | null = null;
    let hrCharacteristic: Characteristic | null = null;
    const onSigint = async () => {
        if (hrCharacteristic) await hrCharacteristic.unsubscribeAsync();
        if (peripheral?.state === "connected") await peripheral.disconnectAsync();
    };
    registerShutdownFunction(onSigint);

    await noble.waitForPoweredOnAsync();
    peripheral = await getHRPeripheral();

    if (!peripheral) {
        console.error("No heart rate peripheral found");
        return;
    }

    try {
        await peripheral.connectAsync();
        hrCharacteristic = await getHRCharacteristic(peripheral);
        if (!hrCharacteristic) {
            console.error("Heart rate characteristic not found");
            return;
        }
        await hrCharacteristic.subscribeAsync();
        hrCharacteristic.on("data", parseHeartRate);
    } catch (error) {
        console.error("Error during connection or subscription:\n", error);
        await shutdown();
    }
})();
