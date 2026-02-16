import { useEffect, useRef, useState } from "react";
import { ThemeProvider } from "./shadcn/components/theme-provider";
import { Button } from "./shadcn/components/ui/button";
import { Card, CardContent } from "./shadcn/components/ui/card";
import { Input } from "./shadcn/components/ui/input";
import { Label } from "./shadcn/components/ui/label";
import { Toaster } from "./shadcn/components/ui/sonner";

export default function App() {
    const ws = useRef<WebSocket>(null as unknown as WebSocket);
    const [wsStatus, setWsStatus] = useState("Disconnected");
    const [hrSensorConnected, setHrSensorConnected] = useState(false);
    const [hrValue, setHrValue] = useState(0);
    const [recording, setRecording] = useState(false);
    const [candidateId, setCandidateId] = useState("");

    useEffect(() => {
        let retryTimeout: ReturnType<typeof setTimeout>;

        const connect = () => {
            setWsStatus("Connecting");
            ws.current = new WebSocket("ws://localhost:3000");

            ws.current.onopen = () => {
                setWsStatus("Connected");
                ws.current.send(JSON.stringify({ type: "subscribe", channel: "hr" }));
            };
            ws.current.onclose = () => {
                setWsStatus("Disconnected");
                setHrSensorConnected(false);
                setHrValue(0);
                retryTimeout = setTimeout(() => connect, 10000);
            };
            ws.current.onerror = () => setWsStatus("Error");
        };
        connect();

        fetch("/record/status")
            .then((res) => res.json())
            .then((data) => {
                setRecording(data.recording);
                setCandidateId(data.id);
            })
            .catch((err) => console.error("Failed to fetch recording status:", err));

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "hr") {
                if (data.value) {
                    setHrValue(data.value);
                    setHrSensorConnected(true);
                } else {
                    setHrValue(0);
                    setHrSensorConnected(false);
                }
            }
        };

        return () => {
            ws.current.close();
            clearTimeout(retryTimeout);
        };
    }, []);

    return (
        <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
            <Toaster />
            <p className="absolute top-0 left-0">
                Websocket Status: {wsStatus} -- HR Sensor Status: {hrSensorConnected ? "Connected" : "Disconnected"} --
                Recording Status: {recording ? "Yes" : "No"}
            </p>
            <main className="min-h-screen flex flex-col items-center justify-center gap-4">
                <Card>
                    <CardContent>
                        <p className="text-8xl font-bold">
                            HR: <span className="w-[3ch] inline-block text-end">{hrValue ?? "-"}</span>
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <div className="flex gap-6 items-end">
                            <div className="grid gap-2">
                                <Label htmlFor="candidate">Candidate ID</Label>
                                <Input
                                    id="candidate"
                                    type="text"
                                    placeholder="Enter candidate ID"
                                    required
                                    disabled={recording}
                                    value={candidateId}
                                    onChange={(e) => setCandidateId(e.target.value)}
                                />
                            </div>
                            <Button
                                type="submit"
                                className="cursor-pointer"
                                variant={recording ? "destructive" : "default"}
                                disabled={!candidateId.trim() || wsStatus !== "Connected" || !hrSensorConnected}
                                onClick={() => {
                                    if (recording) {
                                        fetch("/record/stop", { method: "POST" }).then(
                                            (response) => response.ok && setRecording(false),
                                        );
                                    } else {
                                        fetch("/record/start", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ id: candidateId }),
                                        }).then((response) => {
                                            if (response.ok) {
                                                setRecording(true);
                                            }
                                        });
                                    }
                                }}
                            >
                                {recording ? (
                                    <span className="text-center w-[15ch]">Stop Recording</span>
                                ) : (
                                    "Start Recording"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </ThemeProvider>
    );
}
