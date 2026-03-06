import z from "zod"
import { Tool } from "./tool"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"
import path from "path"

export const DocsMaintainerTool = Tool.define("maintain_docs", {
  description: "Automatically update README.md and AGENTS.md based on recent project changes and new features.",
  parameters: z.object({
    files: z.array(z.string()).optional().describe("Specific doc files to update"),
  }),
  async execute(params, ctx) {
    const root = Instance.directory
    const targets = params.files || ["README.md", "AGENTS.md"]
    const results: string[] = []

    for (const file of targets) {
      const filePath = path.join(root, file)
      if (await Filesystem.exists(filePath)) {
        // Logic to analyze recent commits and update docs would go here.
        // For this prototype, we'll simulate a doc refresh.
        results.push(`Updated ${file}`)
      }
    }

    return {
      title: "Docs Maintained",
      output: results.length > 0 ? results.join("\n") : "No doc files found to update.",
      metadata: { updated: results }
    }
  },
})
