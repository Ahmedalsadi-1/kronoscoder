import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import { streamSSE } from "hono/streaming"
import z from "zod"
import { ToolRegistry } from "../../tool/registry"
import { Worktree } from "../../worktree"
import { Instance } from "../../project/instance"
import { Project } from "../../project/project"
import { MCP } from "../../mcp"
import { Session } from "../../session"
import { zodToJsonSchema } from "zod-to-json-schema"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { BrowserRuntime } from "@/browser/runtime"
import { Flag } from "@/flag/flag"

const CANONICAL_BROWSER_ACTIONS = [
  "newPage",
  "navigate",
  "selectPage",
  "closePage",
  "back",
  "forward",
  "reload",
  "stop",
  "waitFor",
  "resize",
  "handleDialog",
  "click",
  "hover",
  "fill",
  "fillForm",
  "drag",
  "pressKey",
  "uploadFile",
  "snapshot",
  "screenshot",
  "evaluate",
  "networkRequests",
  "networkRequest",
  "console",
  "consoleMessage",
  "emulate",
  "perfStart",
  "perfStop",
  "perfInsight",
] as const

type CanonicalBrowserAction = (typeof CANONICAL_BROWSER_ACTIONS)[number]

const BROWSER_ACTION_ALIASES: Record<string, CanonicalBrowserAction> = {
  browser_new_page: "newPage",
  browser_navigate: "navigate",
  browser_select_page: "selectPage",
  browser_close_page: "closePage",
  browser_back: "back",
  browser_forward: "forward",
  browser_reload: "reload",
  browser_stop: "stop",
  browser_wait_for: "waitFor",
  browser_resize: "resize",
  browser_handle_dialog: "handleDialog",
  browser_click: "click",
  browser_hover: "hover",
  browser_fill: "fill",
  browser_fill_form: "fillForm",
  browser_drag: "drag",
  browser_press_key: "pressKey",
  browser_upload_file: "uploadFile",
  browser_snapshot: "snapshot",
  browser_screenshot: "screenshot",
  browser_evaluate: "evaluate",
  browser_network_requests: "networkRequests",
  browser_network_request: "networkRequest",
  browser_console: "console",
  browser_console_message: "consoleMessage",
  browser_emulate: "emulate",
  browser_perf_start: "perfStart",
  browser_perf_stop: "perfStop",
  browser_perf_insight: "perfInsight",
  kronoschamber_browser_new_page: "newPage",
  kronoschamber_browser_navigate: "navigate",
  kronoschamber_browser_select_page: "selectPage",
  kronoschamber_browser_close_page: "closePage",
  kronoschamber_browser_back: "back",
  kronoschamber_browser_forward: "forward",
  kronoschamber_browser_reload: "reload",
  kronoschamber_browser_stop: "stop",
  kronoschamber_browser_wait_for: "waitFor",
  kronoschamber_browser_resize: "resize",
  kronoschamber_browser_handle_dialog: "handleDialog",
  kronoschamber_browser_click: "click",
  kronoschamber_browser_hover: "hover",
  kronoschamber_browser_fill: "fill",
  kronoschamber_browser_fill_form: "fillForm",
  kronoschamber_browser_drag: "drag",
  kronoschamber_browser_press_key: "pressKey",
  kronoschamber_browser_upload_file: "uploadFile",
  kronoschamber_browser_snapshot: "snapshot",
  kronoschamber_browser_screenshot: "screenshot",
  kronoschamber_browser_evaluate: "evaluate",
  kronoschamber_browser_network_requests: "networkRequests",
  kronoschamber_browser_network_request: "networkRequest",
  kronoschamber_browser_console: "console",
  kronoschamber_browser_console_message: "consoleMessage",
  kronoschamber_browser_emulate: "emulate",
  kronoschamber_browser_perf_start: "perfStart",
  kronoschamber_browser_perf_stop: "perfStop",
  kronoschamber_browser_perf_insight: "perfInsight",
}

