import z from "zod"
import { Tool } from "./tool"
import { Session } from "../session"
import { SessionSummary } from "../session/summary"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"
import path from "path"

export const HandoffGeneratorTool = Tool.define("generate_handoff", {
  description: "Generate a comprehensive developer handoff summary for the current session. This document explains what was changed, why, and what remains to be done.",
  parameters: z.object({
    filename: z.string().optional().describe("The name of the handoff file (defaults to HANDOFF.md)"),
  }),
  async execute(params, ctx) {
    const session = await Session.get(ctx.sessionID)
    const messages = await Session.messages({ sessionID: ctx.sessionID })
    const diffs = await SessionSummary.computeDiff({ messages })
    
    const handoff = `
# Developer Handoff: ${session.title}
Generated: ${new Date().toLocaleString()}

## Context
This session focused on: ${session.title}

## Changes Summary
- **Files Modified**: ${diffs.length}
- **Additions**: ${diffs.reduce((s, x) => s + x.additions, 0)}
- **Deletions**: ${diffs.reduce((s, x) => s + x.deletions, 0)}

### Modified Files:
${diffs.map(d => `- ${d.file} (+${d.additions} -${d.deletions})`).join("\n")}

## Architectural Choices
[Agent to fill in reasoning based on conversation history]

## Next Steps
- [ ] Verify the changes in a staging environment.
- [ ] Run the full test suite.
- [ ] Review the hardcoded strings in the new UI components.
    `
    
    const filePath = path.join(Instance.directory, params.filename || "HANDOFF.md")
    await Filesystem.write(filePath, handoff)

    return {
      title: "Handoff Generated",
      output: `Successfully generated handoff document at ${filePath}. This summary will help human reviewers understand the work done in this session.`,
      metadata: { path: filePath }
    }
  },
})
