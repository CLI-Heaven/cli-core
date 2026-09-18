import { describe, expect, it } from "vitest"
import { parseRateLimitReset, parseRetryAfter, providerWaitMs, retryableStatus, statusToCode } from "./index.js"

const at = (iso: string) => () => new Date(iso)
const now = at("2026-09-19T12:00:00Z")

describe("parseRetryAfter", () => {
  it("reads the seconds form", () => {
    expect(parseRetryAfter("120", now)).toBe(120_000)
  })

  it("reads the HTTP-date form", () => {
    expect(parseRetryAfter("Sat, 19 Sep 2026 12:00:30 GMT", now)).toBe(30_000)
  })

  it("ignores a date already in the past, because a zero wait is a hot loop", () => {
    expect(parseRetryAfter("Sat, 19 Sep 2026 11:59:00 GMT", now)).toBeUndefined()
  })

  it("ignores nonsense and absence alike", () => {
    expect(parseRetryAfter("soon", now)).toBeUndefined()
    expect(parseRetryAfter(null, now)).toBeUndefined()
  })
})

describe("parseRateLimitReset", () => {
  it("reads a Unix timestamp in seconds", () => {
    expect(parseRateLimitReset(String(Date.parse("2026-09-19T12:00:45Z") / 1000), now)).toBe(45_000)
  })

  it("ignores a reset already passed", () => {
    expect(parseRateLimitReset("1", now)).toBeUndefined()
  })
})

describe("providerWaitMs", () => {
  it("lets the provider's own timing beat our backoff", () => {
    const headers = new Headers({ "retry-after": "5" })
    expect(providerWaitMs(headers, now)).toBe(5000)
  })

  it("falls back to the rate-limit reset when there is no Retry-After", () => {
    const headers = new Headers({ "x-ratelimit-reset": String(Date.parse("2026-09-19T12:00:10Z") / 1000) })
    expect(providerWaitMs(headers, now)).toBe(10_000)
  })

  it("says nothing when the provider asked for nothing", () => {
    expect(providerWaitMs(new Headers(), now)).toBeUndefined()
  })
})

describe("classification", () => {
  it("retries only what is worth retrying", () => {
    expect([408, 429, 500, 503].every(retryableStatus)).toBe(true)
    expect([400, 401, 403, 404, 422].some(retryableStatus)).toBe(false)
  })

  it("maps a status onto a code a script can branch on", () => {
    expect(statusToCode(401)).toBe("authentication_error")
    expect(statusToCode(403)).toBe("permission_error")
    expect(statusToCode(429)).toBe("rate_limited")
    expect(statusToCode(503)).toBe("provider_unavailable")
    expect(statusToCode(418)).toBe("provider_error")
  })
})
