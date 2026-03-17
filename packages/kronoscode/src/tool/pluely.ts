import z from "zod"
import { Tool } from "./tool"
import { Log } from "@/util/log"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

/**
 * Pluely Tool: Integration with Pluely - Privacy-First Invisible AI Assistant
 *
 * Pluely is an undetectable AI assistant that operates during meetings, interviews,
 * and conversations. This tool allows KronosCode to interact with Pluely for:
 * - Triggering AI interactions
 * - Getting conversation context
 * - Capturing screen/audio context
 * - Managing the Pluely workflow
 *
 * Docs: https://pluely.com
 * GitHub: https://github.com/iamsrikanthnani/pluely
 */
export const PluelyTool = Tool.define("pluely", {
  description:
    "Interact with Pluely - Privacy-first invisible AI assistant. Use for meeting notes, conversation context, and stealth AI interactions.",
  parameters: z.object({
    action: z.enum([
      "activate",
      "deactivate",
      "get_context",
      "capture_screen",
      "capture_audio",
      "list_conversations",
      "get_conversation",
      "status",
    ]),
    conversationId: z.string().optional().describe("ID of the conversation to retrieve."),
    captureType: z.enum(["full", "region", "window"]).optional().describe("Type of screen capture."),
  }),
  async execute(args, ctx) {
    const log = Log.create({ service: "tool.pluely" })
    log.info("Executing Pluely tool", { action: args.action })

    let output = ""
    let title = "Pluely"

    try {
      if (process.platform !== "darwin") {
        return {
          title: "Pluely Error",
          output: "Pluely is only available on macOS.",
          metadata: { action: args.action },
        }
      }

      switch (args.action) {
        case "activate":
          // Activate Pluely via AppleScript - trigger the menu bar app
          const activateScript = `tell application "System Events"
  if exists (process "Pluely") then
    tell application "Pluely" to activate
  end if
end tell`
          await execAsync(`osascript << 'EOF'
${activateScript}
EOF`)
          output = "Pluely activated. Use keyboard shortcut Cmd+Shift+Space to interact."
          title = "Pluely Activated"
          break

        case "deactivate":
          // Minimize/hide Pluely
          const deactivateScript = `tell application "System Events"
  if exists (process "Pluely") then
    tell application "Pluely" to quit
  end if
end tell`
          await execAsync(`osascript << 'EOF'
${deactivateScript}
EOF`)
          output = "Pluely deactivated."
          title = "Pluely Deactivated"
          break

        case "status":
          // Check if Pluely is running
          const statusScript = `tell application "System Events"
  if exists (process "Pluely") then
    return "running"
  else
    return "not_running"
  end if
end tell`
          const { stdout: status } = await execAsync(`osascript << 'EOF'
${statusScript}
EOF`)
          output = `Pluely status: ${status.trim()}`
          title = "Pluely Status"
          break

        case "capture_screen":
          // Trigger screen capture through Pluely
          const captureScript = `tell application "System Events"
  if exists (process "Pluely") then
    keystroke "m" using {command down, shift down}
    return "Screen capture triggered"
  else
    return "Pluely is not running. Activate first."
  end if
end tell`
          const { stdout: captureResult } = await execAsync(`osascript << 'EOF'
${captureScript}
EOF`)
          output = captureResult.trim() || "Screen capture initiated through Pluely."
          title = "Pluely Screen Capture"
          break

        case "capture_audio":
          // Trigger audio capture through Pluely
          const audioScript = `tell application "System Events"
  if exists (process "Pluely") then
    keystroke "m" using {command down, shift down, option down}
    return "Audio capture triggered"
  else
    return "Pluely is not running. Activate first."
  end if
end tell`
          const { stdout: audioResult } = await execAsync(`osascript << 'EOF'
${audioScript}
EOF`)
          output = audioResult.trim() || "Audio capture initiated through Pluely."
          title = "Pluely Audio Capture"
          break

        case "list_conversations":
          // List Pluely conversations using shell directly (no AppleScript needed)
          const { stdout: conversations } = await execAsync(
            `ls -la ~/Library/Application\\ Support/Pluely/conversations/ 2>/dev/null || echo 'No conversations found'`,
          )
          output = conversations.trim() || "No conversations found. Make sure Pluely has been used."
          title = "Pluely Conversations"
          break

        case "get_conversation":
          if (!args.conversationId) {
            throw new Error("conversationId is required for get_conversation")
          }
          // Read specific conversation from Pluely data using shell directly
          const { stdout: conversation } = await execAsync(
            `cat ~/Library/Application\\ Support/Pluely/conversations/${args.conversationId}.json 2>/dev/null || echo 'Conversation not found'`,
          )
          output = conversation.trim() || "Conversation not found."
          title = `Pluely Conversation: ${args.conversationId}`
          break

        case "get_context":
          // Get recent context from Pluely using shell directly
          const { stdout: context } = await execAsync(
            `ls -lt ~/Library/Application\\ Support/Pluely/context/ 2>/dev/null | head -5 || echo 'No context yet'`,
          )
          output = context.trim() || "No context captured yet. Activate Pluely and use it to capture context."
          title = "Pluely Context"
          break

        default:
          output = `Unknown action: ${args.action}`
          title = "Pluely Error"
      }
    } catch (error: any) {
      log.error("Pluely tool failed", { error: error.message })
      output = `Error: ${error.message}`
    }

    return {
      title,
      output,
      metadata: {
        action: args.action,
      },
    }
  },
})

