# KronosCode Core

AI coding agent core engine. TypeScript with Bun runtime.

## Overview

The brain - handles AI logic, tool execution, session management, LSP integration, and native capabilities.

## Structure

```
packages/kronoscode/src/
├── tool/           # 69 files - core tool implementations
├── session/        # 18 files - session management
├── provider/       # 9 files - AI provider layer
├── server/         # 8 files - HTTP server routes
├── mcp/            # 8 files - MCP server integration
├── lsp/            # 6 files - Language Server Protocol
├── cli/            # 9 files - CLI interface
├── project/        # 8 files - project detection
├── marketplace/    # 7 files - plugin marketplace
├── skill/          # 7 files - skill system
├── storage/        # 8 files - database/persistence
├── desktop/        # 4 files - desktop integration
├── agent/          # 5 files - agent logic
└── index.ts        # Main entry
```

## Entry Points

- **CLI**: `packages/kronoscode/bin/kronoscode`
- **Main**: `packages/kronoscode/src/index.ts`

## Database

- **Schema**: Drizzle schema in `src/**/*.sql.ts`
- **Naming**: snake_case for tables/columns
- **Join columns**: `<entity>_id`
- **Indexes**: `<table>_<column>_idx`
- **Migrations**: `drizzle.config.ts` - run `bun run db generate --name <slug>`
- **Output**: creates `migration/<timestamp>_<slug>/migration.sql` and `snapshot.json`

## Scripts

```bash
bun run dev           # Run kronoscode
bun run db generate  # Generate migration
bun run db push      # Push schema to DB
bun test             # Run tests (from this dir)
bun run typecheck   # Type checking
```

## Where to Look

| Task            | Location                           |
| --------------- | ---------------------------------- |
| Add new tool    | `src/tool/*.ts` + `src/tool/*.txt` |
| AI providers    | `src/provider/`                    |
| Session logic   | `src/session/`                     |
| Database        | `src/storage/`                     |
| MCP integration | `src/mcp/`                         |

## Key Dependencies

- `ai` - AI SDK
- `hono` - HTTP framework
- `drizzle-orm` - Database ORM
- `zod` - Validation
- `node-pty` - PTY for shell

## Anti-Patterns

- DO NOT import from deprecated routes (use brokers)
- No direct DB inserts from routes - use services
- No setTimeout for expiration - use queue schedulers
- No in-memory lock tracking - use DB-backed leases
