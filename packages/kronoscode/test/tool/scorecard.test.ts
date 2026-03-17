import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { ToolRegistry } from "../../src/tool/registry"

describe("tool.scorecard", () => {
  test("returns builtin and MCP capability entries with promotion metadata", async () => {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const scorecard = await ToolRegistry.capabilityScorecard()
        expect(scorecard.length).toBeGreaterThan(0)

        const readEntry = scorecard.find((item) => item.id === "read")
        expect(readEntry).toBeDefined()
        expect(readEntry?.source).toBe("builtin")
        expect(readEntry?.promotion_status === "builtin" || readEntry?.promotion_status === "builtin-adjacent").toBe(
          true,
        )
      },
    })
  })
})
