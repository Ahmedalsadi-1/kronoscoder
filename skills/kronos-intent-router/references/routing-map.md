# Kronos Routing Map

Use this map to convert user language into package ownership and command scope.

## Core Engine

Target: `packages/kronoscode/`

Keywords:
- engine
- mcp
- lsp
- session
- tool calling
- orchestration
- agent runtime
- cli behavior

Start commands:
- `cd packages/kronoscode && bun run dev`
- `cd packages/kronoscode && bun test --timeout 30000`

## Chamber Runtime UI

Target: `kronosChamber/`

Keywords:
- chamber
- web app
- desktop ui
- vscode ui
- panel
- sidebar
- navigation
- settings page

Start commands:
- `cd kronosChamber && bun run dev`
- `cd kronosChamber && bun run desktop:dev`
- `cd kronosChamber && bun run vscode:dev`

## Shared UI System

Target: `packages/ui/`

Keywords:
- design token
- typography
- shared component
- icon
- theme class
- primitive

Start commands:
- `cd packages/ui && bun test --timeout 30000`
- `cd packages/ui && bun run typecheck`

## SDK Contracts

Target: `packages/sdk/`

Keywords:
- openapi
- generated types
- client types
- api surface
- schema contract

Start commands:
- `cd packages/sdk && bun run typecheck`

## Desktop Packaging

Target: `packages/desktop/`

Keywords:
- tauri
- tray
- native menu
- desktop packaging
- installer

Start commands:
- `cd packages/desktop && bun run typecheck`

## Escalation Rule

If request matches two or more targets with similar confidence, treat as cross-package:
1. confirm shared interfaces first (`packages/ui` or `packages/sdk`),
2. then edit runtime package,
3. run package-level checks for each touched package.
