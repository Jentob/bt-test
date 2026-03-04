import type { SetStateAction } from "preact/compat";
import type { Dispatch } from "preact/hooks";
import { toast } from "sonner";
import { phases } from "@/main";
import { apiClient } from "../utils";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export default function Form({
    recording,
    setRecording,
    disableSubmit = false,
}: {
    recording: {
        isRecording: boolean;
        recordingId: string;
        phase: keyof typeof phases;
    };
    setRecording: Dispatch<
        SetStateAction<{
            isRecording: boolean;
            recordingId: string;
            phase: keyof typeof phases;
        }>
    >;
    disableSubmit: boolean;
}) {
    const onSubmit = async (e: Event) => {
        e.preventDefault();
        if (disableSubmit) return;

        try {
            if (recording.isRecording) {
                const response = await apiClient.record.stop.$post();

                if (response.ok) {
                    setRecording((p) => ({ ...p, isRecording: false }));
                    toast.success(`Recording with ID ${recording.recordingId} stopped.`);
                }
            } else {
                const response = await apiClient.record.start.$post({
                    json: { id: recording.recordingId, phase: recording.phase },
                });

                if (response.ok) {
                    setRecording((p) => ({ ...p, isRecording: true }));
                    toast.success(`Recording started with ID "${recording.recordingId}".`);
                } else if (response.status === 409) {
                    const data = await response.json();
                    setRecording(data);
                    toast.error(`Recording has already been started with ID "${data.recordingId}".`);
                }
            }
        } catch (error) {
            console.error("Request failed:", error);
            toast.error("An unexpected error occurred.");
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
                                onChange={(e) =>
                                    setRecording((p) => ({
                                        ...p,
                                        recordingId: e.currentTarget.value,
                                    }))
                                }
                            />
                            <Label htmlFor="phase">Phase</Label>
                            <select
                                id="phase"
                                required
                                disabled={recording.isRecording}
                                value={String(recording.phase)}
                                onChange={(e) =>
                                    setRecording((p) => ({
                                        ...p,
                                        phase: e.currentTarget.value as keyof typeof phases,
                                    }))
                                }
                            >
                                {Object.entries(phases).map(([key, value]) => (
                                    <option key={key} value={key}>
                                        {value}
                                    </option>
                                ))}
                            </select>
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
