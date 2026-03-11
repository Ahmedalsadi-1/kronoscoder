# Data & Testing Guidelines

## Overview

Use this file for database conventions, migrations, and test execution.

## Database Conventions

- Use `snake_case` for schema fields so code names match SQLite column names.
- Keep column names and property names identical; avoid manual mapping layers.
- Name join columns as `<entity>_id`.
- Name indexes as `<table>_<column>_idx`.
- Drizzle schema lives in `packages/kronoscode/src/**/*.sql.ts`.
- Generate migrations from `packages/kronoscode` with `bun run db generate --name <slug>`.

## Testing Rules

- Root `bun test` is disabled. Run tests from the affected package directory.
- Reproduce bugs with a failing test before implementing the fix.
- Use the Bun test runner from the package directory: `bun test --timeout 30000`.
- Co-locate tests in `test/` directories or `*.test.ts` files.
