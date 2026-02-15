export const { registerShutdownFunction, shutdown } = (() => {
    const shutdownFunctions = new Set<() => Promise<void> | void>();
    let isShuttingDown = false;
    return {
        registerShutdownFunction: (fn: () => Promise<void> | void) => {
            shutdownFunctions.add(fn);
            return () => shutdownFunctions.delete(fn);
        },
        shutdown: async () => {
            if (isShuttingDown) return;
            isShuttingDown = true;
            console.log("Shutting down...");
            for (const fn of shutdownFunctions) {
                try {
                    await fn();
                } catch (error) {
                    console.error("Error during shutdown function:\n", error);
                    process.exitCode = 1;
                }
            }
            process.exit();
        },
    };
})();

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);