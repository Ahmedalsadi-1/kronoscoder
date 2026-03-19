# Flow Browser Integration Plan: Real Browser + AI Layer

## Vision

Transform KronosChamber into a **real browser** that users interact with as their primary browser, with KronosChamber AI as an **intelligent layer on top** - not a separate app, but an integrated companion that understands and enhances the browsing experience.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  KronosChamber Real Browser (Electron + Chromium)                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  BROWSER CHROME (from flow-browser)                                │    │
│  │                                                                     │    │
│  │  [Spaces] [Tab Bar with tabs, pinned, groups]                       │    │
│  │  [Omnibox: URL/Search with suggestions, history, bookmarks]        │    │
│  │  [Nav: ← → ⟳] [Extensions icon] [Profile] [Settings]                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  WEB CONTENT (Chromium WebContents) - Full browser capabilities     │    │
│  │                                                                     │    │
│  │  ✅ Right-click context menus (Inspect, Copy, Paste, Save, etc.)  │    │
│  │  ✅ Chrome extensions (uBlock, LastPass, Grammarly, etc.)        │    │
│  │  ✅ DevTools (F12) - Full debugging                               │    │
│  │  ✅ Downloads, print, zoom, find in page                          │    │
│  │  ✅ Bookmarks, history, autofill, password manager               │    │
│  │  ✅ WebRTC, WebGL, all web APIs work 100%                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  AI LAYER (KronosChamber Overlay - always present, transparent)   │    │
│  │                                                                     │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │  AI Sidebar (right side, 380px width, collapsible)         │   │    │
│  │  │  • Current page context                                     │   │    │
│  │  │  • AI suggestions/actions based on page content             │   │    │
│  │  │  • Chat history with page references                        │   │    │
│  │  │  • "Ask about this page..." input at bottom                  │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  │                                                                     │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │  Floating AI Widgets (overlay on browser content)           │   │    │
│  │  │  • Smart highlights on page elements                        │   │    │
│  │  │  • Right-click AI actions ("Fill this form", "Explain")    │   │    │
│  │  │  • Page action buttons (summarize, translate, extract)   │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  DIRECT BROWSER ACCESS (CDP - Chrome DevTools Protocol)            │    │
│  │                                                                     │    │
│  │  AI has real-time access to:                                       │    │
│  │  • DOM tree (live mutations)                                       │    │
│  │  • Network requests/responses                                        │    │
│  │  • Console logs                                                     │    │
│  │  • User interactions (clicks, scrolls, inputs)                     │    │
│  │  • Can execute JavaScript directly                                  │    │
│  │  • Can monitor and react to page changes                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## What You Get vs Current State

### Current State (Tauri WebView)

```
❌ Limited browser feel - feels like embedded web view
❌ No Chrome extensions
❌ No right-click context menus
❌ No DevTools
❌ AI gets snapshots, not live DOM
❌ Browser resets on close (no persistence)
```

### Target State (Electron + Flow Browser)

```
✅ Full Chrome browser experience
✅ All Chrome extensions work
✅ Native right-click menus + AI-enhanced
✅ Full DevTools (F12)
✅ AI has live DOM monitoring via CDP
✅ Persistent browser sessions (tabs, cookies, logins)
✅ Bookmarks, history, downloads
```

---

## Integration Architecture

### Two-Layer Architecture

```
Layer 1: Flow Browser (Base)
├── Electron main process
├── Chromium WebContents
├── Native browser chrome (tabs, omnibox, navigation)
├── Extension loader
├── Profile management
└── CDP server (for AI access)

Layer 2: KronosChamber AI (Overlay)
├── React UI overlay (always visible)
├── CDP client (connects to browser's CDP)
├── AI agent (direct DOM access)
├── Context bridge (browser ↔ AI communication)
└── Enhanced context menus
```

---

## Phase 1: Extract Flow Browser Components (Weeks 1-3)

### Step 1.1: Fork and Extract

**Fork flow-browser, extract these components:**

```bash
# Fork flow-browser
git clone https://github.com/MultiboxLabs/flow-browser.git

# Extract key files we need:
```

