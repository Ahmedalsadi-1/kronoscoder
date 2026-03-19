# KronosCoder & OpenChamber

Monorepo for the KronosCoder core engine and OpenChamber web, desktop, and VS Code runtimes.

## Overview

**Package Manager:** Bun 1.3.9
**Build System:** Turbo 2.5.6
**TypeScript:** 5.8.2
**License:** MIT

## Quick Reference

```bash
bun install                    # Install dependencies
bun turbo build                # Build all packages
bun run lint                   # Run ESLint
bun turbo typecheck            # Type check all
```

### Development

```bash
cd packages/kronoscode && bun run dev          # Core engine dev
cd kronosChamber && bun run dev                # Chamber web dev
cd kronosChamber && bun run desktop:dev         # Desktop dev
```

### Testing

Root `bun test` is **disabled**. Run from package directories:

```bash
cd packages/kronoscode && bun test             # Core tests
cd packages/ui && bun test                      # UI tests
```

## Structure

```
.
├── packages/
│   ├── kronoscode/          # Core AI engine (TypeScript/Bun)
│   ├── ui/                   # Shared component library
│   ├── web/                  # Express + React web server
│   ├── desktop/              # Tauri desktop app
│   ├── sdk/                  # OpenAPI-generated SDK
│   ├── enterprise/           # Enterprise features (SolidStart)
│   └── console/              # Console workspace (nested)
├── kronosChamber/            # Web/Desktop/VS Code runtime
│   ├── packages/web/         # Chamber web server
│   ├── packages/desktop/     # Tauri desktop wrapper
│   ├── packages/ui/          # Chamber UI components
│   └── packages/vscode/      # VS Code extension
└── third_party/upstream/     # External dependencies
```

## Where to Look

| Task          | Location                            | Notes                     |
| ------------- | ----------------------------------- | ------------------------- |
| Add AI tool   | `packages/kronoscode/src/tool/`     | 69 tool implementations   |
| AI providers  | `packages/kronoscode/src/provider/` | 20+ provider integrations |
| Session logic | `packages/kronoscode/src/session/`  | Session management        |
| Database      | `packages/kronoscode/src/storage/`  | Drizzle ORM               |
| UI components | `packages/ui/src/components/ui/`    | 55 Radix primitives       |
| Theme tokens  | `packages/ui/src/lib/theme/`        | NEVER hardcode HEX/RGB    |
| Web server    | `packages/web/server/`              | Express backend           |
| Desktop app   | `packages/desktop/src-tauri/`       | Rust/Tauri                |
| SDK           | `packages/sdk/js/`                  | OpenAPI-generated         |

## Conventions

### Code Style

- **Prettier:** No semicolons, 120 char width
- **EditorConfig:** 2-space indent, LF line endings
- **TypeScript:** Strict mode, no `any`

### Language Preferences

- Prefer `Bun.file()` and `Bun.password` over Node equivalents
- Use control flow and early returns over deep nesting
- Minimize `try/catch`; use only for real exception boundaries
- Let inference work; use explicit interfaces when needed

### Database

- **Schema:** `src/**/*.sql.ts` (Drizzle)
- **Naming:** snake_case for tables/columns
- **Join columns:** `<entity>_id`
- **Indexes:** `<table>_<column>_idx`
- **Migrations:** `bun run db generate --name <slug>`

### UI

- NEVER hardcode HEX/RGB; use tokens like `text-brand-primary`
- Use semantic typography from `packages/ui/src/lib/typography.ts`
- Use `@remixicon/react` for icons exclusively
- Cross-platform: validate for Web, Desktop, VS Code

## Anti-Patterns

- DO NOT import from deprecated routes (use brokers)
- No direct DB inserts from routes - use services
- No setTimeout for expiration - use queue schedulers
- No in-memory lock tracking - use DB-backed leases
- Never commit `.env`, API keys, or secrets
- Avoid drive-by refactors; keep diffs surgical
- Never update git config or run destructive git commands

## Package-Specific Rules

Each package has its own `AGENTS.md` for local specifics:

- `packages/kronoscode/AGENTS.md` - Core engine
- `packages/ui/AGENTS.md` - Component library
- `packages/web/AGENTS.md` - Web server
- `packages/desktop/AGENTS.md` - Desktop app
- `kronosChamber/AGENTS.md` - Chamber runtime

## Detailed Documentation

- [Architecture](docs/agent-instructions/architecture.md) - Package ownership, layout
- [Workflows](docs/agent-instructions/workflows.md) - Environment, commands
- [UI](docs/agent-instructions/ui.md) - Design system, components
- [Data & Testing](docs/agent-instructions/data-and-testing.md) - Database, tests
- [Guardrails](docs/agent-instructions/guardrails.md) - Security, scope

## Key Dependencies

| Package               | Purpose             |
| --------------------- | ------------------- |
| `ai`                  | AI SDK              |
| `drizzle-orm`         | Database ORM        |
| `hono`                | HTTP framework      |
| `zod`                 | Schema validation   |
| `react` / `react-dom` | Frontend (v19)      |
| `tailwindcss`         | Styling (v4)        |
| `vite`                | Build tool          |
| `@tauri-apps/api`     | Desktop integration |
