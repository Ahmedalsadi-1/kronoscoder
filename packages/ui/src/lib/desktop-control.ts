// Desktop Control MCP Servers Configuration
// These are popular MCP servers for desktop automation

export interface DesktopControlMcpServer {
  id: string
  name: string
  description: string
  installCommand: string
  stars: number
  language: string
  features: string[]
  mcpName?: string
}

// Popular desktop control MCP servers
export const DESKTOP_CONTROL_MCP_SERVERS: DesktopControlMcpServer[] = [
  {
    id: "ghost-os",
    mcpName: "ghost-os",
    name: "Ghost OS",
    description:
      "Accessibility-tree first macOS automation with reusable recipes and local vision fallback for native app workflows.",
    installCommand: "brew install ghostwright/ghost-os/ghost-os && ghost setup",
    stars: 0,
    language: "Go",
    features: ["native-macos", "recipes", "accessibility-tree", "vision-fallback"],
  },
  {
    id: "automation-mcp",
    mcpName: "automation-mcp",
    name: "Automation MCP (local macOS)",
    description:
      "Local desktop automation MCP for macOS (mouse, keyboard, screenshots, window controls) without remote host setup.",
    installCommand: "bun run ~/.kronoscode/mcp-servers/automation-mcp/index.ts --stdio",
    stars: 0,
    language: "TypeScript",
    features: ["local-macos", "screenshot", "mouse", "keyboard", "window-control"],
  },
  {
    id: "computer-use-mcp",
    name: "computer-use-mcp",
    description: "Give AI models complete control of your computer. Screenshot capture, mouse/keyboard control.",
    installCommand: "bunx computer-use-mcp",
    stars: 137,
    language: "TypeScript",
    features: ["screenshot", "mouse", "keyboard", "cross-platform"],
  },
  {
    id: "computer-control-mcp",
    name: "computer-control-mcp",
    description: "Computer control with OCR, PyAutoGUI, element detection. Similar to Anthropic computer-use.",
    installCommand: "uvx computer-control-mcp",
    stars: 116,
    language: "Python",
    features: ["OCR", "element-detection", "automation"],
  },
  {
    id: "mcp-server-client-computer-use-ai-sdk",
    name: "Computer Use AI SDK",
    description:
      "Native macOS computer control using screenpipe. No pixel-based approach - uses underlying desktop elements.",
    installCommand: "cargo install m13v-computer-use",
    stars: 192,
    language: "Rust",
    features: ["native-macos", "screenpipe", "fast"],
  },
  {
    id: "mcp-desktop-automation",
    name: "MCP Desktop Automation",
    description: "Desktop automation using RobotJS and screenshot capabilities.",
    installCommand: "npx -y @tanob/mcp-desktop-automation",
    stars: 25,
    language: "JavaScript",
    features: ["screenshot", "RobotJS", "automation"],
  },
]

export type DesktopControlKnowledge = {
  defaultPolicy: {
    browsingMode: string
    backgroundModes: string[]
  }
  authMode: "hybrid" | "byok" | "managed"
  envPolicy: string
  entitlement?: {
    configured: boolean
    available: boolean
    status: string
    plan?: string | null
    balance?: number | null
    currency?: string | null
    error?: string | null
  }
  routingPolicy?: {
    userDesktopOrder?: string[]
    userDesktop?: {
      requestedMode: string
      mode: string | null
      provider: string
      reason: string
      order: string[]
    }
  }
  providers: Record<string, {
    id: string
    capabilities: string[]
    authMode: string
    requiredEnv: string[]
    authEnv?: string[]
    env?: Array<{ key: string; present: boolean }>
    entitlement?: {
      configured: boolean
      available: boolean
      status: string
      plan?: string | null
      balance?: number | null
      currency?: string | null
      error?: string | null
    }
    status?: Record<string, unknown>
  }>
}

const withDirectory = (directory?: string | null) => {
  const trimmed = typeof directory === "string" ? directory.trim() : ""
  if (!trimmed) return ""
  return `?directory=${encodeURIComponent(trimmed)}`
}

const withDirectoryHeader = (directory?: string | null): HeadersInit | undefined => {
  const trimmed = typeof directory === "string" ? directory.trim() : ""
  if (!trimmed) return undefined
  return { "x-kronoscode-directory": trimmed }
}

export async function getDesktopControlKnowledge(directory?: string | null): Promise<DesktopControlKnowledge> {
  const query = withDirectory(directory)
  const response = await fetch(`/api/desktop-control/knowledge${query}`, {
    headers: withDirectoryHeader(directory),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || "Failed to fetch desktop control knowledge")
  }
  return await response.json()
}

// Desktop control tools that MCP servers expose
export interface DesktopControlTool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export const DESKTOP_CONTROL_TOOLS: DesktopControlTool[] = [
  {
    name: "screenshot",
    description: "Capture a screenshot of the current screen",
    parameters: {},
  },
  {
    name: "mouse_move",
    description: "Move the mouse cursor to a specific position",
    parameters: {
      x: "number",
      y: "number",
    },
  },
  {
    name: "mouse_click",
    description: "Click the mouse at a position or element",
    parameters: {
      button: "left | right | middle",
      x: "number (optional)",
      y: "number (optional)",
    },
  },
  {
    name: "mouse_drag",
    description: "Drag from one position to another",
    parameters: {
      start_x: "number",
      start_y: "number",
      end_x: "number",
      end_y: "number",
    },
  },
  {
    name: "keyboard_type",
    description: "Type text using the keyboard",
    parameters: {
      text: "string",
    },
  },
  {
    name: "keyboard_hotkey",
    description: "Press a keyboard shortcut",
    parameters: {
      keys: 'string[] (e.g., ["Command", "c"])',
    },
  },
  {
    name: "window_list",
    description: "List all open windows",
    parameters: {},
  },
  {
    name: "window_focus",
    description: "Focus a specific window by name",
    parameters: {
      name: "string",
    },
  },
  {
    name: "get_screen_size",
    description: "Get the screen dimensions",
    parameters: {},
  },
]