| Source File                           | Destination                                            | Purpose                  |
| ------------------------------------- | ------------------------------------------------------ | ------------------------ |
| `src/main/browser.ts`                 | `kronosChamber/packages/desktop/src-electron/browser/` | BrowserWindow management |
| `src/main/tabs.ts`                    | `kronosChamber/packages/desktop/src-electron/browser/` | Tab management           |
| `src/main/extensions.ts`              | `kronosChamber/packages/desktop/src-electron/browser/` | Extension loader         |
| `src/main/omnibox.ts`                 | `kronosChamber/packages/desktop/src-electron/browser/` | Address bar logic        |
| `src/renderer/components/TabBar/`     | `kronosChamber/packages/ui/src/components/browser/`    | Tab bar UI               |
| `src/renderer/components/Omnibox/`    | `kronosChamber/packages/ui/src/components/browser/`    | Address bar UI           |
| `src/renderer/components/Navigation/` | `kronosChamber/packages/ui/src/components/browser/`    | Nav buttons              |
| `src/renderer/components/Sidebar/`    | `kronosChamber/packages/ui/src/components/browser/`    | Browser sidebar          |

### Step 1.2: Adapt to KronosChamber Design System

```typescript
// Adapt flow-browser TabBar to KronosChamber design
// File: packages/ui/src/components/browser/FlowTabBar.tsx

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tab, TabList, TabGroup } from '@/components/ui/tabs';

// Flow-browser props, KronosChamber styling
export const FlowTabBar = ({
  tabs,
  activeTab,
  onSelect,
  onClose,
  onNewTab,
}: FlowTabBarProps) => {
  return (
    <div className="flex items-center gap-1 bg-card border-b border-border px-2 py-1">
      <TabGroup className="flex-1">
        <TabList className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              selected={tab.id === activeTab}
              onClick={() => onSelect(tab.id)}
              className={cn(
                "group flex h-9 min-w-[140px] max-w-[240px] items-center gap-2 rounded-md px-3",
                tab.id === activeTab
                  ? "bg-background shadow-sm ring-1 ring-border"
                  : "hover:bg-accent"
              )}
            >
              {tab.favicon && (
                <img src={tab.favicon} className="h-4 w-4" />
              )}
              <span className="flex-1 truncate text-sm">
                {tab.title || 'Untitled'}
              </span>
              {tab.isLoading && (
                <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                className="opacity-0 group-hover:opacity-100"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </Tab>
          ))}
        </TabList>
      </TabGroup>
      <Button size="sm" variant="ghost" onClick={onNewTab}>
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};
```

### Step 1.3: Electron Main Process Setup

```typescript
// File: packages/desktop/src-electron/main.ts
// NEW FILE - replaces Tauri

import { app, BrowserWindow, session, ipcMain, Menu } from "electron"
import path from "path"

// Browser state management (from flow-browser)
class BrowserManager {
  private windows: Map<string, BrowserWindow> = new Map()
  private tabs: Map<string, Tab[]> = new Map()

  createWindow(profile?: string) {
    const win = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        // Enable CDP for AI access
        devToolsExtensions: true,
        // Isolate browser from KronosChamber UI
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        // Use persistent session for profile
        partition: profile ? `persist:${profile}` : "persist:default",
      },
      // Custom titlebar for our UI overlay
      titleBarStyle: "hiddenInset",
    })

    // Enable CDP
    win.webContents.debugger.attach("1.3")

    // Load browser chrome UI
    win.loadFile("index.html")

    // Setup context menu
    this.setupContextMenu(win)

    return win
  }

  setupContextMenu(win: BrowserWindow) {
    win.webContents.on("context-menu", (event, params) => {
      const menu = Menu.buildFromTemplate([
        // Standard browser actions
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { type: "separator" },
        // AI-enhanced actions
        {
          label: "✨ Ask AI about this",
          click: () => {
            // Send to KronosChamber AI
            win.webContents.send("ai-context-menu", {
              action: "ask",
              selectionText: params.selectionText,
              linkURL: params.linkURL,
              srcURL: params.srcURL,
            })
          },
        },
        {
          label: "📝 Summarize page",
          click: () => {
            win.webContents.send("ai-context-menu", {
              action: "summarize",
            })
          },
        },
        {
          label: "🔍 Explain this element",
          click: () => {
            win.webContents.send("ai-context-menu", {
              action: "explain",
              x: params.x,
              y: params.y,
            })
          },
        },
        { type: "separator" },
        { role: "inspect" }, // DevTools
      ])
      menu.popup()
    })
  }
}

// IPC handlers for browser control
ipcMain.handle("browser:navigate", async (event, url: string) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  await win.webContents.navigationHistory.push(url)
  win.webContents.loadURL(url)
})

ipcMain.handle("browser:back", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win.webContents.navigationHistory.canGoBack()) {
    win.webContents.goBack()
  }
})

ipcMain.handle("browser:forward", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win.webContents.navigationHistory.canGoForward()) {
    win.webContents.goForward()
  }
})

// CDP handlers for AI
ipcMain.handle("cdp:execute", async (event, method: string, params: any) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await win.webContents.debugger.sendCommand(method, params)
  return result
})
```

