import { describe, expect, test } from "bun:test"
import { resolveMedia } from "../../../src/cli/cmd/tui/util/media-resolve"
import { extractVideoFrame } from "../../../src/cli/cmd/tui/util/video-frame"

describe("media-resolve", () => {
  test("resolves data URL media into a local file", async () => {
    const item = {
      id: "media-1",
      sessionID: "s1",
      messageID: "m1",
      partID: "p1",
      tool: "playwright",
      mime: "image/png",
      url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBAp5s1uQAAAAASUVORK5CYII=",
      kind: "image",
      time: 1,
    } as const

    const resolved = await resolveMedia(item)
    expect(resolved.localPath).toBeDefined()
  })

  test("returns error for unsupported URL", async () => {
    const item = {
      id: "media-2",
      sessionID: "s1",
      messageID: "m1",
      partID: "p1",
      tool: "playwright",
      mime: "image/png",
      url: "gopher://example",
      kind: "image",
      time: 1,
    } as const

    const resolved = await resolveMedia(item)
    expect(resolved.error).toBeDefined()
  })

  test("video frame extraction surfaces an error for missing input", async () => {
    const result = await extractVideoFrame("/definitely/missing.mp4", "missing-video")
    expect(result.error).toBeDefined()
  })
})
