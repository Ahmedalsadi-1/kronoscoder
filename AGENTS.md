# Agent Guidelines for KronosCoder & OpenChamber

This repository is a monorepo containing KronosCoder (core AI agent logic) and OpenChamber (multi-platform UI runtimes).

## Workspace Structure
- `packages/kronoscode`: Core AI agent logic and CLI.
- `packages/web`: OpenChamber web application and Express server.
- `packages/ui`: Shared React/TypeScript component library (Tailwind v4).
- `packages/desktop`: Tauri-based desktop application.
- `packages/vscode`: VS Code extension integration.
- `kronosChamber/`: Primary UI development workspace for OpenChamber.

## Build & Test Commands

### Root Commands
- **Install**: `bun install`
- **Build All**: `bun turbo build`
- **Type-Check**: `bun turbo typecheck`
- **Clean**: `bun run clean`

### KronosCoder (`packages/kronoscode`)
- **Run Dev**: `bun run dev`
- **Run Single Test**: `bun test packages/kronoscode/src/path/to/test.ts`
- **Test All**: `bun test` (Run from within `packages/kronoscode`)
- **Build SDK**: `./packages/sdk/js/script/build.ts`

### OpenChamber (`kronosChamber`)
- **Dev (Full)**: `bun run dev` (Starts server, web, and UI concurrently)
- **Desktop Dev**: `bun run desktop:dev`
- **VS Code Dev**: `bun run vscode:dev`
- **Lint**: `bun run lint`
- **Type-Check**: `bun run type-check`
- **Release Smoke Test**: `bun run release:test`

## Code Style Guidelines

### General Principles
- **Modern Standards**: Use React 19, TypeScript 5+, and Tailwind v4.
- **Brevity**: Keep functions small and composable. Avoid `try/catch` where possible; handle errors through control flow.
- **Type Safety**: Avoid `any` and blind type casts. Rely on type inference; only use explicit interfaces for exports.
- **Variable Naming**: Prefer single-word names (e.g., `journal` vs `journalData`). Inline variables used only once.
- **Immutability**: Prefer `const` over `let`. Use ternaries and early returns instead of reassignment/else blocks.
- **Destructuring**: Use dot notation (`obj.prop`) instead of destructuring to preserve context, unless multiple props are used.

### Imports & Dependencies
- **Order**: Standard library -> External packages -> Internal workspaces (`@kronoscode-ai/*`) -> Local paths.
- **Bun APIs**: Prefer Bun native APIs (e.g., `Bun.file()`, `Bun.password`) over Node equivalents when applicable.
- **New Dependencies**: Do not add new dependencies without explicit instruction.

### UI & Theme (OpenChamber)
- **Theme Tokens**: **MANDATORY**. Do not hardcode colors or use Tailwind color classes (e.g., `text-blue-500`). Use theme tokens (e.g., `text-brand-primary`).
- **Typography**: Use semantic classes from `packages/ui/src/lib/typography.ts` (e.g., `typography-markdown`, `typography-code`).
- **Icons**: Use `@remixicon/react` for consistency.
- **Toasts**: Use the project wrapper from `@/components/ui`; do not import `sonner` directly.
- **Consistency**: Ensure UI changes work across Web, Desktop, and VS Code runtimes.

### Schema (Drizzle)
- Use `snake_case` for database field names to avoid manual column mapping.
```ts
const sessions = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(), // Good: matches DB column
})
```

## Testing Guidelines
- **No Root Tests**: NEVER run `bun test` from the repo root; it is guarded to fail.
- **Targeted Testing**: Run tests from the specific package directory.
- **Avoid Mocks**: Test actual implementations whenever possible.
- **Reproduction**: Before fixing a bug, create a failing test case to verify the fix.

## Critical Mandates
- **Tight Diffs**: Avoid drive-by refactors. Keep changes strictly focused on the task.
- **No Secrets**: Never commit `.env` files, API keys, or log sensitive information.
- **Verification**: Always run `type-check` and `lint` before finalizing a PR.
- **Branching**: The default branch is `dev`. Use `origin/dev` as the base for diffs.
