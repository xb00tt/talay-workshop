/**
 * Logger utility — wraps console in development, ready for Sentry in production.
 * Never use console.log/warn directly in production code.
 */

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, extra?: unknown) {
  if (process.env.NODE_ENV === "production") {
    // TODO: wire to Sentry when @sentry/nextjs is configured
    // Sentry.captureMessage(message, level);
    return;
  }
  const prefix = `[talay:${level}]`;
  if (level === "error") console.error(prefix, message, extra ?? "");
  else if (level === "warn") console.warn(prefix, message, extra ?? "");
  else console.log(prefix, message, extra ?? "");
}

export const logger = {
  info: (message: string, extra?: unknown) => log("info", message, extra),
  warn: (message: string, extra?: unknown) => log("warn", message, extra),
  error: (message: string, extra?: unknown) => log("error", message, extra),
};
