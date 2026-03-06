import z from "zod"
import { Tool } from "./tool"
import { SkillSuggestion } from "../skill/suggestion"
import { Log } from "../util/log"
import { SkillPrewarm } from "../skill/prewarm"

const log = Log.create({ service: "tool.predictive_skills" })

export const PredictiveSkillLoaderTool = Tool.define("load_predictive_skills", {
  description: "Analyze the current file imports and project state to predict and pre-load skills the agent might need next. This reduces latency and ensures the agent is always 'warmed up'.",
  parameters: z.object({
    auto: z.boolean().optional().describe("Automatically load suggested skills without confirmation"),
  }),
  async execute(params, ctx) {
    const suggestions = await SkillSuggestion.suggest()
    const cwd = process.cwd()
    const agent = ctx.agent || null
    
    if (suggestions.length === 0) {
      return {
        title: "Predictive Skill Loading",
        output: "No new skills predicted for the current context.",
        metadata: { suggested: [], cached: false, cwd, agent }
      }
    }

    if (params.auto) {
      const warmed = await SkillPrewarm.prewarm({ cwd, agent })
      return {
        title: "Skills Pre-loaded",
        output: `Successfully pre-loaded ${warmed.suggested.length} skills: ${warmed.suggested.join(", ")}.`,
        metadata: { suggested: warmed.suggested, cached: warmed.cached, cwd: warmed.cwd, agent: warmed.agent }
      }
    }

    return {
      title: "Predicted Skills Found",
      output: `I predict you might need these skills next: \n${suggestions.map(s => `- ${s.name} (${s.description})`).join("\n")} \n\nUse 'load_predictive_skills(auto=true)' to pre-warm the environment.`,
      metadata: { suggested: suggestions.map(s => s.name), cached: false, cwd, agent }
    }
  },
})