---

## Phase 2: CDP Integration - AI Direct Browser Access (Weeks 3-5)

### What is CDP?

Chrome DevTools Protocol (CDP) gives **direct, real-time access** to browser internals:

```
┌─────────────────────────────────────────────┐
│  AI Agent (KronosChamber)                   │
│                                             │
│  CDP Client ──WebSocket──► CDP Server       │
│  (Node.js)              │ (in Electron)   │
│                                             │
│  Can:                                      │
│  • Read DOM tree                           │
│  • Listen for mutations                    │
│  • Monitor network                         │
│  • Execute JavaScript                      │
│  • Take screenshots                        │
│  • Monitor console                         │
│  • Track user interactions                 │
└─────────────────────────────────────────────┘
```

### CDP Client Implementation

```typescript
// File: packages/ui/src/lib/cdpClient.ts
// NEW FILE

import CDP from "chrome-remote-interface"

export class CDPBrowserClient {
  private client: CDP.Client | null = null
  private eventHandlers: Map<string, ((data: any) => void)[]> = new Map()

  async connect(port: number = 9222) {
    this.client = await CDP({ port })

    // Enable all domains we need
    const { Page, DOM, Network, Runtime, Console, Overlay } = this.client
    await Promise.all([
      Page.enable(),
      DOM.enable(),
      Network.enable(),
      Runtime.enable(),
      Console.enable(),
      Overlay.enable(),
    ])

    // Setup event listeners
    this.setupEventListeners()
  }

  private setupEventListeners() {
    if (!this.client) return

    // DOM mutations
    this.client.DOM.documentUpdated(() => {
      this.emit("documentUpdated", {})
    })

    this.client.DOM.childNodeInserted((params) => {
      this.emit("domInsert", params)
    })

    // Network monitoring
    this.client.Network.requestWillBeSent((params) => {
      this.emit("networkRequest", params)
    })

    this.client.Network.responseReceived((params) => {
      this.emit("networkResponse", params)
    })

    // Console logs
    this.client.Console.messageAdded((params) => {
      this.emit("console", params)
    })

    // Page lifecycle
    this.client.Page.loadEventFired(() => {
      this.emit("pageLoad", {})
    })
  }

  // AI methods - direct browser control

  async getDOM(): Promise<any> {
    if (!this.client) throw new Error("Not connected")
    const { DOM } = this.client
    const { root } = await DOM.getDocument()
    return root
  }

  async querySelector(selector: string): Promise<any> {
    if (!this.client) throw new Error("Not connected")
    const { DOM } = this.client
    const { root } = await DOM.getDocument()
    const { nodeId } = await DOM.querySelector({
      nodeId: root.nodeId,
      selector,
    })
    return nodeId
  }

  async clickElement(selector: string): Promise<void> {
    if (!this.client) throw new Error("Not connected")
    const { Runtime } = this.client
    await Runtime.evaluate({
      expression: `document.querySelector('${selector}').click()`,
    })
  }

  async fillInput(selector: string, value: string): Promise<void> {
    if (!this.client) throw new Error("Not connected")
    const { Runtime } = this.client
    await Runtime.evaluate({
      expression: `
        const el = document.querySelector('${selector}');
        el.value = '${value}';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      `,
    })
  }

  async takeScreenshot(): Promise<string> {
    if (!this.client) throw new Error("Not connected")
    const { Page } = this.client
    const { data } = await Page.captureScreenshot({
      format: "png",
      fromSurface: true,
    })
    return data // base64
  }

  async getElementAtPoint(x: number, y: number): Promise<any> {
    if (!this.client) throw new Error("Not connected")
    const { DOM } = this.client
    const { nodeId } = await DOM.getNodeForLocation({ x, y })
    return nodeId
  }

  // Event subscription for AI
  on(event: string, handler: (data: any) => void) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  private emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event) || []
    handlers.forEach((h) => h(data))
  }
}

// Singleton instance
export const cdpClient = new CDPBrowserClient()
```

