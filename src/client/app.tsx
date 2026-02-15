import { useEffect, useRef, useState } from "react";
import { Button } from "./shadcn/components/ui/button";
import { Card, CardContent } from "./shadcn/components/ui/card";
import { Input } from "./shadcn/components/ui/input";
import { Label } from "./shadcn/components/ui/label";

export default function App() {
    const ws = useRef<WebSocket | null>(null);
    const [messages, setMessages] = useState<string[]>([]);
    const [input, setInput] = useState("");

    useEffect(() => {
        ws.current = new WebSocket("ws://localhost:3000/hr");

        ws.current.onopen = () => {
            console.log("Connected to WS server");
        };

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setMessages((prev) => [...prev, JSON.stringify(data)]);
        };

        ws.current.onclose = () => {
            console.log("Disconnected");
        };

        return () => {
            ws.current?.close();
        };
    }, []);

    const sendMessage = () => {
        ws.current?.send(input);
        setInput("");
    };

    return (
        <div>
            <h1>WebSocket Test</h1>

            <input value={input} onChange={(e) => setInput(e.target.value)} />
            <button type="button" onClick={sendMessage}>
                Send
            </button>

            <ul>
                {messages.map((m, i) => (
                    <li key={i}>{m}</li>
                ))}
            </ul>
        </div>
    );
}
/*
export default function App() {
    const ws = useRef<WebSocket | null>(null);

    return (
        <main className="min-h-screen flex flex-col items-center justify-center gap-8">
            <section>
                <Card>
                    <CardContent>
                        <p className="text-8xl font-bold">HR: 67</p>
                    </CardContent>
                </Card>
            </section>
            <section>
                <Card>
                    <CardContent>
                        <form>
                            <div className="flex flex-col gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" placeholder="m@example.com" required />
                                </div>
                                <div className="grid gap-2">
                                    <div className="flex items-center">
                                        <Label htmlFor="password">Password</Label>
                                        <a
                                            href="#"
                                            className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                                        >
                                            Forgot your password?
                                        </a>
                                    </div>
                                    <Input id="password" type="password" required />
                                </div>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}
*/
