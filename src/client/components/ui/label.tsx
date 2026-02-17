import type { ComponentProps } from "preact";

import { cn } from "@/client/lib/utils";

function Label({ className, ...props }: ComponentProps<"label">) {
    return (
        // biome-ignore lint/a11y/noLabelWithoutControl: -
        <label
            data-slot="label"
            className={cn(
                "gap-2 text-sm leading-none font-medium group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed",
                className,
            )}
            {...props}
        />
    );
}

export { Label };
