import z from "zod"
import { Tool } from "./tool"
import { BrowserRuntime } from "@/browser/runtime"

const ensureBrowserRuntime = () => {
  if (!BrowserRuntime.enabled()) {
    throw new Error("AI Browser runtime is disabled. Set KRONOSCODE_ENABLE_AI_BROWSER=true.")
  }
}

export const AnythingBrowserActionTool = Tool.define("anything_browser_action", {
  description:
    "Bridge tool for Anything-style browser actions. Maps deterministically to existing browser runtime commands.",
  parameters: z.object({
    action: z.enum([
      "navigate",
      "click",
      "fill",
      "snapshot",
      "screenshot",
      "open_context_menu",
      "double_click_handoff",
      "capture_selection",
    ]),
    payload: z.record(z.string(), z.any()).optional(),
  }),
  async execute(args, ctx) {
    ensureBrowserRuntime()
    const payload = args.payload || {}

    switch (args.action) {
      case "navigate":
        return {
          title: "Anything Browser Navigate",
          output: JSON.stringify(
            await BrowserRuntime.navigate(ctx.sessionID, {
              type: typeof payload.type === "string" ? (payload.type as "url" | "back" | "forward" | "reload") : "url",
              url: typeof payload.url === "string" ? payload.url : undefined,
              timeoutMs: typeof payload.timeout === "number" ? payload.timeout : undefined,
            }),
            null,
            2,
          ),
          metadata: { connector: "anything", risk_level: "medium", interactive: true, fallback: ["browser_*"] },
        }
      case "click":
        return {
          title: "Anything Browser Click",
          output: JSON.stringify(
            await BrowserRuntime.click(ctx.sessionID, {
              uid: typeof payload.uid === "string" ? payload.uid : undefined,
              selector: typeof payload.selector === "string" ? payload.selector : undefined,
              button: payload.button as "left" | "right" | "middle" | undefined,
              doubleClick: payload.doubleClick === true,
            }),
            null,
            2,
          ),
          metadata: { connector: "anything", risk_level: "medium", interactive: true, fallback: ["browser_*"] },
        }
      case "fill":
        return {
          title: "Anything Browser Fill",
          output: JSON.stringify(
            await BrowserRuntime.fill(ctx.sessionID, {
              uid: typeof payload.uid === "string" ? payload.uid : undefined,
              selector: typeof payload.selector === "string" ? payload.selector : undefined,
              value: typeof payload.value === "string" ? payload.value : "",
            }),
            null,
            2,
          ),
          metadata: { connector: "anything", risk_level: "medium", interactive: true, fallback: ["browser_*"] },
        }
      case "snapshot": {
        const snap = await BrowserRuntime.snapshot(ctx.sessionID)
        return {
          title: "Anything Browser Snapshot",
          output: snap.text,
          metadata: { connector: "anything", risk_level: "low", interactive: false, fallback: ["browser_snapshot"] },
        }
      }
      case "screenshot": {
        const shot = await BrowserRuntime.screenshot(ctx.sessionID, payload.fullPage !== false)
        return {
          title: "Anything Browser Screenshot",
          output: `Captured screenshot for ${shot.title}`,
          metadata: { connector: "anything", risk_level: "low", interactive: false, fallback: ["browser_screenshot"] },
          attachments: [
            {
              type: "file",
              mime: shot.mime,
              url: `data:${shot.mime};base64,${shot.base64}`,
            },
          ],
        }
      }
      case "open_context_menu":
        return {
          title: "Anything Context Menu",
          output: JSON.stringify(
            await BrowserRuntime.click(ctx.sessionID, {
              uid: typeof payload.uid === "string" ? payload.uid : undefined,
              selector: typeof payload.selector === "string" ? payload.selector : undefined,
              button: "right",
              doubleClick: false,
            }),
            null,
            2,
          ),
          metadata: { connector: "anything", risk_level: "medium", interactive: true, fallback: ["browser_click"] },
        }
      case "double_click_handoff":
        return {
          title: "Anything Double Click Handoff",
          output: JSON.stringify(
            {
              clickResult: await BrowserRuntime.click(ctx.sessionID, {
                uid: typeof payload.uid === "string" ? payload.uid : undefined,
                selector: typeof payload.selector === "string" ? payload.selector : undefined,
                button: "left",
                doubleClick: true,
              }),
              handoffOptions: ["summarize", "capture_selection", "open_context_menu"],
            },
            null,
            2,
          ),
          metadata: { connector: "anything", risk_level: "medium", interactive: true, fallback: ["browser_click"] },
        }
      case "capture_selection": {
        const snapshot = await BrowserRuntime.snapshot(ctx.sessionID)
        const query = typeof payload.query === "string" ? payload.query.toLowerCase() : ""
        const matched = query
          ? snapshot.items.filter((item) => `${item.value ?? ""} ${item.name ?? ""}`.toLowerCase().includes(query))
          : snapshot.items
        return {
          title: "Anything Capture Selection",
          output: JSON.stringify(
            {
              query: query || null,
              count: matched.length,
              items: matched.slice(0, 25),
            },
            null,
            2,
          ),
          metadata: { connector: "anything", risk_level: "low", interactive: false, fallback: ["browser_snapshot"] },
        }
      }
    }
  },
})

