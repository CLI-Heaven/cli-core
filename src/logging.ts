import { createWriteStream } from "node:fs"
import { pino } from "pino"
import type { Logger } from "./logger.js"

/**
 * Field names whose value must never reach a log file. This is the **second** line of defence, not
 * the first: a secret should not be handed to a logger at all. Redaction catches the one that
 * slipped into a nested object nobody thought about.
 */
export const REDACTED_FIELDS = [
  "authorization",
  "Authorization",
  "apiKey",
  "api_key",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "password",
  "secret",
  "verifyCode",
  "phone",
]

export interface FileLogger extends Logger {
  /** Must be awaited before the process exits, or the tail of the file is lost. */
  close(): Promise<void>
}

export interface FileLoggerOptions {
  /** Where the JSON lines go. Omit for a logger that writes nowhere. */
  path?: string
  level?: string
  base?: Record<string, unknown>
  /** Added to `REDACTED_FIELDS` — the names only this program knows about. */
  redact?: string[]
  /**
   * Told once when the file cannot be opened or written; every record after that is dropped.
   * Without it the failure is silent, so a host that promised a log should say it is gone.
   */
  onError?: (error: Error) => void
}

/**
 * Structured records for machines: JSON lines, no ANSI ever, secrets redacted. The terminal is a
 * different concern and goes through the renderer — a spinner frame must never reach a log file,
 * and a log record must never reach stdout.
 */
export const createFileLogger = ({
  path,
  level = "info",
  base = {},
  redact = [],
  onError = () => {},
}: FileLoggerOptions = {}): FileLogger => {
  if (!path) return { ...silent, close: async () => {} }

  // A plain append stream, not a worker transport: logging must not need a second process, and
  // `sync: false` drops the tail of the file when a command exits — which is exactly the failure
  // the log exists to explain.
  const file = createWriteStream(path, { flags: "a" })
  // The open is asynchronous, so a directory removed a moment ago surfaces here as an `error`
  // event — and one with no listener kills the process the log was only meant to describe.
  file.on("error", onError)
  const fields = [...new Set([...REDACTED_FIELDS, ...redact])]
  const paths = fields.flatMap((field) => [field, `*.${field}`, `*.*.${field}`])

  const logger = pino(
    { level, base, redact: { paths, censor: "[redacted]" }, timestamp: pino.stdTimeFunctions.isoTime },
    file,
  )

  return {
    debug: (event, message) => logger.debug(event, message),
    info: (event, message) => logger.info(event, message),
    warn: (event, message) => logger.warn(event, message),
    error: (event, message) => logger.error(event, message),
    close: () =>
      new Promise<void>((resolve) => {
        file.end(() => {
          resolve()
        })
      }),
  }
}

const silent: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}
