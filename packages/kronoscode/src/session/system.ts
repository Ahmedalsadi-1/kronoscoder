import { Ripgrep } from "../file/ripgrep"

import { Instance } from "../project/instance"
import { Config } from "../config/config"

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_ANTHROPIC_WITHOUT_TODO from "./prompt/qwen.txt"
import PROMPT_BEAST from "./prompt/beast.txt"
import PROMPT_GEMINI from "./prompt/gemini.txt"
import PROMPT_CAPABILITIES from "./prompt/capabilities_supplement.txt"

import PROMPT_CODEX from "./prompt/codex_header.txt"
import PROMPT_TRINITY from "./prompt/trinity.txt"
import type { Provider } from "@/provider/provider"
import { SkillSuggestion } from "@/skill/suggestion"

export namespace SystemPrompt {
  export function instructions() {
    return PROMPT_CODEX.trim()
  }

  export function provider(model: Provider.Model) {
    if (model.api.id.includes("gpt-5")) return [PROMPT_CODEX]
    if (model.api.id.includes("gpt-") || model.api.id.includes("o1") || model.api.id.includes("o3"))
      return [PROMPT_BEAST]
    if (model.api.id.includes("gemini-")) return [PROMPT_GEMINI]
    if (model.api.id.includes("claude")) return [PROMPT_ANTHROPIC]
    if (model.api.id.toLowerCase().includes("trinity")) return [PROMPT_TRINITY]
    return [PROMPT_ANTHROPIC_WITHOUT_TODO]
  }

  export async function environment(model: Provider.Model) {
    const project = Instance.project
    const suggestions = await SkillSuggestion.suggest()
    const cfg = await Config.get()
    const persona = cfg.agent?.persona || "default"
    const desktopPolicy =
      "  Browser-first policy: use browser_* or kronoschamber_browser_* tools for interactive browsing, reserve e2b for background desktop tasks, and use user-desktop routing for full-control actions."
    const e2bEnvHint =
      "  If E2B auth is missing, surface these env keys: E2B_API_KEY, KRONOSCHAMBER_E2B_AUTH_MODE, KRONOSCHAMBER_E2B_ENTITLEMENT_URL, KRONOSCHAMBER_E2B_TOKEN_ISSUER_URL."
    const kronosCapabilityPolicy = [
      "  First-level capability policy: treat KronosChamber MCP configuration flows and skill installation as the primary setup path before ad-hoc custom integrations.",
      "  MCP policy: prioritize browseros, computer-use-mcp, automation-mcp, and apple_mcp for desktop routing, but never hard-block user-added MCP servers.",
      "  Extension policy: if users add new MCP servers, keep them available, explain routing impact, and only apply preference ordering for desktop-control decisions.",
      "  Skill policy: prefer skill discovery/installation and existing skill workflows first when capability is missing; only propose manual implementation when no viable skill exists.",
    ]
    const layeredPromptPolicy = [
      "  Prompt stack contract: router -> planner -> executor -> critic -> summarizer.",
      "  Router: classify user intent, choose one primary path, and state fallback path only if needed.",
      "  Planner: produce minimal ordered steps with concrete verification gates before execution.",
      "  Executor: run tools in small batches, prefer deterministic local actions, and report partial failures immediately.",
      "  Critic: verify outputs against user intent and constraints before final response.",
      "  Summarizer: return concise user-facing outcome + next action without exposing internal chain-of-thought.",
      "  Tool budgets: default max 1 broad search + 3 focused reads before coding; after edits, always run at least one verification command.",
      "  Stop conditions: stop when acceptance checks pass or when blocked by missing external credentials/environment.",
      "  User-desktop routing policy: computer-use-mcp -> automation-mcp -> local TS fallback; always report chosen provider and fallback reason.",
    ]

    const skillsList = suggestions.length > 0
      ? `  Suggested skills for this project: ${suggestions.map(s => s.name).join(", ")} (You can load these using the \`skill\` tool)`
      : ""

    return [
      [
        `You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}`,
        `Current Agent Persona: ${persona}`,
        `Here is some useful information about the environment you are running in:`,
        `<env>`,
        `  Working directory: ${Instance.directory}`,
        `  Is directory a git repo: ${project.vcs === "git" ? "yes" : "no"}`,
        `  Platform: ${process.platform}`,
        `  Today's date: ${new Date().toDateString()}`,
        skillsList,
        desktopPolicy,
        e2bEnvHint,
        ...kronosCapabilityPolicy,
        ...layeredPromptPolicy,
        `</env>`,
        `<capabilities>`,
        PROMPT_CAPABILITIES,
        `</capabilities>`,
        `<directories>`,
        `  ${
          project.vcs === "git" && false
            ? await Ripgrep.tree({
                cwd: Instance.directory,
                limit: 50,
              })
            : ""
        }`,
        `</directories>`,
      ].join("\n"),
    ]
  }
}
