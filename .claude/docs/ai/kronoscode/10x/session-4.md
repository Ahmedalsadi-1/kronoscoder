# 10x Analysis: KronosCode (Ghost OS + MCP Control Plane)
Session 4 | Date: 2026-03-13

## Current Value
KronosCode already has a stronger agent substrate than most open-source coding agents:
- A layered prompt contract with explicit tool priority, workspace routing, and fallback logic in `packages/kronoscode/src/session/system.ts` and `packages/kronoscode/src/agent/prompt/coder.txt`.
- Real runtime capability injection from KronosChamber before message send, including active workspace, connector health, and fallback policy in `kronosChamber/packages/ui/src/stores/messageStore.ts`.
- Mature MCP plumbing with local/remote transport support, OAuth handling, status tracking, and live tool refresh in `packages/kronoscode/src/mcp/index.ts`.
- A working MCP management surface already exists: manual server config, presets, status UI, and CLI add flows in `packages/ui/src/components/sections/mcp/`, `packages/kronoscode/src/cli/cmd/mcp.ts`, and `packages/ui/src/stores/useMcpConfigStore.ts`.
- A repo-install pattern already exists for skills, which is the exact UX shape you want for future MCP installation in `packages/ui/src/components/sections/skills/catalog/InstallFromRepoDialog.tsx`.

The current gap is not “can KronosCode use MCP?” It already can. The gap is turning MCP from a manual extension layer into a trusted, measurable, first-class capability marketplace.

## The Question
What would make KronosCode 10x more valuable as an agent operating system, not just a coding agent with optional MCP connectors?

---

## Massive Opportunities

### 1. Capability Broker (Prompt Advice -> Runtime Enforcement)
**What**: Build a first-class broker that scores built-in tools, skills, MCP servers, and runtime modes by health, trust, cost, speed, and task fit, then enforces routing instead of merely describing it in prompts.
**Why 10x**: Today the prompt stack says “built-in first, skills second, MCP fallback,” but `packages/kronoscode/src/session/prompt.ts` still exposes built-ins and MCP tools side-by-side to the model. That means routing quality depends too much on obedience. A broker converts policy into product behavior.
**Unlocks**: Safer autonomy, lower prompt variance, cleaner enterprise controls, better multi-agent consistency.
**Effort**: Very High
**Risk**: Over-constraining models and blocking useful improvisation if the broker is too rigid.
**Score**: 🔥

### 2. Ghost OS as the Native macOS Automation Engine
**What**: Integrate Ghost OS as a first-class native-desktop provider for macOS workflows, with recipe discovery, health checks, and learning-mode import into KronosCode memory/skills.
**Why 10x**: Ghost OS is materially different from screenshot-only computer-use stacks. It uses the macOS accessibility tree first, adds local vision fallback when needed, and can learn reusable recipes by observing the user once. That turns desktop control from “live remote control” into “replayable operational knowledge.”
**Unlocks**: One-shot teaching, reusable workflows, team-shared native automations, much better Mac app control than browser-only or pixel-only approaches.
**Effort**: High
**Risk**: macOS-only surface area, permissions friction, and overlap confusion with BrowserOS/computer-use-mcp.
**Score**: 🔥

### 3. MCP Marketplace With Trust Gates
**What**: Create a real MCP marketplace/install flow inside KronosChamber: discover, draft config, validate env vars, run health checks, connect, and score ongoing reliability.
**Why 10x**: MCPs are currently “power-user config.” Turning them into a governed marketplace makes KronosCode extensible by default.
**Unlocks**: Faster ecosystem growth, community distribution, better onboarding, enterprise approval workflows.
**Effort**: High
**Risk**: Supply-chain risk and support burden if installs are too permissive.
**Score**: 👍

---

## Medium Opportunities

### 1. Fork `mcp-installer` Into a KronosCode-Native Installer
**What**: Adapt `anaisbetts/mcp-installer` so it writes to KronosCode/KronosChamber MCP config via your own config API and UI draft flow instead of mutating Claude Desktop config files.
**Why 10x**: It closes the biggest UX gap immediately: “install a package/repo as an MCP server for me.”
**Impact**: MCP install becomes conversational and low-friction.
**Effort**: Medium
**Score**: 🔥

### 2. Prompt Quality Harness
**What**: Turn your prompt stack into a testable artifact with evals for tool choice, fallback correctness, MCP routing, verification compliance, and refusal behavior.
**Why 10x**: Your prompt system is good, but not measured enough. Right now it is strong architecture without equally strong regression protection.
**Impact**: Faster prompt iteration, less routing drift, better confidence in model/provider changes.
**Effort**: Medium
**Score**: 🔥

