import { describe, expect, it } from "vitest"
import { fakeClock } from "./index.js"

describe("fakeClock", () => {
  it("records what was asked for and waits for none of it", async () => {
    const time = fakeClock()

    await time.sleep(250, undefined, "retry")
    await time.sleep(30_000, undefined, "timeout")

    expect(time.waits).toEqual([
      { ms: 250, reason: "retry" },
      { ms: 30_000, reason: "timeout" },
    ])
  })

  it("moves the monotonic clock by exactly what was slept", async () => {
    const time = fakeClock()
    await time.sleep(1000)
    time.advance(500)
    expect(time.clock()).toBe(1500)
  })

  it("refuses a sleep whose signal has already fired", async () => {
    await expect(fakeClock().sleep(10, AbortSignal.abort())).rejects.toMatchObject({ name: "AbortError" })
  })
})
