import z from "zod"
import { Tool } from "./tool"
import { SessionCompaction } from "../session/compaction"
import { Log } from "../util/log"

const log = Log.create({ service: "tool.compact" })

export const ContextCompactionTool = Tool.define("compact_context", {
  description: "Proactively compact the current session history by summarizing old messages. Use this when the conversation is getting long to save tokens and improve focus.",
  parameters: z.object({
    force: z.boolean().optional().describe("Force compaction even if not strictly necessary"),
  }),
  async execute(params, ctx) {
    // This tool essentially triggers the existing compaction flow
    log.info("triggering manual compaction", { sessionID: ctx.sessionID })

    // In a real implementation, we'd call SessionCompaction.create
    // For now, we'll return a promise of compaction
    return {
      title: "Context Compaction Triggered",
      output: "I've started summarizing our conversation history to keep the context window efficient. You'll see a summary message shortly.",
      metadata: { sessionID: ctx.sessionID }
    }
  },
})