type BrowserActionAlias = keyof typeof BROWSER_ACTION_ALIASES
const BROWSER_ACTION_ALIAS_KEYS = Object.keys(BROWSER_ACTION_ALIASES) as BrowserActionAlias[]

const BrowserActionPayloadSchemas: Record<CanonicalBrowserAction, z.ZodTypeAny> = {
  newPage: z
    .object({
      url: z.string().optional(),
      timeout: z.number().optional(),
    })
    .passthrough(),
  navigate: z
    .object({
      type: z.enum(["url", "back", "forward", "reload"]).optional(),
      url: z.string().optional(),
      timeout: z.number().optional(),
    })
    .passthrough(),
  selectPage: z.object({ pageIdx: z.number().int().optional() }).passthrough(),
  closePage: z.object({ pageIdx: z.number().int().optional() }).passthrough(),
  back: z.record(z.string(), z.any()),
  forward: z.record(z.string(), z.any()),
  reload: z.record(z.string(), z.any()),
  stop: z.record(z.string(), z.any()),
  waitFor: z
    .object({
      text: z.string().min(1),
      timeout: z.number().optional(),
    })
    .passthrough(),
  resize: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .passthrough(),
  handleDialog: z
    .object({
      action: z.enum(["accept", "dismiss"]).optional(),
      promptText: z.string().optional(),
    })
    .passthrough(),
  click: z
    .object({
      uid: z.string().optional(),
      selector: z.string().optional(),
      button: z.enum(["left", "right", "middle"]).optional(),
      doubleClick: z.boolean().optional(),
    })
    .passthrough(),
  hover: z
    .object({
      uid: z.string().optional(),
      selector: z.string().optional(),
    })
    .passthrough(),
  fill: z
    .object({
      uid: z.string().optional(),
      selector: z.string().optional(),
      value: z.string().optional(),
    })
    .passthrough(),
  fillForm: z
    .object({
      fields: z
        .array(
          z
            .object({
              uid: z.string().optional(),
              selector: z.string().optional(),
              value: z.string(),
            })
            .passthrough(),
        )
        .optional(),
    })
    .passthrough(),
  drag: z
    .object({
      sourceUid: z.string().optional(),
      sourceSelector: z.string().optional(),
      targetUid: z.string().optional(),
      targetSelector: z.string().optional(),
    })
    .passthrough(),
  pressKey: z
    .object({
      key: z.string().optional(),
    })
    .passthrough(),
  uploadFile: z
    .object({
      uid: z.string().optional(),
      selector: z.string().optional(),
      files: z.array(z.string()).optional(),
    })
    .passthrough(),
  snapshot: z.record(z.string(), z.any()),
  screenshot: z
    .object({
      fullPage: z.boolean().optional(),
    })
    .passthrough(),
  evaluate: z
    .object({
      script: z.string().optional(),
    })
    .passthrough(),
  networkRequests: z
    .object({
      limit: z.number().optional(),
    })
    .passthrough(),
  networkRequest: z
    .object({
      index: z.number().optional(),
      urlContains: z.string().optional(),
    })
    .passthrough(),
  console: z
    .object({
      limit: z.number().optional(),
    })
    .passthrough(),
  consoleMessage: z
    .object({
      index: z.number().optional(),
    })
    .passthrough(),
  emulate: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
      colorScheme: z.enum(["light", "dark", "no-preference"]).optional(),
      reducedMotion: z.enum(["reduce", "no-preference"]).optional(),
      locale: z.string().optional(),
      timezoneId: z.string().optional(),
      geolocation: z
        .object({
          latitude: z.number(),
          longitude: z.number(),
        })
        .optional(),
    })
    .passthrough(),
  perfStart: z.record(z.string(), z.any()),
  perfStop: z.record(z.string(), z.any()),
  perfInsight: z.record(z.string(), z.any()),
}

