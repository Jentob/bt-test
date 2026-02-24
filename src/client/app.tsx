import { useEffect, useRef, useState } from "preact/hooks";
import Form from "./components/form";
import { ThemeProvider } from "./components/theme-provider";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Toaster } from "./components/ui/sonner";

export default function App() {
    const ws = useRef<WebSocket>(null as unknown as WebSocket);
    const [wsStatus, setWsStatus] = useState<"Connected" | "Disconnected" | "Connecting" | "Error">("Disconnected");
    const [hrSensor, setHrSensor] = useState({
        isConnected: false,
        hrBpm: null as number | null,
        hrv: null as number | null,
    });
    const [recording, setRecording] = useState({
        isRecording: false,
        recordingId: "",
    });

    useEffect(() => {
        const connect = () => {
            setWsStatus("Connecting");
            ws.current = new WebSocket("ws://localhost:3000");

            ws.current.onopen = () => {
                setWsStatus("Connected");
                ws.current.send(JSON.stringify({ type: "subscribe", channel: "hr" }));
            };
            ws.current.onclose = () => {
                setWsStatus("Disconnected");
                setHrSensor({
                    isConnected: false,
                    hrBpm: null,
                    hrv: null,
                });
            };
            ws.current.onerror = () => setWsStatus("Error");
        };
        connect();

        ws.current.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.channel === "hr") {
                if (message.type === "state") {
                    setHrSensor((p) => ({
                        ...p,
                        isConnected: message.data.isHrSensorConnected,
                    }));
                    setRecording({
                        isRecording: message.data.isRecording,
                        recordingId: message.data.recordingId,
                    });
                }
                if (message.type === "event") {
                    if (message.data.hrBpm !== null) {
                        setHrSensor({
                            isConnected: true,
                            hrBpm: message.data.hrBpm,
                            hrv: message.data.rmssd,
                        });
                    } else {
                        setHrSensor({
                            isConnected: false,
                            hrBpm: null,
                            hrv: null,
                        });
                    }
                }
            }
        };

        return () => {
            ws.current.close();
        };
    }, []);

    return (
        <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
            <Toaster />
            <p className="absolute top-0 left-0">
                Websocket Status: {wsStatus} -- HR Sensor Status: {hrSensor.isConnected ? "Connected" : "Disconnected"}{" "}
                -- Recording Status: {recording.isRecording ? "Yes" : "No"} -- Participant ID:{" "}
                {recording.recordingId || "None"}
            </p>
            <main className="min-h-screen flex flex-col items-center justify-center gap-4">
                <div className="flex gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Heart Rate (BPM)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-8xl font-bold w-[3ch] inline-block text-end">{hrSensor.hrBpm ?? "-"}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Heart Rate Variability</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-8xl font-bold w-[3ch] inline-block text-end">{hrSensor.hrv ?? "-"}</p>
                        </CardContent>
                    </Card>
                </div>
                <Form
                    recording={recording}
                    setRecording={setRecording}
                    disableSubmit={wsStatus !== "Connected" || !hrSensor.isConnected}
                />
            </main>
        </ThemeProvider>
    );
}
