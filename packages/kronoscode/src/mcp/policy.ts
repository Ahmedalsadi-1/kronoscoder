export const MCP_POLICY_ALLOWED = [
  "apple_mcp",
  "automation-mcp",
  "browseros",
  "computer-use-mcp",
  "sequential-thinking",
  "openfang",
] as const

export type AllowedMcpName = (typeof MCP_POLICY_ALLOWED)[number]

export const MCP_POLICY_ALLOWED_SET = new Set<string>(MCP_POLICY_ALLOWED)

const MCP_POLICY_ALIASES: Record<string, AllowedMcpName> = {
  "apple-mcp": "apple_mcp",
  apple_mcp: "apple_mcp",
  "automation-mcp": "automation-mcp",
  automation_mcp: "automation-mcp",
  browseros: "browseros",
  "kronoschamber-browser-mcp": "browseros",
  "computer-use-mcp": "computer-use-mcp",
  computer_use_mcp: "computer-use-mcp",
  "sequential-thinking": "sequential-thinking",
  sequential_thinking: "sequential-thinking",
  sequentialthinking: "sequential-thinking",
  openfang: "openfang",
  "openfang-mcp": "openfang",
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
  return normalized.length > 0 && MCP_POLICY_ALLOWED_SET.has(normalized)
}

export const mcpPolicyErrorMessage = (value: string): string => {
  const attempted = typeof value === "string" && value.trim().length > 0 ? value.trim() : "<empty>"
  return `MCP server "${attempted}" is blocked by policy. Allowed MCP servers: ${MCP_POLICY_ALLOWED.join(", ")}.`
}

export const assertMcpPolicyAllowed = (value: string): AllowedMcpName => {
  const normalized = normalizeMcpPolicyName(value)
  if (!normalized || !MCP_POLICY_ALLOWED_SET.has(normalized)) {
    throw new Error(mcpPolicyErrorMessage(value))
  }
  return normalized as AllowedMcpName
}
