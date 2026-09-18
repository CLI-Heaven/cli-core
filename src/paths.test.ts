import { describe, expect, it } from "vitest"
import { pathsAreOverridden, resolvePaths } from "./paths.js"

describe("resolvePaths", () => {
  it("derives the environment variable names from the app name", () => {
    const paths = resolvePaths({ appName: "max-cli", env: { MAX_CLI_CONFIG_DIR: "/tmp/cfg" } })
    expect(paths.config).toBe("/tmp/cfg")
  })

  it("takes an explicit prefix when the app name makes an awkward variable", () => {
    const paths = resolvePaths({ appName: "max-cli", prefix: "MAX", env: { MAX_STATE_DIR: "/tmp/state" } })
    expect(paths.state).toBe("/tmp/state")
  })

  it("falls back to the OS convention, and the three directories differ", () => {
    const paths = resolvePaths({ appName: "max-cli", env: {} })
    expect(paths.config).toContain("max-cli")
    expect(new Set([paths.config, paths.state, paths.cache]).size).toBe(3)
  })

  it("reports whether anything was overridden, which is what scopes the keyring", () => {
    expect(pathsAreOverridden({ appName: "max-cli", env: {} })).toBe(false)
    expect(pathsAreOverridden({ appName: "max-cli", env: { MAX_CLI_CACHE_DIR: "/tmp/c" } })).toBe(true)
  })
})