export const AnythingOpenContextMenuTool = Tool.define("anything_open_context_menu", {
  description: "Open a context menu using Anything-style bridge behavior.",
  parameters: z.object({
    uid: z.string().optional(),
    selector: z.string().optional(),
  }),
  async execute(args, ctx) {
    ensureBrowserRuntime()
    const data = await BrowserRuntime.click(ctx.sessionID, {
      uid: args.uid,
      selector: args.selector,
      button: "right",
      doubleClick: false,
    })
    return {
      title: "Anything Open Context Menu",
      output: JSON.stringify(data, null, 2),
      metadata: { connector: "anything", risk_level: "medium", interactive: true, fallback: ["browser_click"] },
    }
  },
})

export const AnythingDoubleClickHandoffTool = Tool.define("anything_double_click_handoff", {
  description: "Trigger Anything-style double-click handoff flow.",
  parameters: z.object({
    uid: z.string().optional(),
    selector: z.string().optional(),
  }),
  async execute(args, ctx) {
    ensureBrowserRuntime()
    const click = await BrowserRuntime.click(ctx.sessionID, {
      uid: args.uid,
      selector: args.selector,
      button: "left",
      doubleClick: true,
    })
    return {
      title: "Anything Double Click Handoff",
      output: JSON.stringify(
        {
          click,
          handoffOptions: ["summarize", "capture_selection", "open_context_menu"],
        },
        null,
        2,
      ),
      metadata: { connector: "anything", risk_level: "medium", interactive: true, fallback: ["browser_click"] },
    }
  },
})

export const AnythingCaptureSelectionTool = Tool.define("anything_capture_selection", {
  description: "Capture current selection or matching UI nodes from browser snapshot.",
  parameters: z.object({
    query: z.string().optional(),
  }),
  async execute(args, ctx) {
    ensureBrowserRuntime()
    const snapshot = await BrowserRuntime.snapshot(ctx.sessionID)
    const query = args.query?.trim().toLowerCase()
    const items = query
      ? snapshot.items.filter((item) => `${item.value ?? ""} ${item.name ?? ""}`.toLowerCase().includes(query))
      : snapshot.items

    return {
      title: "Anything Capture Selection",
      output: JSON.stringify(
        {
          query: query || null,
          count: items.length,
          items: items.slice(0, 25),
        },
        null,
        2,
      ),
      metadata: { connector: "anything", risk_level: "low", interactive: false, fallback: ["browser_snapshot"] },
    }
  },
})