### AI Agent Integration

```typescript
// File: packages/ui/src/stores/useBrowserAIStore.ts
// NEW FILE

import { create } from "zustand"
import { cdpClient } from "@/lib/cdpClient"

interface BrowserAIState {
  isConnected: boolean
  currentPage: {
    url: string
    title: string
    domSnapshot: any
  } | null
  contextMenuActions: ContextMenuAction[]
  connect: () => Promise<void>
  disconnect: () => void
  executeAIAction: (action: string, params: any) => Promise<void>
}

export const useBrowserAIStore = create<BrowserAIState>((set, get) => ({
  isConnected: false,
  currentPage: null,
  contextMenuActions: [],

  connect: async () => {
    await cdpClient.connect()
    set({ isConnected: true })

    // Subscribe to page events
    cdpClient.on("pageLoad", async () => {
      const dom = await cdpClient.getDOM()
      set({
        currentPage: {
          url: await cdpClient.getCurrentURL(),
          title: await cdpClient.getTitle(),
          domSnapshot: dom,
        },
      })
    })

    // AI monitors DOM mutations for proactive suggestions
    cdpClient.on("domInsert", (mutation) => {
      const { currentPage } = get()
      if (!currentPage) return

      // AI detects patterns and suggests actions
      if (mutation.node.nodeName === "FORM") {
        // Suggest form filling
        get().suggestAction("formDetected", mutation)
      }
    })
  },

  executeAIAction: async (action, params) => {
    switch (action) {
      case "fillForm":
        await cdpClient.fillInput(params.selector, params.value)
        break
      case "click":
        await cdpClient.clickElement(params.selector)
        break
      case "screenshot":
        const screenshot = await cdpClient.takeScreenshot()
        // Send to AI for analysis
        break
      case "extractData":
        // Use CDP to extract structured data
        break
    }
  },
}))
```

---

## Phase 3: Right-Click AI Context Menus (Week 4)

### Enhanced Context Menu

```typescript
// File: packages/desktop/src-electron/contextMenu.ts
// NEW FILE

import { Menu, BrowserWindow, ipcMain } from "electron"

export function createAIContextMenu(win: BrowserWindow, params: any) {
  const template: Electron.MenuItemConstructorOptions[] = [
    // Standard browser actions
    { role: "cut" },
    { role: "copy" },
    { role: "paste" },
    { type: "separator" },
  ]

  // AI-enhanced actions based on context
  if (params.selectionText) {
    template.push({
      label: "✨ Ask AI about selection",
      click: () => {
        win.webContents.send("ai-action", {
          type: "ask",
          text: params.selectionText,
        })
      },
    })

    template.push({
      label: "📝 Summarize selection",
      click: () => {
        win.webContents.send("ai-action", {
          type: "summarize",
          text: params.selectionText,
        })
      },
    })

    template.push({
      label: "🔍 Search with AI",
      click: () => {
        win.webContents.send("ai-action", {
          type: "search",
          text: params.selectionText,
        })
      },
    })

    template.push({ type: "separator" })
  }

  if (params.linkURL) {
    template.push({
      label: "🌐 Open with AI preview",
      click: () => {
        win.webContents.send("ai-action", {
          type: "preview",
          url: params.linkURL,
        })
      },
    })

    template.push({ type: "separator" })
  }

  // Form elements
  if (params.inputFieldType) {
    template.push({
      label: "🤖 AI Fill this field",
      click: () => {
        win.webContents.send("ai-action", {
          type: "fillForm",
          fieldType: params.inputFieldType,
          fieldName: params.inputFieldName,
        })
      },
    })

    template.push({ type: "separator" })
  }

  // Page actions
  template.push({
    label: "📄 Summarize page",
    click: () => {
      win.webContents.send("ai-action", {
        type: "summarizePage",
      })
    },
  })

  template.push({
    label: "🔖 Save to Kronos",
    click: () => {
      win.webContents.send("ai-action", {
        type: "saveBookmark",
        url: params.pageURL,
        title: params.pageTitle,
      })
    },
  })

  template.push({ type: "separator" })

  // DevTools
  template.push({ role: "inspect" })

  return Menu.buildFromTemplate(template)
}
```

