import { useEffect, useRef, useState } from "preact/hooks";

export function useStopwatch() {
    const [elapsed, setElapsed] = useState(0); // ms
    const [isRunning, setIsRunning] = useState(false);

    const startTimeRef = useRef<number | null>(null);
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        if (isRunning) {
            startTimeRef.current = Date.now() - elapsed;

            intervalRef.current = window.setInterval(() => {
                setElapsed(Date.now() - (startTimeRef.current ?? 0));
            }, 100);
        }

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning]);

    const start = () => setIsRunning(true);
    const stop = () => setIsRunning(false);

    const reset = () => {
        setIsRunning(false);
        setElapsed(0);
    };

    return {
        time: elapsed,
        start,
        stop,
        reset,
        isRunning,
    };
}
