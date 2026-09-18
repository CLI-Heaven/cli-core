import { describe, expect, it } from "vitest"
import { captureStreams } from "./streams.js"

describe("captureStreams", () => {
  it("keeps the two halves apart", () => {
    const streams = captureStreams()

    streams.data('{"ok":true}')
    streams.diagnostic("connecting")
    streams.progress?.("3 of 10")

    expect(streams.stdout).toEqual(['{"ok":true}'])
    expect(streams.stderr).toEqual(["connecting", "3 of 10"])
  })

  it("puts progress on stderr, which is what stops it breaking machine output", () => {
    const streams = captureStreams()
    streams.progress?.("working")
    expect(streams.stdout).toEqual([])
  })
})
