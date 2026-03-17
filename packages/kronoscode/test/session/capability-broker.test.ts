import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { CapabilityBroker } from "../../src/session/capability-broker"

describe("session.capability-broker", () => {
  test("routes browser tasks to stage1 builtin path", async () => {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const decision = CapabilityBroker.decide({
          sessionID: "session-test",
          agent: {
            name: "build",
            mode: "primary",
            permission: [],
            options: {},
          } as any,
          messages: [
            {
              info: { role: "user" },
              parts: [{ type: "text", text: "Navigate the browser and click the submit button" }],
            } as any,
          ],
          capabilities: [
            {
              id: "browser_navigate",
              connector: "browser",
              risk_level: "medium",
              interactive: true,
              fallback: [],
            },
          ],
          mcpStatus: {},
        })

        expect(decision.taskClass).toBe("browser")
        expect(decision.stage).toBe("stage1_builtin_only")
        expect(decision.selectedRuntimeMode).toBe("browseros")
        expect(decision.eligibleFamilies).toContain("builtin")
        expect(decision.eligibleFamilies).not.toContain("mcp-approved")
      },
    })
  })

  test("prefers ghost-os in stage2 for native macOS tasks", async () => {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const decision = CapabilityBroker.decide({
          sessionID: "session-test",
          agent: {
            name: "build",
            mode: "primary",
            permission: [],
            options: {},
            requiredMcp: ["ghost-os"],
          } as any,
          messages: [
            {
              info: { role: "user" },
              parts: [{ type: "text", text: "Use macOS native app controls in Finder" }],
            } as any,
          ],
          capabilities: [
            {
              id: "read",
              connector: "core",
              risk_level: "medium",
              interactive: false,
              fallback: [],
            },
          ],
          mcpStatus: {
            "ghost-os": { status: "connected" },
          },
        })

        expect(decision.taskClass).toBe("native-macos")
        expect(decision.stage).toBe("stage2_builtin_adjacent")
        expect(decision.selectedRuntimeMode).toBe("ghost-os")
        expect(decision.selectedMcpServers).toContain("ghost-os")
      },
    })
  })

  test("records and returns trace entries per session", async () => {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const decision = CapabilityBroker.decide({
          sessionID: "trace-session",
          agent: {
            name: "build",
            mode: "primary",
            permission: [],
            options: {},
          } as any,
          messages: [
            {
              info: { role: "user" },
              parts: [{ type: "text", text: "Explain this TypeScript function and edit the file" }],
            } as any,
          ],
          capabilities: [
            {
              id: "read",
              connector: "core",
              risk_level: "medium",
              interactive: false,
              fallback: [],
            },
          ],
          mcpStatus: {},
        })

        await CapabilityBroker.record("trace-session", decision)
        const latest = await CapabilityBroker.latest("trace-session")
        expect(latest?.sessionID).toBe("trace-session")
        expect(latest?.decision.selectedAgent).toBe("build")
      },
    })
  })

  test("maps MCP tool ID back to server using longest matching prefix", () => {
    const server = CapabilityBroker.mapMcpToolToServer("apple_mcp_take_screenshot", ["apple", "apple_mcp", "ghost-os"])
    expect(server).toBe("apple_mcp")
  })

  test("enforces required MCP as hard block when fallback mode is off", async () => {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const decision = CapabilityBroker.decide({
          sessionID: "session-required-mcp",
          agent: {
            name: "build",
            mode: "primary",
            permission: [],
            options: {},
            requiredMcp: ["ghost-os"],
            fallback: { mode: "off" },
          } as any,
          messages: [
            {
              info: { role: "user" },
              parts: [{ type: "text", text: "Use native macOS controls" }],
            } as any,
          ],
          capabilities: [
            {
              id: "read",
              connector: "core",
              risk_level: "medium",
              interactive: false,
              fallback: [],
            },
          ],
          mcpStatus: {},
        })

        expect(decision.requiredMcpMissing).toContain("ghost-os")
        expect(decision.enforcement.mode).toBe("block")
      },
    })
  })

  test("marks required MCP missing as warn when fallback mode is enabled", async () => {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const decision = CapabilityBroker.decide({
          sessionID: "session-required-mcp-warn",
          agent: {
            name: "build",
            mode: "primary",
            permission: [],
            options: {},
            requiredMcp: ["ghost-os"],
            fallback: { mode: "browseros" },
          } as any,
          messages: [
            {
              info: { role: "user" },
              parts: [{ type: "text", text: "Use native macOS controls" }],
            } as any,
          ],
          capabilities: [
            {
              id: "read",
              connector: "core",
              risk_level: "medium",
              interactive: false,
              fallback: [],
            },
          ],
          mcpStatus: {},
        })

        expect(decision.requiredMcpMissing).toContain("ghost-os")
        expect(decision.enforcement.mode).toBe("warn")
      },
    })
  })
})
