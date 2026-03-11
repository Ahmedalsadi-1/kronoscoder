# Workflow Guidelines

## Overview

Use this file for environment setup, day-to-day commands, and repo-wide coding conventions.

## Environment Initialization

- `bun install`
- `bun turbo build`
- `bun turbo typecheck && bun run lint`

## Runtime Development

- `cd packages/kronoscode && bun run dev`
- `cd kronosChamber && bun run dev`
- `cd kronosChamber && bun run desktop:dev`
- `cd kronosChamber && bun run vscode:dev`

## Language and Runtime Conventions

- Prefer `Bun.file()` and `Bun.password` over Node equivalents when Bun already provides the capability.
- Use control flow and early returns instead of deep nesting.
- Minimize `try/catch`; use it only when a real exception boundary is required.
- Do not use `any` or blind casts. Let inference work and use explicit exported interfaces when needed.

## Change Management

- Base diffs on `origin/dev`.
- Keep changes focused on the requested task.
- Use the nearest package-level `AGENTS.md` for package-specific scripts and constraints.
