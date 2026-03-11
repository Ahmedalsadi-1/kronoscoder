# KronosCoder & OpenChamber

Monorepo for the KronosCoder core engine and OpenChamber web, desktop, and VS Code runtimes.

## Quick Reference

- Package manager: `bun`
- Install: `bun install`
- Build all: `bun turbo build`
- Lint: `bun run lint`
- Typecheck: `bun turbo typecheck`
- Core dev: `cd packages/kronoscode && bun run dev`
- Chamber dev: `cd kronosChamber && bun run dev`
- Desktop dev: `cd kronosChamber && bun run desktop:dev`
- Testing: root `bun test` is disabled; run tests from the affected package
- Scope: keep diffs surgical and check the nearest nested `AGENTS.md` for package-specific rules

## Detailed Instructions

- [Architecture](docs/agent-instructions/architecture.md)
- [Workflows](docs/agent-instructions/workflows.md)
- [UI](docs/agent-instructions/ui.md)
- [Data & Testing](docs/agent-instructions/data-and-testing.md)
- [Guardrails](docs/agent-instructions/guardrails.md)
