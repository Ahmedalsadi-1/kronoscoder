const MCP_POLICY_ALLOWED = Object.freeze([
  "apple_mcp",
  "automation-mcp",
  "browseros",
  "computer-use-mcp",
  "sequential-thinking",
  "openfang",
])

const MCP_POLICY_ALIASES = Object.freeze({
  "apple-mcp": "apple_mcp",
  "apple_mcp": "apple_mcp",
  "automation-mcp": "automation-mcp",
  "automation_mcp": "automation-mcp",
  "browseros": "browseros",
  "kronoschamber-browser-mcp": "browseros",
  "computer-use-mcp": "computer-use-mcp",
  "computer_use_mcp": "computer-use-mcp",
  "sequential-thinking": "sequential-thinking",
  "sequential_thinking": "sequential-thinking",
  "sequentialthinking": "sequential-thinking",
  "openfang": "openfang",
  "openfang-mcp": "openfang",
})

const MCP_POLICY_ALLOWED_SET = new Set(MCP_POLICY_ALLOWED)

const normalizeMcpPolicyName = (value) => {
  if (typeof value !== "string") return ""
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return ""
  if (Object.prototype.hasOwnProperty.call(MCP_POLICY_ALIASES, trimmed)) {
    return MCP_POLICY_ALIASES[trimmed]
  }
  const collapsed = trimmed.replace(/\s+/g, "-")
  if (Object.prototype.hasOwnProperty.call(MCP_POLICY_ALIASES, collapsed)) {
    return MCP_POLICY_ALIASES[collapsed]
  }
  return collapsed
}

const isMcpPolicyAllowed = (value) => {
  const normalized = normalizeMcpPolicyName(value)
  return normalized.length > 0 && MCP_POLICY_ALLOWED_SET.has(normalized)
}

const disallowedMcpPolicyMessage = (value) => {
  const attempted = typeof value === "string" && value.trim().length > 0 ? value.trim() : "<empty>"
  return `MCP server "${attempted}" is blocked by policy. Allowed MCP servers: ${MCP_POLICY_ALLOWED.join(", ")}.`
}

const buildMcpPolicyMetadata = () => ({
  mode: "hard-enforced-allowlist",
  allowed: MCP_POLICY_ALLOWED,
  aliases: MCP_POLICY_ALIASES,
  message: `Only these MCP servers are allowed: ${MCP_POLICY_ALLOWED.join(", ")}.`,
})

export {
  MCP_POLICY_ALLOWED,
  MCP_POLICY_ALLOWED_SET,
  MCP_POLICY_ALIASES,
  normalizeMcpPolicyName,
  isMcpPolicyAllowed,
  disallowedMcpPolicyMessage,
  buildMcpPolicyMetadata,
}
