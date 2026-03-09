import type { Dispatch, StateUpdater } from "preact/hooks";
import { toast } from "sonner";
import type { Phase, Task } from "@/main";
import type { RecordingState } from "../app";
import { apiClient } from "../utils";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export default function Form({
	recording,
	setRecording,
	taskOrder,
	setTaskOrder,
	disableSubmit = false,
	phases,
	phasesArray,
}: {
	recording: RecordingState;
	setRecording: Dispatch<StateUpdater<RecordingState>>;
	taskOrder: Task[];
	setTaskOrder: Dispatch<StateUpdater<Task[]>>;
	disableSubmit: boolean;
	phases: Record<Phase, string>;
	phasesArray: Phase[];
}) {
	const square: Task[][] = [];
	for (let i = 0; i < taskOrder.length; i++) {
		const row: Task[] = [];
		for (let j = 0; j < taskOrder.length; j++) {
			row.push(taskOrder[(i + j) % taskOrder.length]);
		}
		square.push(row);
	}

	const startRecording = async ({
		id = recording.recordingId,
		phase = recording.phase,
	}: {
		id?: string;
		phase?: Phase;
	} = {}) => {
		try {
			const response = await apiClient.record.start.$post({
				json: { id, phase },
			});

			if (response.ok) {
				setRecording((p) => ({ ...p, isRecording: true }));
				toast.success(
					`Recording started: ID "${id}", Phase "${phases[phase]}"`,
				);
			} else if (response.status === 409) {
				const data = await response.json();
				setRecording(data);
				toast.error(
					`Recording has already been started: ID "${data.recordingId}", Phase "${phases[data.phase]}"`,
				);
			}
		} catch (error) {
			console.error("Request failed:", error);
			toast.error("An unexpected error occurred.");
		}
	};

	const stopRecording = async () => {
		try {
			const response = await apiClient.record.stop.$post();

			if (response.ok) {
				setRecording((p) => ({ ...p, isRecording: false }));
				toast.success(
					`Recording stopped: ID "${recording.recordingId}", Phase "${phases[recording.phase]}"`,
				);
			}
		} catch (error) {
			console.error("Request failed:", error);
			toast.error("An unexpected error occurred.");
		}
	};

	const onSubmit = async (e: Event) => {
		e.preventDefault();
		if (disableSubmit) return;

		if (recording.isRecording) await stopRecording();
		else await startRecording();
	};

	const changePhase = async (s: number) => {
		const currentIndex = phasesArray.indexOf(recording.phase);
		const newIndex = currentIndex + s;
		await stopRecording();
		setRecording((p) => ({ ...p, phase: phasesArray[newIndex] }));
		await startRecording({ phase: phasesArray[newIndex] });
	};

	const previousPhase = async () => changePhase(-1);
	const nextPhase = async () => changePhase(1);

	return (
		<Card>
			<CardContent>
				<form onSubmit={onSubmit}>
					<div className="flex gap-6 items-end">
						<div className="flex flex-col gap-2">
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
							<Label htmlFor="taskOrder">Task Order</Label>
							<select
								id="taskOrder"
								required
								disabled={recording.isRecording}
								value={String(recording.phase)}
								onChange={(e) =>
									setTaskOrder(square[Number(e.currentTarget.value)])
								}
							>
								{square.map(([key, value]) => (
									<option key={key} value={key}>
										{value}
									</option>
								))}
							</select>
						</div>
						<div className="flex flex-col gap-2">
							<Button
								type="submit"
								variant={recording.isRecording ? "destructive" : "default"}
								disabled={!recording.recordingId.trim() || disableSubmit}
							>
								{recording.isRecording ? (
									<span className="text-center w-[15ch]">Stop Recording</span>
								) : (
									<span>Start Recording</span>
								)}
							</Button>
							<div className="flex gap-2">
								<Button
									type="button"
									variant="secondary"
									onClick={previousPhase}
									disabled={phasesArray.indexOf(recording.phase) === 0}
								>
									Previous Task
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={nextPhase}
									disabled={
										phasesArray.indexOf(recording.phase) ===
										phasesArray.length - 1
									}
								>
									Next Task
								</Button>
							</div>
						</div>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
