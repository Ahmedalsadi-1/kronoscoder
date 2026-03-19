# KronosCode ↔ KronosChamber Browser Control Architecture

## Answer: YES - Full In-App Control ✅

**KronosCode (Core Engine) has complete in-app control over the KronosChamber Desktop Browser through the AI Browser Runtime.**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    KRONOSCODER (Core Engine)                │
│                 packages/kronoscode/src/                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Tool Registry & Execution                   │  │
│  │  (src/tool/registry.ts)                              │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  • browser_* (19 tools) ────────────────┐            │  │
│  │  • kronoschamber_browser_* (19 tools) ──┼──────┐     │  │
│  │  • automation-mcp_* (13 tools)           │      │     │  │
│  │  • computer-use-mcp_computer             │      │     │  │
│  └──────────────────────────────────────────┼──────┼─────┘  │
│                                             │      │        │
│  ┌──────────────────────────────────────────▼──────▼─────┐  │
│  │         AI Browser Runtime Controller                  │  │
│  │      (src/browser/runtime.ts)                         │  │
│  │      (src/tool/ai_browser.ts)                         │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  • BrowserRuntime class                              │  │
│  │  • Session management (per sessionID)                │  │
│  │  • Page lifecycle (create, select, close)            │  │
│  │  • Navigation & interaction control                  │  │
│  │  • Network monitoring                                │  │
│  │  • Console message capture                           │  │
│  │  • Performance metrics                               │  │
│  │  • Playwright integration                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ▲                                  │
│                          │                                  │
│                    Event Emitter Bus                        │
│              (runtimeEventBus: EventEmitter)               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ browser.state events
                          │ (sessionID, reason, timestamp)
                          │
        ┌─────────────────▼─────────────────┐
        │                                    │
        │      KRONOSCHAMBER Desktop         │
        │    (kronosChamber/)                │
        │                                    │
        ├────────────────────────────────────┤
        │                                    │
        │  ┌──────────────────────────────┐ │
        │  │   Browser Panel Component    │ │
        │  │   (Listens to events)        │ │
        │  │   (Real-time sync)           │ │
        │  │   (Visual feedback)          │ │
        │  └──────────────────────────────┘ │
        │           ▲                        │
        │           │ State updates          │
        │           │                        │
        │  ┌────────▼─────────────────────┐ │
        │  │  Playwright Browser Instance  │ │
        │  │  (Chromium headless)          │ │
        │  │  (Page management)            │ │
        │  │  (User interactions)          │ │
        │  └──────────────────────────────┘ │
        │                                    │
        └────────────────────────────────────┘
```

---

## Control Flow: How KronosCode Controls KronosChamber Browser

### 1. **Tool Invocation** (KronosCode → AI Browser Runtime)

```typescript
// User/Agent calls in KronosCode:
kronoschamber_browser_new_page(url: "https://example.com")
kronoschamber_browser_click(selector: ".button")
kronoschamber_browser_fill(selector: "input", value: "text")
kronoschamber_browser_screenshot()
```

### 2. **Alias Mechanism** (Unified API)

```typescript
// From ai_browser.ts (line 474-520)
const aliasBrowserTool = (id: string, tool: Tool.Info) => Tool.alias(id, tool)

