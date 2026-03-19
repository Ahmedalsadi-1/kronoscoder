import { randomUUID } from "crypto"
import { EventEmitter } from "node:events"
import { Flag } from "@/flag/flag"
import { Log } from "@/util/log"

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type DialogAction = "accept" | "dismiss"

type BrowserConsoleMessage = {
  type: string
  text: string
  location?: {
    url?: string
    lineNumber?: number
    columnNumber?: number
  }
  time: number
}

type BrowserNetworkEvent = {
  id: string
  url: string
  method: string
  resourceType?: string
  status?: number
  ok?: boolean
  failure?: string
  time: number
}

type BrowserPerfSnapshot = {
  startedAt: number
  stoppedAt?: number
  durationMs?: number
  metrics?: {
    jsHeapUsedSize?: number
    jsHeapTotalSize?: number
    domNodeCount?: number
    resourceCount?: number
    navDuration?: number
  }
}

type RuntimePageState = {
  id: string
  createdAt: number
  page: any
  console: BrowserConsoleMessage[]
  network: BrowserNetworkEvent[]
  perf?: BrowserPerfSnapshot
  isLoading: boolean
  lastError: string | null
}

type RuntimeSessionState = {
  sessionID: string
  browser: any
  context: any
  pages: RuntimePageState[]
  activePageID: string | null
  createdAt: number
  lastEmitAt: number
  pendingEmitReason: string | null
  emitTimer: NodeJS.Timeout | null
}

export type BrowserRuntimeEvent = {
  type: "browser.state"
  sessionID: string
  at: number
  reason: string
}

const log = Log.create({ service: "browser.runtime" })
const sessions = new Map<string, RuntimeSessionState>()
const runtimeEventBus = new EventEmitter()
runtimeEventBus.setMaxListeners(200)
let playwrightModPromise: Promise<any> | null = null

