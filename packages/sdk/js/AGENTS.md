# @kronoscode-ai/sdk

JavaScript/TypeScript SDK for KronosCode API integration.

## Overview

Client and server SDK for interacting with KronosCode. Includes v2 API support.

## Exports

```json
{
  ".": "./src/index.ts",
  "./client": "./src/client.ts",
  "./server": "./src/server.ts",
  "./v2": "./src/v2/index.ts",
  "./v2/client": "./src/v2/client.ts",
  "./v2/server": "./src/v2/server.ts"
}
```

## Scripts

```bash
bun run build    # Build SDK (runs ./script/build.ts)
bun run typecheck
```

## Key Notes

- SDK is published to npm (@kronoscode-ai/sdk)
- Build output goes to `dist/` directory
- Uses `@hey-api/openapi-ts` for OpenAPI code generation
- v2 APIs are still in development (dist/types available)

## Regeneration

To regenerate SDK types from OpenAPI spec:

```bash
bun run build
```
