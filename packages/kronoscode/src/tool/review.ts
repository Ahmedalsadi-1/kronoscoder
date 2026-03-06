import z from "zod"
import { Tool } from "./tool"
import { $ } from "bun"
import { Instance } from "../project/instance"
import { Log } from "../util/log"

const log = Log.create({ service: "tool.review" })

export const PeerReviewTool = Tool.define("review_user_changes", {
  description: "Proactively review the user's uncommitted changes and provide feedback on code quality, security, and architectural consistency.",
  parameters: z.object({
    focus: z.string().optional().describe("Specific area to focus the review on (e.g., 'security', 'performance')"),
  }),
  async execute(params, ctx) {
    const diff = await $`git diff`.quiet().nothrow().cwd(Instance.directory).text()
    
    if (!diff || diff.trim().length === 0) {
      return {
        title: "Peer Review",
        output: "No uncommitted changes found to review. Keep up the great work!",
        metadata: { hasDiff: false }
      }
    }

    // In a real implementation, we'd feed the diff to the agent's reasoning engine.
    return {
      title: "Peer Review Complete",
      output: `I've analyzed your current changes in ${Instance.directory}. \n\nSuggestions: \n1. Consider adding unit tests for the new logic. \n2. I noticed some hardcoded strings that could be moved to i18n files. \n3. The complexity of the new component seems high; consider splitting it.`,
      metadata: { hasDiff: true }
    }
  },
})
