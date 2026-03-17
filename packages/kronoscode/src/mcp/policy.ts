// DEFAULT ALLOWED MCP SERVERS - Can be extended via environment variable
// Set MCP_ALLOWED_SERVERS env var to comma-separated list of allowed MCP names
// Use "*" to allow ALL MCP servers
const DEFAULT_ALLOWED = [
  "apple_mcp",
  "automation-mcp",
  "browseros",
  "computer-use-mcp",
  "ghost-os",
  "sequential-thinking",
  "openfang",
  "excalidraw",
  "atsurae",
  "personalizationmcp",
] as const

// Get allowed MCPs from environment variable or use defaults
// MCP_ALLOWED_SERVERS="*" means allow all
// MCP_ALLOWED_SERVERS="github,jira,slack" means allow only those + defaults
const getAllowedFromEnv = (): readonly string[] => {
  const envVar = process.env.MCP_ALLOWED_SERVERS
  // Backward compatible default: if not configured, allow all servers.
  // Restriction only applies when MCP_ALLOWED_SERVERS is explicitly set.
  if (!envVar) return ["*"] as const
  if (envVar === "*") return ["*"] as const
  // Merge env list with defaults
  const envList = envVar
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return [...new Set([...DEFAULT_ALLOWED, ...envList])] as readonly string[]
}

export const MCP_POLICY_ALLOWED = getAllowedFromEnv()

export type AllowedMcpName = string

export const MCP_POLICY_ALLOWED_SET = new Set<string>(MCP_POLICY_ALLOWED)

const MCP_POLICY_ALIASES: Record<string, string> = {
  "apple-mcp": "apple_mcp",
  apple_mcp: "apple_mcp",
  "automation-mcp": "automation-mcp",
  automation_mcp: "automation-mcp",
  browseros: "browseros",
  "kronoschamber-browser-mcp": "browseros",
  "computer-use-mcp": "computer-use-mcp",
  computer_use_mcp: "computer-use-mcp",
  "ghost-os": "ghost-os",
  ghost_os: "ghost-os",
  ghostos: "ghost-os",
  "sequential-thinking": "sequential-thinking",
  sequential_thinking: "sequential-thinking",
  sequentialthinking: "sequential-thinking",
  openfang: "openfang",
  "openfang-mcp": "openfang",
  excalidraw: "excalidraw",
  "excalidraw-mcp": "excalidraw",
  atsurae: "atsurae",
  personalizationmcp: "personalizationmcp",
  "personalization-mcp": "personalizationmcp",
  "personalizationmcp-mcp": "personalizationmcp",
}

export const normalizeMcpPolicyName = (value: string): string => {
  const trimmed = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (!trimmed) return ""
  if (MCP_POLICY_ALIASES[trimmed]) return MCP_POLICY_ALIASES[trimmed]
  const collapsed = trimmed.replace(/\s+/g, "-")
  if (MCP_POLICY_ALIASES[collapsed]) return MCP_POLICY_ALIASES[collapsed]
  return collapsed
}

export const isMcpPolicyAllowed = (value: string): boolean => {
  const normalized = normalizeMcpPolicyName(value)
  if (!normalized) return false
  if (MCP_POLICY_ALLOWED_SET.has("*")) return true
  return MCP_POLICY_ALLOWED_SET.has(normalized)
}

export const mcpPolicyErrorMessage = (value: string): string => {
  const attempted = typeof value === "string" && value.trim().length > 0 ? value.trim() : "<empty>"
  const allowedList = MCP_POLICY_ALLOWED_SET.has("*") ? "ALL (using wildcard)" : MCP_POLICY_ALLOWED.join(", ")
  return `MCP server "${attempted}" is blocked by policy. Allowed MCP servers: ${allowedList}.`
}

export const assertMcpPolicyAllowed = (value: string): AllowedMcpName => {
  const normalized = normalizeMcpPolicyName(value)
  if (!normalized) throw new Error(mcpPolicyErrorMessage(value))
  if (MCP_POLICY_ALLOWED_SET.has("*")) return normalized as AllowedMcpName
  if (!MCP_POLICY_ALLOWED_SET.has(normalized)) {
    throw new Error(mcpPolicyErrorMessage(value))
  }
  return normalized as AllowedMcpName
}
