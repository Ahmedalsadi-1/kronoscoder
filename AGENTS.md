# 🛠️ KronosCoder & OpenChamber: Engineering Guidelines

This monorepo integrates **KronosCoder** (the brain) with **OpenChamber** (the body). It is designed for maximum performance, multi-platform consistency, and AI-native workflows.

## 🏗️ Repository Architecture

| Package | Purpose | Core Tech |
| :--- | :--- | :--- |
| `packages/kronoscode` | **The Brain**: Core AI logic, tools, and TUI engine. | Bun, Drizzle, node-pty |
| `kronosChamber/` | **The Body**: Unified UI runtimes (Web, Desktop, VS Code). | React 19, Vite, Tailwind v4 |
| `packages/ui` | **The DNA**: Shared component library and theme tokens. | Radix UI, HeroUI, Remixicon |
| `packages/sdk` | **The Nervous System**: Type-safe communication layer. | OpenAPI, TypeScript |

## 🕹️ Critical Workflows

### 1. Environment Initialization
- **Root Setup**: `bun install`
- **Full Build**: `bun turbo build`
- **Verify Integrity**: `bun turbo typecheck && bun run lint`

### 2. Runtime Development
- **Core Dev**: `bun run dev` (within `packages/kronoscode`)
- **UI Full Stack**: `bun run dev` (within `kronosChamber` - starts server + web + UI)
- **Native Apps**: `bun run desktop:dev` or `bun run vscode:dev`

## 🛠️ Native Capability Primitives (Hardcoded)

- **Everywhere**: Cross-app UI control and introspection (AppleScript/PowerShell based).
- **OpenFang**: Security engine for dependency auditing and vulnerability patching.
- **Screenpipe**: 24/7 visual/audio context capture and recall.
- **AI Browser**: Dedicated agent-controlled runtime for web interactions.
- **LSP**: Semantic code intelligence (Go to definition, Find references).

## 🎨 Design & UI Mandates

- **Theme Tokens Only**: NEVER hardcode HEX/RGB. Use tokens: `text-brand-primary`, `bg-surface-secondary`.
- **Typography**: Adhere to `packages/ui/src/lib/typography.ts` semantic classes.
- **Iconography**: Use `@remixicon/react` exclusively.
- **Cross-Platform Parity**: Any change to the Web UI must be validated for Desktop and VS Code runtimes.

## 📜 Development Standards

### Logic & Performance
- **Bun Native**: Use `Bun.file()` and `Bun.password` over Node equivalents.
- **Error Handling**: Use control flow and early returns. Minimize nested `try/catch`.
- **Type Safety**: No `any`. No blind casts. Let inference work; use interfaces for exports.

### Database (Drizzle)
- Use `snake_case` for schema fields to ensure native SQLite column alignment.
- **No Manual Mappings**: Keep column names and property names identical.

### Git & Testing
- **Branching**: All work targets `origin/dev`.
- **Targeted Testing**: Run tests from the specific package folder. **Root `bun test` is disabled.**
- **Reproduction First**: Every bug fix requires a failing test case before implementation.

## ⚠️ Security & Guardrails
- **No Secrets**: Zero tolerance for `.env` or API keys in commits.
- **Drive-by Refactors**: PROHIBITED. Keep PRs surgical and task-focused.
- **Verification**: `type-check` is mandatory before every commit.
