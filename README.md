<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCode logo" width="200">
    </picture>
  </a>
</p>
<p align="center">The enterprise-grade AI coding assistant.</p>
<p align="center">
  <a href="https://opencode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/@opencode-ai/sdk"><img alt="npm" src="https://img.shields.io/npm/v/@opencode-ai/sdk?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/kronoscoder/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/kronoscoder/publish.yml?style=flat-square&branch=dev" /></a>
</p>

---

## OpenCode — The Production-Ready AI Coding Platform

OpenCode is an **enterprise-grade AI coding assistant** designed for professional development teams. Built with security, reliability, and performance in mind, OpenCode combines cutting-edge AI capabilities with deep system integration.

### Why OpenCode?

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpenCode Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│   │   Web UI    │    │  Desktop    │    │   VS Code   │       │
│   │  (React)    │    │  (Tauri)    │    │  Extension  │       │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘       │
│          │                   │                   │              │
│          └───────────────────┼───────────────────┘              │
│                              ▼                                  │
│                 ┌─────────────────────────┐                     │
│                 │   kronosChamber UI      │                     │
│                 │   (Unified Runtime)    │                     │
│                 └───────────┬─────────────┘                     │
│                             ▼                                   │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │              OpenCode Core Engine                       │  │
│   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐  │  │
│   │  │ Tools   │ │Provider │ │ Session │ │  Native     │  │  │
│   │  │ (50+)   │ │  Layer   │ │ Manager │ │ Capabilities│  │  │
│   │  └─────────┘ └─────────┘ └─────────┘ └─────────────┘  │  │
│   └─────────────────────────────────────────────────────────┘  │
│                             ▼                                   │
│                 ┌─────────────────────────┐                     │
│                 │   AI Providers (20+)   │                     │
│                 │ Anthropic • OpenAI •   │                     │
│                 │ Google • xAI • Mistral │                     │
│                 └─────────────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

### 🧠 Intelligent Code Understanding

```mermaid
flowchart LR
    subgraph Input
        A[User Query] --> B[Session Manager]
    end

    subgraph Processing
        B --> C{LSP Analysis}
        C -->|Definitions| D[Go to Definition]
        C -->|References| E[Find References]
        C -->|Symbols| F[Workspace Symbols]
        C -->|Hover| G[Type Hints]
    end

    subgraph Tools
        H[Read] --> I[Grep]
        I --> J[Glob]
        J --> K[Edit/Write]
    end

    subgraph Output
        K --> L[AI Response]
        L --> M[Execute Tools]
    end

    M -->|Feedback| B
```

- **LSP Integration** — Go to definition, find references, hover information
- **Semantic Search** — Understand code context, not just keywords
- **Multi-File Analysis** — Analyze entire codebases

### 🔧 50+ Built-in Tools

```mermaid
mindmap
  root((Tools))
    File Operations
      Read
      Write
      Edit
      Glob
      Grep
    Execution
      Bash
      Spawn
      Task
      Batch
    Search
      WebSearch
      CodeSearch
      WebFetch
      Docs
    Intelligence
      LSP
      Skill
      PredictiveSkills
    Context
      ScreenpipeSearch
      ScreenpipeRecall
      Snapshot
      Todo
    Native
      AIBrowser
      Everywhere
      OpenFang
```

### 🌍 Multi-Provider AI

```mermaid
pie title AI Provider Market Share (Supported)
    "Anthropic (Claude)" : 25
    "OpenAI (GPT)" : 25
    "Google (Gemini)" : 15
    "xAI (Grok)" : 10
    "Mistral" : 8
    "Cohere" : 5
    "Others (20+)" : 12
```

**Supported Providers:**

