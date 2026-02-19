export type WsIncoming<T = unknown> = {
    type: "event" | "action" | "subscribe" | "unsubscribe";
    channel: string;
    event?: string;
    data?: T;
};

export type WsOutgoing<T = unknown> = {
    channel: string;
    type: "event" | "subscribed" | "unsubscribed" | "error" | "state";
    data: T;
    timestamp: number | null;
};

export const webSocketHelper = (server: Bun.Server<undefined>) => {
    return {
        publish: <T>(
            channel: WsOutgoing<T>["channel"],
            data: WsOutgoing<T>["data"],
            type: WsOutgoing<T>["type"] = "event",
            timestamp: WsOutgoing<T>["timestamp"] = Date.now(),
        ) => {
            server.publish(channel, JSON.stringify({ channel, type, data, timestamp } satisfies WsOutgoing<T>));
        },
    };
};
