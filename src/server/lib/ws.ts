export type wsIncoming<T = unknown> = {
    type: "event" | "action" | "subscribe" | "unsubscribe";
    channel: string;
    event?: string;
    data?: T;
};

export type wsOutgoing<T = unknown> = {
    channel: string;
    type: "event" | "subscribed" | "unsubscribed" | "error" | "snapshot";
    data: T;
    timestamp: number | null;
};

export function webSocketHelper(server: Bun.Server<undefined>) {
    function publish<T>(
        channel: string,
        {
            type = "event",
            data,
            timestamp = Date.now(),
        }: { type?: wsOutgoing<T>["type"]; data: T; timestamp?: number | null },
    ) {
        server.publish(channel, JSON.stringify({ channel, type, data, timestamp } satisfies wsOutgoing<T>));
    }
    return { publish };
}
