/**
 * Text that came from Braze or from a customer's input file, made safe to display.
 *
 * A campaign name, a catalog title and a user attribute are all edited somewhere we do not
 * control and handed back to us as data. A terminal executes what it is given: `\x1b[2K\x1b[1G`
 * clears the line and returns the cursor, so a campaign name can overwrite output this tool
 * already printed. Braze's own error messages reach a terminal the same way (`SEC-2`).
 *
 * **Machine modes need none of this** — `JSON.stringify` already escapes control characters, and
 * those bytes are a contract with scripts. Only what a person reads goes through here.
 */

/**
 * C0 minus tab and newline, DEL, and C1 — which xterm honours as escapes in its 8-bit form. Then
 * the direction overrides and isolates, which reorder what follows them (`invoice\u202efdp.exe`
 * reads as a PDF), and the invisible zero-width space and direction marks.
 *
 * U+200C and U+200D stay: Persian and Indic text need the non-joiner, and every multi-person emoji
 * is built with the joiner.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the whole point
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069]/g

const LINE_BREAKS = /[\t\n\u2028\u2029]/g

const escaped = (c: string): string => {
  const code = c.charCodeAt(0)
  return code > 0xff ? `\\u${code.toString(16).padStart(4, "0")}` : `\\x${code.toString(16).padStart(2, "0")}`
}

/**
 * Control characters become visible rather than disappearing. A reader has to know the value
 * contained something strange; an audit that silently drops bytes is worse than one that shows
 * them.
 *
 * `\t` and `\n` survive, because a table and a multi-line field are built out of them.
 */
export const visibleControls = (text: string): string => text.replace(CONTROL, escaped)

/**
 * For a value that must stay on one line: a name, a title, a file name, a URL. A newline in a
 * sender's name would otherwise print as a line of its own, indistinguishable from real output.
 */
export const singleLine = (text: string): string => visibleControls(text).replace(LINE_BREAKS, escaped)
