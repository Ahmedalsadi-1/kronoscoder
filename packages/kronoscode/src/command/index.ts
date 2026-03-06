import { BusEvent } from "@/bus/bus-event"
import z from "zod"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import { Identifier } from "../id/id"
import PROMPT_INITIALIZE from "./template/initialize.txt"
import PROMPT_REVIEW from "./template/review.txt"
import { MCP } from "../mcp"
import { Skill } from "../skill"

export namespace Command {
  export const Event = {
    Executed: BusEvent.define(
      "command.executed",
      z.object({
        name: z.string(),
        sessionID: Identifier.schema("session"),
        arguments: z.string(),
        messageID: Identifier.schema("message"),
      }),
    ),
  }

  export const Info = z
    .object({
      name: z.string(),
      description: z.string().optional(),
      agent: z.string().optional(),
      model: z.string().optional(),
      source: z.enum(["command", "mcp", "skill"]).optional(),
      // workaround for zod not supporting async functions natively so we use getters
      // https://zod.dev/v4/changelog?id=zfunction
      template: z.promise(z.string()).or(z.string()),
      subtask: z.boolean().optional(),
      hints: z.array(z.string()),
    })
    .meta({
      ref: "Command",
    })

  // for some reason zod is inferring `string` for z.promise(z.string()).or(z.string()) so we have to manually override it
  export type Info = Omit<z.infer<typeof Info>, "template"> & { template: Promise<string> | string }

  export function hints(template: string): string[] {
    const result: string[] = []
    const numbered = template.match(/\$\d+/g)
    if (numbered) {
      for (const match of [...new Set(numbered)].sort()) result.push(match)
    }
    if (template.includes("$ARGUMENTS")) result.push("$ARGUMENTS")
    return result
  }

  export const Default = {
    INIT: "init",
    REVIEW: "review",
    GIT_UNDO: "git.undo",
    GIT_SPLIT: "git.split",
    GIT_SQUASH: "git.squash",
    GIT_COMMIT: "git.commit",
  } as const

  const state = Instance.state(async () => {
    const cfg = await Config.get()

    const result: Record<string, Info> = {
      [Default.INIT]: {
        name: Default.INIT,
        description: "create/update AGENTS.md",
        source: "command",
        get template() {
          return PROMPT_INITIALIZE.replace("${path}", Instance.worktree)
        },
        hints: hints(PROMPT_INITIALIZE),
      },
      [Default.REVIEW]: {
        name: Default.REVIEW,
        description: "review changes [commit|branch|pr], defaults to uncommitted",
        source: "command",
        get template() {
          return PROMPT_REVIEW.replace("${path}", Instance.worktree)
        },
        subtask: true,
        hints: hints(PROMPT_REVIEW),
      },
      [Default.GIT_UNDO]: {
        name: Default.GIT_UNDO,
        description: "undo the last commit or uncommitted changes",
        source: "command",
        template: "Please undo the last commit (reset head~1) or discard my uncommitted changes if that makes more sense. Confirm with me first if you are unsure.",
        hints: [],
      },
      [Default.GIT_SPLIT]: {
        name: Default.GIT_SPLIT,
        description: "split my current changes into multiple logical commits",
        source: "command",
        template: "Analyze my current uncommitted changes and split them into multiple logical, atomic commits. Craft descriptive commit messages for each.",
        hints: [],
      },
      [Default.GIT_SQUASH]: {
        name: Default.GIT_SQUASH,
        description: "squash the last $1 commits into one",
        source: "command",
        template: "Squash the last $1 commits into a single commit with a clean, unified commit message.",
        hints: ["$1"],
      },
      [Default.GIT_COMMIT]: {
        name: Default.GIT_COMMIT,
        description: "craft a great commit message and commit my changes",
        source: "command",
        template: "Review my staged (or unstaged) changes, craft a high-quality commit message following conventional commits, and commit them. $ARGUMENTS",
        hints: ["$ARGUMENTS"],
      },
      "blueprint": {
        name: "blueprint",
        description: "create a visual architectural blueprint before implementing",
        source: "command",
        template: "I want to build a new feature. Before you write any implementation code, create a high-level blueprint. This should include: 1. A Mermaid diagram of the architecture. 2. A proposed file structure. 3. A list of key components and their responsibilities. Wait for my 'vibe check' before proceeding. $ARGUMENTS",
        hints: ["$ARGUMENTS"],
      },
      "review.me": {
        name: "review.me",
        description: "ask the agent to review your current uncommitted changes",
        source: "command",
        template: "Please perform a proactive peer review of my current uncommitted changes. Analyze the diff, catch potential bugs, and suggest improvements or refactors. $ARGUMENTS",
        hints: ["$ARGUMENTS"],
      },
      "maintain.docs": {
        name: "maintain.docs",
        description: "automatically update project documentation based on recent changes",
        source: "command",
        template: "Analyze the recent changes in this project and update the README.md and AGENTS.md files to ensure they are accurate and up-to-date. $ARGUMENTS",
        hints: ["$ARGUMENTS"],
      },
      "health": {
        name: "health",
        description: "calculate the project health score and quality metrics",
        source: "command",
        template: "Analyze this project and calculate a 'Project Health Score'. Consider test coverage, documentation completeness, and technical debt (code complexity). Provide a high-level report. $ARGUMENTS",
        hints: ["$ARGUMENTS"],
      },
    }

    for (const [name, command] of Object.entries(cfg.command ?? {})) {
      result[name] = {
        name,
        agent: command.agent,
        model: command.model,
        description: command.description,
        source: "command",
        get template() {
          return command.template
        },
        subtask: command.subtask,
        hints: hints(command.template),
      }
    }
    for (const [name, prompt] of Object.entries(await MCP.prompts())) {
      result[name] = {
        name,
        source: "mcp",
        description: prompt.description,
        get template() {
          // since a getter can't be async we need to manually return a promise here
          return new Promise<string>(async (resolve, reject) => {
            const template = await MCP.getPrompt(
              prompt.client,
              prompt.name,
              prompt.arguments
                ? // substitute each argument with $1, $2, etc.
                  Object.fromEntries(prompt.arguments?.map((argument, i) => [argument.name, `$${i + 1}`]))
                : {},
            ).catch(reject)
            resolve(
              template?.messages
                .map((message) => (message.content.type === "text" ? message.content.text : ""))
                .join("\n") || "",
            )
          })
        },
        hints: prompt.arguments?.map((_, i) => `$${i + 1}`) ?? [],
      }
    }

    // Add skills as invokable commands
    for (const skill of await Skill.all()) {
      // Skip if a command with this name already exists
      if (result[skill.name]) continue
      result[skill.name] = {
        name: skill.name,
        description: skill.description,
        source: "skill",
        get template() {
          return skill.content
        },
        hints: [],
      }
    }

    return result
  })

  export async function get(name: string) {
    return state().then((x) => x[name])
  }

  export async function list() {
    return state().then((x) => Object.values(x))
  }
}
