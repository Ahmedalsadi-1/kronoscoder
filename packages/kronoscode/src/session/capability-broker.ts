import { Instance } from "@/project/instance"
import type { Agent } from "@/agent/agent"
import type { MessageV2 } from "./message-v2"

export namespace CapabilityBroker {
  export type TaskClass = "code-file" | "browser" | "native-macos" | "remote-background" | "specialty-integration"
  export type Stage = "stage1_builtin_only" | "stage2_builtin_adjacent" | "stage3_mcp_fallback"
  export type RuntimeMode = "code-native" | "browseros" | "ghost-os" | "e2b" | "mcp"
  export type ToolFamily = "builtin" | "builtin-adjacent" | "skill" | "mcp-approved" | "mcp-hidden"

  export type ToolCapability = {
    id: string
    connector: string
    risk_level: "low" | "medium" | "high"
    interactive: boolean
    fallback: string[]
  }

  export type McpStatus = {
    status: "connected" | "disabled" | "failed" | "needs_auth" | "needs_client_registration"
    error?: string
  }

  export type ConnectorHealth = {
    browser: boolean
    e2b: boolean
    ghost: boolean
    mcpConnected: string[]
    mcpFailed: string[]
  }

  export type Decision = {
    taskClass: TaskClass
    stage: Stage
    selectedRuntimeMode: RuntimeMode
    selectedAgent: string
    eligibleFamilies: ToolFamily[]
    suppressedFamilies: ToolFamily[]
    selectedMcpServers: string[]
    requiredMcpMissing: string[]
    enforcement: {
      mode: "allow" | "warn" | "block"
      reason: string | null
    }
    fallbackReason: string | null
    connectorHealth: ConnectorHealth
    router: {
      classifier: string
      confidence: number
    }
    critic: {
      routeValid: boolean
      issues: string[]
    }
  }

  export type TraceEntry = {
    timestamp: number
    sessionID: string
    decision: Decision
  }

  const traceState = Instance.state(
    async () => ({ bySession: {} as Record<string, TraceEntry[]> }),
    async () => {},
  )

  const DEFAULT_CONNECTED_MCPS = ["browseros", "ghost-os", "automation-mcp", "computer-use-mcp"]

  function textFromMessages(messages: MessageV2.WithParts[]) {
    const segments: string[] = []
    for (const msg of messages.slice(-8)) {
      if (msg.info.role !== "user") continue
      for (const part of msg.parts) {
        if (part.type === "text" && part.text.trim()) segments.push(part.text.trim())
        if (part.type === "agent" && part.name.trim()) segments.push(`@${part.name.trim()}`)
      }
    }
    return segments.join("\n").toLowerCase()
  }

  function detectTaskClass(text: string): { taskClass: TaskClass; classifier: string; confidence: number } {
    const has = (pattern: RegExp) => pattern.test(text)
    if (
      has(/\b(browser|website|web page|navigate|click|form|scrape|snapshot|screenshot|url|tab)\b/) ||
      has(/\bbrowser_|kronoschamber_browser_/)
    ) {
      return { taskClass: "browser", classifier: "browser-keywords", confidence: 0.9 }
    }
    if (has(/\b(macos|finder|menu bar|dock|appkit|native app|system settings|ghost)\b/)) {
      return { taskClass: "native-macos", classifier: "macos-keywords", confidence: 0.88 }
    }
    if (has(/\b(e2b|sandbox|background desktop|remote desktop|headless desktop|vm)\b/)) {
      return { taskClass: "remote-background", classifier: "remote-keywords", confidence: 0.86 }
    }
    if (has(/\b(notion|jira|linear|slack|github|figma|salesforce|hubspot|shopify|stripe|airtable)\b/)) {
      return { taskClass: "specialty-integration", classifier: "integration-keywords", confidence: 0.8 }
    }
    return { taskClass: "code-file", classifier: "default-code-file", confidence: 0.7 }
  }

  function connectorHealth(capabilities: ToolCapability[], mcpStatus: Record<string, McpStatus>): ConnectorHealth {
    const byConnector = new Set(capabilities.map((item) => item.connector))
    const connectedMcp = Object.entries(mcpStatus)
      .filter(([, status]) => status.status === "connected")
      .map(([name]) => name)
    const failedMcp = Object.entries(mcpStatus)
      .filter(([, status]) => status.status !== "connected")
      .map(([name]) => name)

    const connected = connectedMcp.length > 0 ? connectedMcp : DEFAULT_CONNECTED_MCPS
    return {
      browser: byConnector.has("browser"),
      e2b: byConnector.has("e2b") && Boolean(process.env.E2B_API_KEY || process.env.E2B_ACCESS_TOKEN),
      ghost: connected.includes("ghost-os"),
      mcpConnected: connected,
      mcpFailed: failedMcp,
    }
  }