const MAX_CONSOLE_MESSAGES = 300
const MAX_NETWORK_EVENTS = 600
const EVENT_THROTTLE_MS = 120
const DEFAULT_VIEWPORT = { width: 1280, height: 720 }
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
const AGENT_FEEDBACK_BOOTSTRAP = String.raw`
(() => {
  if (window.__kronosAgentVisualFeedback) {
    return true;
  }

  const STATUS_VALUES = new Set(["Thinking", "Navigating", "Clicking", "Success"]);
  const ROOT_ID = "__kronos_agent_feedback_root";
  const STYLE_ID = "__kronos_agent_feedback_style";
  const OVERLAY_ID = "__kronos_agent_feedback_overlay";
  const GHOST_ID = "__kronos_agent_feedback_ghost";
  const DRAG_LAYER_ID = "__kronos_agent_feedback_drag";
  const DRAG_PATH_ID = "__kronos_agent_feedback_drag_path";
  const DRAG_GRIP_ID = "__kronos_agent_feedback_drag_grip";
  const state = {
    root: null,
    ghost: null,
    dragPath: null,
    dragGrip: null,
    trackedElement: null,
    raf: 0,
  };

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "#" + ROOT_ID + " { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }",
      "#" + OVERLAY_ID + " { position: absolute; inset: 0; border-radius: 14px; box-shadow: inset 0 0 0 3px rgba(0, 122, 255, 0.78), inset 0 0 24px rgba(0, 122, 255, 0.18); opacity: 0.34; animation: kronosAgentBreath 3s ease-in-out infinite; transition: opacity 260ms cubic-bezier(.22,1,.36,1), box-shadow 260ms cubic-bezier(.22,1,.36,1); }",
      "#" + ROOT_ID + '[data-status="Thinking"] #' + OVERLAY_ID + " { opacity: .28; }",
      "#" + ROOT_ID + '[data-status="Navigating"] #' + OVERLAY_ID + " { opacity: .44; }",
      "#" + ROOT_ID + '[data-status="Clicking"] #' + OVERLAY_ID + " { opacity: .62; box-shadow: inset 0 0 0 3px rgba(0, 122, 255, 0.92), inset 0 0 32px rgba(0, 122, 255, 0.26); }",
      "#" + ROOT_ID + '[data-status="Success"] #' + OVERLAY_ID + " { opacity: .42; }",
      "@keyframes kronosAgentBreath { 0%,100% { transform: scale(1); filter: saturate(1); } 50% { transform: scale(.998); filter: saturate(1.08); } }",
      "#" + GHOST_ID + " { position: fixed; left: 0; top: 0; width: 0; height: 0; opacity: 0; border-radius: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.58); box-shadow: 0 0 0 1px rgba(0,122,255,0.44), 0 10px 28px rgba(0,122,255,0.2), inset 0 1px 0 rgba(255,255,255,0.42); backdrop-filter: blur(10px) saturate(140%); -webkit-backdrop-filter: blur(10px) saturate(140%); transition: transform 280ms cubic-bezier(.22,1,.36,1), width 280ms cubic-bezier(.22,1,.36,1), height 280ms cubic-bezier(.22,1,.36,1), opacity 180ms ease-out; }",
      "#" + DRAG_LAYER_ID + " { position: absolute; inset: 0; }",
      "#" + DRAG_LAYER_ID + " svg { position: absolute; inset: 0; width: 100%; height: 100%; }",
      "#" + DRAG_PATH_ID + " { fill: none; stroke: rgba(0,122,255,0.94); stroke-width: 3; stroke-linecap: round; stroke-dasharray: 10 10; filter: drop-shadow(0 0 6px rgba(0,122,255,0.45)); animation: kronosAgentDashFlow 1s linear infinite; }",
      "#" + DRAG_GRIP_ID + " { position: absolute; width: 40px; height: 40px; border-radius: 999px; display: grid; place-items: center; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.62), rgba(255,255,255,0.14)); border: 1px solid rgba(255,255,255,0.68); box-shadow: 0 10px 24px rgba(0,122,255,0.26), inset 0 1px 0 rgba(255,255,255,0.72); backdrop-filter: blur(8px) saturate(130%); -webkit-backdrop-filter: blur(8px) saturate(130%); opacity: 0; transform: translate3d(-9999px, -9999px, 0); }",
      "#" + DRAG_GRIP_ID + '::after { content: ""; width: 8px; height: 8px; border-radius: 999px; background: rgba(0,122,255,0.96); box-shadow: 0 0 10px rgba(0,122,255,0.5); }',
      "@keyframes kronosAgentDashFlow { to { stroke-dashoffset: -16; } }",
    ].join("\n")
    document.documentElement.appendChild(style);
  };

  const ensureRoot = () => {
    ensureStyles();
    if (!state.root || !state.root.isConnected) {
      const root = document.getElementById(ROOT_ID) || document.createElement("div");
      root.id = ROOT_ID;
      root.dataset.status = "Thinking";
      if (!root.isConnected) {
        document.documentElement.appendChild(root);
      }

      if (!document.getElementById(OVERLAY_ID)) {
        const overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        root.appendChild(overlay);
      }

      const ghost = document.getElementById(GHOST_ID) || document.createElement("div");
      ghost.id = GHOST_ID;
      if (!ghost.isConnected) {
        root.appendChild(ghost);
      }

      const dragLayer = document.getElementById(DRAG_LAYER_ID) || document.createElement("div");
      dragLayer.id = DRAG_LAYER_ID;
      if (!dragLayer.isConnected) {
        root.appendChild(dragLayer);
      }
      if (!dragLayer.querySelector("svg")) {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        const path = document.createElementNS(ns, "path");
        path.id = DRAG_PATH_ID;
        svg.appendChild(path);
        dragLayer.appendChild(svg);
      }
      const grip = document.getElementById(DRAG_GRIP_ID) || document.createElement("div");
      grip.id = DRAG_GRIP_ID;
      if (!grip.isConnected) {
        dragLayer.appendChild(grip);
      }

      state.root = root;
      state.ghost = ghost;
      state.dragPath = document.getElementById(DRAG_PATH_ID);
      state.dragGrip = grip;
    }
  };

  const normalizedStatus = (status) => {
    const value = typeof status === "string" ? status.trim() : "";
    return STATUS_VALUES.has(value) ? value : "Thinking";
  };

  const setStatus = (status) => {
    ensureRoot();
    state.root.dataset.status = normalizedStatus(status);
  };

  const rectFor = (element, padding = 6) => {
    const rect = element.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return {
      x: Math.round(rect.left - padding),
      y: Math.round(rect.top - padding),
      width: Math.round(rect.width + padding * 2),
      height: Math.round(rect.height + padding * 2),
    };
  };

  const paintGhost = () => {
    if (!state.trackedElement || !state.ghost) {
      return;
    }
    if (!document.contains(state.trackedElement)) {
      state.ghost.style.opacity = "0";
      return;
    }
    const rect = rectFor(state.trackedElement);
    if (!rect) {
      state.ghost.style.opacity = "0";
      return;
    }
    state.ghost.style.transform = "translate3d(" + rect.x + "px," + rect.y + "px,0)";
    state.ghost.style.width = rect.width + "px";
    state.ghost.style.height = rect.height + "px";
    state.ghost.style.opacity = "1";
  };

  const tickTrack = () => {
    state.raf = 0;
    if (!state.trackedElement) {
      return;
    }
    paintGhost();
    state.raf = requestAnimationFrame(tickTrack);
  };

  const highlightTarget = (target) => {
    ensureRoot();
    let element = null;
    if (typeof target === "string" && target.trim()) {
      element = document.querySelector(target.trim());
    } else if (target instanceof Element) {
      element = target;
    }
    if (!element) {
      if (state.ghost) {
        state.ghost.style.opacity = "0";
      }
      state.trackedElement = null;
      if (state.raf) {
        cancelAnimationFrame(state.raf);
        state.raf = 0;
      }
      return false;
    }
    state.trackedElement = element;
    paintGhost();
    if (!state.raf) {
      state.raf = requestAnimationFrame(tickTrack);
    }
    return true;
  };

  const clearTarget = () => {
    state.trackedElement = null;
    if (state.ghost) {
      state.ghost.style.opacity = "0";
    }
    if (state.raf) {
      cancelAnimationFrame(state.raf);
      state.raf = 0;
    }
  };

  const centerOf = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    };
  };

  const buildPath = (x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const c1x = x1 + dx * 0.28;
    const c1y = y1 + dy * 0.08;
    const c2x = x1 + dx * 0.72;
    const c2y = y1 + dy * 0.92;
    return "M " + x1 + " " + y1 + " C " + c1x + " " + c1y + ", " + c2x + " " + c2y + ", " + x2 + " " + y2;
  };

  const animateGrip = async (x1, y1, x2, y2, durationMs) => {
    if (!state.dragGrip) {
      return;
    }
    const from = "translate3d(" + (x1 - 20) + "px," + (y1 - 20) + "px,0)";
    const to = "translate3d(" + (x2 - 20) + "px," + (y2 - 20) + "px,0)";
    state.dragGrip.style.opacity = "1";
    state.dragGrip.style.transform = from;

    const maybeFramer = window.framerMotion || window.Motion || null;
    if (maybeFramer && typeof maybeFramer.animate === "function") {
      try {
        maybeFramer.animate(
          state.dragGrip,
          { transform: [from, to] },
          { duration: durationMs / 1000, ease: [0.22, 1, 0.36, 1] }
        );
        await new Promise((resolve) => window.setTimeout(resolve, durationMs));
        return;
      } catch (_) {
      }
    }

    if (typeof state.dragGrip.animate === "function") {
      state.dragGrip.animate(
        [{ transform: from }, { transform: to }],
        {
          duration: durationMs,
          easing: "cubic-bezier(.22,1,.36,1)",
          fill: "forwards",
        }
      );
      await new Promise((resolve) => window.setTimeout(resolve, durationMs));
      return;
    }

    state.dragGrip.style.transform = to;
  };

  const clearDrag = () => {
    if (state.dragPath) {
      state.dragPath.setAttribute("d", "");
    }
    if (state.dragGrip) {
      state.dragGrip.style.opacity = "0";
      state.dragGrip.style.transform = "translate3d(-9999px, -9999px, 0)";
    }
  };

  const renderDragFromPoints = async (x1, y1, x2, y2, durationMs = 500) => {
    ensureRoot();
    if (!state.dragPath || !state.dragGrip) {
      return null;
    }
    const clampedDuration = Number.isFinite(durationMs) ? Math.max(120, Math.min(1600, durationMs)) : 500;
    state.dragPath.setAttribute("d", buildPath(x1, y1, x2, y2));
    await animateGrip(x1, y1, x2, y2, clampedDuration);
    window.setTimeout(clearDrag, 260);
    return { x1, y1, x2, y2, durationMs: clampedDuration };
  };

  const renderDragBetweenSelectors = async (sourceSelector, targetSelector, durationMs = 500) => {
    const source = typeof sourceSelector === "string" ? document.querySelector(sourceSelector) : null;
    const target = typeof targetSelector === "string" ? document.querySelector(targetSelector) : null;
    if (!(source instanceof Element) || !(target instanceof Element)) {
      return null;
    }
    const from = centerOf(source);
    const to = centerOf(target);
    return renderDragFromPoints(from.x, from.y, to.x, to.y, durationMs);
  };

  window.__kronosAgentVisualFeedback = {
    setStatus,
    highlightTarget,
    clearTarget,
    renderDragBetweenSelectors,
    renderDragFromPoints,
  };

  setStatus("Thinking");
  return true;
})();
`

