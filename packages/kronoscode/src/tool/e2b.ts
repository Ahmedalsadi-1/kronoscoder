import z from "zod"
import { Tool } from "./tool"
import { SandboxBroker } from "@/desktop/broker"
import { Log } from "@/util/log"

const log = Log.create({ service: "tool.e2b" })

const E2B_AVAILABLE = process.env.KRONOSCODE_ENABLE_REAL_E2B === "true"

const baseMeta = { available: E2B_AVAILABLE }
const toolMeta = {
  connector: "e2b",
  risk_level: "high",
  interactive: true,
  fallback: ["computer-use-mcp", "automation-mcp"],
}

const runDesktopAction = async (
  args: {
    sessionId: string
    orgId: string
    userId?: string
  } & Record<string, any>,
  action: string,
  actionArgs: Record<string, any>,
) => {
  if (!E2B_AVAILABLE) {
    return { title: "E2B Desktop", output: "E2B not enabled", metadata: { ...baseMeta, ...toolMeta } }
  }

  try {
    const executed = await SandboxBroker.executeDesktopAction(
      args.sessionId,
      args.userId || "agent",
      args.orgId,
      action,
      actionArgs,
    )
    return {
      title: `E2B Desktop ${action}`,
      output: JSON.stringify(executed.result, null, 2),
      metadata: {
        ...baseMeta,
        ...toolMeta,
        action,
        sessionId: args.sessionId,
        context: executed.context,
      },
    }
  } catch (e) {
    return { title: "E2B Error", output: String(e), metadata: { ...baseMeta, ...toolMeta, error: true, action } }
  }
}

export const E2BCreateTool = Tool.define("e2b_create", {
  description: "Create an E2B desktop sandbox for isolated code execution.",
  parameters: z.object({
    type: z.enum(["browser", "terminal", "desktop"]).default("desktop"),
    userId: z.string(),
    orgId: z.string(),
  }),
  async execute(params) {
    if (!E2B_AVAILABLE) {
      return {
        title: "E2B Sandbox",
        output: "E2B not enabled. Set KRONOSCODE_ENABLE_REAL_E2B=true",
        metadata: baseMeta,
      }
    }
    try {
      const result = await SandboxBroker.createSession(params.userId, params.orgId, params.type, {}, {})
      return {
        title: "E2B Created",
        output: `Session: ${result.sessionId}`,
        metadata: { ...baseMeta, sessionId: result.sessionId },
      }
    } catch (e) {
      return { title: "E2B Error", output: String(e), metadata: { ...baseMeta, error: true } }
    }
  },
})

export const E2BListTool = Tool.define("e2b_list", {
  description: "List E2B desktop sandboxes.",
  parameters: z.object({ orgId: z.string() }),
  async execute(params) {
    if (!E2B_AVAILABLE) {
      return { title: "E2B List", output: "E2B not enabled", metadata: baseMeta }
    }
    try {
      const sessions = await SandboxBroker.listSessionsForOrg(params.orgId)
      return {
        title: "E2B List",
        output: `${sessions.length} sessions`,
        metadata: { ...baseMeta, count: sessions.length },
      }
    } catch (e) {
      return { title: "E2B Error", output: String(e), metadata: { ...baseMeta, error: true } }
    }
  },
})

export const E2BProvidersTool = Tool.define("e2b_providers", {
  description: "Get E2B provider info.",
  parameters: z.object({}),
  async execute() {
    const providers = SandboxBroker.getProviderCatalog()
    return { title: "E2B Providers", output: JSON.stringify(providers, null, 2), metadata: baseMeta }
  },
})

export const E2BTakeoverTool = Tool.define("e2b_takeover", {
  description: "Take over an E2B sandbox.",
  parameters: z.object({ sessionId: z.string(), userId: z.string(), orgId: z.string() }),
  async execute(params) {
    if (!E2B_AVAILABLE) {
      return { title: "E2B Takeover", output: "E2B not enabled", metadata: baseMeta }
    }
    try {
      const result = await SandboxBroker.requestTakeover(params.sessionId, params.userId, params.orgId)
      return {
        title: "E2B Takeover",
        output: result.success ? "Success" : "Failed",
        metadata: { ...baseMeta, success: result.success },
      }
    } catch (e) {
      return { title: "E2B Error", output: String(e), metadata: { ...baseMeta, error: true } }
    }
  },
})

export const E2BReleaseTool = Tool.define("e2b_release", {
  description: "Release an E2B sandbox.",
  parameters: z.object({ sessionId: z.string(), userId: z.string(), orgId: z.string() }),
  async execute(params) {
    if (!E2B_AVAILABLE) {
      return { title: "E2B Release", output: "E2B not enabled", metadata: baseMeta }
    }
    try {
      await SandboxBroker.releaseTakeover(params.sessionId, params.userId, params.orgId)
      return { title: "E2B Release", output: "Released", metadata: { ...baseMeta, success: true } }
    } catch (e) {
      return { title: "E2B Error", output: String(e), metadata: { ...baseMeta, error: true } }
    }
  },
})

export const E2BQuotaTool = Tool.define("e2b_quota", {
  description: "Get E2B quota info.",
  parameters: z.object({ orgId: z.string() }),
  async execute(params) {
    if (!E2B_AVAILABLE) {
      return { title: "E2B Quota", output: "E2B not enabled", metadata: baseMeta }
    }
    try {
      const quota = await SandboxBroker.getQuotaSummary(params.orgId)
      return { title: "E2B Quota", output: JSON.stringify(quota), metadata: { ...baseMeta, ...quota } }
    } catch (e) {
      return { title: "E2B Error", output: String(e), metadata: { ...baseMeta, error: true } }
    }
  },
})

