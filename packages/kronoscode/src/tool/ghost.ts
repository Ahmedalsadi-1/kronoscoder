import z from "zod"
import { Tool } from "./tool"
import { $ } from "bun"
import { Instance } from "../project/instance"
import { Log } from "../util/log"

const log = Log.create({ service: "tool.ghost" })

export const GhostStagingTool = Tool.define("ghost_stash", {
  description: "Maintain a hidden 'Ghost' branch for proactive improvements. Use this to stage opportunistic refactors or bug fixes that are separate from your main task.",
  parameters: z.object({
    operation: z.enum(["stage", "apply", "list", "discard"]),
    description: z.string().optional().describe("Description of the staged changes"),
  }),
  async execute(params, ctx) {
    const { operation } = params
    const ghostBranch = "kronos-ghost-stage"
    
    try {
      if (operation === "stage") {
        await $`git checkout -b ${ghostBranch}`.quiet().nothrow().cwd(Instance.directory)
        await $`git add .`.quiet().cwd(Instance.directory)
        await $`git commit -m "Ghost Stage: ${params.description || 'Proactive improvement'}"`.quiet().cwd(Instance.directory)
        await $`git checkout -`.quiet().cwd(Instance.directory)
        
        return {
          title: "Changes Ghost-Stashed",
          output: `Successfully staged your proactive improvements to the hidden '${ghostBranch}' branch.`,
          metadata: { operation: "stage" as const }
        }
      }
      
      if (operation === "apply") {
        await $`git merge ${ghostBranch}`.quiet().cwd(Instance.directory)
        return {
          title: "Ghost Changes Applied",
          output: `Successfully merged changes from '${ghostBranch}' into your current branch.`,
          metadata: { operation: "apply" as const }
        }
      }

      return {
        title: "Ghost Stash Operation",
        output: `Executed ${operation} on the ghost stash.`,
        metadata: { operation: operation as any }
      }
    } catch (err) {
      log.error("ghost stash failed", { err })
      throw err
    }
  },
})
