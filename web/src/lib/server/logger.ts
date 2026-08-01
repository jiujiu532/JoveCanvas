type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL = (process.env.VOZEB_PRO_LOG_LEVEL || "info") as LogLevel;
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: LogLevel) {
    return LEVELS[level] >= LEVELS[LOG_LEVEL];
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (!shouldLog(level)) return;
    const payload = JSON.stringify({ level, message, ...meta, timestamp: new Date().toISOString() });
    if (level === "debug") console.debug(payload);
    else if (level === "info") console.info(payload);
    else if (level === "warn") console.warn(payload);
    else console.error(payload);
}

export function toLogError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export const logger = {
    debug(message: string, meta?: Record<string, unknown>) {
        write("debug", message, meta);
    },
    info(message: string, meta?: Record<string, unknown>) {
        write("info", message, meta);
    },
    warn(message: string, meta?: Record<string, unknown>) {
        write("warn", message, meta);
    },
    error(message: string, meta?: Record<string, unknown>) {
        write("error", message, meta);
    },
};