---

## Phase 4: Omnibox with AI Integration (Week 5)

### AI-Enhanced Omnibox

```typescript
// File: packages/ui/src/components/browser/AIOmnibox.tsx
// NEW FILE - Based on flow-browser omnibox + AI features

import React, { useState, useRef, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { cdpClient } from '@/lib/cdpClient';
import { cn } from '@/lib/utils';

interface OmniboxSuggestion {
  id: string;
  type: 'history' | 'bookmark' | 'ai-suggestion' | 'search';
  title: string;
  url?: string;
  icon?: string;
  aiContext?: string;
}

export const AIOmnibox: React.FC = () => {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<OmniboxSuggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedValue = useDebounce(value, 150);

  // Fetch suggestions
  React.useEffect(() => {
    if (!debouncedValue) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      // 1. Get browser history matches
      const history = await window.electron.getHistory(debouncedValue);

      // 2. Get bookmark matches
      const bookmarks = await window.electron.getBookmarks(debouncedValue);

      // 3. Get AI suggestions
      const aiSuggestions = await getAISuggestions(debouncedValue);

      setSuggestions([
        ...history.map((h) => ({ ...h, type: 'history' as const })),
        ...bookmarks.map((b) => ({ ...b, type: 'bookmark' as const })),
        ...aiSuggestions,
      ]);
    };

    fetchSuggestions();
  }, [debouncedValue]);

  const getAISuggestions = async (query: string): Promise<OmniboxSuggestion[]> => {
    // AI analyzes query and suggests actions
    if (query.startsWith('translate ')) {
      return [{
        id: 'ai-translate',
        type: 'ai-suggestion',
        title: `Translate "${query.replace('translate ', '')}"`,
        aiContext: 'Will use page context for translation',
      }];
    }

    if (query.startsWith('summarize ')) {
      return [{
        id: 'ai-summarize',
        type: 'ai-suggestion',
        title: `Summarize: ${query.replace('summarize ', '')}`,
        aiContext: 'AI will fetch and summarize this page',
      }];
    }

    return [];
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    if (value.startsWith('translate ')) {
      // AI translate action
      window.electron.sendAIAction({
        type: 'translate',
        text: value.replace('translate ', ''),
      });
    } else if (value.startsWith('summarize ')) {
      // AI summarize action
      window.electron.sendAIAction({
        type: 'summarize',
        url: value.replace('summarize ', ''),
      });
    } else {
      // Normal navigation
      const url = normalizeURL(value);
      cdpClient.navigate(url);
    }

    setIsFocused(false);
    inputRef.current?.blur();
  }, [value]);

  return (
    <div className="relative flex-1">
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border bg-card px-4 py-2 transition-all",
            isFocused && "border-primary ring-1 ring-primary/20"
          )}
        >
          {/* Security icon */}
          <SecurityIcon url={value} />

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder="Search or enter address"
            className="flex-1 bg-transparent text-sm outline-none"
          />

          {/* Loading indicator */}
          {isLoading && (
            <Loader className="h-4 w-4 animate-spin text-primary" />
          )}
        </div>

        {/* Suggestions dropdown */}
        {isFocused && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border bg-popover shadow-lg">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 hover:bg-accent cursor-pointer",
                  index === selectedIndex && "bg-accent"
                )}
                onClick={() => selectSuggestion(suggestion)}
              >
                {/* Icon based on type */}
                <SuggestionIcon type={suggestion.type} />

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {suggestion.title}
                  </div>
                  {suggestion.url && (
                    <div className="text-xs text-muted-foreground truncate">
                      {suggestion.url}
                    </div>
                  )}
                  {suggestion.aiContext && (
                    <div className="text-xs text-primary truncate">
                      {suggestion.aiContext}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </form>
    </div>
  );
};
```

---

## Phase 5: UI Integration - AI Sidebar Overlay (Week 6)

### Browser View with AI Sidebar

