import { describe, expect, test } from "bun:test"

describe("mcp policy", () => {
  test("defaults to wildcard allow-all when MCP_ALLOWED_SERVERS is unset", async () => {
    const previous = process.env.MCP_ALLOWED_SERVERS
    try {
      delete process.env.MCP_ALLOWED_SERVERS
      const mod = await import(`../../src/mcp/policy?cacheBust=${Date.now()}`)
      expect(mod.MCP_POLICY_ALLOWED_SET.has("*")).toBe(true)
      expect(mod.isMcpPolicyAllowed("github")).toBe(true)
      expect(mod.isMcpPolicyAllowed("custom-mcp")).toBe(true)
    } finally {
      if (previous === undefined) {
        delete process.env.MCP_ALLOWED_SERVERS
      } else {
        process.env.MCP_ALLOWED_SERVERS = previous
      }
    }
  })
})
