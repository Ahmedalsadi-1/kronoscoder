# @kronoscode-ai/sdk

Type-safe communication layer - the "Nervous System" of the monorepo.

## Overview

OpenAPI-generated TypeScript SDK for interacting with KronosCode services. Provides type-safe API clients.

## Structure

```
packages/sdk/
├── openapi.json    # OpenAPI specification (320KB)
└── js/             # Generated JavaScript/TypeScript SDK
```

## Key Details

- **Spec**: `openapi.json` - 320KB OpenAPI 3.0 spec
- **Generation**: TypeScript client from OpenAPI spec
- **Purpose**: Type-safe API layer for external integrations

## Scripts

```bash
# Regenerate SDK from OpenAPI spec
bun run generate
```

## Usage

```bash
npm install @kronoscode-ai/sdk
```

## Notes

- Auto-generated from OpenAPI spec - do not edit manually
- Re-generate when API changes
