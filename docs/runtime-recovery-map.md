# KronosCode / KronosChamber Runtime Recovery Map

## 1) Runtime Topology
```mermaid
flowchart LR
  U[User] --> UI["KronosChamber UI\n(packages/ui)"]
  UI --> WEB["Web Runtime Server\n(packages/web/server/index.js)"]
  WEB --> KC["kronoscode backend\n127.0.0.1:4096"]
  WEB --> RT["Runtime API\n/api/runtime/*"]
  RT --> DBR[desktop-browser]
  RT --> BG[e2b/openbrowser]
  RT --> UD[user-desktop router]
  UD --> CUM[computer-use-mcp]
  UD --> RM[remote-macos]
  UD --> TS[ts-tools fallback]
```

## 2) User Desktop Routing (Current)
```mermaid
flowchart TD
  A["mode=user-desktop task"] --> B{"computer-use-mcp connected?"}
  B -- yes --> C[use computer-use-mcp]
  B -- no --> D{"remote-macos connected?"}
  D -- yes --> E[use remote-macos]
  D -- no --> F{"ts-tools available?"}
  F -- yes --> G[use ts-tools]
  F -- no --> H["400: No provider available"]
```

## 3) Current Failure Tree (Validated)
```mermaid
flowchart TD
  R[Runtime smoke tests] --> W1[Web/API healthy]
  R --> W2[Backend healthy]
  R --> W3[Desktop provider routing healthy]

  W3 --> P1[computer-use-mcp connected]
  W3 --> P2[remote-macos configured but env missing]

  UI[Playwright UI checks] --> U1[Main app loads]
  UI --> U2[Settings open]
  UI --> U3[MASCOT_COLLAGE_B crash resolved]
  UI --> U4[Intermittent Playwright target crash after long interactions]

  Git[Git panel checks] --> G1[ENOENT diff-stat spam suppressed]
```

## 4) Action Ownership
```mermaid
flowchart LR
  A1[Fix desktop provider readiness] --> O1[Config and MCP command]
  A2[Stabilize restart-all orchestration] --> O2[CLI + runtime logs]
  A3[Reduce Playwright crash path] --> O3[UI + Runtime event pressure]
  A4[Harden git status polling errors] --> O4[Web server + UI fetch retry]
```

## 5) Restart Sequence Contract
```mermaid
sequenceDiagram
  participant U as User
  participant CLI as kronoscode doctor restart-all
  participant KC as kronoscode serve
  participant WEB as KronosChamber web server
  U->>CLI: restart-all --json
  CLI->>CLI: kill stale ports/processes
  CLI->>KC: start backend
  CLI->>KC: wait /global/health == ok
  CLI->>WEB: start web server
  CLI->>WEB: wait /health == ok
  CLI->>WEB: wait /api/runtime/status == ok
  CLI-->>U: structured health + log paths
```

## 6) Provider Readiness Matrix
```mermaid
flowchart LR
  A[user-desktop request] --> B{computer-use-mcp connected?}
  B -- yes --> C[route=openbrowser provider=computer-use-mcp]
  B -- no --> D{remote-macos connected?}
  D -- yes --> E[route=openbrowser provider=remote-macos]
  D -- no --> F{openbrowser/e2b local tools available?}
  F -- yes --> G[route=ts-tools fallback]
  F -- no --> H[provider=none return actionable error]
```
