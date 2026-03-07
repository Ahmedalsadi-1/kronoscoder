import z from "zod"
import { Tool } from "./tool"
import { Log } from "@/util/log"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

/**
 * Everywhere Tool: Native capability for cross-application UI introspection and control.
 * This tool allows the agent to "see" and "interact" with other running applications on the host system.
 */
export const EverywhereTool = Tool.define("everywhere", {
  description: "Interacts with and controls other applications on the host system (macOS/Windows/Linux).",
  parameters: z.object({
    action: z.enum(["list_apps", "inspect_ui", "control_app", "get_window_info"]),
    targetApp: z.string().optional().describe("The name or bundle ID of the target application."),
    command: z.string().optional().describe("The specific command or script to execute (e.g., AppleScript, PowerShell)."),
    element: z.string().optional().describe("The UI element to interact with (e.g., button name, menu item)."),
  }),
  async execute(args, ctx) {
    const log = Log.create({ service: "tool.everywhere" })
    log.info("Executing everywhere tool", { action: args.action, targetApp: args.targetApp })

    let output = ""
    let title = "Everywhere Control"

    try {
      if (process.platform === "darwin") {
        // macOS implementation using AppleScript
        switch (args.action) {
          case "list_apps":
            const { stdout: apps } = await execAsync(`osascript -e 'tell application "System Events" to get name of every process whose background only is false'`)
            output = `Running Applications:\n${apps.split(", ").join("\n")}`
            title = "List Running Apps"
            break
          case "inspect_ui":
            if (!args.targetApp) throw new Error("targetApp is required for inspect_ui")
            // Basic UI inspection via AppleScript
            const inspectScript = `
              tell application "System Events"
                tell process "${args.targetApp}"
                  entire contents of window 1
                end tell
              end tell
            `
            const { stdout: uiTree } = await execAsync(`osascript -e '${inspectScript}'`)
            output = uiTree
            title = `Inspect UI: ${args.targetApp}`
            break
          case "control_app":
            if (!args.targetApp || !args.command) throw new Error("targetApp and command are required for control_app")
            const { stdout: controlResult } = await execAsync(`osascript -e 'tell application "${args.targetApp}" to ${args.command}'`)
            output = controlResult || "Command executed successfully."
            title = `Control App: ${args.targetApp}`
            break
          case "get_window_info":
             const { stdout: windowInfo } = await execAsync(`osascript -e 'tell application "System Events" to get window info of every process whose background only is false'`)
             output = windowInfo
             title = "Get Window Info"
             break
        }
      } else if (process.platform === "win32") {
        // Windows implementation using PowerShell (Simplified placeholder)
        output = "Windows 'Everywhere' support is currently limited. Use powershell for deep interaction."
      } else {
        // Linux implementation (Simplified placeholder)
        output = "Linux 'Everywhere' support requires X11/Wayland introspection tools like xdotool."
      }
    } catch (error: any) {
      log.error("Everywhere tool failed", { error: error.message })
      output = `Error: ${error.message}`
    }

    return {
      title,
      output,
      metadata: {
        action: args.action,
        targetApp: args.targetApp,
      },
    }
  },
})