### 3. Recipe <-> Skill <-> Prompt Convergence
**What**: Treat Ghost recipes, OpenFang hands, and skills as one reusable “agent capability artifact” family with import/export between them.
**Why 10x**: Right now reusable knowledge is split across skills, MCP presets, and prompt instructions. Converging them creates compounding value.
**Impact**: Better reuse, better onboarding, less duplicated workflow logic.
**Effort**: Medium
**Score**: 👍

---

## Small Gems

### 1. Add `ghost-os` as an MCP preset plus desktop-control provider profile
**What**: Ship a preset, health check, and connector summary entry for Ghost OS.
**Why powerful**: This gets Ghost OS into the product quickly without waiting for deeper orchestration work.
**Effort**: Low
**Score**: 🔥

### 2. Add “Install MCP from package/repo” next to “Create from preset”
**What**: Mirror the existing skill repo installer UX for MCPs.
**Why powerful**: Users already understand this interaction model from skills.
**Effort**: Low
**Score**: 🔥

### 3. Tighten MCP policy before enabling installer workflows
**What**: Replace the current default wildcard posture with admin-approved sources or explicit confirmation for install-time mutation.
**Why powerful**: This prevents the install surface from becoming the biggest supply-chain hole in the product.
**Effort**: Low
**Score**: 🔥

### 4. Add a per-session routing report
**What**: Show which provider/tool path was chosen and why.
**Why powerful**: It makes prompt routing legible, debuggable, and trainable.
**Effort**: Low
**Score**: 👍

---

## Recommended Priority

### Do Now
1. Add `ghost-os` as a preset/provider profile for macOS desktop-control.
2. Fork/adapt `mcp-installer` into a KronosCode-native MCP draft/install flow.
3. Tighten MCP install security posture before enabling conversational installs.

### Do Next
1. Build a prompt QA harness for routing, fallback, and verification compliance.
2. Add a routing report panel so users and developers can see why a path was chosen.
3. Import Ghost recipes and OpenFang hand templates into a shared reusable capability model.

### Explore
1. Full Capability Broker that enforces built-in -> skill -> MCP precedence at runtime.
2. Ghost learning mode as a product feature: “Teach KronosCode this workflow.”
3. A governed MCP marketplace with health scoring, reputation, and team approval.

### Backlog
1. Cross-platform native desktop recipe engines beyond macOS.

---

## Direct Answers

### Should you add Ghost OS?
- **Yes, with a specific role.**
- Ghost OS should **not** replace BrowserOS. Keep BrowserOS as the primary browser path.
- Ghost OS should become the **native macOS automation provider** for Finder, Mail, Slack, Messages, native dialogs, and repeatable learned workflows.
- Best routing model for macOS:
  1. Browser/web work: BrowserOS first
  2. Native macOS app work: Ghost OS first
  3. Fallback desktop control: `computer-use-mcp` / `automation-mcp`

### Should you allow `mcp-installer`?
- **Yes, but not as-is and not as a general always-on tool.**
- The repo currently installs servers by editing Claude Desktop config directly. That is useful proof-of-concept, but it is the wrong control plane for KronosCode.
- Best move: fork/adapt it into a **KronosCode installer service** that:
  - writes MCP drafts through your config API/UI
  - shows the generated command/env before save
  - requires explicit user confirmation for package install and config mutation
  - runs a health check before marking the server usable
  - tags the source as npm, PyPI, local path, or curated preset

### How should you utilize MCP servers and logic for your agents?
- Treat MCP as a **capability extension plane**, not the default execution path.
- Keep the current product principle: built-ins first, skills second, MCP third.
- Move from prompt-only guidance to runtime scoring:
  - health
  - auth readiness
  - workspace fit
  - latency/cost
  - security posture
  - user intent match
- Use MCP in three lanes:
  - **Core operators**: desktop-control, browser, memory, security, observability
  - **Business connectors**: Jira, Linear, GitHub, Slack, databases
  - **Ecosystem expansion**: installable specialty servers

### How strong is the current prompting system?
**Rating: 7/10**

**Why it scores well**:
- It has a real layered contract.
- It injects runtime capability context.
- It has explicit fallback/routing language.
- It has mature agent permissions and MCP infrastructure.

**Why it is not yet 9/10**:
- Tool priority is still mostly advisory.
- MCP policy is too permissive by default if `MCP_ALLOWED_SERVERS` is unset.
- Verification requirements are described strongly but not enforced strongly.
- Routing-critical agent metadata (`capabilities`, `required_mcp`, `fallback`) is defined but not yet fully operationalized.