type AgentFeedbackStatus = "Thinking" | "Navigating" | "Clicking" | "Success"

function ensureEnabled() {
  if (!Flag.KRONOSCODE_ENABLE_AI_BROWSER) {
    throw new Error("AI Browser is disabled. Enable KRONOSCODE_ENABLE_AI_BROWSER=true to use browser tools.")
  }
}

async function ensureAgentFeedback(page: any) {
  try {
    await page.evaluate(AGENT_FEEDBACK_BOOTSTRAP)
  } catch {
    // best-effort visual feedback
  }
}

async function setAgentFeedbackStatus(page: any, status: AgentFeedbackStatus) {
  try {
    await ensureAgentFeedback(page)
    await page.evaluate((nextStatus: AgentFeedbackStatus) => {
      ;(window as any).__kronosAgentVisualFeedback?.setStatus?.(nextStatus)
    }, status)
  } catch {
    // best-effort visual feedback
  }
}

async function pulseAgentFeedbackSuccess(page: any) {
  await setAgentFeedbackStatus(page, "Success")
  try {
    await page.waitForTimeout(220)
  } catch {
    // ignore
  }
  await setAgentFeedbackStatus(page, "Thinking")
}

async function highlightAgentFeedbackTarget(page: any, selector: string | null | undefined) {
  if (typeof selector !== "string" || selector.trim().length === 0) return
  try {
    await ensureAgentFeedback(page)
    await page.evaluate((targetSelector: string) => {
      ;(window as any).__kronosAgentVisualFeedback?.highlightTarget?.(targetSelector)
    }, selector.trim())
  } catch {
    // best-effort visual feedback
  }
}

async function clearAgentFeedbackTarget(page: any) {
  try {
    await ensureAgentFeedback(page)
    await page.evaluate(() => {
      ;(window as any).__kronosAgentVisualFeedback?.clearTarget?.()
    })
  } catch {
    // best-effort visual feedback
  }
}

async function renderAgentFeedbackDrag(page: any, sourceSelector: string, targetSelector: string) {
  try {
    await ensureAgentFeedback(page)
    await page.evaluate(
      (source: string, target: string) => {
        return (window as any).__kronosAgentVisualFeedback?.renderDragBetweenSelectors?.(source, target, 500) ?? null
      },
      sourceSelector,
      targetSelector,
    )
  } catch {
    // best-effort visual feedback
  }
}

async function getPlaywright() {
  if (!playwrightModPromise) {
    playwrightModPromise = (async () => {
      const specifier = "playwright"
      try {
        const mod = await import(specifier)
        if (!mod || !mod.chromium) {
          throw new Error("Playwright chromium runtime is unavailable")
        }
        return mod
      } catch (error) {
        playwrightModPromise = null
        throw new Error(
          `Unable to load Playwright runtime (${error instanceof Error ? error.message : String(error)}). Install playwright in kronoscode workspace.`
        )
      }
    })()
  }
  return playwrightModPromise
}