  function unique(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)))
  }

  export function mapMcpToolToServer(toolID: string, servers: string[]): string | null {
    const sorted = [...servers].sort((a, b) => b.length - a.length)
    for (const server of sorted) {
      if (toolID.startsWith(`${server}_`)) return server
    }
    return null
  }

  export function decide(input: {
    sessionID: string
    agent: Agent.Info
    messages: MessageV2.WithParts[]
    capabilities: ToolCapability[]
    mcpStatus: Record<string, McpStatus>
  }): Decision {
    const combinedText = textFromMessages(input.messages)
    const detected = detectTaskClass(combinedText)
    const health = connectorHealth(input.capabilities, input.mcpStatus)

    const requiredMcpMissing = (input.agent.requiredMcp ?? []).filter((name) => !health.mcpConnected.includes(name))
    const capabilityAllowlist = (input.agent.capabilities ?? []).map((item) => item.trim()).filter(Boolean)
    const hasStrongBuiltinPath =
      detected.taskClass === "code-file"
        ? true
        : detected.taskClass === "browser"
          ? health.browser
          : detected.taskClass === "remote-background"
            ? health.e2b
            : false

    const hasBuiltInAdjacentPath = detected.taskClass === "native-macos" ? health.ghost : false

    let stage: Stage = "stage3_mcp_fallback"
    let selectedRuntimeMode: RuntimeMode = "mcp"
    let selectedMcpServers = health.mcpConnected
    let fallbackReason: string | null = null

    if (hasStrongBuiltinPath) {
      stage = "stage1_builtin_only"
      selectedRuntimeMode = detected.taskClass === "browser" ? "browseros" : detected.taskClass === "remote-background" ? "e2b" : "code-native"
      selectedMcpServers = []
    } else if (hasBuiltInAdjacentPath) {
      stage = "stage2_builtin_adjacent"
      selectedRuntimeMode = "ghost-os"
      selectedMcpServers = health.mcpConnected.filter((name) => name === "ghost-os")
      if (selectedMcpServers.length === 0) {
        fallbackReason = "Ghost OS is not connected; escalating to approved MCP fallback."
      }
    } else {
      fallbackReason = "No strong built-in path detected for this task class."
    }

    if (requiredMcpMissing.length > 0 && !fallbackReason) {
      fallbackReason = `Required MCP missing for agent ${input.agent.name}: ${requiredMcpMissing.join(", ")}`
    }

    const enforcementMode: "allow" | "warn" | "block" =
      requiredMcpMissing.length === 0
        ? "allow"
        : input.agent.fallback?.mode === "off"
          ? "block"
          : "warn"
    const enforcementReason =
      requiredMcpMissing.length > 0
        ? `required_mcp_missing:${requiredMcpMissing.join(",")}`
        : capabilityAllowlist.length > 0
          ? `capability_allowlist:${capabilityAllowlist.join(",")}`
          : null

    const eligibleFamilies: ToolFamily[] =
      stage === "stage1_builtin_only"
        ? ["builtin"]
        : stage === "stage2_builtin_adjacent"
          ? ["builtin", "skill", "builtin-adjacent"]
          : ["builtin", "skill", "builtin-adjacent", "mcp-approved"]

    const suppressedFamilies = (["builtin", "builtin-adjacent", "skill", "mcp-approved", "mcp-hidden"] as ToolFamily[]).filter(
      (family) => !eligibleFamilies.includes(family),
    )

    const criticIssues: string[] = []
    if (requiredMcpMissing.length > 0) criticIssues.push(`missing_required_mcp:${requiredMcpMissing.join(",")}`)
    if (stage === "stage2_builtin_adjacent" && selectedMcpServers.length === 0)
      criticIssues.push("builtin_adjacent_unavailable")
    if (stage === "stage3_mcp_fallback" && health.mcpConnected.length === 0) criticIssues.push("no_mcp_connected")

    return {
      taskClass: detected.taskClass,
      stage,
      selectedRuntimeMode,
      selectedAgent: input.agent.name,
      eligibleFamilies,
      suppressedFamilies,
      selectedMcpServers: unique(selectedMcpServers),
      requiredMcpMissing,
      enforcement: {
        mode: enforcementMode,
        reason: enforcementReason,
      },
      fallbackReason,
      connectorHealth: health,
      router: {
        classifier: detected.classifier,
        confidence: detected.confidence,
      },
      critic: {
        routeValid: criticIssues.length === 0,
        issues: criticIssues,
      },
    }
  }

  export async function record(sessionID: string, decision: Decision) {
    const state = await traceState()
    const entries = state.bySession[sessionID] ?? []
    entries.push({
      timestamp: Date.now(),
      sessionID,
      decision,
    })
    state.bySession[sessionID] = entries.slice(-25)
  }

  export async function latest(sessionID: string): Promise<TraceEntry | null> {
    const state = await traceState()
    const entries = state.bySession[sessionID] ?? []
    return entries.length ? entries[entries.length - 1] : null
  }

  export async function trace(sessionID?: string): Promise<Record<string, TraceEntry[]>> {
    const state = await traceState()
    if (!sessionID) return state.bySession
    return { [sessionID]: state.bySession[sessionID] ?? [] }
  }
}
