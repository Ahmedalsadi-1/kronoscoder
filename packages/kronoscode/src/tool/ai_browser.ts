import z from "zod"
import { Tool } from "./tool"
import { BrowserRuntime } from "@/browser/runtime"

const NAV_TIMEOUT_MS = 30_000

function ensureEnabled() {
  if (!BrowserRuntime.enabled()) {
    throw new Error("AI Browser tools are disabled. Set KRONOSCODE_ENABLE_AI_BROWSER=true to enable them.")
  }
}

function toOutput(value: unknown) {
  if (typeof value === "string") return value
  return JSON.stringify(value, null, 2)
}

function base64DataUrl(mime: string, base64: string) {
  return `data:${mime};base64,${base64}`
}

const browser_list_pages = Tool.define("browser_list_pages", {
  description: "Get a list of pages open in the AI Browser session.",
  parameters: z.object({}),
  async execute(_params, ctx) {
    ensureEnabled()
    const pages = await BrowserRuntime.listPages(ctx.sessionID)
    return {
      title: "Browser Pages",
      metadata: { count: pages.length },
      output: toOutput(pages),
    }
  },
})

const browser_select_page = Tool.define("browser_select_page", {
  description: "Select a page by index as the active browser page.",
  parameters: z.object({
    pageIdx: z.number().int().min(0),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const pages = await BrowserRuntime.selectPage(ctx.sessionID, params.pageIdx)
    return {
      title: "Selected Browser Page",
      metadata: { pageIdx: params.pageIdx },
      output: toOutput(pages),
    }
  },
})

const browser_new_page = Tool.define("browser_new_page", {
  description: "Create a new browser page and navigate to a URL.",
  parameters: z.object({
    url: z.string().min(1),
    timeout: z.number().int().positive().optional(),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const page = await BrowserRuntime.newPage(ctx.sessionID, params.url, params.timeout ?? NAV_TIMEOUT_MS)
    return {
      title: "Created Browser Page",
      metadata: { pageID: page.id },
      output: toOutput(page),
    }
  },
})

const browser_close_page = Tool.define("browser_close_page", {
  description: "Close a browser page by index. The last page cannot be closed.",
  parameters: z.object({
    pageIdx: z.number().int().min(0),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const pages = await BrowserRuntime.closePage(ctx.sessionID, params.pageIdx)
    return {
      title: "Closed Browser Page",
      metadata: { pageIdx: params.pageIdx },
      output: toOutput(pages),
    }
  },
})

const browser_navigate = Tool.define("browser_navigate", {
  description: "Navigate the active browser page (url/back/forward/reload).",
  parameters: z.object({
    type: z.enum(["url", "back", "forward", "reload"]).optional(),
    url: z.string().optional(),
    timeout: z.number().int().positive().optional(),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.navigate(ctx.sessionID, {
      type: params.type,
      url: params.url,
      timeoutMs: params.timeout,
    })
    return {
      title: "Browser Navigation",
      metadata: { type: data.type, url: data.url },
      output: toOutput(data),
    }
  },
})

const browser_wait_for = Tool.define("browser_wait_for", {
  description: "Wait until text appears on the active page.",
  parameters: z.object({
    text: z.string().min(1),
    timeout: z.number().int().positive().optional(),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.waitForText(ctx.sessionID, params.text, params.timeout ?? NAV_TIMEOUT_MS)
    return {
      title: "Wait For Text",
      metadata: { text: params.text },
      output: toOutput(data),
    }
  },
})

const browser_resize = Tool.define("browser_resize", {
  description: "Resize the active page viewport.",
  parameters: z.object({
    width: z.number().int().min(200),
    height: z.number().int().min(200),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.resize(ctx.sessionID, params.width, params.height)
    return {
      title: "Browser Resize",
      metadata: data,
      output: toOutput(data),
    }
  },
})

const browser_handle_dialog = Tool.define("browser_handle_dialog", {
  description: "Prepare a one-shot handler for the next browser dialog.",
  parameters: z.object({
    action: z.enum(["accept", "dismiss"]),
    promptText: z.string().optional(),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.handleDialog(ctx.sessionID, params.action, params.promptText)
    return {
      title: "Dialog Handler",
      metadata: data,
      output: toOutput(data),
    }
  },
})

const browser_click = Tool.define("browser_click", {
  description: "Click an element by selector or snapshot uid.",
  parameters: z.object({
    uid: z.string().optional(),
    selector: z.string().optional(),
    button: z.enum(["left", "right", "middle"]).optional(),
    doubleClick: z.boolean().optional(),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.click(ctx.sessionID, params)
    return {
      title: "Browser Click",
      metadata: data,
      output: toOutput(data),
    }
  },
})

const browser_hover = Tool.define("browser_hover", {
  description: "Hover an element by selector or snapshot uid.",
  parameters: z.object({
    uid: z.string().optional(),
    selector: z.string().optional(),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.hover(ctx.sessionID, params)
    return {
      title: "Browser Hover",
      metadata: data,
      output: toOutput(data),
    }
  },
})

const browser_fill = Tool.define("browser_fill", {
  description: "Fill an input element by selector or snapshot uid.",
  parameters: z.object({
    uid: z.string().optional(),
    selector: z.string().optional(),
    value: z.string(),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.fill(ctx.sessionID, params)
    return {
      title: "Browser Fill",
      metadata: { valueLength: params.value.length, target: data.target },
      output: toOutput(data),
    }
  },
})

const browser_fill_form = Tool.define("browser_fill_form", {
  description: "Fill multiple form fields in one call.",
  parameters: z.object({
    fields: z.array(
      z.object({
        uid: z.string().optional(),
        selector: z.string().optional(),
        value: z.string(),
      })
    ),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.fillForm(ctx.sessionID, params.fields)
    return {
      title: "Browser Fill Form",
      metadata: { count: params.fields.length },
      output: toOutput(data),
    }
  },
})

const browser_drag = Tool.define("browser_drag", {
  description: "Drag from one element to another.",
  parameters: z.object({
    sourceUid: z.string().optional(),
    sourceSelector: z.string().optional(),
    targetUid: z.string().optional(),
    targetSelector: z.string().optional(),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.drag(ctx.sessionID, params)
    return {
      title: "Browser Drag",
      metadata: data,
      output: toOutput(data),
    }
  },
})

const browser_press_key = Tool.define("browser_press_key", {
  description: "Press a keyboard key in the active page.",
  parameters: z.object({
    key: z.string().min(1),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.pressKey(ctx.sessionID, params.key)
    return {
      title: "Browser Key Press",
      metadata: data,
      output: toOutput(data),
    }
  },
})

const browser_upload_file = Tool.define("browser_upload_file", {
  description: "Upload one or more files through a file input element.",
  parameters: z.object({
    uid: z.string().optional(),
    selector: z.string().optional(),
    files: z.array(z.string()).min(1),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.uploadFile(ctx.sessionID, params)
    return {
      title: "Browser File Upload",
      metadata: data,
      output: toOutput(data),
    }
  },
})

const browser_snapshot = Tool.define("browser_snapshot", {
  description: "Capture an accessibility-oriented snapshot of actionable page elements.",
  parameters: z.object({}),
  async execute(_params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.snapshot(ctx.sessionID)
    return {
      title: "Browser Snapshot",
      metadata: { count: data.items.length },
      output: data.text,
    }
  },
})

const browser_screenshot = Tool.define("browser_screenshot", {
  description: "Capture a screenshot of the active page.",
  parameters: z.object({
    fullPage: z.boolean().optional(),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.screenshot(ctx.sessionID, params.fullPage ?? true)
    return {
      title: "Browser Screenshot",
      metadata: { pageID: data.pageID, mime: data.mime },
      output: `Captured screenshot for ${data.title}`,
      attachments: [
        {
          type: "file",
          mime: data.mime,
          url: base64DataUrl(data.mime, data.base64),
        },
      ],
    }
  },
})

const browser_evaluate = Tool.define("browser_evaluate", {
  description: "Evaluate JavaScript in the active page context.",
  parameters: z.object({
    script: z.string().min(1),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.evaluate(ctx.sessionID, params.script)
    return {
      title: "Browser Evaluate",
      metadata: { ok: data.ok },
      output: toOutput(data),
    }
  },
})

const browser_network_requests = Tool.define("browser_network_requests", {
  description: "List recent network requests for the active page.",
  parameters: z.object({
    limit: z.number().int().min(1).max(500).optional(),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.networkRequests(ctx.sessionID, params.limit ?? 50)
    return {
      title: "Network Requests",
      metadata: { count: data.length },
      output: toOutput(data),
    }
  },
})

const browser_network_request = Tool.define("browser_network_request", {
  description: "Get one network request by index or URL substring.",
  parameters: z.object({
    index: z.number().int().min(0).optional(),
    urlContains: z.string().optional(),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.networkRequest(ctx.sessionID, params)
    return {
      title: "Network Request",
      metadata: { found: true },
      output: toOutput(data),
    }
  },
})

const browser_console = Tool.define("browser_console", {
  description: "List recent console messages for the active page.",
  parameters: z.object({
    limit: z.number().int().min(1).max(300).optional(),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.consoleMessages(ctx.sessionID, params.limit ?? 50)
    return {
      title: "Console Messages",
      metadata: { count: data.length },
      output: toOutput(data),
    }
  },
})

const browser_console_message = Tool.define("browser_console_message", {
  description: "Get one console message by index.",
  parameters: z.object({
    index: z.number().int().min(0),
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.consoleMessage(ctx.sessionID, params.index)
    return {
      title: "Console Message",
      metadata: { index: params.index },
      output: toOutput(data),
    }
  },
})

const browser_emulate = Tool.define("browser_emulate", {
  description: "Apply viewport/media/geolocation emulation to the active page.",
  parameters: z.object({
    width: z.number().int().min(200).optional(),
    height: z.number().int().min(200).optional(),
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
  }),
  async execute(params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.emulate(ctx.sessionID, params)
    return {
      title: "Browser Emulation",
      metadata: { emulated: true },
      output: toOutput(data),
    }
  },
})

const browser_perf_start = Tool.define("browser_perf_start", {
  description: "Start lightweight performance capture for the active page.",
  parameters: z.object({}),
  async execute(_params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.perfStart(ctx.sessionID)
    return {
      title: "Performance Capture Started",
      metadata: { startedAt: data.startedAt },
      output: toOutput(data),
    }
  },
})

const browser_perf_stop = Tool.define("browser_perf_stop", {
  description: "Stop performance capture and collect current page metrics.",
  parameters: z.object({}),
  async execute(_params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.perfStop(ctx.sessionID)
    return {
      title: "Performance Capture Stopped",
      metadata: { durationMs: data.durationMs },
      output: toOutput(data),
    }
  },
})

const browser_perf_insight = Tool.define("browser_perf_insight", {
  description: "Generate high-level insights from the latest captured performance sample.",
  parameters: z.object({}),
  async execute(_params, ctx) {
    ensureEnabled()
    const data = await BrowserRuntime.perfInsight(ctx.sessionID)
    return {
      title: "Performance Insights",
      metadata: { durationMs: data.durationMs },
      output: toOutput(data),
    }
  },
})

const aliasBrowserTool = (id: string, tool: Tool.Info) =>
  Tool.define(id, async (ctx) => {
    const resolved = await tool.init(ctx)
    return {
      description: resolved.description,
      parameters: resolved.parameters,
      execute: (args, runCtx) => resolved.execute(args as never, runCtx),
      ...(resolved.formatValidationError ? { formatValidationError: resolved.formatValidationError } : {}),
    }
  })

const kronoschamber_browser_list_pages = aliasBrowserTool("kronoschamber_browser_list_pages", browser_list_pages)
const kronoschamber_browser_select_page = aliasBrowserTool("kronoschamber_browser_select_page", browser_select_page)
const kronoschamber_browser_new_page = aliasBrowserTool("kronoschamber_browser_new_page", browser_new_page)
const kronoschamber_browser_close_page = aliasBrowserTool("kronoschamber_browser_close_page", browser_close_page)
const kronoschamber_browser_navigate = aliasBrowserTool("kronoschamber_browser_navigate", browser_navigate)
const kronoschamber_browser_wait_for = aliasBrowserTool("kronoschamber_browser_wait_for", browser_wait_for)
const kronoschamber_browser_resize = aliasBrowserTool("kronoschamber_browser_resize", browser_resize)
const kronoschamber_browser_handle_dialog = aliasBrowserTool("kronoschamber_browser_handle_dialog", browser_handle_dialog)
const kronoschamber_browser_click = aliasBrowserTool("kronoschamber_browser_click", browser_click)
const kronoschamber_browser_hover = aliasBrowserTool("kronoschamber_browser_hover", browser_hover)
const kronoschamber_browser_fill = aliasBrowserTool("kronoschamber_browser_fill", browser_fill)
const kronoschamber_browser_fill_form = aliasBrowserTool("kronoschamber_browser_fill_form", browser_fill_form)
const kronoschamber_browser_drag = aliasBrowserTool("kronoschamber_browser_drag", browser_drag)
const kronoschamber_browser_press_key = aliasBrowserTool("kronoschamber_browser_press_key", browser_press_key)
const kronoschamber_browser_upload_file = aliasBrowserTool("kronoschamber_browser_upload_file", browser_upload_file)
const kronoschamber_browser_snapshot = aliasBrowserTool("kronoschamber_browser_snapshot", browser_snapshot)
const kronoschamber_browser_screenshot = aliasBrowserTool("kronoschamber_browser_screenshot", browser_screenshot)
const kronoschamber_browser_evaluate = aliasBrowserTool("kronoschamber_browser_evaluate", browser_evaluate)
const kronoschamber_browser_network_requests = aliasBrowserTool(
  "kronoschamber_browser_network_requests",
  browser_network_requests,
)
const kronoschamber_browser_network_request = aliasBrowserTool(
  "kronoschamber_browser_network_request",
  browser_network_request,
)
const kronoschamber_browser_console = aliasBrowserTool("kronoschamber_browser_console", browser_console)
const kronoschamber_browser_console_message = aliasBrowserTool(
  "kronoschamber_browser_console_message",
  browser_console_message,
)
const kronoschamber_browser_emulate = aliasBrowserTool("kronoschamber_browser_emulate", browser_emulate)
const kronoschamber_browser_perf_start = aliasBrowserTool("kronoschamber_browser_perf_start", browser_perf_start)
const kronoschamber_browser_perf_stop = aliasBrowserTool("kronoschamber_browser_perf_stop", browser_perf_stop)
const kronoschamber_browser_perf_insight = aliasBrowserTool(
  "kronoschamber_browser_perf_insight",
  browser_perf_insight,
)

export const AIBrowserTools = [
  browser_list_pages,
  browser_select_page,
  browser_new_page,
  browser_close_page,
  browser_navigate,
  browser_wait_for,
  browser_resize,
  browser_handle_dialog,
  browser_click,
  browser_hover,
  browser_fill,
  browser_fill_form,
  browser_drag,
  browser_press_key,
  browser_upload_file,
  browser_snapshot,
  browser_screenshot,
  browser_evaluate,
  browser_network_requests,
  browser_network_request,
  browser_console,
  browser_console_message,
  browser_emulate,
  browser_perf_start,
  browser_perf_stop,
  browser_perf_insight,
  kronoschamber_browser_list_pages,
  kronoschamber_browser_select_page,
  kronoschamber_browser_new_page,
  kronoschamber_browser_close_page,
  kronoschamber_browser_navigate,
  kronoschamber_browser_wait_for,
  kronoschamber_browser_resize,
  kronoschamber_browser_handle_dialog,
  kronoschamber_browser_click,
  kronoschamber_browser_hover,
  kronoschamber_browser_fill,
  kronoschamber_browser_fill_form,
  kronoschamber_browser_drag,
  kronoschamber_browser_press_key,
  kronoschamber_browser_upload_file,
  kronoschamber_browser_snapshot,
  kronoschamber_browser_screenshot,
  kronoschamber_browser_evaluate,
  kronoschamber_browser_network_requests,
  kronoschamber_browser_network_request,
  kronoschamber_browser_console,
  kronoschamber_browser_console_message,
  kronoschamber_browser_emulate,
  kronoschamber_browser_perf_start,
  kronoschamber_browser_perf_stop,
  kronoschamber_browser_perf_insight,
]
