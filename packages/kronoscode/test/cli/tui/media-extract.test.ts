import { describe, expect, test } from "bun:test"
import { extractMediaItems } from "../../../src/cli/cmd/tui/util/media-extract"

describe("media-extract", () => {
  test("extracts browser tool image and video attachments only", () => {
    const messages = [
      {
        id: "m1",
        sessionID: "s1",
        role: "assistant",
        time: { created: 10 },
      },
      {
        id: "m2",
        sessionID: "s1",
        role: "assistant",
        time: { created: 11 },
      },
    ] as any

    const partsByMessage = {
      m1: [
        {
          id: "p1",
          type: "tool",
          tool: "browser_screenshot",
          state: {
            status: "completed",
            time: { start: 1, end: 2 },
            attachments: [
              { mime: "image/png", url: "data:image/png;base64,AAA", filename: "screen.png" },
              {
                mime: "video/mp4",
                url: "file:///tmp/demo.mp4",
                filename: "demo.mp4",
                metadata: {
                  title: "Checkout flow",
                  url: "https://example.com/checkout",
                  page_id: "page-7",
                },
              },
              { mime: "application/pdf", url: "file:///tmp/a.pdf", filename: "a.pdf" },
            ],
          },
        },
      ],
      m2: [
        {
          id: "p2",
          type: "tool",
          tool: "bash",
          state: {
            status: "completed",
            time: { start: 1, end: 2 },
            attachments: [{ mime: "image/png", url: "data:image/png;base64,BBB", filename: "skip.png" }],
          },
        },
      ],
    } as any

    const result = extractMediaItems({
      sessionID: "s1",
      messages,
      partsByMessage,
      browserToolPattern: "browser|playwright",
    })

    expect(result).toHaveLength(2)
    expect(result[0]?.mime).toBe("image/png")
    expect(result[1]?.mime).toBe("video/mp4")
    expect(result[1]?.title).toBe("Checkout flow")
    expect(result[1]?.url_hint).toBe("https://example.com/checkout")
    expect(result[1]?.page_id).toBe("page-7")
  })

  test("skips compacted and incomplete tool parts", () => {
    const messages = [{ id: "m1", sessionID: "s1", role: "assistant", time: { created: 10 } }] as any
    const partsByMessage = {
      m1: [
        {
          id: "p1",
          type: "tool",
          tool: "playwright",
          state: {
            status: "running",
            time: { start: 1 },
            attachments: [{ mime: "image/png", url: "data:image/png;base64,AAA" }],
          },
        },
        {
          id: "p2",
          type: "tool",
          tool: "playwright",
          state: {
            status: "completed",
            time: { start: 1, end: 2, compacted: 123 },
            attachments: [{ mime: "image/png", url: "data:image/png;base64,BBB" }],
          },
        },
      ],
    } as any

    const result = extractMediaItems({ sessionID: "s1", messages, partsByMessage })
    expect(result).toHaveLength(0)
  })
})