### How do you raise Prompt Architecture from 7.5/10 -> 9/10?
- **Move routing rules out of prose and into execution gates.**
  The system prompt already says built-ins first, skills second, MCP third, but `packages/kronoscode/src/session/prompt.ts` still exposes both built-ins and MCP tools in the same final tool bag. The next step is a pre-model routing pass that decides which classes of tools are even eligible for the turn.
- **Make capability context mandatory, not advisory.**
  The host/runtime already knows health and workspace state. The model should receive a normalized capability object plus explicit unavailable-tool suppressions so it cannot “see” tools that are unhealthy or blocked.
- **Split prompt responsibilities harder.**
  Right now system, agent prompt, capabilities supplement, and runtime hints all overlap. Tighten this:
  - system prompt = universal behavior contract
  - agent prompt = task style and scope
  - capabilities supplement = tool descriptions only
  - runtime context = current health/routing facts only
- **Add evals for every routing claim.**
  If the prompt says “use built-ins first,” there should be tests where the model is given a job solvable by built-ins and fails if it chooses MCP first.
- **Add a visible routing trace.**
  Prompt quality improves dramatically once you can inspect why the system chose BrowserOS, Ghost OS, E2B, skill fallback, or MCP.

### How do you raise Agent Architecture from 8/10 -> 9/10?
- **Turn agent metadata into real scheduling inputs.**
  `capabilities`, `required_mcp`, and `fallback` should control agent eligibility, startup warnings, and runtime downgrade behavior instead of living mostly as descriptive metadata.
- **Introduce agent classes, not just names.**
  Current native agents are useful but flat: `build`, `plan`, `general`, `explore`. Add explicit categories:
  - execution agents
  - research agents
  - workflow agents
  - desktop/browser operators
  - governance/critic agents
- **Add a dedicated routing/critic agent layer.**
  The layered prompt contract references router and critic, but those are not fully materialized as isolated, inspectable agents. Make them real components with logs and measurable outputs.
- **Unify reusable capability artifacts.**
  Skills, MCP presets, Ghost recipes, OpenFang hands, and generated CLI harnesses should all become versions of one shared concept: reusable agent capability packages.
- **Add agent fitness scoring.**
  Before the system picks an agent, score it by:
  - prompt fit
  - tool availability
  - required MCP health
  - workspace fit
  - cost/latency preference

### How do you raise Tool Routing from 6.5/10 -> 9/10?
- **Enforce a three-stage router.**
  1. Built-in eligibility
  2. Skill eligibility
  3. MCP fallback eligibility
  The model should not choose from all three at once.
- **Classify tasks before tool exposure.**
  Examples:
  - code editing -> local file/code tools only
  - interactive browser -> BrowserOS/browser tools first
  - native macOS app automation -> Ghost OS first
  - background worker -> E2B first
  - specialty integration -> MCP only if no built-in/skill path exists
- **Promote stable MCP patterns into built-ins.**
  MCP is best for ecosystem expansion, but once a capability proves essential and stable, it should graduate into native tools or native runtime connectors.
- **Add health-aware suppression.**
  Unhealthy connectors should not merely be “discouraged”; they should be hidden or demoted unless the user explicitly asks for them.
- **Add verification by route type.**
  Each route class needs different validation:
  - code route: tests/lint/typecheck
  - browser route: page state/screenshot/assertion
  - desktop route: task result + screenshot/log
  - MCP route: connectivity + expected tool output + fallback behavior

### Which current MCPs should become built-in or built-in-adjacent?
Not every MCP should become native. Use this rule:
- **Promote to built-in** when the capability is core, frequently used, latency-sensitive, or strategically differentiating.
- **Keep as MCP** when the capability is niche, third-party specific, fast-moving, or community-owned.

#### Strong built-in / built-in-adjacent candidates
1. **Ghost OS**
   Why: strategically important for native macOS control and differentiated workflow learning.
2. **BrowserOS / browser MCP surfaces**
   Why: browser control is already core product behavior, so it should remain native-first.
3. **mcp2cli-style deferred tool discovery**
   Why: this is not just one integration; it is an optimization pattern that can improve the entire tool economy.
4. **CLI-Anything-style adapter generation**
   Why: if successful, it can convert non-agent-native software into deterministic interfaces, which is platform-level value.

#### Keep as MCP-first
1. Business SaaS connectors
2. Community experimental tools
3. Narrow vertical integrations
4. Research or unstable servers

### How should you test all built-in tools and MCP tools correctly?
You need a **Tool Reliability Program**, not ad hoc spot checks.