const pluelyMeta = {
  connector: "pluely",
  risk_level: "medium",
  interactive: true,
  fallback: ["pluely"],
}

export const PluelyVoiceStartTool = Tool.define("pluely_voice_start", {
  description: "Start/activate Pluely voice workflow.",
  parameters: z.object({}),
  async execute(_args, ctx) {
    const result = await PluelyTool.init().then((tool) => tool.execute({ action: "activate" }, ctx))
    return {
      ...result,
      title: "Pluely Voice Start",
      metadata: { ...result.metadata, ...pluelyMeta },
    }
  },
})

export const PluelyVoiceStopTool = Tool.define("pluely_voice_stop", {
  description: "Stop/deactivate Pluely voice workflow.",
  parameters: z.object({}),
  async execute(_args, ctx) {
    const result = await PluelyTool.init().then((tool) => tool.execute({ action: "deactivate" }, ctx))
    return {
      ...result,
      title: "Pluely Voice Stop",
      metadata: { ...result.metadata, ...pluelyMeta },
    }
  },
})

export const PluelyTranscriptGetTool = Tool.define("pluely_transcript_get", {
  description: "Get Pluely transcript or specific conversation.",
  parameters: z.object({
    conversationId: z.string().optional(),
  }),
  async execute(args, ctx) {
    const result = await PluelyTool.init().then((tool) =>
      tool.execute(
        args.conversationId
          ? { action: "get_conversation", conversationId: args.conversationId }
          : { action: "list_conversations" },
        ctx,
      ),
    )
    return {
      ...result,
      title: "Pluely Transcript",
      metadata: { ...result.metadata, ...pluelyMeta },
    }
  },
})

export const PluelyOverlayShowTool = Tool.define("pluely_overlay_show", {
  description: "Show/activate Pluely overlay surface.",
  parameters: z.object({}),
  async execute(_args, ctx) {
    const result = await PluelyTool.init().then((tool) => tool.execute({ action: "activate" }, ctx))
    return {
      ...result,
      title: "Pluely Overlay Show",
      metadata: { ...result.metadata, ...pluelyMeta },
    }
  },
})

export const PluelyOverlayHideTool = Tool.define("pluely_overlay_hide", {
  description: "Hide/deactivate Pluely overlay surface.",
  parameters: z.object({}),
  async execute(_args, ctx) {
    const result = await PluelyTool.init().then((tool) => tool.execute({ action: "deactivate" }, ctx))
    return {
      ...result,
      title: "Pluely Overlay Hide",
      metadata: { ...result.metadata, ...pluelyMeta },
    }
  },
})

export const PluelyContextRecentTool = Tool.define("pluely_context_recent", {
  description: "Get most recent Pluely context entries.",
  parameters: z.object({}),
  async execute(_args, ctx) {
    const result = await PluelyTool.init().then((tool) => tool.execute({ action: "get_context" }, ctx))
    return {
      ...result,
      title: "Pluely Context Recent",
      metadata: { ...result.metadata, ...pluelyMeta },
    }
  },
})
