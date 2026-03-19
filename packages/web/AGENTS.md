# @kronoscode-ai/web

kronosChamber web server and React frontend. Express.js + React 19.

## Overview

Full-stack web application serving kronosChamber UI. Combines Express.js backend with React 19 frontend. Embeds kronosCode core as sidecar process.

## Structure

```
packages/web/
├── server/           # Express.js backend (15000+ lines)
│   ├── index.js      # Main server entry
│   └── lib/          # Server utilities, integrations
├── src/              # React frontend
│   ├── main.tsx      # React entry
│   ├── api/          # API routes
│   └── sw.ts         # Service worker
├── public/           # Static assets
└── bin/              # CLI tools
```

## Entry Points

- **Server**: `server/index.js` - Express server, WebSockets, MCP integrations
- **Frontend**: `src/main.tsx` - React 19 entry
- **CLI**: `bin/cli.js` - Server management

## Scripts

```bash
bun run dev        # Dev server
bun run build      # Production build
bun run start      # Start production
```

## Key Dependencies

- `express` - Web server
- `react` / `react-dom` - Frontend (19)
- `vite` - Build tool
- `@kronoscode-ai/sdk` - Core SDK

## Anti-Patterns

- DO NOT import node:\* modules in frontend code (browser bundle restriction)
- NEVER use bash for file operations (use tools instead)

## Notes

- WebSocket for real-time communication with core engine
- MCP server integrations for extended capabilities
- PWA support with service worker
