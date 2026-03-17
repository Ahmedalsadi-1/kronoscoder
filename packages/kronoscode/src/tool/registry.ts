import { QuestionTool } from "./question"
import { BashTool } from "./bash"
import { EditTool } from "./edit"
import { GlobTool } from "./glob"
import { GrepTool } from "./grep"
import { BatchTool } from "./batch"
import { ReadTool } from "./read"
import { TaskTool } from "./task"
import { TodoWriteTool, TodoReadTool } from "./todo"
import { WebFetchTool } from "./webfetch"
import { WriteTool } from "./write"
import { InvalidTool } from "./invalid"
import { SkillTool, SkillUpdateTool } from "./skill"
import type { Agent } from "../agent/agent"
import { Tool } from "./tool"
import { Instance } from "../project/instance"
import { Config } from "../config/config"
import path from "path"
import { type ToolContext as PluginToolContext, type ToolDefinition } from "@kronoscode-ai/plugin"
import z from "zod"
import { Plugin } from "../plugin"
import { WebSearchTool } from "./websearch"
import { CodeSearchTool } from "./codesearch"
import { Flag } from "@/flag/flag"
import { Log } from "@/util/log"
import { LspTool } from "./lsp"
import { Truncate } from "./truncation"
import { PlanExitTool, PlanEnterTool } from "./plan"
import { SnapshotSaveTool, SnapshotRestoreTool } from "./snapshot"
import { AgentSpawnTool } from "./spawn"
import { EnvironmentDoctorTool } from "./doctor"
import { PersonaTuneTool } from "./persona"
import { NotificationTool } from "./notify"
import { PeerReviewTool } from "./review"
import { DocsMaintainerTool } from "./docs"
import { AgentForgeTool } from "./forge"
import { ACPProxyTool } from "./acp_proxy"
import { SwarmDiscoveryTool } from "./swarm"
import { MeshSearchTool } from "./mesh_search"
import { ContextCompactionTool } from "./compact"
import { HandoffGeneratorTool } from "./handoff"
import { AutoSaveTool } from "./autosave"
import { MultiModelConsensusTool } from "./consensus"
import { GhostStagingTool } from "./ghost"
import { ProjectHealthTool } from "./health"
import { PredictiveSkillLoaderTool } from "./predictive_skills"
import { ApplyPatchTool } from "./apply_patch"
import { DynamicToolCreator } from "./dynamic"
import { MCP } from "../mcp"
import { EverywhereTool } from "./everywhere"
import { OpenFangTool } from "./openfang"
import { Glob } from "../util/glob"
import { AIBrowserTools } from "./ai_browser"
import {
  ScreenpipeSearchTool,
  ScreenpipeRecallTool,
  ScreenpipeContextTool,
  ScreenpipeDigestTool,
  isScreenpipeAvailable,
} from "./screenpipe"
import { E2BCreateTool, E2BListTool, E2BProvidersTool, E2BTakeoverTool, E2BReleaseTool, E2BQuotaTool } from "./e2b"
import {
  E2BDesktopScreenshotTool,
  E2BDesktopClickTool,
  E2BDesktopTypeTool,
  E2BDesktopHotkeyTool,
  E2BDesktopDragTool,
  E2BDesktopWindowListTool,
  E2BDesktopWindowFocusTool,
  E2BDesktopOpenAppTool,
  E2BDesktopClipboardGetTool,
  E2BDesktopClipboardSetTool,
  E2BDesktopWaitTool,
  E2BDesktopRunMacroTool,
} from "./e2b"
import {
  PluelyTool,
  PluelyVoiceStartTool,
  PluelyVoiceStopTool,
  PluelyTranscriptGetTool,
  PluelyOverlayShowTool,
  PluelyOverlayHideTool,
  PluelyContextRecentTool,
} from "./pluely"
import {
  JaazTool,
  JaazGenerateTool,
  JaazGenerateBatchTool,
  JaazProjectListTool,
  JaazProjectCreateTool,
  JaazExportTool,
} from "./jaaz"
import {
  AnythingBrowserActionTool,
  AnythingOpenContextMenuTool,
  AnythingDoubleClickHandoffTool,
  AnythingCaptureSelectionTool,
} from "./anything"
import {
  VoiceBoxOpenTool,
  VoiceBoxListenTool,
  VoiceBoxInterruptTool,
  VoiceBoxInjectPromptTool,
} from "./voice_bus"
import { isMcpPolicyAllowed } from "@/mcp/policy"

export namespace ToolRegistry {
  const log = Log.create({ service: "tool.registry" })

  type ToolCapability = {
    id: string
    connector: string
    risk_level: "low" | "medium" | "high"
    interactive: boolean
    fallback: string[]
  }

  export type CapabilityPromotion = "builtin" | "builtin-adjacent" | "mcp-approved" | "mcp-hidden"
  export type CapabilityHealth = "healthy" | "degraded" | "unavailable"
  export type CapabilityScorecardItem = {
    id: string
    source: "builtin" | "mcp"
    connector: string
    required_auth_env: string[]
    risk_level: "low" | "medium" | "high"
    health_status: CapabilityHealth
    verification_strategy: string
    promotion_status: CapabilityPromotion
    interactive: boolean
    fallback: string[]
  }

