import { describe, expect, it } from "vitest"
import { monotonic, realSleep, wallClock } from "./time.js"

describe("realSleep", () => {
  it("resolves after the time asked for", async () => {
    const before = monotonic()
    await realSleep(5)
    expect(monotonic() - before).toBeGreaterThanOrEqual(1)
  })

  it("rejects with an AbortError when the signal fires first", async () => {
    const controller = new AbortController()
    const sleeping = realSleep(10_000, controller.signal)
    controller.abort()
    await expect(sleeping).rejects.toMatchObject({ name: "AbortError" })
  })

  it("rejects immediately when the signal has already fired", async () => {
    await expect(realSleep(1, AbortSignal.abort())).rejects.toMatchObject({ name: "AbortError" })
  })
})

describe("the two clocks", () => {
  it("are different kinds of number", () => {
    expect(typeof monotonic()).toBe("number")
    expect(wallClock()).toBeInstanceOf(Date)
  })
})