#### 1. Capability inventory
Maintain a generated matrix for every tool:
- tool id
- connector/source
- built-in vs MCP vs skill-backed
- required env/auth
- destructive risk level
- expected inputs/outputs
- deterministic verification strategy

#### 2. Connector health checks
For every connector class:
- startup check
- auth check
- capability check
- smoke test
- error-shape check
- fallback-path check

#### 3. Golden task suites
Create repeatable task packs:
- **Code pack**: read/edit/search/test/build
- **Browser pack**: open, navigate, fill, click, capture, assert
- **Desktop pack**: screenshot, app focus, action, verify state
- **Memory pack**: recall/search/context
- **MCP pack**: connect, call representative tool, handle failure, reroute

#### 4. Routing eval suite
For each scenario, assert:
- which agent should be selected
- which runtime mode should be selected
- which tool family should be exposed first
- which fallback should occur if primary is unavailable

#### 5. Promotion gates
Before an MCP-derived capability can be considered “built-in-adjacent,” require:
- stable invocation pattern
- predictable auth/setup story
- high user frequency
- low failure variance
- clear ownership in the codebase

### What is the highest-leverage testing move right now?
**Build one unified “agent capability scorecard” page and one automated smoke harness.**

Why this is the move:
- It improves prompt quality because you can measure routing outcomes.
- It improves agent quality because you can see which agents are actually viable.
- It improves tool routing because unhealthy paths become obvious immediately.
- It gives you a promotion rubric for deciding which MCPs should become native.

### Recommended tool validation scorecard
For every tool or connector, score:
- **Availability**: can it be reached right now?
- **Readiness**: are auth/env/setup requirements satisfied?
- **Correctness**: does it return the expected output shape?
- **Latency**: how long does the representative task take?
- **Fallback quality**: when it fails, does the system reroute well?
- **User trust**: would a normal user feel safe relying on it?

### Recommended immediate score-improvement plan

#### Do Now
1. Add a routing trace and capability scorecard UI.
2. Build smoke tests for every built-in tool family and every approved MCP connector.
3. Hide or demote unhealthy connectors from the model-visible tool set.

#### Do Next
1. Add routing evals that assert built-in-first behavior.
2. Materialize router and critic as real runtime components, not just prompt concepts.
3. Define promotion criteria for MCP -> built-in-adjacent -> built-in.

#### Explore
1. Build a deferred-discovery tool layer inspired by `mcp2cli`.
2. Build an adapter-generation layer inspired by `CLI-Anything`.
3. Convert Ghost OS from “connector” to a first-class native operator subsystem.

---

## Perplexity Computer

### Why it is interesting
- Perplexity is positioning Computer as an asynchronous “digital worker,” not just an interactive browser agent.
- Official product materials emphasize multi-model orchestration, sub-agents, authenticated integrations, persistent memory, scheduling, and secure isolated execution.
- The launch narrative is notably close to where KronosCode wants to go: one system that can research, create, code, and operate tools over time.

### What stands out strategically
- **Asynchronous execution**: this is the big difference versus most agent UIs. Perplexity is selling background task completion, not just chat-time assistance.
- **Model orchestration as product**: they are explicitly making “best model for each subtask” a user-facing advantage.
- **Skills + connectors + memory**: their stack combines reusable instructions, integrations, memory, and scheduling into one worker concept.
- **Cloud sandbox default**: they reduce local setup friction by running in isolated environments rather than requiring users to assemble local tools.

### What KronosCode should learn from it
- KronosCode should push harder on the idea of a persistent worker, not only a coding session.
- The strongest opportunity is not “copy Perplexity Computer.” It is to combine your stronger local/developer-native stack with the same async orchestration ambition.
- Product gap to close:
  1. background tasks that survive the active session
  2. reusable skills/recipes/hands under one abstraction
  3. model-routing visibility and control
  4. durable execution with better operator UX

### Recommendation
- **Use Perplexity Computer as a benchmark, not an integration target.**
- It is valuable as a product reference for:
  - async worker UX
  - multi-model orchestration
  - enterprise-friendly isolated execution
  - skills/memory/scheduling convergence
- I would **not** add it to the repo recommendations list unless you specifically want a “competitive references” section. It is more useful as strategic inspiration than as an open-source building block.

---

## Recommended Open Source Repos

### 1. `ghostwright/ghost-os`
**Use for**: Native macOS desktop control plus learned recipes.
**Why**: Best fit for your “AI agent that can really operate the user’s Mac” ambition.

### 2. `lastmile-ai/mcp-agent`
**Use for**: Reference patterns for composing MCP-powered agents, durable execution, and agent-as-MCP-server flows.
**Why**: Good architecture reference if you want a stronger capability broker and workflow composition layer.