function activePage(state: RuntimeSessionState) {
  if (!state.activePageID) return null
  return state.pages.find((p) => p.id === state.activePageID) ?? null
}

function simplifyUrl(input: string) {
  try {
    const url = new URL(input)
    const pathname = url.pathname === "/" ? "" : url.pathname
    return `${url.origin}${pathname}`
  } catch {
    return input
  }
}

function pushLimited<T>(arr: T[], value: T, max: number) {
  arr.push(value)
  if (arr.length > max) {
    arr.splice(0, arr.length - max)
  }
}

function emitStateEvent(state: RuntimeSessionState, reason: string) {
  runtimeEventBus.emit("event", {
    type: "browser.state",
    sessionID: state.sessionID,
    at: Date.now(),
    reason,
  } satisfies BrowserRuntimeEvent)
}

function scheduleStateEvent(state: RuntimeSessionState, reason: string) {
  const now = Date.now()
  const elapsed = now - state.lastEmitAt

  state.pendingEmitReason = reason
  if (state.emitTimer) {
    return
  }

  if (elapsed >= EVENT_THROTTLE_MS) {
    state.lastEmitAt = now
    const pendingReason = state.pendingEmitReason ?? reason
    state.pendingEmitReason = null
    emitStateEvent(state, pendingReason)
    return
  }

  const delay = Math.max(0, EVENT_THROTTLE_MS - elapsed)
  state.emitTimer = setTimeout(() => {
    state.emitTimer = null
    state.lastEmitAt = Date.now()
    const pendingReason = state.pendingEmitReason ?? reason
    state.pendingEmitReason = null
    emitStateEvent(state, pendingReason)
  }, delay)
}

async function getPageNavigationCapabilities(page: any): Promise<{ canGoBack: boolean; canGoForward: boolean }> {
  let cdpSession: any
  try {
    const context = page?.context?.()
    if (!context?.newCDPSession) {
      return { canGoBack: false, canGoForward: false }
    }

    cdpSession = await context.newCDPSession(page)
    const history = await cdpSession.send("Page.getNavigationHistory")
    const currentIndex = typeof history?.currentIndex === "number" ? history.currentIndex : 0
    const totalEntries = Array.isArray(history?.entries) ? history.entries.length : 0

    return {
      canGoBack: currentIndex > 0,
      canGoForward: totalEntries > 0 ? currentIndex < totalEntries - 1 : false,
    }
  } catch {
    return { canGoBack: false, canGoForward: false }
  } finally {
    try {
      await cdpSession?.detach?.()
    } catch {
      // ignore
    }
  }
}

async function attachPageListeners(state: RuntimeSessionState, pageState: RuntimePageState) {
  const page = pageState.page

  page.on("request", (request: any) => {
    if (request?.isNavigationRequest?.()) {
      pageState.isLoading = true
      pageState.lastError = null
      scheduleStateEvent(state, "navigation-start")
    }
  })

  page.on("domcontentloaded", () => {
    pageState.isLoading = false
    scheduleStateEvent(state, "domcontentloaded")
  })

  page.on("load", () => {
    pageState.isLoading = false
    pageState.lastError = null
    scheduleStateEvent(state, "page-load")
  })

  page.on("console", (msg: any) => {
    const location = msg?.location?.()
    const entry: BrowserConsoleMessage = {
      type: msg?.type?.() ?? "log",
      text: msg?.text?.() ?? "",
      location:
        location && typeof location === "object"
          ? {
              url: typeof location.url === "string" ? location.url : undefined,
              lineNumber: typeof location.lineNumber === "number" ? location.lineNumber : undefined,
              columnNumber: typeof location.columnNumber === "number" ? location.columnNumber : undefined,
            }
          : undefined,
      time: Date.now(),
    }
    pushLimited(pageState.console, entry, MAX_CONSOLE_MESSAGES)
  })

  page.on("request", (request: any) => {
    const entry: BrowserNetworkEvent = {
      id: randomUUID(),
      url: request?.url?.() ?? "",
      method: request?.method?.() ?? "GET",
      resourceType: request?.resourceType?.() ?? undefined,
      time: Date.now(),
    }
    pushLimited(pageState.network, entry, MAX_NETWORK_EVENTS)
  })

  page.on("response", (response: any) => {
    const req = response?.request?.()
    const entry: BrowserNetworkEvent = {
      id: randomUUID(),
      url: response?.url?.() ?? req?.url?.() ?? "",
      method: req?.method?.() ?? "GET",
      resourceType: req?.resourceType?.() ?? undefined,
      status: response?.status?.(),
      ok: response?.ok?.(),
      time: Date.now(),
    }
    pushLimited(pageState.network, entry, MAX_NETWORK_EVENTS)
  })

  page.on("requestfailed", (request: any) => {
    if (request?.isNavigationRequest?.()) {
      pageState.isLoading = false
      pageState.lastError = request?.failure?.()?.errorText ?? "requestfailed"
      scheduleStateEvent(state, "navigation-failed")
    }
    const entry: BrowserNetworkEvent = {
      id: randomUUID(),
      url: request?.url?.() ?? "",
      method: request?.method?.() ?? "GET",
      resourceType: request?.resourceType?.() ?? undefined,
      failure: request?.failure?.()?.errorText ?? "requestfailed",
      time: Date.now(),
    }
    pushLimited(pageState.network, entry, MAX_NETWORK_EVENTS)
  })

  page.on("close", () => {
    const idx = state.pages.findIndex((p) => p.id === pageState.id)
    if (idx >= 0) {
      state.pages.splice(idx, 1)
      if (state.activePageID === pageState.id) {
        state.activePageID = state.pages[0]?.id ?? null
      }
      scheduleStateEvent(state, "page-closed")
    }
  })
}

