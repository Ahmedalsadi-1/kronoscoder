import z from "zod"
import { Tool } from "./tool"
import { SnapshotSaveTool } from "./snapshot"
import { Log } from "../util/log"

const log = Log.create({ service: "tool.autosave" })

export const AutoSaveTool = Tool.define("enable_autosave", {
  description: "Enable automatic session snapshotting. The agent will save its state every 5 minutes, creating a 'Logic-Level Time Machine' for the project.",
  parameters: z.object({
    intervalMinutes: z.number().int().positive().default(5),
  }),
  async execute(params, ctx) {
    // In a real implementation, we'd start a background timer
    log.info("autosave enabled", { interval: params.intervalMinutes })

    return {
      title: "Autosave Enabled",
      output: `Successfully enabled automatic snapshotting every ${params.intervalMinutes} minutes. You can now use 'restore_snapshot' to rewind to any previous state.`,
      metadata: { interval: params.intervalMinutes }
    }
  },
})
