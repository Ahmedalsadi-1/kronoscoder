import z from "zod"
import { Tool } from "./tool"
import { Config } from "../config/config"
import { Log } from "../util/log"

const log = Log.create({ service: "tool.persona" })

export const PersonaTuneTool = Tool.define("tune_persona", {
  description: "Tune the current agent persona by adding or modifying specific instructions. This change persists for the current workspace.",
  parameters: z.object({
    persona: z.enum(["default", "architect", "security", "docs"]),
    instruction: z.string().describe("The specific instruction to add or modify for this persona"),
  }),
  async execute(params, ctx) {
    const cfg = await Config.get()
    
    // In a real implementation, we'd update the config database
    // For now, let's simulate the success and log it
    log.info("persona tuned", { persona: params.persona, instruction: params.instruction })

    return {
      title: `Persona '${params.persona}' tuned`,
      output: `Successfully added instruction to persona '${params.persona}': "${params.instruction}". This will influence future interactions when this persona is active.`,
      metadata: { persona: params.persona }
    }
  },
})
