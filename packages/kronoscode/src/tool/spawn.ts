import z from "zod"
import { Tool } from "./tool"
import { Session } from "../session"
import { Identifier } from "../id/id"
import { Instance } from "../project/instance"

export const AgentSpawnTool = Tool.define("spawn_worker", {
  description: "Spawn a specialized sub-agent (worker) to handle a specific part of a larger task in parallel.",
  parameters: z.object({
    task: z.string().describe("The specific sub-task for the worker agent"),
    context: z.string().describe("Relevant context or file paths the worker should focus on"),
    persona: z
      .enum(["architect", "security", "docs", "default"])
      .optional()
      .describe("The persona for the worker agent"),
    model: z.string().optional().describe("The AI model to use for the worker (e.g., 'claude-4-sonnet', 'gpt-4o')"),
  }),
  async execute(params, ctx) {
    const parent = await Session.get(ctx.sessionID)

    // Create a child session
    const child = await Session.createNext({
      parentID: ctx.sessionID,
      directory: Instance.directory,
      title: `Worker: ${params.task.slice(0, 30)}...`,
    })

    // Initialize the child session with the specific task
    const userMsg: any = {
      id: Identifier.ascending("message"),
      sessionID: child.id,
      role: "user",
      time: { created: Date.now() },
      agent: "build",
    }

    await Session.updateMessage(userMsg)
    await Session.updatePart({
      id: Identifier.ascending("part"),
      messageID: userMsg.id,
      sessionID: child.id,
      type: "text",
      text: `Task from Director Agent: ${params.task}

Context:
${params.context}

${params.model ? `Preferred Model: ${params.model}\n` : ""}Please execute this task and report back.`,
      synthetic: true,
    } as any)

    return {
      title: `Worker agent spawned`,
      output: `Successfully spawned a worker agent in session ${child.id}.${params.model ? ` Using model: ${params.model}.` : ""} You can track its progress in the sidebar under child sessions.`,
      metadata: { childID: child.id, model: params.model },
    }
  },
})
