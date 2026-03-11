# Architecture Guidelines

## Overview

Use this file for package ownership, repo layout, and cross-repo architecture constraints.

## Package Map

- `packages/kronoscode`: core AI logic, tools, TUI engine, session management, MCP, and LSP integration
- `kronosChamber/`: web, desktop, and VS Code UI runtimes
- `packages/ui`: shared components, theme tokens, hooks, and typography primitives
- `packages/sdk`: generated type-safe API surface from the OpenAPI spec
- `packages/desktop`: Tauri desktop wrapper and native packaging
- `packages/console`: console workspace packages
- `packages/enterprise`: enterprise app and integrations

## Runtime Capabilities

- `Everywhere`: cross-app UI control and introspection
- `OpenFang`: dependency auditing and security remediation
- `Screenpipe`: long-running visual and audio context capture
- `AI Browser`: agent-controlled browser runtime
- `LSP`: semantic code navigation and symbol intelligence

## Project Layout

```text
kronoscoder/
├── packages/
│   ├── kronoscode/
│   ├── ui/
│   ├── sdk/
│   ├── desktop/
│   ├── console/
│   └── enterprise/
├── kronosChamber/
└── third_party/upstream/
```

## Package-Level Overrides

- The nearest nested `AGENTS.md` adds local rules on top of this root file.
- Current package-level instruction files exist in `packages/kronoscode/`, `kronosChamber/`, `packages/ui/`, `packages/sdk/`, `packages/desktop/`, `packages/console/`, and `packages/enterprise/`.

## Avoid

- Do not import deprecated server routes such as `desktop/index.ts` or `marketplace/index.ts`.
- Do not use synchronous installation flows; use async queue-based flows.
- Do not insert directly into the database from routes; go through brokers or services.
- Do not use `setTimeout` for expiration workflows; use queue schedulers.
- Do not track locks in memory; use database-backed leases.