// Creates identical tools with different names:
const kronoschamber_browser_new_page = aliasBrowserTool(
  "kronoschamber_browser_new_page",
  browser_new_page, // Same underlying implementation
)
```

**Why aliases?**

- Single implementation, multiple interfaces
- Supports both `browser_*` (generic) and `kronoschamber_browser_*` (specific) naming
- Reduces code duplication
- Maintains consistency

### 3. **Runtime Execution** (AI Browser Runtime)

```typescript
// ai_browser.ts - browser_new_page implementation
const browser_new_page = Tool.define("browser_new_page", {
  description: "Create a new browser page and navigate to a URL",
  parameters: z.object({
    url: z.string().min(1),
    timeout: z.number().int().positive().optional(),
  }),
  async execute(params, ctx) {
    ensureEnabled() // Check KRONOSCODE_ENABLE_AI_BROWSER=true

    // Get session-specific browser state
    const page = await BrowserRuntime.newPage(ctx.sessionID, params.url, params.timeout ?? NAV_TIMEOUT_MS)

    return {
      title: "Created Browser Page",
      metadata: { pageID: page.id },
      output: toOutput(page),
    }
  },
})
```

### 4. **Session Management** (BrowserRuntime)

```typescript
// src/browser/runtime.ts
type RuntimeSessionState = {
  sessionID: string
  browser: any // Playwright browser instance
  context: any // Playwright context
  pages: RuntimePageState[] // Array of open pages
  activePageID: string | null
  createdAt: number
  lastEmitAt: number
  pendingEmitReason: string | null
  emitTimer: NodeJS.Timeout | null
}

// Session tracking
const sessions = new Map<string, RuntimeSessionState>()

// Each session is isolated:
// - Independent browser instance
// - Independent context
// - Separate page management
// - Own console/network/perf tracking
```

### 5. **State Synchronization** (Event Emitter)

```typescript
// BrowserRuntime emits state changes
const runtimeEventBus = new EventEmitter()

function emitStateEvent(state: RuntimeSessionState, reason: string) {
  runtimeEventBus.emit("event", {
    type: "browser.state",
    sessionID: state.sessionID,
    at: Date.now(),
    reason, // "pageCreated", "navigationComplete", "clicked", etc.
  } satisfies BrowserRuntimeEvent)
}

// KronosChamber listens and updates UI in real-time
```

---

## Supported Operations (19 kronoschamber*browser*\* tools)

### Page Management

- ✅ `kronoschamber_browser_list_pages` - Get all open pages
- ✅ `kronoschamber_browser_select_page` - Switch active page
- ✅ `kronoschamber_browser_new_page` - Open new page
- ✅ `kronoschamber_browser_close_page` - Close page

### Navigation

- ✅ `kronoschamber_browser_navigate` - Go to URL / back / forward / reload
- ✅ `kronoschamber_browser_wait_for` - Wait for text/element

### User Interaction

- ✅ `kronoschamber_browser_click` - Click elements
- ✅ `kronoschamber_browser_hover` - Hover over elements
- ✅ `kronoschamber_browser_fill` - Fill form fields
- ✅ `kronoschamber_browser_fill_form` - Fill multiple fields
- ✅ `kronoschamber_browser_drag` - Drag elements
- ✅ `kronoschamber_browser_press_key` - Press keyboard keys

### Observation & Debugging

- ✅ `kronoschamber_browser_snapshot` - Get accessibility tree
- ✅ `kronoschamber_browser_screenshot` - Capture screenshot
- ✅ `kronoschamber_browser_console` - Read console messages
- ✅ `kronoschamber_browser_console_message` - Get specific message
- ✅ `kronoschamber_browser_network_requests` - List network activity
- ✅ `kronoschamber_browser_network_request` - Get specific request

### Advanced Control

- ✅ `kronoschamber_browser_evaluate` - Execute JavaScript
- ✅ `kronoschamber_browser_emulate` - Emulate viewport/media/geolocation
- ✅ `kronoschamber_browser_handle_dialog` - Handle alerts/confirms
- ✅ `kronoschamber_browser_resize` - Resize viewport
- ✅ `kronoschamber_browser_perf_start` - Start performance capture
- ✅ `kronoschamber_browser_perf_stop` - Stop performance capture
- ✅ `kronoschamber_browser_perf_insight` - Get performance insights

---

## Key Features

### 1. **Session Isolation**

- Each KronosCode session has its own browser instance
- Multiple simultaneous sessions supported
- No cross-contamination between sessions

### 2. **Real-Time Synchronization**

- Event-driven architecture
- KronosChamber UI updates as KronosCode controls browser
- Bidirectional awareness (both can see what's happening)

### 3. **Playwright Integration**

- Uses headless Chromium
- Full browser automation capabilities
- Network/console/performance monitoring built-in

### 4. **Context Preservation**

- Console messages (max 300)
- Network events (max 600)
- Performance metrics
- All tracked per-page

### 5. **Flexible Execution**

- Can run in KronosCode CLI
- Can run in KronosChamber desktop
- Can run in VS Code extension
- Same underlying runtime

---

## Setup Requirements

### Enable AI Browser

```bash
export KRONOSCODE_ENABLE_AI_BROWSER=true
```

### Install Playwright

```bash
npm install playwright
# or
bun install playwright
```

### Verify

```bash
# Check if enabled
grep -r "KRONOSCODE_ENABLE_AI_BROWSER" src/
```

---

## Example: Complete Control Sequence

```typescript
// From KronosCode (Sisyphus AI Agent):