const E2BDesktopBaseParams = z.object({
  sessionId: z.string().min(1),
  orgId: z.string().min(1),
  userId: z.string().optional(),
})

export const E2BDesktopScreenshotTool = Tool.define("e2b_desktop_screenshot", {
  description: "Capture an E2B desktop screenshot.",
  parameters: E2BDesktopBaseParams.extend({
    fullPage: z.boolean().optional(),
  }),
  async execute(args) {
    return runDesktopAction(args, "screenshot", { fullPage: args.fullPage ?? true })
  },
})

export const E2BDesktopClickTool = Tool.define("e2b_desktop_click", {
  description: "Click on an E2B desktop session.",
  parameters: E2BDesktopBaseParams.extend({
    x: z.number().optional(),
    y: z.number().optional(),
    button: z.enum(["left", "right", "middle"]).optional(),
    doubleClick: z.boolean().optional(),
  }),
  async execute(args) {
    return runDesktopAction(args, "click", {
      x: args.x,
      y: args.y,
      button: args.button || "left",
      doubleClick: args.doubleClick === true,
    })
  },
})

export const E2BDesktopTypeTool = Tool.define("e2b_desktop_type", {
  description: "Type text in an E2B desktop session.",
  parameters: E2BDesktopBaseParams.extend({
    text: z.string(),
    replace: z.boolean().optional(),
    pressEnter: z.boolean().optional(),
  }),
  async execute(args) {
    return runDesktopAction(args, "type", {
      text: args.text,
      replace: args.replace === true,
      pressEnter: args.pressEnter === true,
    })
  },
})

export const E2BDesktopHotkeyTool = Tool.define("e2b_desktop_hotkey", {
  description: "Press a hotkey in an E2B desktop session.",
  parameters: E2BDesktopBaseParams.extend({
    keys: z.array(z.string()).min(1),
  }),
  async execute(args) {
    return runDesktopAction(args, "hotkey", {
      keys: args.keys,
    })
  },
})

export const E2BDesktopDragTool = Tool.define("e2b_desktop_drag", {
  description: "Drag between points in an E2B desktop session.",
  parameters: E2BDesktopBaseParams.extend({
    startX: z.number(),
    startY: z.number(),
    endX: z.number(),
    endY: z.number(),
    durationMs: z.number().optional(),
  }),
  async execute(args) {
    return runDesktopAction(args, "drag", {
      startX: args.startX,
      startY: args.startY,
      endX: args.endX,
      endY: args.endY,
      durationMs: args.durationMs,
    })
  },
})

export const E2BDesktopWindowListTool = Tool.define("e2b_desktop_window_list", {
  description: "List desktop windows in an E2B session.",
  parameters: E2BDesktopBaseParams,
  async execute(args) {
    return runDesktopAction(args, "window_list", {})
  },
})

export const E2BDesktopWindowFocusTool = Tool.define("e2b_desktop_window_focus", {
  description: "Focus a window in an E2B desktop session.",
  parameters: E2BDesktopBaseParams.extend({
    name: z.string().optional(),
    id: z.string().optional(),
  }),
  async execute(args) {
    return runDesktopAction(args, "window_focus", { name: args.name, id: args.id })
  },
})

export const E2BDesktopOpenAppTool = Tool.define("e2b_desktop_open_app", {
  description: "Open an app in an E2B desktop session.",
  parameters: E2BDesktopBaseParams.extend({
    app: z.string().optional(),
    command: z.string().optional(),
  }),
  async execute(args) {
    return runDesktopAction(args, "open_app", { app: args.app, command: args.command })
  },
})

export const E2BDesktopClipboardGetTool = Tool.define("e2b_desktop_clipboard_get", {
  description: "Get clipboard content from an E2B desktop session.",
  parameters: E2BDesktopBaseParams,
  async execute(args) {
    return runDesktopAction(args, "clipboard_get", {})
  },
})

export const E2BDesktopClipboardSetTool = Tool.define("e2b_desktop_clipboard_set", {
  description: "Set clipboard content for an E2B desktop session.",
  parameters: E2BDesktopBaseParams.extend({
    value: z.string(),
  }),
  async execute(args) {
    return runDesktopAction(args, "clipboard_set", { value: args.value })
  },
})

export const E2BDesktopWaitTool = Tool.define("e2b_desktop_wait", {
  description: "Wait/pause within an E2B desktop automation flow.",
  parameters: E2BDesktopBaseParams.extend({
    ms: z.number().int().min(0),
  }),
  async execute(args) {
    return runDesktopAction(args, "wait", { ms: args.ms })
  },
})

export const E2BDesktopRunMacroTool = Tool.define("e2b_desktop_run_macro", {
  description: "Run a desktop macro (sequence of actions) in an E2B session.",
  parameters: E2BDesktopBaseParams.extend({
    steps: z.array(
      z.object({
        action: z.string().min(1),
        args: z.record(z.string(), z.any()).optional(),
      }),
    ),
  }),
  async execute(args) {
    return runDesktopAction(args, "run_macro", {
      steps: args.steps,
    })
  },
})
