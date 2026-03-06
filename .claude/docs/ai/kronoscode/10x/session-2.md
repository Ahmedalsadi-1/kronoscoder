# 10x Analysis: KronosCode Runtime + KronosChamber Sleeve
Session 2 | Date: 2026-03-04

## Current Value
KronosCode already has a strong core: a local runtime (`kronoscode serve`), a web sleeve (`packages/web`), desktop shell (`packages/desktop`), and a large skill ecosystem symlinked into `~/.kronoscode`. The practical bottleneck is operational reliability and discoverability: users do not get one deterministic startup path, MCP servers are not pre-wired, and high-value agent packs (for example Sisyphus) are installed in legacy locations but not always surfaced canonically.

## The Question
What would make KronosCode + KronosChamber feel 10x more reliable, installable, and scalable for advanced users on day one?

---

## Massive Opportunities

### 1. Unified Runtime Orchestrator (`kronoscode up`)
**What**: One command that boots runtime + web sleeve + optional desktop, verifies ports/health/contracts, and prints one diagnostics summary.
**Why 10x**: Removes the most common failure mode (partial startup, wrong env, wrong port). Converts setup from manual runbook to deterministic boot contract.
**Unlocks**: Team-wide reproducibility, supportability, easier onboarding, scripted CI smoke.
**Effort**: High
**Risk**: Coordination across CLI/web/desktop scripts and compatibility env aliases.
**Score**: 🔥

### 2. Registry-Driven Capability Marketplace (Agents + Skills + MCP)
**What**: A signed manifest model for agent packs, skill packs, and MCP presets with install/update/remove/version pinning from curated registries.
**Why 10x**: Converts ad-hoc local files into lifecycle-managed capabilities. Makes "add Sisyphus + remote macOS + context7" a 30-second operation.
**Unlocks**: Ecosystem growth, reproducible team bundles, enterprise policy controls, compatibility channels.
**Effort**: Very High
**Risk**: Trust/security model, dependency conflicts, update safety.
**Score**: 🔥

### 3. Cross-Runtime Session Continuity Layer
**What**: Shared session state bus so terminal/web/desktop can switch instantly without losing tool context, media timeline, or active runtime panel state.
**Why 10x**: Removes runtime fragmentation. Users move between terminal, browser, and desktop as one continuous workspace.
**Unlocks**: True multi-surface productivity, seamless handoff, better debugging/observability.
**Effort**: High
**Risk**: Event schema drift across runtimes.
**Score**: 👍

---

## Medium Opportunities

### 1. Canonical Global Asset Ingestion (Already started)
**What**: Treat `~/.kronoscode` as canonical while importing from `~/.agents`, `~/.codex`, `~/.claude`, `~/.opencode`, and `~/.config/opencode` via symlinks + manifest.
**Why 10x**: Immediately surfaces hidden value (legacy agents/skills) without migration risk.
**Impact**: Resolves “why is Sisyphus missing?” class issues quickly.
**Effort**: Medium
**Score**: 🔥

### 2. MCP Provisioning Profiles
**What**: Opinionated presets (`local-dev`, `research`, `desktop-control`) that install/configure MCP servers and verify env prerequisites.
**Why 10x**: Eliminates blank-state MCP confusion (`kronoscode mcp list` showing none) and makes advanced setups repeatable.
**Impact**: Faster activation and fewer support tickets.
**Effort**: Medium
**Score**: 🔥

### 3. Browser-First Policy Guardrails
**What**: Runtime policy layer that defaults browsing/capture tasks to KronosChamber browser and auto-opens split side-panel on new media events.
**Why 10x**: Makes browser workflows visibly reliable and user-trustworthy.
**Impact**: Better task observability and lower confusion during automation.
**Effort**: Medium
**Score**: 👍

---

## Small Gems

### 1. Startup Doctor with Copy-Paste Fixes
**What**: `kronoscode debug doctor --startup` that prints exact exports and start commands based on detected state.
**Why powerful**: Turns troubleshooting into 1-command recovery.
**Effort**: Low
**Score**: 🔥

### 2. “Import Legacy Assets” One-Click in Onboarding
**What**: UI/CLI button triggers global sync and shows linked counts/conflicts.
**Why powerful**: Immediate visible win for existing OpenCode users.
**Effort**: Low
**Score**: 🔥

### 3. MCP Row Click with Inline Health Badge
**What**: Click row to connect/disconnect and immediately show auth/env/transport health.
**Why powerful**: Removes ambiguity from MCP state.
**Effort**: Low
**Score**: 👍

---

## Recommended Priority

### Do Now
1. Ship deterministic startup path (`serve` + web sleeve + health checks) and publish canonical command block.
2. Keep global asset sync as canonical ingest path and include `~/.config/opencode` source.
3. Add MCP preset bootstrap for `remote-macos`, `context7`, and one web-search provider.

### Do Next
1. Build `kronoscode up` orchestrator with runtime smoke gate.
2. Add capability manifest for agent/skill/MCP packs with version pinning.
3. Add browser-first policy observability (event + panel open metrics).

### Explore
1. Signed remote registry for packs with trust/allowlist policy.
2. Managed entitlement hooks for premium MCP providers (hybrid BYOK + managed token mode).
3. Cross-runtime session continuity with media timeline replay.

### Backlog
1. Full marketplace UX with ratings/discovery/search.
2. Automated compatibility matrix testing for every external pack.

---

## Questions

### Answered
- **Q**: Why does KronosCode show OpenCode-era assets? **A**: Compatibility scanning intentionally pulls from legacy homes; canonical symlink ingestion is required.
- **Q**: Why was Sisyphus not visible canonically? **A**: It lived under `~/.config/opencode/agent` and was outside previous migration scan roots.
- **Q**: Why does startup feel brittle? **A**: Runtime and sleeve are separate processes with env contracts; users often start only one side.

### Blockers
- **Q**: Which MCP providers should be first-party presets by default? (Need product decision on security/trust policy.)
- **Q**: Should pack installation be local-only or support org-level managed registries now?

## Evidence (Codebase + External)
- Local runtime/source evidence: `packages/web/server/index.js`, `packages/kronoscode/src/migration/global-assets.ts`, `~/.config/opencode/agent/Sisyphus.md`.
- MCP Registry (official): https://modelcontextprotocol.io/docs/tools/registry
- MCP Registry service: https://registry.modelcontextprotocol.io/
- Awesome MCP list: https://github.com/appcypher/awesome-mcp-servers
- MCP server manager (`mcp-get`): https://github.com/michaellatman/mcp-get
- Remote macOS MCP repo: https://github.com/baryhuang/mcp-remote-macos-use
- oh-my-opencode (Sisyphus + plugin ecosystem): https://github.com/code-yeongyu/oh-my-opencode

## Next Steps
- [ ] Implement `kronoscode up` with health/port contract validation.
- [ ] Add MCP profile bootstrap command with env checklist output.
- [ ] Add pack manifest draft schema (`agents`, `skills`, `mcp`, `version`, `source`, `trust`).
- [ ] Add compatibility smoke test for startup + MCP connectivity gates.
