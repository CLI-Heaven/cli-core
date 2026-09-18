import type { ErrorCode } from "./errors.js"

export interface RetryConfig {
  /** Attempts after the first. One means two attempts in total. */
  retries: number
  baseDelayMs: number
  maxDelayMs: number
  /** Beyond this we stop waiting and hand back a structured error instead of blocking. */
  maxRetryAfterMs: number
}

export const DEFAULT_RETRY: RetryConfig = {
  retries: 1,
  baseDelayMs: 250,
  maxDelayMs: 10_000,
  maxRetryAfterMs: 30_000,
}

/**
 * Full jitter: the wait is uniform over `[0, min(cap, base · 2^n))`. Picking the exponential value
 * itself synchronizes every client that failed at the same moment, which is the stampede the
 * backoff exists to avoid.
 *
 * `attempt` is the attempt that just failed, counting from 1.
 */
export const backoffMs = (attempt: number, config: RetryConfig, random: () => number): number => {
  const ceiling = Math.min(config.maxDelayMs, config.baseDelayMs * 2 ** (attempt - 1))
  return Math.round(random() * ceiling)
}

/**
 * The three outcomes where nothing came back, and so there is nothing to classify.
 *
 * **This says the attempt failed without an answer — never that the operation is safe to repeat.**
 * A request that died after leaving may well have been carried out, which is why a write gets
 * `outcome_unknown` rather than a retry.
 */
export const isTransportFailure = (code: ErrorCode): boolean =>
  code === "timeout" || code === "network_error" || code === "cancelled"