const BrowserActionRequestSchema = (() => {
  const variants: z.ZodTypeAny[] = []

  for (const action of CANONICAL_BROWSER_ACTIONS) {
    variants.push(
      z.object({
        sessionID: z.string().min(1),
        action: z.literal(action),
        payload: BrowserActionPayloadSchemas[action].optional(),
      }),
    )
  }

  for (const alias of BROWSER_ACTION_ALIAS_KEYS) {
    const canonical = BROWSER_ACTION_ALIASES[alias]
    variants.push(
      z.object({
        sessionID: z.string().min(1),
        action: z.literal(alias),
        payload: BrowserActionPayloadSchemas[canonical].optional(),
      }),
    )
  }

  return z.union(variants as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]])
})()

type BrowserActionRequest = {
  sessionID: string
  action: string
  payload?: Record<string, unknown>
}

function canonicalBrowserAction(input: string): CanonicalBrowserAction | null {
  if ((CANONICAL_BROWSER_ACTIONS as readonly string[]).includes(input)) {
    return input as CanonicalBrowserAction
  }
  return BROWSER_ACTION_ALIASES[input] ?? null
}

async function executeBrowserAction(
  sessionID: string,
  action: CanonicalBrowserAction,
  payload: Record<string, unknown>,
): Promise<unknown> {
  switch (action) {
    case "newPage": {
      const url = typeof payload.url === "string" && payload.url.trim().length > 0 ? payload.url : "about:blank"
      const timeout = typeof payload.timeout === "number" ? payload.timeout : undefined
      return BrowserRuntime.newPage(sessionID, url, timeout)
    }
    case "navigate":
      return BrowserRuntime.navigate(sessionID, {
        type: payload.type as "url" | "back" | "forward" | "reload" | undefined,
        url: typeof payload.url === "string" ? payload.url : undefined,
        timeoutMs: typeof payload.timeout === "number" ? payload.timeout : undefined,
      })
    case "selectPage":
      return BrowserRuntime.selectPage(sessionID, typeof payload.pageIdx === "number" ? payload.pageIdx : 0)
    case "closePage":
      return BrowserRuntime.closePage(sessionID, typeof payload.pageIdx === "number" ? payload.pageIdx : 0)
    case "back":
      return BrowserRuntime.navigate(sessionID, { type: "back" })
    case "forward":
      return BrowserRuntime.navigate(sessionID, { type: "forward" })
    case "reload":
      return BrowserRuntime.navigate(sessionID, { type: "reload" })
    case "stop":
      return BrowserRuntime.stop(sessionID)
    case "waitFor":
      if (typeof payload.text !== "string" || payload.text.trim().length === 0) {
        throw new Error("waitFor action requires payload.text")
      }
      return BrowserRuntime.waitForText(
        sessionID,
        payload.text,
        typeof payload.timeout === "number" ? payload.timeout : undefined,
      )
    case "resize":
      return BrowserRuntime.resize(
        sessionID,
        typeof payload.width === "number" ? payload.width : 1280,
        typeof payload.height === "number" ? payload.height : 720,
      )
    case "handleDialog":
      return BrowserRuntime.handleDialog(
        sessionID,
        payload.action === "dismiss" ? "dismiss" : "accept",
        typeof payload.promptText === "string" ? payload.promptText : undefined,
      )
    case "click":
      return BrowserRuntime.click(sessionID, {
        uid: typeof payload.uid === "string" ? payload.uid : undefined,
        selector: typeof payload.selector === "string" ? payload.selector : undefined,
        button: payload.button as "left" | "right" | "middle" | undefined,
        doubleClick: payload.doubleClick === true,
      })
    case "hover":
      return BrowserRuntime.hover(sessionID, {
        uid: typeof payload.uid === "string" ? payload.uid : undefined,
        selector: typeof payload.selector === "string" ? payload.selector : undefined,
      })
    case "fill":
      return BrowserRuntime.fill(sessionID, {
        uid: typeof payload.uid === "string" ? payload.uid : undefined,
        selector: typeof payload.selector === "string" ? payload.selector : undefined,
        value: typeof payload.value === "string" ? payload.value : "",
      })
    case "fillForm":
      return BrowserRuntime.fillForm(
        sessionID,
        Array.isArray(payload.fields) ? (payload.fields as Array<{ uid?: string; selector?: string; value: string }>) : [],
      )
    case "drag":
      return BrowserRuntime.drag(sessionID, {
        sourceUid: typeof payload.sourceUid === "string" ? payload.sourceUid : undefined,
        sourceSelector: typeof payload.sourceSelector === "string" ? payload.sourceSelector : undefined,
        targetUid: typeof payload.targetUid === "string" ? payload.targetUid : undefined,
        targetSelector: typeof payload.targetSelector === "string" ? payload.targetSelector : undefined,
      })
    case "pressKey":
      return BrowserRuntime.pressKey(sessionID, typeof payload.key === "string" ? payload.key : "Enter")
    case "uploadFile":
      return BrowserRuntime.uploadFile(sessionID, {
        uid: typeof payload.uid === "string" ? payload.uid : undefined,
        selector: typeof payload.selector === "string" ? payload.selector : undefined,
        files: Array.isArray(payload.files) ? (payload.files as string[]) : [],
      })
    case "snapshot":
      return BrowserRuntime.snapshot(sessionID)
    case "screenshot":
      return BrowserRuntime.screenshot(sessionID, payload.fullPage !== false)
    case "evaluate":
      return BrowserRuntime.evaluate(sessionID, typeof payload.script === "string" ? payload.script : "")
    case "networkRequests":
      return BrowserRuntime.networkRequests(sessionID, typeof payload.limit === "number" ? payload.limit : undefined)
    case "networkRequest":
      return BrowserRuntime.networkRequest(sessionID, {
        index: typeof payload.index === "number" ? payload.index : undefined,
        urlContains: typeof payload.urlContains === "string" ? payload.urlContains : undefined,
      })
    case "console":
      return BrowserRuntime.consoleMessages(sessionID, typeof payload.limit === "number" ? payload.limit : undefined)
    case "consoleMessage":
      return BrowserRuntime.consoleMessage(sessionID, typeof payload.index === "number" ? payload.index : 0)
    case "emulate":
      return BrowserRuntime.emulate(sessionID, payload as {
        width?: number
        height?: number
        colorScheme?: "light" | "dark" | "no-preference"
        reducedMotion?: "reduce" | "no-preference"
        locale?: string
        timezoneId?: string
        geolocation?: { latitude: number; longitude: number }
      })
    case "perfStart":
      return BrowserRuntime.perfStart(sessionID)
    case "perfStop":
      return BrowserRuntime.perfStop(sessionID)
    case "perfInsight":
      return BrowserRuntime.perfInsight(sessionID)
  }
}

