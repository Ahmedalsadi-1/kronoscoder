# @kronoscode-ai/enterprise

Enterprise features including AWS integrations, billing, and team management.

## Overview

SolidStart-based web app with Hono backend, Cloudflare Workers deployment target.

## Scripts

```bash
bun run dev       # Dev server
bun run build     # Production build
bun run build:cloudflare  # Cloudflare Workers build
```

## Key Dependencies

- `@solidjs/start` - Full-stack SolidJS framework
- `hono` + `hono-openapi` - API framework
- `aws4fetch` - AWS integrations
- `zod` - Schema validation
- `nitro` - Deployment engine

## Notes

- Node >=22 required
- Uses Tailwind v4 via `@tailwindcss/vite`
