import { type ClassValue, clsx } from "clsx";
import { hc } from "hono/client";
import { twMerge } from "tailwind-merge";
import type { HonoType } from "@/main";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const apiClient = hc<HonoType>("http://localhost:3000/").api;

export const title = (s: string) =>
    s
        .split(" ")
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(" ");
