import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { createFileLogger } from "./logging.js"

const logFile = () => join(mkdtempSync(join(tmpdir(), "cli-core-log-")), "events.jsonl")

const written = async (write: (logger: ReturnType<typeof createFileLogger>) => void, redact?: string[]) => {
  const path = logFile()
  const logger = createFileLogger(redact ? { path, redact } : { path })
  write(logger)
  await logger.close()
  return readFileSync(path, "utf8")
}

describe("createFileLogger", () => {
  it("writes one JSON object per line", async () => {
    const text = await written((logger) => {
      logger.info({ event: "connected" })
      logger.warn({ event: "slow" })
    })

    const lines = text.trimEnd().split("\n")
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0] as string).event).toBe("connected")
  })

  it("redacts a secret by field name, however it was handed over", async () => {
    const text = await written((logger) => {
      logger.info({ token: "t0ken", nested: { password: "hunter2" }, deep: { a: { access_token: "leak" } } })
    })

    expect(text).not.toContain("t0ken")
    expect(text).not.toContain("hunter2")
    expect(text).not.toContain("leak")
    expect(text).toContain("[redacted]")
  })

  it("redacts the names this program adds, on top of the defaults", async () => {
    const text = await written((logger) => logger.info({ deviceId: "device-1", token: "t" }), ["deviceId"])
    expect(text).not.toContain("device-1")
  })

  it("keeps a phone number and a verification code out of the file", async () => {
    const text = await written((logger) => logger.info({ phone: "+34600000000", verifyCode: "123456" }))
    expect(text).not.toContain("+34600000000")
    expect(text).not.toContain("123456")
  })

  it("writes no ANSI, because this file is grepped and jq'ed", async () => {
    const text = await written((logger) => logger.error({ event: "failed", reason: "timeout" }))
    expect(text).not.toContain(String.fromCharCode(27))
  })

  it("writes nowhere at all when given no path", async () => {
    const logger = createFileLogger()
    logger.info({ event: "ignored" })
    await expect(logger.close()).resolves.toBeUndefined()
  })
})
