# UI Guidelines

## Overview

Use this file when working in `kronosChamber`, `packages/ui`, desktop UI, or VS Code UI surfaces.

## Design System Rules

- Never hardcode HEX or RGB values; use theme tokens such as `text-brand-primary` and `bg-surface-secondary`.
- Use semantic typography classes from `packages/ui/src/lib/typography.ts`.
- Use `@remixicon/react` for iconography.
- Reuse shared components from `packages/ui` instead of duplicating them locally.
- Do not reduce opacity as a shortcut for theme integration; fix the token or surface styling directly.

## Cross-Platform Expectations

- Validate web UI changes for desktop and VS Code runtimes when the surface is shared.
- Preserve parity between `packages/ui` and any mirrored UI packages when both are involved in the change.