// 1. Create new page
await kronoschamber_browser_new_page({
  url: "https://example.com",
})
// Event: browser.state (reason: "pageCreated")
// KronosChamber UI: New page appears in browser panel

// 2. Wait for content
await kronoschamber_browser_wait_for({
  text: "Login",
})
// Event: browser.state (reason: "navigationComplete")
// KronosChamber UI: Screenshot updates, page marked as ready

// 3. Fill form
await kronoschamber_browser_fill({
  selector: "input[type=email]",
  value: "user@example.com",
})
// Event: browser.state (reason: "filled")
// KronosChamber UI: Form field highlighted/filled

// 4. Click button
await kronoschamber_browser_click({
  selector: "button[type=submit]",
})
// Event: browser.state (reason: "clicked")
// KronosChamber UI: Button press animated, page loading

// 5. Capture result
const screenshot = await kronoschamber_browser_screenshot()
// Event: browser.state (reason: "screenshotCaptured")
// KronosChamber UI: New screenshot displayed

// 6. Check network
const requests = await kronoschamber_browser_network_requests()
// Event: browser.state (reason: "networkQueried")
// KronosChamber UI: Network panel updated

// 7. Read console
const messages = await kronoschamber_browser_console()
// Event: browser.state (reason: "consoleQueried")
// KronosChamber UI: Console panel updated
```

---

## Tool Availability Matrix

| Tool                      | KronosCode CLI | KronosChamber Web | KronosChamber Desktop | VS Code |
| ------------------------- | -------------- | ----------------- | --------------------- | ------- |
| browser\_\*               | ✅             | ✅                | ✅                    | ✅      |
| kronoschamber*browser*\*  | ✅             | ✅                | ✅                    | ✅      |
| automation-mcp\_\*        | ✅             | ⚠️ (limited)      | ✅                    | ✅      |
| computer-use-mcp_computer | ✅             | ⚠️ (limited)      | ✅                    | ✅      |

---

## Architecture Benefits

### 1. **Unified Interface**

- Same tools work everywhere (KronosCode, KronosChamber, VS Code)
- No need to learn different APIs

### 2. **Real-Time Feedback**

- KronosChamber shows exactly what KronosCode is doing
- Debugging and monitoring built-in

### 3. **Scalability**

- Multiple sessions can run in parallel
- Each session fully isolated
- Event-driven design prevents blocking

### 4. **Developer Experience**

- Clear separation of concerns
- Aliasing reduces duplication
- Event-based makes testing easier

### 5. **Security**

- Session isolation prevents leakage
- No cross-session interference
- Controlled browser access

---

## Conclusion

**YES - KronosCode has complete in-app control of KronosChamber browser through:**

1. **19 dedicated `kronoschamber_browser_*` tools** in the tool registry
2. **AI Browser Runtime** (BrowserRuntime class) managing Playwright instances
3. **Session-based isolation** for concurrent operations
4. **Event-driven synchronization** for real-time UI updates
5. **Alias mechanism** for unified implementation with multiple interfaces

The architecture is elegant, scalable, and maintains clear separation between the KronosCode core engine and the KronosChamber UI runtime while providing complete control capabilities.
