import type { SetStateAction } from "preact/compat";
import type { Dispatch } from "preact/hooks";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export default function Form({
    recording,
    setRecording,
    disableSubmit = false,
}: {
    recording: { isRecording: boolean; recordingId: string };
    setRecording: Dispatch<SetStateAction<{ isRecording: boolean; recordingId: string }>>;
    disableSubmit: boolean;
}) {
    const onSubmit = (e: Event) => {
        e.preventDefault();
        if (disableSubmit) return;
        if (recording.isRecording) {
            fetch("/api/record/stop", { method: "POST" }).then((response) => {
                if (response.ok) {
                    setRecording((p) => ({ ...p, isRecording: false }));
                    toast.success(`Recording with ID ${recording.recordingId} stopped.`);
                }
            });
        } else {
            fetch("/api/record/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: recording.recordingId }),
            }).then((response) => {
                if (response.ok) {
                    setRecording((p) => ({ ...p, isRecording: true }));
                    toast.success(`Recording started with ID ${recording.recordingId}.`);
                } else if (response.status === 409) {
                    response.json().then((data) => {
                        setRecording(data);
                        toast.error(`Recording has already been started with ID ${data.recordingId}.`);
                    });
                }
            });
        }
    };

    return (
        <Card>
            <CardContent>
                <form onSubmit={onSubmit}>
                    <div className="flex gap-6 items-end">
                        <div className="grid gap-2">
                            <Label htmlFor="participant">Participant ID</Label>
                            <Input
                                id="participant"
                                type="text"
                                placeholder="Enter participant ID"
                                required
                                disabled={recording.isRecording}
                                value={recording.recordingId}
                                onChange={(e) => setRecording((p) => ({ ...p, recordingId: e.currentTarget.value }))}
                            />
                        </div>
                        <Button
                            type="submit"
                            className="cursor-pointer"
                            variant={recording.isRecording ? "destructive" : "default"}
                            disabled={!recording.recordingId.trim() || disableSubmit}
                        >
                            {recording.isRecording ? (
                                <span className="text-center w-[15ch]">Stop Recording</span>
                            ) : (
                                <span>Start Recording</span>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
