<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCode logo" width="200">
    </picture>
  </a>
</p>
<p align="center">The open source AI coding agent.</p>
<p align="center">
  <a href="https://opencode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/@opencode-ai/sdk"><img alt="npm" src="https://img.shields.io/npm/v/@opencode-ai/sdk?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/kronoscoder/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/kronoscoder/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a>
</p>

[![OpenCode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://opencode.ai)

---

## What is OpenCode?

OpenCode (formerly KronosCoder) is an open source AI coding agent that runs locally in your terminal. It combines the power of AI with deep system integration to assist with software development tasks.

### Key Features

- **50+ Built-in Tools** - Comprehensive toolkit for reading, writing, editing, searching, and executing code
- **Multi-Provider Support** - Works with Anthropic, OpenAI, Google, xAI, Mistral, Cohere, and 20+ other providers
- **Native Capabilities** - Screenpipe vision/audio context, AI Browser automation, LSP support, cross-app control
- **MCP Integration** - Full Model Context Protocol support with policy-based allowlist
- **Multiple Runtimes** - Web, Desktop (Tauri), and VS Code extensions

---

## Architecture

This is a **monorepo** containing the core engine and multiple UI runtimes:

| Package               | Purpose                                                   | Tech                   |
| --------------------- | --------------------------------------------------------- | ---------------------- |
| `packages/kronoscode` | **Core AI engine** - Tools, providers, session management | Bun, Drizzle, node-pty |
| `kronosChamber/`      | **Primary UI** - React 19, Vite, Tailwind v4              | React, TypeScript      |
| `packages/ui`         | **Shared components** - Radix UI, HeroUI, Remixicon       | React, Tailwind        |
| `packages/sdk`        | **Type-safe API** - OpenAPI communication layer           | TypeScript             |
| `packages/web`        | **Web server** - Express-based API server                 | Node.js                |
| `packages/desktop`    | **Desktop app** - Tauri native application                | Rust, Tauri            |

---

## Installation

```bash
# Install universally
curl -fsSL https://opencode.ai/install | bash

# Or via package manager
bun add -g opencode
```

### Usage

Start the AI development environment:

```bash
opencode
```

Other installation methods:

```bash
npm i -g @opencode-ai/sdk@latest        # or bun/pnpm/yarn
brew install anomalyco/tap/opencode       # macOS (recommended)
sudo pacman -S opencode                  # Arch Linux
mise use -g opencode                     # Any OS
```

### Desktop App (Beta)

OpenCode is available as a desktop application. Download from the [releases page](https://github.com/anomalyco/kronoscoder/releases).

| Platform              | Download                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `opencode-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `opencode-desktop-darwin-x64.dmg`     |
| Windows               | `opencode-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, or AppImage           |

---

## Supported AI Providers

OpenCode supports **20+ AI providers** with 100+ models:

- **Anthropic** - Claude 4 ( Sonnet, Opus, Haiku)
- **OpenAI** - GPT-4o, GPT-4o mini, o1, o3, o4
- **Google** - Gemini 2.0, 2.5 Pro/Flash
- **xAI** - Grok 2, Grok 3
- **Mistral** - Mistral Large, Codestral
- **Cohere** - Command R7B
- **Cerebras** - Fastest inference
- **OpenRouter** - 100+ models via unified API
- **Azure OpenAI** - Enterprise deployment
- **Amazon Bedrock** - Claude, Llama, Mistral
- **GitHub Copilot** - Claude 4 integration
- **Perplexity** - Online research models
- **DeepInfra** - Open source models
- **Together AI** - Open source models
- **Vercel AI SDK** - Edge deployments

Plus **OpenCode Zen** - Our recommended hosted model with the best pricing.

---

## Tools

OpenCode includes **50+ built-in tools** for comprehensive development assistance:

### File Operations

- **Read** - Read files and directories
- **Write** - Write content to files
- **Edit** - Edit files by replacing text
- **Glob** - Find files by glob patterns
- **Grep** - Search file contents with regex

### Execution

- **Bash** - Execute shell commands
- **Spawn** - Spawn sub-agents for parallel tasks
- **Task** - Manage multi-step tasks
- **Batch** - Execute multiple tools in batch

### Search & Research

- **WebSearch** - Search the web
- **CodeSearch** - Search code across GitHub repos
- **WebFetch** - Fetch web content
- **Docs** - Maintain documentation
- **MeshSearch** - Search across meshes

### Intelligence

- **LSP** - Go to definition, find references, hover
- **Skill** - Load and manage agent skills
- **PredictiveSkills** - Load skills proactively

### Context & Memory

- **ScreenpipeSearch** - Search screen/audio context
- **ScreenpipeRecall** - Recall recent activity
- **ScreenpipeContext** - Build context from memory
- **ScreenpipeDigest** - Summarize recent activity
- **Snapshot** - Save/restore working state
- **Todo** - Track task progress

### Agent Orchestration

- **Plan** - Enter/exit planning mode
- **Swarm** - Coordinate multiple agents
- **Forge** - Forge new agents
- **Ghost** - Manage ghost staging
- **Handoff** - Create session handoffs

### Native Capabilities

- **AI Browser** - Agent-controlled web interactions
- **Everywhere** - Cross-app UI control (AppleScript/PowerShell)
- **OpenFang** - Security auditing & vulnerability scanning

### Utilities

- **Review** - Peer code review
- **Consensus** - Achieve consensus across models
- **Doctor** - Diagnose environment issues
- **Notify** - Send notifications
- **Autosave** - Auto-save changes

---

## Agents

OpenCode includes built-in agents:

- **build** - Default agent for development work
- **plan** - Read-only agent for code exploration
  - Denies file edits by default
  - Asks permission before running bash
  - Ideal for analyzing unfamiliar codebases

- **general** - Subagent for complex searches and multistep tasks (invoke with `@general`)

---

## Configuration

### Environment Variables

```bash
# API Keys
OPENCODE_API_KEY          # OpenCode Zen API key
ANTHROPIC_API_KEY         # Anthropic API key
OPENAI_API_KEY            # OpenAI API key
GOOGLE_API_KEY            # Google API key
# ... and 20+ more provider keys

# Features
KRONOSCODE_ENABLE_AI_BROWSER=1    # Enable AI Browser tools
KRONOSCODE_ENABLE_EXA=1            # Enable web/code search
KRONOSCODE_EXPERIMENTAL_LSP_TOOL=1 # Enable experimental LSP
```

### MCP Servers

Configure MCP servers in `~/.opencode/config.json`:

```json
{
  "mcp": {
    "github": {
      "type": "remote",
      "url": "https://api.github.com/mcp",
      "oauth": {
        "clientId": "..."
      }
    }
  }
}
```

---

## Development

```bash
# Install dependencies
bun install

# Build all packages
bun turbo build

# Type check
bun turbo typecheck

# Run core dev
cd packages/kronoscode && bun run dev

# Run web UI dev
cd kronosChamber && bun run dev

# Run desktop dev
cd kronosChamber && bun run desktop:dev
```

---

## Documentation

For more info, [**head over to our docs**](https://opencode.ai/docs).

---

## Contributing

Please read our [contributing docs](./CONTRIBUTING.md) before submitting pull requests.

---

## FAQ

### How is this different from Claude Code?

OpenCode and Claude Code have similar capabilities. Key differences:

- **100% open source** - All code is public
- **Provider agnostic** - Use any AI provider (Anthropic, OpenAI, Google, xAI, local models, etc.)
- **Built-in tools** - 50+ tools for development, vs. basic file operations
- **Native integrations** - Screenpipe, AI Browser, cross-app control, security scanning
- **Client/server architecture** - Run remotely, drive from mobile or web UI
- **Multiple runtimes** - Terminal, Web, Desktop (Tauri), VS Code

---

**Join our community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencodeai)
