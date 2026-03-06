import z from "zod"
import { Tool } from "./tool"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"
import path from "path"
import { Global } from "../global"

export const SnapshotSaveTool = Tool.define("save_snapshot", {
  description: "Save the current session state (messages and context) to a local snapshot file for later retrieval.",
  parameters: z.object({
    name: z.string().describe("The name of the snapshot (e.g., 'working-auth')"),
  }),
  async execute(params, ctx) {
    const session = await Session.get(ctx.sessionID)
    const messages = await Session.messages({ sessionID: ctx.sessionID })
    
    const snapshot = {
      sessionID: ctx.sessionID,
      title: session.title,
      messages,
      timestamp: Date.now(),
    }
    
    const snapshotDir = path.join(Global.Path.data, "snapshots")
    const filePath = path.join(snapshotDir, `${params.name}.json`)
    
    await Filesystem.write(filePath, JSON.stringify(snapshot, null, 2))

    return {
      title: `Snapshot '${params.name}' saved`,
      output: `Successfully saved session state to ${filePath}. You can restore this state later using 'restore_snapshot'.`,
      metadata: { path: filePath }
    }
  },
})

export const SnapshotRestoreTool = Tool.define("restore_snapshot", {
  description: "Restore a previously saved session snapshot.",
  parameters: z.object({
    name: z.string().describe("The name of the snapshot to restore"),
  }),
  async execute(params, ctx) {
    const snapshotDir = path.join(Global.Path.data, "snapshots")
    const filePath = path.join(snapshotDir, `${params.name}.json`)
    
    if (!(await Filesystem.exists(filePath))) {
      throw new Error(`Snapshot '${params.name}' not found at ${filePath}`)
    }
    
    const data = JSON.parse(await Filesystem.readText(filePath))
    
    // In a real implementation, we would create a NEW session and inject these messages.
    // For this prototype, we'll return the summary.
    
    return {
      title: `Snapshot '${params.name}' retrieved`,
      output: `Found snapshot from ${new Date(data.timestamp).toLocaleString()}. It contains ${data.messages.length} messages. To fully restore, create a new session and paste this context.`,
      metadata: { snapshot: data }
    }
  },
})