  export const state = Instance.state(async () => {
    const custom = [] as Tool.Info[]

    const matches = await Config.directories().then((dirs) =>
      dirs.flatMap((dir) =>
        Glob.scanSync("{tool,tools}/*.{js,ts}", { cwd: dir, absolute: true, dot: true, symlink: true }),
      ),
    )
    if (matches.length) await Config.waitForDependencies()
    for (const match of matches) {
      const namespace = path.basename(match, path.extname(match))
      const mod = await import(match)
      for (const [id, def] of Object.entries<ToolDefinition>(mod)) {
        custom.push(fromPlugin(id === "default" ? namespace : `${namespace}_${id}`, def))
      }
    }

    const plugins = await Plugin.list()
    for (const plugin of plugins) {
      for (const [id, def] of Object.entries(plugin.tool ?? {})) {
        custom.push(fromPlugin(id, def))
      }
    }

    return { custom }
  })

  function fromPlugin(id: string, def: ToolDefinition): Tool.Info {
    return {
      id,
      init: async (initCtx) => ({
        parameters: z.object(def.args),
        description: def.description,
        execute: async (args, ctx) => {
          const pluginCtx = {
            ...ctx,
            directory: Instance.directory,
            worktree: Instance.worktree,
          } as unknown as PluginToolContext
          const result = await def.execute(args as any, pluginCtx)
          const out = await Truncate.output(result, {}, initCtx?.agent)
          return {
            title: "",
            output: out.truncated ? out.content : result,
            metadata: { truncated: out.truncated, outputPath: out.truncated ? out.outputPath : undefined },
          }
        },
      }),
    }
  }

  export async function register(tool: Tool.Info) {
    const { custom } = await state()
    const idx = custom.findIndex((t) => t.id === tool.id)
    if (idx >= 0) {
      custom.splice(idx, 1, tool)
      return
    }
    custom.push(tool)
  }

  export async function capabilities(): Promise<ToolCapability[]> {
    const tools = await all()
    const defaults: ToolCapability[] = tools.map((tool) => ({
      id: tool.id,
      connector:
        tool.id.startsWith("e2b_")
          ? "e2b"
          : tool.id.startsWith("pluely_")
            ? "pluely"
            : tool.id.startsWith("jaaz_")
              ? "jaaz"
              : tool.id.startsWith("screenpipe_")
                ? "screenpipe"
                : tool.id.startsWith("anything_")
                  ? "anything"
                  : tool.id.startsWith("voice_box_")
                    ? "voice_bus"
                    : tool.id.startsWith("browser_") || tool.id.startsWith("kronoschamber_browser_")
                      ? "browser"
                      : "core",
      risk_level: tool.id.includes("delete") || tool.id.includes("apply_patch") ? "high" : "medium",
      interactive: !tool.id.startsWith("screenpipe_"),
      fallback: [],
    }))
    return defaults
  }

  export async function capabilityScorecard(): Promise<CapabilityScorecardItem[]> {
    const builtins = await capabilities()
    const mcpStatus = await MCP.status().catch(() => ({}))

    const builtinItems: CapabilityScorecardItem[] = builtins.map((item) => {
      const auth: string[] = []
      if (item.connector === "e2b") auth.push("E2B_API_KEY|E2B_ACCESS_TOKEN")
      if (item.connector === "pluely") auth.push("PLUELY_API_KEY")
      if (item.connector === "jaaz") auth.push("JAAZ_API_KEY")
      if (item.id.startsWith("ghost_")) auth.push("macOS desktop runtime")

      const promotion: CapabilityPromotion = item.id.startsWith("ghost_") ? "builtin-adjacent" : "builtin"
      const health: CapabilityHealth =
        item.connector === "e2b" && !(process.env.E2B_API_KEY || process.env.E2B_ACCESS_TOKEN) ? "degraded" : "healthy"

      return {
        id: item.id,
        source: "builtin",
        connector: item.connector,
        required_auth_env: auth,
        risk_level: item.risk_level,
        health_status: health,
        verification_strategy: `tool-contract:${item.connector}`,
        promotion_status: promotion,
        interactive: item.interactive,
        fallback: item.fallback,
      }
    })

    const mcpItems: CapabilityScorecardItem[] = Object.entries(mcpStatus).map(([name, status]) => {
      const promotion: CapabilityPromotion = name === "ghost-os" ? "builtin-adjacent" : isMcpPolicyAllowed(name) ? "mcp-approved" : "mcp-hidden"
      const health: CapabilityHealth =
        status.status === "connected"
          ? "healthy"
          : status.status === "disabled" || status.status === "needs_auth" || status.status === "needs_client_registration"
            ? "degraded"
            : "unavailable"

      return {
        id: name,
        source: "mcp",
        connector: "mcp",
        required_auth_env: [`mcp:${name}`],
        risk_level: "medium",
        health_status: health,
        verification_strategy: `connector-health:${name}`,
        promotion_status: promotion,
        interactive: true,
        fallback: ["builtin", "skill"],
      }
    })

    return [...builtinItems, ...mcpItems]
  }

