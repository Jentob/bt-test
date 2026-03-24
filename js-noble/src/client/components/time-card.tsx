import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function TimeCard({ time }: { time: number }) {
    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Heart Rate (BPM)</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-8xl font-bold inline-block text-end">{formatTime(time)}</p>
            </CardContent>
        </Card>
    );
}
