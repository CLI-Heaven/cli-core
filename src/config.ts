import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import * as v from "valibot"

/**
 * Atomic, and the directory is locked down before the first write.
 *
 * Atomic because a partial credential file loses **every** profile's secret, not just the one
 * being written, and the window for that is exactly a Ctrl+C mid-write. The directory mode matters
 * as much as the file's: `0o600` on a file inside a world-readable directory is worth little.
 * ⚠ Both modes are ignored on Windows.
 */
export const writeSecurely = (path: string, contents: string, mode: number): void => {
  const dir = dirname(path)
  mkdirSync(dir, { recursive: true, mode: 0o700 })

  const temp = join(dir, `.${Date.now()}-${process.pid}.tmp`)
  writeFileSync(temp, contents, { mode })
  // A rename within one directory is atomic on every platform we target.
  renameSync(temp, path)
}

/**
 * Reads and validates a JSON config. A missing file is not an error — it is a program that has not
 * been configured yet — but a malformed one is, and it says which field and why.
 *
 * The schema belongs to the host: what a profile holds is the one thing no shared package can know.
 */
export const loadConfigFile = <TSchema extends v.GenericSchema>(
  path: string,
  schema: TSchema,
  fallback: () => v.InferOutput<TSchema>,
): v.InferOutput<TSchema> => {
  let text: string
  try {
    text = readFileSync(path, "utf8")
  } catch {
    return fallback()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`${path} is not valid JSON`)
  }

  const result = v.safeParse(schema, parsed)
  if (!result.success) {
    const problems = result.issues.map((issue) => `${v.getDotPath(issue) ?? "(root)"}: ${issue.message}`)
    throw new Error(`${path} is not a valid config:\n  ${problems.join("\n  ")}`)
  }
  return result.output
}

/** Config is not a secret, so it is `0644`; the credential file next to it is not. */
export const saveConfigFile = (path: string, config: unknown): void => {
  writeSecurely(path, `${JSON.stringify(config, null, 2)}\n`, 0o644)
}