  async function all(): Promise<Tool.Info[]> {
    const custom = await state().then((x) => x.custom)
    const config = await Config.get()
    const question = ["app", "cli", "desktop"].includes(Flag.KRONOSCODE_CLIENT) || Flag.KRONOSCODE_ENABLE_QUESTION_TOOL

    return [
      InvalidTool,
      ...(question ? [QuestionTool] : []),
      BashTool,
      ReadTool,
      GlobTool,
      GrepTool,
      EditTool,
      WriteTool,
      TaskTool,
      WebFetchTool,
      TodoWriteTool,
      // TodoReadTool,
      WebSearchTool,
      CodeSearchTool,
      SkillTool,
      SkillUpdateTool,
      EverywhereTool,
      OpenFangTool,
      DynamicToolCreator,
      SnapshotSaveTool,
      SnapshotRestoreTool,
      AgentSpawnTool,
      EnvironmentDoctorTool,
      PersonaTuneTool,
      NotificationTool,
      PeerReviewTool,
      DocsMaintainerTool,
      AgentForgeTool,
      ACPProxyTool,
      SwarmDiscoveryTool,
      MeshSearchTool,
      ContextCompactionTool,
      HandoffGeneratorTool,
      AutoSaveTool,
      MultiModelConsensusTool,
      GhostStagingTool,
      ProjectHealthTool,
      PredictiveSkillLoaderTool,
      ApplyPatchTool,
      ScreenpipeSearchTool,
      ScreenpipeRecallTool,
      ScreenpipeContextTool,
      ScreenpipeDigestTool,
      ...AIBrowserTools,
      LspTool,
      BatchTool,
      E2BCreateTool,
      E2BListTool,
      E2BProvidersTool,
      E2BTakeoverTool,
      E2BReleaseTool,
      E2BQuotaTool,
      E2BDesktopScreenshotTool,
      E2BDesktopClickTool,
      E2BDesktopTypeTool,
      E2BDesktopHotkeyTool,
      E2BDesktopDragTool,
      E2BDesktopWindowListTool,
      E2BDesktopWindowFocusTool,
      E2BDesktopOpenAppTool,
      E2BDesktopClipboardGetTool,
      E2BDesktopClipboardSetTool,
      E2BDesktopWaitTool,
      E2BDesktopRunMacroTool,
      PluelyTool,
      PluelyVoiceStartTool,
      PluelyVoiceStopTool,
      PluelyTranscriptGetTool,
      PluelyOverlayShowTool,
      PluelyOverlayHideTool,
      PluelyContextRecentTool,
      JaazTool,
      JaazGenerateTool,
      JaazGenerateBatchTool,
      JaazProjectListTool,
      JaazProjectCreateTool,
      JaazExportTool,
      AnythingBrowserActionTool,
      AnythingOpenContextMenuTool,
      AnythingDoubleClickHandoffTool,
      AnythingCaptureSelectionTool,
      VoiceBoxOpenTool,
      VoiceBoxListenTool,
      VoiceBoxInterruptTool,
      VoiceBoxInjectPromptTool,
      ...(Flag.KRONOSCODE_EXPERIMENTAL_PLAN_MODE && Flag.KRONOSCODE_CLIENT === "cli"
        ? [PlanExitTool, PlanEnterTool]
        : []),
      ...custom,
    ]
  }

  export async function ids() {
    const tools = await all()
    const mcp = await MCP.tools().catch(() => ({}))
    return tools.map((t) => t.id).concat(Object.keys(mcp))
  }

  export async function tools(
    model: {
      providerID: string
      modelID: string
    },
    agent?: Agent.Info,
  ) {
    const tools = await all()
    const capabilityByID = new Map((await capabilities()).map((item) => [item.id, item] as const))
    const result = await Promise.all(
      tools
        .filter((t) => {
          // Enable websearch/codesearch for all users (was gated to kronoscode provider only)
          if (t.id === "codesearch" || t.id === "websearch") {
            return true
          }

          // use apply tool in same format as codex
          const usePatch =
            model.modelID.includes("gpt-") && !model.modelID.includes("oss") && !model.modelID.includes("gpt-4")
          if (t.id === "apply_patch") return usePatch
          if (t.id === "edit" || t.id === "write") return !usePatch

          return true
        })
        .map(async (t) => {
          using _ = log.time(t.id)
          const tool = await t.init({ agent })
          const output = {
            description: tool.description,
            parameters: tool.parameters,
          }
          await Plugin.trigger("tool.definition", { toolID: t.id }, output)
          return {
            id: t.id,
            ...tool,
            ...(capabilityByID.get(t.id) || {}),
            description: output.description,
            parameters: output.parameters,
          }
        }),
    )
    return result
  }
}