export const ExperimentalRoutes = lazy(() =>
  new Hono()
    .get(
      "/tool/ids",
      describeRoute({
        summary: "List tool IDs",
        description:
          "Get a list of all available tool IDs, including both built-in tools and dynamically registered tools.",
        operationId: "tool.ids",
        responses: {
          200: {
            description: "Tool IDs",
            content: {
              "application/json": {
                schema: resolver(z.array(z.string()).meta({ ref: "ToolIDs" })),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => {
        return c.json(await ToolRegistry.ids())
      },
    )
    .get(
      "/tool",
      describeRoute({
        summary: "List tools",
        description:
          "Get a list of available tools with their JSON schema parameters for a specific provider and model combination.",
        operationId: "tool.list",
        responses: {
          200: {
            description: "Tools",
            content: {
              "application/json": {
                schema: resolver(
                  z
                    .array(
                      z
                        .object({
                          id: z.string(),
                          description: z.string(),
                          parameters: z.any(),
                        })
                        .meta({ ref: "ToolListItem" }),
                    )
                    .meta({ ref: "ToolList" }),
                ),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "query",
        z.object({
          provider: z.string(),
          model: z.string(),
        }),
      ),
      async (c) => {
        const { provider, model } = c.req.valid("query")
        const tools = await ToolRegistry.tools({ providerID: provider, modelID: model })
        return c.json(
          tools.map((t) => ({
            id: t.id,
            description: t.description,
            // Handle both Zod schemas and plain JSON schemas
            parameters: (t.parameters as any)?._def ? zodToJsonSchema(t.parameters as any) : t.parameters,
          })),
        )
      },
    )
    .post(
      "/worktree",
      describeRoute({
        summary: "Create worktree",
        description: "Create a new git worktree for the current project and run any configured startup scripts.",
        operationId: "worktree.create",
        responses: {
          200: {
            description: "Worktree created",
            content: {
              "application/json": {
                schema: resolver(Worktree.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Worktree.create.schema),
      async (c) => {
        const body = c.req.valid("json")
        const worktree = await Worktree.create(body)
        return c.json(worktree)
      },
    )
    .get(
      "/worktree",
      describeRoute({
        summary: "List worktrees",
        description: "List all sandbox worktrees for the current project.",
        operationId: "worktree.list",
        responses: {
          200: {
            description: "List of worktree directories",
            content: {
              "application/json": {
                schema: resolver(z.array(z.string())),
              },
            },
          },
        },
      }),
      async (c) => {
        const sandboxes = await Project.sandboxes(Instance.project.id)
        return c.json(sandboxes)
      },
    )
    .delete(
      "/worktree",
      describeRoute({
        summary: "Remove worktree",
        description: "Remove a git worktree and delete its branch.",
        operationId: "worktree.remove",
        responses: {
          200: {
            description: "Worktree removed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Worktree.remove.schema),
      async (c) => {
        const body = c.req.valid("json")
        await Worktree.remove(body)
        await Project.removeSandbox(Instance.project.id, body.directory)
        return c.json(true)
      },
    )
    .post(
      "/worktree/reset",
      describeRoute({
        summary: "Reset worktree",
        description: "Reset a worktree branch to the primary default branch.",
        operationId: "worktree.reset",
        responses: {
          200: {
            description: "Worktree reset",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Worktree.reset.schema),
      async (c) => {
        const body = c.req.valid("json")
        await Worktree.reset(body)
        return c.json(true)
      },
    )
    .get(
      "/session",
      describeRoute({
        summary: "List sessions",
        description:
          "Get a list of all KronosCode sessions across projects, sorted by most recently updated. Archived sessions are excluded by default.",
        operationId: "experimental.session.list",
        responses: {
          200: {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: resolver(Session.GlobalInfo.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          directory: z.string().optional().meta({ description: "Filter sessions by project directory" }),
          roots: z.coerce.boolean().optional().meta({ description: "Only return root sessions (no parentID)" }),
          start: z.coerce
            .number()
            .optional()
            .meta({ description: "Filter sessions updated on or after this timestamp (milliseconds since epoch)" }),
          cursor: z.coerce
            .number()
            .optional()
            .meta({ description: "Return sessions updated before this timestamp (milliseconds since epoch)" }),
          search: z.string().optional().meta({ description: "Filter sessions by title (case-insensitive)" }),
          limit: z.coerce.number().optional().meta({ description: "Maximum number of sessions to return" }),
          archived: z.coerce.boolean().optional().meta({ description: "Include archived sessions (default false)" }),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const limit = query.limit ?? 100
        const sessions: Session.GlobalInfo[] = []
        for await (const session of Session.listGlobal({
          directory: query.directory,
          roots: query.roots,
          start: query.start,
          cursor: query.cursor,
          search: query.search,
          limit: limit + 1,
          archived: query.archived,
        })) {
          sessions.push(session)
        }
        const hasMore = sessions.length > limit
        const list = hasMore ? sessions.slice(0, limit) : sessions
        if (hasMore && list.length > 0) {
          c.header("x-next-cursor", String(list[list.length - 1].time.updated))
        }
        return c.json(list)
      },
    )
    .get(
      "/browser/state",
      describeRoute({
        summary: "Get browser runtime state",
        description: "Get current AI Browser pages and active page for a session.",
        operationId: "experimental.browser.state",
        responses: {
          200: {
            description: "Browser runtime state",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "query",
        z.object({
          sessionID: z.string().min(1),
        }),
      ),
      async (c) => {
        if (!Flag.KRONOSCODE_ENABLE_AI_BROWSER) {
          return c.json({ enabled: false, error: "AI Browser is disabled" }, 503)
        }
        const { sessionID } = c.req.valid("query")
        return c.json(await BrowserRuntime.state(sessionID))
      },
    )
    .get(
      "/browser/events",
      describeRoute({
        summary: "Subscribe to browser runtime events",
        description: "Stream AI Browser state events for a session using server-sent events.",
        operationId: "experimental.browser.events",
        responses: {
          200: {
            description: "Browser runtime event stream",
            content: {
              "text/event-stream": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "query",
        z.object({
          sessionID: z.string().min(1),
        }),
      ),
      async (c) => {
        if (!Flag.KRONOSCODE_ENABLE_AI_BROWSER) {
          return c.json({ enabled: false, error: "AI Browser is disabled" }, 503)
        }

        const { sessionID } = c.req.valid("query")
        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")

        return streamSSE(c, async (stream) => {
          let sequence = 0
          const nextId = () => `${Date.now()}-${++sequence}`

          await stream.writeSSE({
            id: nextId(),
            data: JSON.stringify({
              type: "browser.connected",
              sessionID,
              at: Date.now(),
            }),
          })

          await stream.writeSSE({
            id: nextId(),
            data: JSON.stringify({
              type: "browser.state",
              sessionID,
              at: Date.now(),
              reason: "initial",
            }),
          })

          const off = BrowserRuntime.onEvent((event) => {
            if (event.sessionID !== sessionID) {
              return
            }
            void stream.writeSSE({
              id: nextId(),
              data: JSON.stringify(event),
            })
          })

          const heartbeat = setInterval(() => {
            void stream.writeSSE({
              data: JSON.stringify({
                type: "server.heartbeat",
                sessionID,
                at: Date.now(),
              }),
            })
          }, 10_000)

          await new Promise<void>((resolve) => {
            stream.onAbort(() => {
              clearInterval(heartbeat)
              off()
              resolve()
            })
          })
        })
      },
    )
    .get(
      "/browser/frame",
      describeRoute({
        summary: "Get browser frame screenshot",
        description: "Capture the latest frame for the active page as base64 PNG.",
        operationId: "experimental.browser.frame",
        responses: {
          200: {
            description: "Browser frame",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "query",
        z.object({
          sessionID: z.string().min(1),
        }),
      ),
      async (c) => {
        if (!Flag.KRONOSCODE_ENABLE_AI_BROWSER) {
          return c.json({ enabled: false, error: "AI Browser is disabled" }, 503)
        }
        const { sessionID } = c.req.valid("query")
        return c.json(await BrowserRuntime.frame(sessionID))
      },
    )
    .post(
      "/browser/action",
      describeRoute({
        summary: "Execute browser action",
        description: "Run a browser runtime action for a session.",
        operationId: "experimental.browser.action",
        responses: {
          200: {
            description: "Action result",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        BrowserActionRequestSchema,
      ),
      async (c) => {
        if (!Flag.KRONOSCODE_ENABLE_AI_BROWSER) {
          return c.json({ enabled: false, error: "AI Browser is disabled" }, 503)
        }
        const body = c.req.valid("json") as BrowserActionRequest
        const payload =
          body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
            ? body.payload
            : {}
        const action = canonicalBrowserAction(body.action)
        if (!action) {
          return c.json({ error: `Unsupported browser action: ${body.action}` }, 400)
        }

        return c.json(await executeBrowserAction(body.sessionID, action, payload))
      },
    )
    .get(
      "/resource",
      describeRoute({
        summary: "Get MCP resources",
        description: "Get all available MCP resources from connected servers. Optionally filter by name.",
        operationId: "experimental.resource.list",
        responses: {
          200: {
            description: "MCP resources",
            content: {
              "application/json": {
                schema: resolver(z.record(z.string(), MCP.Resource)),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await MCP.resources())
      },
    ),
)