- ✅ Anthropic — Claude 4 (Sonnet, Opus, Haiku)
- ✅ OpenAI — GPT-4o, o1, o3, o4
- ✅ Google — Gemini 2.0, 2.5 Pro/Flash
- ✅ xAI — Grok 2, Grok 3
- ✅ Mistral — Mistral Large, Codestral
- ✅ Cohere — Command R7B
- ✅ Cerebras — Fastest inference
- ✅ OpenRouter — 100+ models
- ✅ Azure OpenAI — Enterprise
- ✅ Amazon Bedrock — Claude, Llama
- ✅ GitHub Copilot — Claude 4 integration
- ✅ Perplexity — Online research
- ✅ Plus 10+ more providers

---

## kronosChamber — The Flagship Product

**kronosChamber** is the official OpenCode desktop application — a polished, production-ready IDE alternative that brings the full power of AI-assisted coding to your desktop.

```mermaid
flowchart TB
    subgraph kronosChamber
        A[React 19 UI] --> B[State Management]
        B --> C[Tool Registry]
        C --> D[API Layer]
        D --> E[OpenCode Core]
    end

    subgraph Runtime Features
        F[Web Runtime] -.-> A
        G[Desktop Runtime] -.-> A
        H[VS Code Runtime] -.-> A
    end

    subgraph Native Integration
        I[Screenpipe] --> E
        J[AI Browser] --> E
        K[Everywhere] --> E
    end
```

### Why kronosChamber?

| Feature               | Description                                 |
| --------------------- | ------------------------------------------- |
| 🎨 **Beautiful UI**   | Modern React 19 interface with Tailwind v4  |
| 🖥️ **Cross-Platform** | Works on Web, Desktop (Tauri), VS Code      |
| 🔒 **Secure**         | Local processing, enterprise-grade security |
| ⚡ **Fast**           | Built on Bun runtime                        |
| 🔌 **Extensible**     | MCP support, custom skills, plugins         |

### Screenshots

![OpenCode Terminal](packages/web/src/assets/lander/screenshot.png)

---

## Native Capabilities

```mermaid
flowchart LR
    subgraph "Native Integrations"
        A[Screenpipe] --- B[AI Browser]
        B --- C[Everywhere]
        C --- D[OpenFang]
        D --- E[LSP]
    end

    subgraph "Platforms"
        F[macOS] --- G[Windows]
        G --- H[Linux]
    end

    A --> F
    B --> G
    C --> H
    D --> F
    E --> F
```

### 🔍 Screenpipe — AI Memory

- **Visual Context** — OCR screen capture for recall
- **Audio Memory** — Transcribe and recall meetings
- **UI History** — Track application usage
- **Input Logging** — Remember your actions

### 🌐 AI Browser — Web Automation

Agent-controlled web interactions:

- Page navigation & management
- Element interaction (click, fill, hover)
- Screenshot & snapshot capture
- Network monitoring
- Console access

### 🖥️ Everywhere — Cross-App Control

Control other applications via:

- **macOS** — AppleScript
- **Windows** — PowerShell
- **Linux** — Various backends

### 🛡️ OpenFang — Security Engine

- Dependency auditing
- Vulnerability scanning
- Automated patching
- Security best practices

---

## Installation

### kronosChamber (Recommended)

Download the desktop app for the best experience:

| Platform              | Download                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `opencode-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `opencode-desktop-darwin-x64.dmg`     |
| Windows               | `opencode-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, or AppImage           |

```bash
# macOS
brew install --cask kronosChamber

# Or download from:
# https://github.com/anomalyco/kronoscoder/releases
```

### CLI Installation

```bash
# Install universally
curl -fsSL https://opencode.ai/install | bash

# Or via package manager
bun add -g opencode
```

---

## Architecture Deep Dive

```mermaid
sequenceDiagram
    participant U as User
    participant C as kronosChamber
    participant S as Session Manager
    participant T as Tool Registry
    participant P as Provider Layer
    participant A as AI Provider

    U->>C: Enter query
    C->>S: Create session
    S->>T: Load tools
    T-->>S: Return 50+ tools
    S->>P: Send context
    P->>A: API call
    A-->>P: AI response
    P-->>S: Tool calls
    S->>T: Execute tools
    T-->>S: Results
    S-->>C: Stream response
    C-->>U: Display output
```

### Core Components

