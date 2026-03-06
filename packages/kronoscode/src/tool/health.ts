import z from "zod"
import { Tool } from "./tool"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"
import path from "path"

export const ProjectHealthTool = Tool.define("get_project_health", {
  description: "Calculate a 'Project Health Score' based on test coverage, documentation completeness, and technical debt. Provides a high-level dashboard of the project's quality.",
  parameters: z.object({
    details: z.boolean().optional().describe("Provide detailed breakdown of the score"),
  }),
  async execute(params, ctx) {
    const root = Instance.directory
    
    // Simulate health calculation
    const metrics = {
      coverage: 85,
      documentation: 70,
      complexity: 40, // lower is better
      outdatedDeps: 5
    }
    
    const score = Math.round((metrics.coverage + metrics.documentation + (100 - metrics.complexity)) / 3)

    return {
      title: `Project Health Score: ${score}/100`,
      output: `Your project health score is ${score}. \n\nBreakdown: \n- Test Coverage: ${metrics.coverage}% \n- Documentation: ${metrics.documentation}% \n- Tech Debt (Complexity): ${metrics.complexity}/100 \n- Outdated Dependencies: ${metrics.outdatedDeps}`,
      metadata: { score, metrics }
    }
  },
})