async function createPage(state: RuntimeSessionState, url?: string, timeoutMs?: number) {
  const page = await state.context.newPage()
  await ensureAgentFeedback(page)
  await setAgentFeedbackStatus(page, "Thinking")
  const pageState: RuntimePageState = {
    id: randomUUID(),
    createdAt: Date.now(),
    page,
    console: [],
    network: [],
    isLoading: typeof url === "string" && url.trim().length > 0,
    lastError: null,
  }
  state.pages.push(pageState)
  state.activePageID = pageState.id
  await attachPageListeners(state, pageState)
  scheduleStateEvent(state, "page-created")

  if (typeof url === "string" && url.trim().length > 0) {
    try {
      await setAgentFeedbackStatus(page, "Navigating")
      await clearAgentFeedbackTarget(page)
      await page.goto(url, { timeout: timeoutMs ?? 30_000, waitUntil: "domcontentloaded" })
      await ensureAgentFeedback(page)
      await pulseAgentFeedbackSuccess(page)
      pageState.isLoading = false
      pageState.lastError = null
    } catch (error) {
      await ensureAgentFeedback(page)
      await setAgentFeedbackStatus(page, "Thinking")
      pageState.isLoading = false
      pageState.lastError = error instanceof Error ? error.message : String(error)
      scheduleStateEvent(state, "navigation-failed")
      throw error
    }
  }

  scheduleStateEvent(state, "page-ready")

  return pageState
}

async function ensureSession(sessionID: string) {
  ensureEnabled()

  const cached = sessions.get(sessionID)
  if (cached) return cached

  const playwright = await getPlaywright()
  const browser = await playwright.chromium.launch({
    headless: true,
  })
  const context = await browser.newContext({
    viewport: DEFAULT_VIEWPORT,
    userAgent: CHROME_USER_AGENT,
  })

  const state: RuntimeSessionState = {
    sessionID,
    browser,
    context,
    pages: [],
    activePageID: null,
    createdAt: Date.now(),
    lastEmitAt: 0,
    pendingEmitReason: null,
    emitTimer: null,
  }

  sessions.set(sessionID, state)
  await createPage(state, "about:blank")
  scheduleStateEvent(state, "session-created")
  return state
}

function requirePageState(state: RuntimeSessionState) {
  const current = activePage(state)
  if (!current) {
    throw new Error("No active browser page in this session")
  }
  return current
}

async function resolveTargetElement(args: { uid?: string; selector?: string }) {
  if (typeof args.selector === "string" && args.selector.trim().length > 0) {
    return args.selector.trim()
  }
  if (typeof args.uid === "string" && args.uid.trim().length > 0) {
    const uid = args.uid.trim()
    return `[data-kronoscode-browser-uid=\"${uid.replaceAll('"', "\\\"")}\"]`
  }
  throw new Error("Either selector or uid is required")
}

async function buildAccessibilitySnapshot(page: any) {
  const items = (await page.evaluate(() => {
    const isHidden = (el: Element) => {
      const style = window.getComputedStyle(el as HTMLElement)
      return style.display === "none" || style.visibility === "hidden" || (el as HTMLElement).offsetParent === null
    }

    const candidates = Array.from(
      document.querySelectorAll(
        "a,button,input,textarea,select,summary,[role],[onclick],[tabindex],label,option"
      )
    )

    let n = 1
    return candidates
      .filter((el) => !isHidden(el))
      .slice(0, 500)
      .map((el) => {
        const node = el as HTMLElement
        const existing = node.getAttribute("data-kronoscode-browser-uid")
        const uid = existing || String(n++)
        node.setAttribute("data-kronoscode-browser-uid", uid)

        const role = node.getAttribute("role") || node.tagName.toLowerCase()
        const text = (node.innerText || node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 180)
        const name = node.getAttribute("aria-label") || node.getAttribute("name") || node.getAttribute("title") || text
        const value = (node as HTMLInputElement).value
        const href = node.getAttribute("href")

        return {
          uid,
          role,
          name: (name || "").slice(0, 180),
          value: typeof value === "string" ? value.slice(0, 140) : undefined,
          href: typeof href === "string" ? href : undefined,
        }
      })
  })) as Array<{ uid: string; role: string; name: string; value?: string; href?: string }>

  const lines = items.map((item) => {
    const parts = [`@${item.uid}`, item.role]
    if (item.name) parts.push(`\"${item.name}\"`)
    if (item.value) parts.push(`value=\"${item.value}\"`)
    if (item.href) parts.push(`href=${item.href}`)
    return parts.join(" ")
  })

  return {
    items,
    text: lines.join("\n"),
  }
}

export namespace BrowserRuntime {
  export function enabled() {
    return Flag.KRONOSCODE_ENABLE_AI_BROWSER
  }

