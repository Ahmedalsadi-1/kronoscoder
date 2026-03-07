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

export namespace ToolRegistry {
  const log = Log.create({ service: "tool.registry" })

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

  async function all(): Promise<Tool.Info[]> {
    const custom = await state().then((x) => x.custom)
    const config = await Config.get()
    const screenpipeReady = await isScreenpipeAvailable().catch(() => false)
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
      ...(screenpipeReady
        ? [ScreenpipeSearchTool, ScreenpipeRecallTool, ScreenpipeContextTool, ScreenpipeDigestTool]
        : []),
      ...(Flag.KRONOSCODE_ENABLE_AI_BROWSER ? AIBrowserTools : []),
      ...(Flag.KRONOSCODE_EXPERIMENTAL_LSP_TOOL ? [LspTool] : []),
      ...(config.experimental?.batch_tool === true ? [BatchTool] : []),
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
    const result = await Promise.all(
      tools
        .filter((t) => {
          // Enable websearch/codesearch for zen users OR via enable flag
          if (t.id === "codesearch" || t.id === "websearch") {
            return model.providerID === "kronoscode" || Flag.KRONOSCODE_ENABLE_EXA
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
            description: output.description,
            parameters: output.parameters,
          }
        }),
    )
    return result
  }
}
