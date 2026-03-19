---
name: kronos-intent-router
description: Route user requests to the correct KronosCoder package, commands, and validation scope. Use when the request is ambiguous about where to implement work, when selecting between kronosChamber and packages/*, when deciding package-level test/lint/typecheck commands, or when asked to triage/route/fix in the right place.
---

# Kronos Intent Router

Route each request before coding so changes stay surgical and validation is scoped.

## Workflow

1. Classify the request intent.
2. Map intent to package ownership.
3. Choose minimal commands for that package.
4. Apply nearest `AGENTS.md` constraints.
5. Report routing decision before editing files.

## Quick Routing

Use this script when the request is broad or spans multiple surfaces:

```bash
python3 skills/kronos-intent-router/scripts/route_kronos_intent.py "<user request>"
```

The script outputs:
- likely package targets
- confidence score
- recommended dev/test commands
- guardrails to enforce

If confidence is below `0.45`, treat as cross-package and inspect both top candidates before editing.

## Package Decision Rules

- Route to `kronosChamber/` for web, desktop UI shell, VS Code UI runtime, and runtime UX behavior.
- Route to `packages/kronoscode/` for core engine logic, tools, MCP, session orchestration, and LSP behavior.
- Route to `packages/ui/` for shared components, tokens, typography, and cross-surface UI primitives.
- Route to `packages/sdk/` for API type generation and OpenAPI-bound contract changes.
- Route to `packages/desktop/` for Tauri and native desktop packaging.

For exact keyword-to-target mappings, read `references/routing-map.md`.

## Validation Scope

Run the smallest useful checks from the selected package first.

- For `packages/kronoscode/`: `bun test --timeout 30000` and targeted typecheck/lint if needed.
- For `kronosChamber/`: package tests plus `bun run dev` smoke as needed.
- For `packages/ui/`: component tests and typecheck for affected exports.
- For cross-package changes: run package checks for each touched package, then run root `bun turbo typecheck` only if needed.

Never run root `bun test` (disabled in this repo).

## Guardrails

- Keep changes focused; avoid unrelated refactors.
- Follow nearest nested `AGENTS.md` overrides.
- Prefer Bun-native APIs where equivalent behavior exists.
- Avoid deprecated route imports and sync install flows.