  export async function listPages(sessionID: string) {
    const state = await ensureSession(sessionID)
    const pages = await Promise.all(
      state.pages.map(async (item, idx) => {
        const url = item.page?.url?.() ?? "about:blank"
        const title = (await item.page?.title?.().catch(() => "")) || "Untitled"
        const navigation = await getPageNavigationCapabilities(item.page)
        return {
          id: item.id,
          index: idx,
          title,
          url,
          active: state.activePageID === item.id,
          createdAt: item.createdAt,
          canGoBack: navigation.canGoBack,
          canGoForward: navigation.canGoForward,
          isLoading: item.isLoading,
          lastError: item.lastError,
        }
      })
    )
    return pages
  }

  export async function selectPage(sessionID: string, pageIdx: number) {
    const state = await ensureSession(sessionID)
    if (pageIdx < 0 || pageIdx >= state.pages.length) {
      throw new Error(`Invalid page index ${pageIdx}`)
    }
    state.activePageID = state.pages[pageIdx].id
    scheduleStateEvent(state, "page-selected")
    return listPages(sessionID)
  }

  export async function newPage(sessionID: string, url: string, timeoutMs = 30_000) {
    const state = await ensureSession(sessionID)
    const pageState = await createPage(state, url, timeoutMs)
    const title = (await pageState.page.title().catch(() => "")) || "Untitled"
    scheduleStateEvent(state, "page-created")
    return {
      id: pageState.id,
      title,
      url: pageState.page.url?.() ?? url,
    }
  }

  export async function closePage(sessionID: string, pageIdx: number) {
    const state = await ensureSession(sessionID)
    if (state.pages.length <= 1) {
      throw new Error("Cannot close the last browser page")
    }
    if (pageIdx < 0 || pageIdx >= state.pages.length) {
      throw new Error(`Invalid page index ${pageIdx}`)
    }
    const pageState = state.pages[pageIdx]
    await pageState.page.close()
    scheduleStateEvent(state, "page-closed")
    return listPages(sessionID)
  }

  export async function navigate(
    sessionID: string,
    input: { type?: "url" | "back" | "forward" | "reload"; url?: string; timeoutMs?: number }
  ) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    const page = pageState.page
    const navType = input.type || (input.url ? "url" : "url")
    const timeout = input.timeoutMs ?? 30_000

    pageState.isLoading = true
    pageState.lastError = null
    await ensureAgentFeedback(page)
    await setAgentFeedbackStatus(page, "Navigating")
    await clearAgentFeedbackTarget(page)
    scheduleStateEvent(state, "navigation-start")

    try {
      if (navType === "url") {
        if (!input.url) {
          throw new Error("url is required for navigation type=url")
        }
        await page.goto(input.url, { timeout, waitUntil: "domcontentloaded" })
      } else if (navType === "back") {
        await page.goBack({ timeout, waitUntil: "domcontentloaded" }).catch(() => null)
      } else if (navType === "forward") {
        await page.goForward({ timeout, waitUntil: "domcontentloaded" }).catch(() => null)
      } else if (navType === "reload") {
        await page.reload({ timeout, waitUntil: "domcontentloaded" })
      }
      pageState.isLoading = false
      pageState.lastError = null
      await ensureAgentFeedback(page)
      await pulseAgentFeedbackSuccess(page)
      scheduleStateEvent(state, "navigation-complete")
    } catch (error) {
      pageState.isLoading = false
      pageState.lastError = error instanceof Error ? error.message : String(error)
      await ensureAgentFeedback(page)
      await setAgentFeedbackStatus(page, "Thinking")
      scheduleStateEvent(state, "navigation-failed")
      throw error
    }

