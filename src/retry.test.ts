import { describe, expect, it } from "vitest"
import { backoffMs, DEFAULT_RETRY, isTransportFailure } from "./retry.js"

describe("backoffMs", () => {
  it("is full jitter: never more than the exponential ceiling", () => {
    for (const attempt of [1, 2, 3, 4, 5]) {
      const ceiling = Math.min(DEFAULT_RETRY.maxDelayMs, DEFAULT_RETRY.baseDelayMs * 2 ** (attempt - 1))
      expect(backoffMs(attempt, DEFAULT_RETRY, () => 1)).toBeLessThanOrEqual(ceiling)
      expect(backoffMs(attempt, DEFAULT_RETRY, () => 0)).toBe(0)
    }
  })

  it("grows with the attempt, which is the point of backing off", () => {
    const full = (attempt: number) => backoffMs(attempt, DEFAULT_RETRY, () => 1)
    expect(full(2)).toBeGreaterThan(full(1))
    expect(full(3)).toBeGreaterThan(full(2))
  })

  it("stops growing at the cap", () => {
    expect(backoffMs(20, DEFAULT_RETRY, () => 1)).toBe(DEFAULT_RETRY.maxDelayMs)
  })

  it("does not synchronize two clients that failed at the same moment", () => {
    expect(backoffMs(3, DEFAULT_RETRY, () => 0.2)).not.toBe(backoffMs(3, DEFAULT_RETRY, () => 0.9))
  })
})

describe("isTransportFailure", () => {
  it("names the three outcomes where nothing came back", () => {
    expect(isTransportFailure("timeout")).toBe(true)
    expect(isTransportFailure("network_error")).toBe(true)
    expect(isTransportFailure("cancelled")).toBe(true)
  })

  it("does not claim a refusal was a transport problem", () => {
    expect(isTransportFailure("rate_limited")).toBe(false)
    expect(isTransportFailure("validation_error")).toBe(false)
    expect(isTransportFailure("outcome_unknown")).toBe(false)
  })
})
