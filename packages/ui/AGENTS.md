# @kronoscode-ai/ui

Shared component library and design tokens. Used by kronosChamber and console.

## Overview

Component library with Radix UI, HeroUI, and custom theming. Theme tokens defined in `src/lib/theme/`.

## Structure

```
packages/ui/src/
├── components/ui/  # Radix UI primitives (55 files)
├── lib/            # Theme, utilities (44 files)
├── hooks/          # Shared React hooks (34 files)
├── stores/         # Zustand stores (34 files)
├── types/          # TypeScript definitions
└── contexts/       # React contexts
```

## Theme Tokens

- **Location**: `src/lib/theme/`
- **NEVER hardcode HEX/RGB** - Use tokens: `text-brand-primary`, `bg-surface-secondary`
- **Typography**: Semantic classes from `src/lib/typography.ts`
- **Iconography**: `@remixicon/react` exclusively

## Scripts

```bash
bun run build    # Build components
bun run typecheck
```

## Dependencies

- `@radix-ui/react-*` - UI primitives
- `heroicons` - Icons
- `@remixicon/react` - Icon library
- `zustand` - State management

## Notes

- Cross-platform: changes must work on Web, Desktop, and VS Code
- Shared with kronosChamber/packages/ui - keep in sync
