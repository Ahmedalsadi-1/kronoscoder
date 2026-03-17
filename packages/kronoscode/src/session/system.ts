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
import type { CapabilityBroker } from "./capability-broker"

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

  export async function environment(
    model: Provider.Model,
    routing?: {
      decision: CapabilityBroker.Decision
      suppressedTools: string[]
    },
  ) {
    const project = Instance.project
    const suggestions = await SkillSuggestion.suggest()
    const cfg = await Config.get()
    const persona = cfg.agent?.persona || "default"
    const desktopPolicy =
      "  Desktop mode: BrowserOS (KronosChamber built-in browser) is the default and primary browser path. Use built-in browser_* tools first for all interactive browser work."
    const e2bEnvHint =
      "  E2B sandbox: use e2b_* only for explicit background desktop tasks or when user asks for E2B; otherwise stay on BrowserOS/browser tools. If E2B credentials are missing, report actionable remediation."
    const kronosCapabilityPolicy = [
      "  Tool priority: Use built-in tools FIRST (they're optimized and always available). Use skills SECOND. Use MCP as fallback when built-in + skills don't cover the use case.",
      "  Built-in tools include: bash, read, write, edit, glob, grep, task, spawn, webfetch, websearch, codesearch, lsp, browser_*, screenpipe_*, e2b_* (including e2b_desktop_*), anything_*, pluely_*, jaaz_*, voice_box_*, everywhere, openfang, skill, todo, and more.",
      "  Routing eligibility is staged: stage1 built-ins only; stage2 built-in-adjacent and skills; stage3 approved MCP fallback.",
      "  Connector-native tools (screenpipe_*, pluely_*, jaaz_*) must be treated as availability-gated: check status/health first and report exact missing dependency when unavailable.",
      "  Capability source-of-truth: trust host/runtime capability context for live connector health and workspace availability; do not infer availability from registry presence alone.",
      "  Connector selection contract: pick the healthiest connector that satisfies requested capability, then report connector name + explicit fallback reason in the response when degraded or rerouted.",
      "  Workspace routing: align recommendations with active workspace (chat/business/browser/creative/desktop-control) and provide explicit fallback when a workspace is unavailable.",
      "  Skill policy: Use skill tool to load specialized capabilities when task requires specific expertise.",
      "  MCP policy: Use MCP servers only when built-in tools and skills don't provide the needed capability.",
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
      "  User-desktop routing policy: browser tasks -> browseros first; native macOS tasks -> ghost-os first; remote/background desktop tasks -> e2b first when requested/required; approved MCP only as fallback.",
    ]

    const skillsList =
      suggestions.length > 0
        ? `  Suggested skills for this project: ${suggestions.map((s) => s.name).join(", ")} (You can load these using the \`skill\` tool)`
        : ""

    const routingBlock = routing
      ? [
          `<routing>`,
          `  taskClass: ${routing.decision.taskClass}`,
          `  stage: ${routing.decision.stage}`,
          `  selectedRuntimeMode: ${routing.decision.selectedRuntimeMode}`,
          `  selectedAgent: ${routing.decision.selectedAgent}`,
          `  eligibleFamilies: ${routing.decision.eligibleFamilies.join(", ") || "none"}`,
          `  suppressedFamilies: ${routing.decision.suppressedFamilies.join(", ") || "none"}`,
          `  selectedMcpServers: ${routing.decision.selectedMcpServers.join(", ") || "none"}`,
          `  requiredMcpMissing: ${routing.decision.requiredMcpMissing.join(", ") || "none"}`,
          `  enforcementMode: ${routing.decision.enforcement.mode}`,
          `  enforcementReason: ${routing.decision.enforcement.reason ?? "none"}`,
          `  fallbackReason: ${routing.decision.fallbackReason ?? "none"}`,
          `  routeValid: ${routing.decision.critic.routeValid ? "true" : "false"}`,
          `  routeIssues: ${routing.decision.critic.issues.join(", ") || "none"}`,
          `  suppressedTools: ${routing.suppressedTools.join(", ") || "none"}`,
          `</routing>`,
        ]
      : []

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
        ...routingBlock,
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
