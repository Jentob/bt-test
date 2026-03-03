import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function HrCard({ hrBpm }: { hrBpm: number | null }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Heart Rate (BPM)</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-8xl font-bold w-[3ch] inline-block text-end">{hrBpm ?? "-"}</p>
            </CardContent>
        </Card>
    );
}
