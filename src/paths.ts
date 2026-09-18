import { join } from "node:path"
import envPaths from "env-paths"

export interface Paths {
  /** `config.json`, and the credential file when the keyring is unavailable. */
  config: string
  /** Everything the program writes for itself: sessions, run artifacts, databases. */
  state: string
  /** Data that can be deleted without losing anything the user typed. */
  cache: string
}

export interface PathsOptions {
  /** Directory name under the OS convention — the command's name, not the package's. */
  appName: string
  /**
   * Environment variable prefix for the overrides, e.g. `MAX` gives `MAX_CONFIG_DIR`.
   * Defaults to the app name, upper-cased, with anything that is not a letter or digit as `_`.
   */
  prefix?: string
  env?: NodeJS.ProcessEnv
}

/**
 * `env-paths` rather than a hand-rolled `~/.config`, so macOS and Windows land where those systems
 * expect. Each directory is overridable by environment variable, which is what makes a test —
 * and a throwaway profile — possible without touching the real ones.
 */
export const resolvePaths = ({ appName, prefix, env = process.env }: PathsOptions): Paths => {
  const base = envPaths(appName, { suffix: "" })
  const key = (name: string) => `${prefix ?? appName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_${name}`

  return {
    config: env[key("CONFIG_DIR")] ?? base.config,
    state: env[key("STATE_DIR")] ?? base.data,
    cache: env[key("CACHE_DIR")] ?? base.cache,
  }
}

/** Whether any of the three directories came from the environment rather than the OS convention. */
export const pathsAreOverridden = ({ appName, prefix, env = process.env }: PathsOptions): boolean => {
  const stem = prefix ?? appName.toUpperCase().replace(/[^A-Z0-9]/g, "_")
  return ["CONFIG_DIR", "STATE_DIR", "CACHE_DIR"].some((name) => env[`${stem}_${name}`] !== undefined)
}

export const configFilePath = (configDir: string, fileName = "config.json"): string => join(configDir, fileName)
