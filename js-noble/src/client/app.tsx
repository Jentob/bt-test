import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Phase, states, Task, tasks } from "@/main";
import Form from "./components/form";
import { HrCard } from "./components/hr-card";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";
import { title } from "./utils";
import { useStopwatch } from "./hooks/stopwatch";
import { TimeCard } from "./components/time-card";

export type RecordingState = {
    isRecording: boolean;
    recordingId: string;
    phase: Phase;
};

export default function App() {
    const ws = useRef<WebSocket>(null as unknown as WebSocket);
    const [wsStatus, setWsStatus] = useState<"Connected" | "Disconnected" | "Connecting" | "Error">("Disconnected");
    const [hrSensor, setHrSensor] = useState({
        isConnected: false,
        hrBpm: null as number | null,
    });
    const [recording, setRecording] = useState<RecordingState>({
        isRecording: false,
        recordingId: "",
        phase: "calibration",
    });
    const [taskOrder, setTaskOrder] = useState<Task[]>([
        "personal",
        "curated",
        "breathing",
        "natural",
    ] satisfies typeof tasks);
    const phases: Record<Phase, string> = useMemo(
        () => ({
            calibration: "Calibration",
            ...(Object.fromEntries(
                taskOrder.flatMap((m) =>
                    (["stressor", "anticipatory", "relaxation"] satisfies typeof states).map((s) => [
                        `${m}(${s})` as Phase,
                        `${title(m)} - ${title(s)}`,
                    ]),
                ),
            ) as Record<Exclude<Phase, "calibration">, string>),
        }),
        [taskOrder],
    );
    const phasesArray = useMemo(() => Object.keys(phases) as Phase[], [phases]);
    const time = useStopwatch();

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
                    setRecording((p) => ({
                        ...p,
                        isRecording: message.data.isRecording,
                        recordingId: message.data.recordingId,
                        phase: message.data.phase,
                    }));
                }
                if (message.type === "event") {
                    if (message.data.hrBpm !== null) {
                        setHrSensor({
                            isConnected: true,
                            hrBpm: message.data.hrBpm,
                        });
                    } else {
                        setHrSensor({
                            isConnected: false,
                            hrBpm: null,
                        });
                    }
                }
            }
        };

        return () => {
            ws.current.close();
        };
    }, []);

    const memForm = useMemo(
        () => (
            <Form
                recording={recording}
                setRecording={setRecording}
                taskOrder={taskOrder}
                setTaskOrder={setTaskOrder}
                disableSubmit={wsStatus !== "Connected" || !hrSensor.isConnected}
                phases={phases}
                phasesArray={phasesArray}
            />
        ),
        [recording, setRecording, taskOrder, setTaskOrder, wsStatus, hrSensor.isConnected, phases, phasesArray],
    );

    return (
        <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
            <Toaster />
            <p className="absolute top-0 left-0">
                Websocket Status: {wsStatus} -- HR Sensor Status: {hrSensor.isConnected ? "Connected" : "Disconnected"}
            </p>
            <main className="min-h-screen flex flex-col items-center justify-center gap-4">
                <div className="flex gap-4">
                    <HrCard hrBpm={hrSensor.hrBpm} />
                    <TimeCard time={time.time} />
                </div>
                {memForm}
                <p className="text-center text-xl">Current phase: {phases[recording.phase]}</p>
                <p className="text-center text-l text-muted-foreground">
                    Next phase: {phases[phasesArray[phasesArray.indexOf(recording.phase) + 1]] || "None"}
                </p>
            </main>
        </ThemeProvider>
    );
}