    return {
      title: (await page.title().catch(() => "")) || "Untitled",
      url: page.url(),
      type: navType,
    }
  }

  export async function stop(sessionID: string) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    await pageState.page.evaluate(() => window.stop()).catch(() => undefined)
    pageState.isLoading = false
    scheduleStateEvent(state, "navigation-stopped")
    return {
      stopped: true,
      url: pageState.page.url?.() ?? "about:blank",
    }
  }

  export async function waitForText(sessionID: string, text: string, timeoutMs = 30_000) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)

    await ensureAgentFeedback(pageState.page)
    await setAgentFeedbackStatus(pageState.page, "Thinking")

    await pageState.page.waitForFunction(
      (needle: string) => document.body?.innerText?.toLowerCase().includes(needle.toLowerCase()),
      text,
      { timeout: timeoutMs }
    )
    pageState.isLoading = false
    await pulseAgentFeedbackSuccess(pageState.page)
    scheduleStateEvent(state, "wait-for")

    return {
      ok: true,
      text,
    }
  }

  export async function resize(sessionID: string, width: number, height: number) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    await pageState.page.setViewportSize({ width: Math.max(200, width), height: Math.max(200, height) })
    scheduleStateEvent(state, "resize")
    return {
      width: Math.max(200, width),
      height: Math.max(200, height),
    }
  }

  export async function handleDialog(sessionID: string, action: DialogAction, promptText?: string) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    pageState.page.once("dialog", async (dialog: any) => {
      if (action === "accept") {
        await dialog.accept(promptText ?? "")
        return
      }
      await dialog.dismiss()
    })

    return {
      armed: true,
      action,
    }
  }

  export async function click(sessionID: string, args: { uid?: string; selector?: string; button?: "left" | "right" | "middle"; doubleClick?: boolean }) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    const target = await resolveTargetElement(args)
    const locator = pageState.page.locator(target).first()
    await ensureAgentFeedback(pageState.page)
    await setAgentFeedbackStatus(pageState.page, "Clicking")
    await highlightAgentFeedbackTarget(pageState.page, target)

    if (args.doubleClick) {
      await locator.dblclick({ button: args.button ?? "left" })
    } else {
      await locator.click({ button: args.button ?? "left" })
    }
    await pulseAgentFeedbackSuccess(pageState.page)
    scheduleStateEvent(state, "click")

    return {
      clicked: true,
      target,
    }
  }

  export async function hover(sessionID: string, args: { uid?: string; selector?: string }) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    const target = await resolveTargetElement(args)
    await ensureAgentFeedback(pageState.page)
    await setAgentFeedbackStatus(pageState.page, "Navigating")
    await highlightAgentFeedbackTarget(pageState.page, target)
    await pageState.page.locator(target).first().hover()
    await pulseAgentFeedbackSuccess(pageState.page)
    scheduleStateEvent(state, "hover")
    return {
      hovered: true,
      target,
    }
  }

  export async function fill(sessionID: string, args: { uid?: string; selector?: string; value: string }) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    const target = await resolveTargetElement(args)
    await ensureAgentFeedback(pageState.page)
    await setAgentFeedbackStatus(pageState.page, "Clicking")
    await highlightAgentFeedbackTarget(pageState.page, target)
    await pageState.page.locator(target).first().fill(args.value)
    await pulseAgentFeedbackSuccess(pageState.page)
    scheduleStateEvent(state, "fill")
    return {
      filled: true,
      target,
      valueLength: args.value.length,
    }
  }

  export async function fillForm(
    sessionID: string,
    fields: Array<{
      uid?: string
      selector?: string
      value: string
    }>
  ) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)

    await ensureAgentFeedback(pageState.page)
    await setAgentFeedbackStatus(pageState.page, "Clicking")
    const output: Array<{ target: string; ok: boolean; error?: string }> = []
    for (const field of fields) {
      try {
        const target = await resolveTargetElement(field)
        await highlightAgentFeedbackTarget(pageState.page, target)
        await pageState.page.locator(target).first().fill(field.value)
        output.push({ target, ok: true })
      } catch (error) {
        output.push({
          target: field.selector || field.uid || "unknown",
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    await pulseAgentFeedbackSuccess(pageState.page)
    scheduleStateEvent(state, "fill-form")

    return output
  }

  export async function drag(
    sessionID: string,
    args: {
      sourceUid?: string
      sourceSelector?: string
      targetUid?: string
      targetSelector?: string
    }
  ) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)

    const source = await resolveTargetElement({ uid: args.sourceUid, selector: args.sourceSelector })
    const target = await resolveTargetElement({ uid: args.targetUid, selector: args.targetSelector })

    await ensureAgentFeedback(pageState.page)
    await setAgentFeedbackStatus(pageState.page, "Clicking")
    await highlightAgentFeedbackTarget(pageState.page, source)
    await renderAgentFeedbackDrag(pageState.page, source, target)
    await pageState.page.dragAndDrop(source, target)
    await highlightAgentFeedbackTarget(pageState.page, target)
    await pulseAgentFeedbackSuccess(pageState.page)
    scheduleStateEvent(state, "drag")

    return {
      source,
      target,
    }
  }

  export async function pressKey(sessionID: string, key: string) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    await ensureAgentFeedback(pageState.page)
    await setAgentFeedbackStatus(pageState.page, "Clicking")
    await pageState.page.keyboard.press(key)
    await pulseAgentFeedbackSuccess(pageState.page)
    scheduleStateEvent(state, "press-key")
    return { key }
  }

  export async function uploadFile(
    sessionID: string,
    args: {
      uid?: string
      selector?: string
      files: string[]
    }
  ) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    const target = await resolveTargetElement(args)
    await ensureAgentFeedback(pageState.page)
    await setAgentFeedbackStatus(pageState.page, "Clicking")
    await highlightAgentFeedbackTarget(pageState.page, target)
    await pageState.page.setInputFiles(target, args.files)
    await pulseAgentFeedbackSuccess(pageState.page)
    scheduleStateEvent(state, "upload-file")
    return {
      target,
      count: args.files.length,
    }
  }

  export async function snapshot(sessionID: string) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    await ensureAgentFeedback(pageState.page)
    await setAgentFeedbackStatus(pageState.page, "Thinking")
    return await buildAccessibilitySnapshot(pageState.page)
  }

  export async function screenshot(sessionID: string, fullPage = true) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    const screenshotBuffer = await pageState.page.screenshot({ fullPage, type: "png" })
    return {
      mime: "image/png",
      base64: Buffer.from(screenshotBuffer).toString("base64"),
      title: `${simplifyUrl(pageState.page.url?.() ?? "about:blank")}`,
      pageID: pageState.id,
    }
  }

  export async function evaluate(sessionID: string, script: string) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)

    const result = await pageState.page.evaluate((code: string) => {
      try {
        // eslint-disable-next-line no-eval
        const value = eval(code)
        return { ok: true, value }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }, script)

    return result as { ok: boolean; value?: JsonValue; error?: string }
  }

  export async function networkRequests(sessionID: string, limit = 50) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    return pageState.network.slice(-Math.max(1, Math.min(limit, 500)))
  }

  export async function networkRequest(sessionID: string, input: { index?: number; urlContains?: string }) {
    const requests = await networkRequests(sessionID, 500)

    if (typeof input.index === "number") {
      const idx = Math.trunc(input.index)
      if (idx < 0 || idx >= requests.length) {
        throw new Error(`Invalid network request index ${idx}`)
      }
      return requests[idx]
    }

    if (typeof input.urlContains === "string" && input.urlContains.trim().length > 0) {
      const match = [...requests].reverse().find((item) => item.url.includes(input.urlContains!))
      if (!match) {
        throw new Error(`No network request contains: ${input.urlContains}`)
      }
      return match
    }

    throw new Error("Provide either index or urlContains")
  }

  export async function consoleMessages(sessionID: string, limit = 50) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    return pageState.console.slice(-Math.max(1, Math.min(limit, 300)))
  }

  export async function consoleMessage(sessionID: string, index: number) {
    const logs = await consoleMessages(sessionID, 300)
    const idx = Math.trunc(index)
    if (idx < 0 || idx >= logs.length) {
      throw new Error(`Invalid console message index ${idx}`)
    }
    return logs[idx]
  }

  export async function emulate(
    sessionID: string,
    input: {
      width?: number
      height?: number
      colorScheme?: "light" | "dark" | "no-preference"
      reducedMotion?: "reduce" | "no-preference"
      locale?: string
      timezoneId?: string
      geolocation?: { latitude: number; longitude: number }
    }
  ) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)

    if (typeof input.width === "number" || typeof input.height === "number") {
      const current = pageState.page.viewportSize?.() ?? { width: 1280, height: 820 }
      await pageState.page.setViewportSize({
        width: Math.max(200, Math.trunc(input.width ?? current.width)),
        height: Math.max(200, Math.trunc(input.height ?? current.height)),
      })
    }

    if (input.colorScheme || input.reducedMotion) {
      await pageState.page.emulateMedia({
        colorScheme: input.colorScheme,
        reducedMotion: input.reducedMotion,
      })
    }

    if (input.geolocation && typeof input.geolocation.latitude === "number" && typeof input.geolocation.longitude === "number") {
      await state.context.setGeolocation({
        latitude: input.geolocation.latitude,
        longitude: input.geolocation.longitude,
      })
      await state.context.grantPermissions(["geolocation"])
    }

    return {
      emulated: true,
      notes:
        input.locale || input.timezoneId
          ? "Locale/timezone changes require context recreation; current session keeps original context values."
          : undefined,
    }
  }

  export async function perfStart(sessionID: string) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    pageState.perf = {
      startedAt: Date.now(),
    }
    return pageState.perf
  }

  export async function perfStop(sessionID: string) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    const current = pageState.perf ?? { startedAt: Date.now() }
    const stoppedAt = Date.now()

    const metrics = await pageState.page
      .evaluate(() => {
        const nav = performance.getEntriesByType("navigation")?.[0] as PerformanceNavigationTiming | undefined
        return {
          jsHeapUsedSize: (performance as any).memory?.usedJSHeapSize,
          jsHeapTotalSize: (performance as any).memory?.totalJSHeapSize,
          domNodeCount: document.querySelectorAll("*").length,
          resourceCount: performance.getEntriesByType("resource").length,
          navDuration: typeof nav?.duration === "number" ? nav.duration : undefined,
        }
      })
      .catch(() => ({}))

    pageState.perf = {
      ...current,
      stoppedAt,
      durationMs: stoppedAt - current.startedAt,
      metrics,
    }
    return pageState.perf
  }

  export async function perfInsight(sessionID: string) {
    const state = await ensureSession(sessionID)
    const pageState = requirePageState(state)
    const perf = pageState.perf

    if (!perf || !perf.durationMs) {
      throw new Error("Performance capture has not been started/stopped yet")
    }

    const insights = [] as string[]
    if (typeof perf.metrics?.domNodeCount === "number" && perf.metrics.domNodeCount > 2000) {
      insights.push("High DOM node count detected (>2000). Consider reducing rendered nodes.")
    }
    if (typeof perf.metrics?.resourceCount === "number" && perf.metrics.resourceCount > 120) {
      insights.push("High resource request count detected (>120). Consider bundling/lazy-loading.")
    }
    if (typeof perf.metrics?.jsHeapUsedSize === "number" && perf.metrics.jsHeapUsedSize > 150 * 1024 * 1024) {
      insights.push("High JS heap usage detected (>150MB). Investigate memory retention.")
    }
    if (insights.length === 0) {
      insights.push("No major perf anomalies detected in current sample.")
    }

    return {
      durationMs: perf.durationMs,
      metrics: perf.metrics,
      insights,
    }
  }

  export async function frame(sessionID: string) {
    return screenshot(sessionID, true)
  }

  export async function state(sessionID: string) {
    const pages = await listPages(sessionID)
    const active = pages.find((item) => item.active)
    return {
      enabled: enabled(),
      sessionID,
      pages,
      activePageID: active?.id ?? null,
      error: active?.lastError ?? undefined,
    }
  }

  export async function dispose(sessionID: string) {
    const state = sessions.get(sessionID)
    if (!state) return false

    sessions.delete(sessionID)
    if (state.emitTimer) {
      clearTimeout(state.emitTimer)
      state.emitTimer = null
    }
    try {
      await state.context.close()
    } catch (error) {
      log.warn("failed to close browser context", { error })
    }
    try {
      await state.browser.close()
    } catch (error) {
      log.warn("failed to close browser", { error })
    }
    emitStateEvent(state, "session-disposed")
    return true
  }

  export function onEvent(listener: (event: BrowserRuntimeEvent) => void): () => void {
    runtimeEventBus.on("event", listener)
    return () => {
      runtimeEventBus.off("event", listener)
    }
  }
}