### 3. `knowsuchagency/mcp2cli`
**Use for**: Converting MCP servers or OpenAPI specs into on-demand CLI interfaces to reduce schema/token overhead.
**Why**: This is directly relevant to your prompt stack weakness. `mcp2cli` is built around deferred discovery, cheaper `--list` and `--help` flows, OAuth support, caching, and a provider-agnostic CLI pattern. It aligns with your need to stop paying full schema tax on every turn.

### 4. `HKUDS/CLI-Anything`
**Use for**: Generating agent-native CLIs and harnesses for GUI-heavy or non-agent-native software.
**Why**: This is a strong ecosystem fit because it pushes software toward structured CLI control instead of fragile ad hoc automation. It is especially interesting for turning existing apps into deterministic agent surfaces that KronosCode can orchestrate.

---

## Questions

### Answered
- **Q**: Can Ghost OS help your ecosystem? **A**: Yes. It is a strong fit for native macOS automation and reusable workflow learning.
- **Q**: Can `mcp-installer` be used directly? **A**: No. It currently targets Claude Desktop config and should be adapted to KronosCode’s config/runtime layer.
- **Q**: Is the current prompting system weak? **A**: No. It is above average, but still too advisory in key places.

### Blockers
- **Q**: Do you want conversational MCP installs to be available to all users or only a privileged setup/admin agent?
- **Q**: Is your priority macOS-native excellence first, or cross-platform parity first?
- **Q**: Should installed MCPs be restricted to curated registries at launch, or allow arbitrary npm/PyPI packages with warnings?

## Evidence

### Local Codebase
- Prompt stack and routing policy: `packages/kronoscode/src/session/system.ts`
- Main agent prompt contract: `packages/kronoscode/src/agent/prompt/coder.txt`
- Tool exposure path: `packages/kronoscode/src/session/prompt.ts`
- MCP config schema and agent capability fields: `packages/kronoscode/src/config/config.ts`
- MCP runtime implementation: `packages/kronoscode/src/mcp/index.ts`
- MCP policy posture: `packages/kronoscode/src/mcp/policy.ts`
- MCP CLI add flow: `packages/kronoscode/src/cli/cmd/mcp.ts`
- MCP UI + presets: `packages/ui/src/components/sections/mcp/McpSidebar.tsx`, `packages/ui/src/stores/useMcpConfigStore.ts`
- Skills repo installer pattern to copy: `packages/ui/src/components/sections/skills/catalog/InstallFromRepoDialog.tsx`
- Runtime workspace and connector context injection: `kronosChamber/packages/ui/src/stores/messageStore.ts`
- Current desktop routing map: `docs/runtime-recovery-map.md`

### External Research
- Ghost OS: `https://github.com/ghostwright/ghost-os`
- Ghost OS agent instructions: `https://github.com/ghostwright/ghost-os/blob/main/GHOST-MCP.md`
- MCP installer: `https://github.com/anaisbetts/mcp-installer`
- MCP agent: `https://github.com/lastmile-ai/mcp-agent`
- mcp2cli: `https://github.com/knowsuchagency/mcp2cli`
- CLI-Anything: `https://github.com/HKUDS/CLI-Anything`
- Perplexity Computer launch: `https://www.perplexity.ai/hub/blog/introducing-perplexity-computer`
- Perplexity Computer help center: `https://www.perplexity.ai/help-center/en/articles/13837784-what-is-computer`
- Perplexity Computer for Enterprise: `https://www.perplexity.ai/hub/blog/computer-for-enterprise`

## Next Steps
- [ ] Add a `ghost-os` MCP preset and health-check integration to desktop-control knowledge.
- [ ] Design a KronosCode-native fork of `mcp-installer` that drafts config instead of mutating Claude Desktop files.
- [ ] Add explicit install-time approval and source trust rules before enabling conversational MCP installation.
- [ ] Prototype an `mcp2cli`-style deferred tool discovery path for schema-heavy MCP/OpenAPI integrations.
- [ ] Evaluate where CLI-Anything-style generated harnesses fit into skills, recipes, or a new “agent-native adapter” artifact.
- [ ] Decide whether Ghost recipes become a new artifact type, or map into skills/OpenFang hands.
- [ ] Add an agent/tool/capability scorecard with routing trace visibility.
- [ ] Create smoke-test packs for built-in tools, BrowserOS, Ghost OS, E2B, and approved MCP connectors.
- [ ] Define promotion gates for moving selected MCP capabilities into built-in or built-in-adjacent status.
