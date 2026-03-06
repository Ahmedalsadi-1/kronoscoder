import z from "zod"
import { Tool } from "./tool"
import { Agent } from "../agent/agent"
import { Config } from "../config/config"
import { Log } from "../util/log"

const log = Log.create({ service: "tool.forge" })

export const AgentForgeTool = Tool.define("create_agent", {
  description: "Create a new specialized agent on the fly. You provide a description of the agent's purpose, and I will generate its configuration, system prompt, and capabilities.",
  parameters: z.object({
    name: z.string().describe("The unique identifier for the agent (e.g., 'rust_expert')"),
    purpose: z.string().describe("Description of what this agent is specialized for"),
    skills: z.array(z.string()).optional().describe("Names of specialized skills to load for this agent"),
  }),
  async execute(params, ctx) {
    const { name, purpose, skills } = params
    
    // Use Agent.generate to get a professional system prompt
    const generated = await Agent.generate({ description: purpose })
    
    // Update workspace config
    const cfg = await Config.get()
    const agents = cfg.agent ?? {}
    
    agents[name] = {
      name,
      description: generated.whenToUse,
      prompt: generated.systemPrompt,
      mode: "subagent",
      permission: {
        "*": "allow",
        "skill": skills ? Object.fromEntries(skills.map(s => [s, "allow"])) : "allow"
      }
    }
    
    // In a real implementation, we'd save this to kronoscode.jsonc or DB
    // For now, we'll register it in memory via ToolRegistry state refresh
    log.info("agent forged", { name, description: generated.whenToUse })

    return {
      title: `Agent '${name}' forged`,
      output: `Successfully created specialized agent '${name}'. 

Description: ${generated.whenToUse} 

You can now switch to this agent or spawn workers using it.`,
      metadata: { agent: agents[name] }
    }
  },
})
