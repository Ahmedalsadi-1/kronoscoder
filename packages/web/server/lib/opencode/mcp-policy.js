const DEFAULT_ALLOWED = Object.freeze([
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
])

const getAllowedFromEnv = () => {
  const envVar = process.env.MCP_ALLOWED_SERVERS
  if (!envVar) return Object.freeze(["*"])
  if (envVar.trim() === "*") return Object.freeze(["*"])
  const envList = envVar
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return Object.freeze([...new Set([...DEFAULT_ALLOWED, ...envList])])
}

const MCP_POLICY_ALLOWED = getAllowedFromEnv()

const MCP_POLICY_ALIASES = Object.freeze({
  "apple-mcp": "apple_mcp",
  "apple_mcp": "apple_mcp",
  "automation-mcp": "automation-mcp",
  "automation_mcp": "automation-mcp",
  "browseros": "browseros",
  "kronoschamber-browser-mcp": "browseros",
  "computer-use-mcp": "computer-use-mcp",
  "computer_use_mcp": "computer-use-mcp",
  "ghost-os": "ghost-os",
  "ghost_os": "ghost-os",
  "ghostos": "ghost-os",
  "sequential-thinking": "sequential-thinking",
  "sequential_thinking": "sequential-thinking",
  "sequentialthinking": "sequential-thinking",
  "openfang": "openfang",
  "openfang-mcp": "openfang",
  "excalidraw": "excalidraw",
  "excalidraw-mcp": "excalidraw",
  "atsurae": "atsurae",
  "personalizationmcp": "personalizationmcp",
  "personalization-mcp": "personalizationmcp",
  "personalizationmcp-mcp": "personalizationmcp",
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
  if (!normalized.length) return false
  if (MCP_POLICY_ALLOWED_SET.has("*")) return true
  return MCP_POLICY_ALLOWED_SET.has(normalized)
}

const disallowedMcpPolicyMessage = (value) => {
  const attempted = typeof value === "string" && value.trim().length > 0 ? value.trim() : "<empty>"
  const allowedList = MCP_POLICY_ALLOWED_SET.has("*") ? "ALL (using wildcard)" : MCP_POLICY_ALLOWED.join(", ")
  return `MCP server "${attempted}" is blocked by policy. Allowed MCP servers: ${allowedList}.`
}

const buildMcpPolicyMetadata = () => ({
  mode: MCP_POLICY_ALLOWED_SET.has("*") ? "wildcard-allow-all" : "hard-enforced-allowlist",
  allowed: MCP_POLICY_ALLOWED,
  aliases: MCP_POLICY_ALIASES,
  message: MCP_POLICY_ALLOWED_SET.has("*")
    ? "All MCP servers are allowed (wildcard mode)."
    : `Only these MCP servers are allowed: ${MCP_POLICY_ALLOWED.join(", ")}.`,
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