```typescript
// File: packages/ui/src/components/views/RealBrowserView.tsx
// NEW FILE

import React from 'react';
import { FlowTabBar } from '@/components/browser/FlowTabBar';
import { AIOmnibox } from '@/components/browser/AIOmnibox';
import { BrowserNavigation } from '@/components/browser/BrowserNavigation';
import { AISidebar } from '@/components/browser/AISidebar';
import { cn } from '@/lib/utils';

export const RealBrowserView: React.FC = () => {
  const [tabs, setTabs] = React.useState<Tab[]>([]);
  const [activeTab, setActiveTab] = React.useState<string>('');
  const [isAISidebarOpen, setIsAISidebarOpen] = React.useState(true);

  return (
    <div className="flex h-full flex-col">
      {/* Browser Chrome */}
      <div className="flex items-center gap-2 bg-card border-b px-2 py-1">
        {/* Spaces selector */}
        <SpacesSelector />

        {/* Tab bar */}
        <FlowTabBar
          tabs={tabs}
          activeTab={activeTab}
          onSelect={setActiveTab}
          onClose={(id) => {/* close tab */}}
          onNewTab={() => {/* new tab */}}
        />
      </div>

      {/* Navigation bar */}
      <div className="flex items-center gap-2 bg-card/50 px-3 py-2">
        <BrowserNavigation
          canGoBack={/* */}
          canGoForward={/* */}
          onBack={() => window.electron.goBack()}
          onForward={() => window.electron.goForward()}
          onReload={() => window.electron.reload()}
        />

        {/* AI Omnibox */}
        <AIOmnibox />

        {/* Browser actions */}
        <BrowserActions
          onBookmark={() => {/* */}}
          onDownloads={() => {/* */}}
          onExtensions={() => {/* */}}
          onProfile={() => {/* */}}
        />

        {/* AI toggle */}
        <button
          onClick={() => setIsAISidebarOpen(!isAISidebarOpen)}
          className={cn(
            "p-2 rounded-md transition-colors",
            isAISidebarOpen && "bg-primary/20 text-primary"
          )}
        >
          <SparklesIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Web content - takes remaining space */}
        <div className="flex-1 relative">
          {/* This is the actual Electron BrowserWindow content */}
          {/* Handled by Electron main process */}
          <div id="browser-webview-container" className="h-full w-full" />

          {/* AI overlay widgets */}
          <AIOverlayWidgets />
        </div>

        {/* AI Sidebar - persistent right panel */}
        <AISidebar
          isOpen={isAISidebarOpen}
          onClose={() => setIsAISidebarOpen(false)}
        />
      </div>
    </div>
  );
};
```

### AI Sidebar Component

```typescript
// File: packages/ui/src/components/browser/AISidebar.tsx
// NEW FILE

import React from 'react';
import { cn } from '@/lib/utils';
import { useBrowserAIStore } from '@/stores/useBrowserAIStore';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { PageContextPanel } from '@/components/browser/PageContextPanel';

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AISidebar: React.FC<AISidebarProps> = ({ isOpen, onClose }) => {
  const { currentPage, isConnected } = useBrowserAIStore();

  return (
    <div
      className={cn(
        "flex flex-col border-l bg-sidebar transition-all duration-300",
        isOpen ? "w-[420px]" : "w-0 overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-primary" />
          <span className="font-medium">Kronos AI</span>
          {isConnected && (
            <span className="text-xs text-status-success">● Connected</span>
          )}
        </div>
        <button onClick={onClose}>
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Page context */}
      {currentPage && (
        <PageContextPanel
          url={currentPage.url}
          title={currentPage.title}
          className="border-b"
        />
      )}

      {/* AI Chat */}
      <div className="flex-1 overflow-hidden">
        <ChatContainer
          variant="sidebar"
          context={{
            type: 'browser',
            pageUrl: currentPage?.url,
            pageTitle: currentPage?.title,
          }}
        />
      </div>

      {/* AI Input */}
      <div className="border-t p-3">
        <AIChatInput
          placeholder="Ask a question about this page..."
          onSubmit={(message) => {
            // Send to AI with page context
            sendAIMessage(message, {
              pageContext: currentPage,
              cdpSnapshot: currentPage?.domSnapshot,
            });
          }}
        />
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 border-t p-3">
        <QuickActionButton
          icon={<SummarizeIcon />}
          label="Summarize"
          onClick={() => executeAIAction('summarizePage')}
        />
        <QuickActionButton
          icon={<TranslateIcon />}
          label="Translate"
          onClick={() => executeAIAction('translatePage')}
        />
        <QuickActionButton
          icon={<ExtractIcon />}
          label="Extract"
          onClick={() => executeAIAction('extractData')}
        />
        <QuickActionButton
          icon={<FillIcon />}
          label="Fill Form"
          onClick={() => executeAIAction('fillForm')}
        />
      </div>
    </div>
  );
};
```