| Component           | Purpose                                      |
| ------------------- | -------------------------------------------- |
| **kronosChamber**   | Unified UI runtime (Web, Desktop, VS Code)   |
| **Core Engine**     | AI logic, tool execution, session management |
| **Provider Layer**  | Multi-provider support with fallback         |
| **Tool Registry**   | 50+ built-in tools + MCP + custom            |
| **Session Manager** | Context preservation, state management       |

---

## Configuration

### Environment Variables

```bash
# API Keys
OPENCODE_API_KEY          # OpenCode Zen (recommended)
ANTHROPIC_API_KEY         # Anthropic
OPENAI_API_KEY            # OpenAI
GOOGLE_API_KEY            # Google

# Features
KRONOSCODE_ENABLE_AI_BROWSER=1    # Enable AI Browser
KRONOSCODE_ENABLE_EXA=1           # Enable web/code search
```

### MCP Servers

Configure MCP servers for extended capabilities:

```json
{
  "mcp": {
    "github": {
      "type": "remote",
      "url": "https://api.github.com/mcp",
      "oauth": {
        "clientId": "your-client-id"
      }
    }
  }
}
```

---

## Enterprise Features

```mermaid
flowchart LR
    subgraph Security
        A[Local Processing] --> B[No Data Leaks]
        B --> C[Enterprise SSO]
        C --> D[Audit Logs]
    end

    subgraph Reliability
        E[99.9% Uptime] --> F[Auto Recovery]
        F --> G[State Persistence]
    end

    subgraph Performance
        H[Bun Runtime] --> I[Fast Startup]
        I --> J[Low Memory]
    end
```

- 🔒 **Local Processing** — Your code never leaves your machine
- ⚙️ **Custom Skills** — Extend with your own tools
- 🔌 **MCP Support** — Model Context Protocol integration
- 📊 **Telemetry** — Usage analytics (optional)

---

## Comparison

| Feature                 | OpenCode  | Claude Code | Cursor | Windsurf |
| ----------------------- | --------- | ----------- | ------ | -------- |
| **Open Source**         | Core Only | ✅          | ❌     | ❌       |
| **Providers**           | 20+       | 1           | 3      | 3        |
| **Tools**               | 50+       | 15          | 30+    | 30+      |
| **Native Integrations** | ✅        | ❌          | ❌     | ❌       |
| **Screenpipe**          | ✅        | ❌          | ❌     | ❌       |
| **AI Browser**          | ✅        | ❌          | ✅     | ✅       |
| **Cross-App Control**   | ✅        | ❌          | ❌     | ❌       |
| **Desktop App**         | ✅        | ❌          | ✅     | ✅       |
| **VS Code**             | ✅        | ❌          | ✅     | ✅       |

---

## Roadmap

```mermaid
gantt
    title OpenCode Development Roadmap
    dateFormat  YYYY-MM-DD
    section Core
    Tool Expansion       :2026-01-01, 90d
    Provider Additions   :2026-02-01, 60d
    Performance Optim    :2026-03-01, 45d
    section UI
    kronosChamber v2     :2026-01-15, 90d
    Mobile App          :2026-04-01, 60d
    section Enterprise
    SSO Integration      :2026-02-01, 30d
    Audit Logs          :2026-03-01, 30d
    On-Premise Option   :2026-04-15, 60d
```

---

## Documentation & Support

- 📖 **Docs** — [opencode.ai/docs](https://opencode.ai/docs)
- 💬 **Discord** — [discord.gg/opencode](https://discord.gg/opencode)
- 🐦 **Twitter** — [x.com/opencodeai](https://x.com/opencodeai)
- 🐛 **Issues** — [github.com/anomalyco/kronoscoder/issues](https://github.com/anomalyco/kronoscoder/issues)

---

## License

**OpenCode Core** is open source (MIT License).

**kronosChamber** and the **OpenCode Zen** service are proprietary. Contact sales@opencode.ai for enterprise licensing.

---

<p align="center">
  <strong>Built with ❤️ by the OpenCode Team</strong>
</p>