---

## Phase 6: Package Integration (Week 6-7)

### New Package Structure

```
kronosChamber/
├── packages/
│   ├── desktop/              # Keep Tauri for now (can migrate later)
│   │   └── src-tauri/        # Current Tauri code
│   │
│   ├── desktop-electron/     # NEW - Real browser package
│   │   ├── src/
│   │   │   ├── main/         # Electron main process
│   │   │   │   ├── browser.ts        # BrowserWindow management
│   │   │   │   ├── tabs.ts           # Tab management
│   │   │   │   ├── extensions.ts     # Chrome extension loader
│   │   │   │   ├── omnibox.ts        # Address bar logic
│   │   │   │   ├── contextMenu.ts    # Right-click AI menus
│   │   │   │   └── cdpServer.ts      # CDP for AI access
│   │   │   │
│   │   │   ├── preload/      # Preload scripts
│   │   │   │   └── preload.ts        # Context bridge
│   │   │   │
│   │   │   └── renderer/     # React UI (same as packages/ui)
│   │   │
│   │   ├── package.json
│   │   ├── electron-builder.yml
│   │   └── vite.config.ts
│   │
│   └── ui/                   # Shared React components
│       └── src/
│           ├── components/
│           │   └── browser/  # Browser UI components
│           │       ├── FlowTabBar.tsx
│           │       ├── AIOmnibox.tsx
│           │       ├── AISidebar.tsx
│           │       └── AIContextMenu.tsx
│           │
│           ├── lib/
│           │   ├── cdpClient.ts      # CDP connection for AI
│           │   └── electronAPI.ts    # Type-safe IPC
│           │
│           └── stores/
│               └── useBrowserAIStore.ts
```

### Package.json for Desktop-Electron

```json
// packages/desktop-electron/package.json
{
  "name": "@kronoschamber/desktop-electron",
  "version": "1.0.0",
  "description": "KronosChamber Real Browser - Electron version with full browser capabilities",
  "main": "dist/main/main.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "package": "electron-builder",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "electron": "^30.0.0",
    "chrome-remote-interface": "^0.33.0",
    "electron-context-menu": "^3.6.1",
    "electron-extensions": "^1.0.0" // For Chrome extension support
  },
  "devDependencies": {
    "electron-vite": "^2.0.0",
    "electron-builder": "^24.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Summary: What Changes

### For You (The Developer)

| Task               | Time   | Description                       |
| ------------------ | ------ | --------------------------------- |
| Fork flow-browser  | 1 day  | Clone and understand structure    |
| Extract components | 3 days | Pull tab bar, omnibox, navigation |
| Setup Electron     | 2 days | Create desktop-electron package   |
| CDP integration    | 3 days | Connect AI to browser via CDP     |
| Context menus      | 2 days | Right-click AI actions            |
| UI integration     | 3 days | AI sidebar, overlay widgets       |
| Testing            | 2 days | Extensions, right-click, AI       |

**Total: ~2-3 weeks for full integration**

### For Users

**Before:**

- Uses KronosChamber as AI coding tool
- Browser feels like an iframe
- No extensions, no right-click, no DevTools

**After:**

- Uses KronosChamber as their **daily browser**
- Full Chrome experience + AI superpowers
- Right-click any element → Ask AI about it
- Type in omnibox → AI suggests actions
- Browse normally, AI watches and helps

---

## Next Steps

1. **Fork flow-browser** and explore the codebase
2. **Create desktop-electron package** in your repo
3. **Extract TabBar and Omnibox** components
4. **Setup CDP connection** between AI and browser
5. **Add right-click context menus** with AI actions

**Start with Phase 1** - just extracting the tab bar and omnibox will give you immediate browser feel improvements.
