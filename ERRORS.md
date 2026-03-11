# KronosCode & KronosChamber - Error Analysis Report

> Generated: March 8, 2026  
> Status: 🔴 Critical Issues Found

---

## Table of Contents

1. [Critical Errors (Blocking)](#critical-errors-blocking)
2. [MCP Configuration Issues](#mcp-configuration-issues)
3. [Warnings & Non-Blocking Issues](#warnings--non-blocking-issues)
4. [Console Errors](#console-errors)
5. [Recommended Fixes](#recommended-fixes)

---

## Critical Errors (Blocking)

### 1. TUI: Missing Module Export `@/storage`

| Field         | Value                                              |
| ------------- | -------------------------------------------------- |
| **Severity**  | 🔴 CRITICAL                                        |
| **Component** | KronosCode TUI                                     |
| **Command**   | `bun run dev`                                      |
| **Error**     | `Cannot find module '@/storage'`                   |
| **File**      | `/packages/kronoscode/src/marketplace/registry.ts` |
| **Line**      | 3                                                  |
| **Exit Code** | 1                                                  |

**Stack Trace:**

```
error: Cannot find module '@/storage' from '/Users/albsheralsadi/kronosfinal/kronoscoder/packages/kronoscode/src/marketplace/registry.ts'

Bun v1.3.9 (macOS arm64)
error: script "dev" exited with code 1
```

**Root Cause:**
The import `import { db } from "@/storage"` in `registry.ts` expects a module export from `@/storage`, but there's **no index.ts file** in `/packages/kronoscode/src/storage/` to re-export the `db` variable.

**Storage Directory Contents:**

```
/packages/kronoscode/src/storage/
├── db.ts              # Contains database exports
├── storage.ts         # Storage namespace
├── schema.sql.ts      # Database schema
├── schema.ts          # Schema definitions
└── json-migration.ts  # Migration logic
```

**Missing:** `index.ts` to aggregate exports

**Impact:** The TUI **fails to start entirely**. This is a **blocking error** - no development can proceed.

---

## MCP Configuration Issues

### 2. MCP Policy - HARDCODED & Locked

| Field         | Value                                    |
| ------------- | ---------------------------------------- |
| **Severity**  | 🔴 CRITICAL                              |
| **Component** | KronosCode Core (MCP)                    |
| **File**      | `/packages/kronoscode/src/mcp/policy.ts` |
| **Lines**     | 1-8                                      |

**The Problem:**
The MCP (Model Context Protocol) servers are **hardcoded and locked**. Users **cannot add custom MCP servers** through the UI - they are restricted to only these 6 pre-approved servers:

```typescript
// CURRENT HARDCODED LIST (packages/kronoscode/src/mcp/policy.ts)
export const MCP_POLICY_ALLOWED = [
  "apple_mcp",
  "automation-mcp",
  "browseros",
  "computer-use-mcp",
  "sequential-thinking",
  "openfang",
] as const
```

**Policy Enforcement:**

```typescript
// Line 39-42
export const isMcpPolicyAllowed = (value: string): boolean => {
  const normalized = normalizeMcpPolicyName(value)
  return normalized.length > 0 && MCP_POLICY_ALLOWED_SET.has(normalized)
}

// Line 44-47
export const mcpPolicyErrorMessage = (value: string): string => {
  const attempted = typeof value === "string" && value.trim().length > 0 ? value.trim() : "<empty>"
  return `MCP server "${attempted}" is blocked by policy. Allowed MCP servers: ${MCP_POLICY_ALLOWED.join(", ")}.`
}
```

**Impact:**

- ❌ Users **cannot add** custom MCP servers (e.g., GitHub, Jira, Slack, custom tools)
- ❌ UI shows error when trying to add non-approved MCPs
- ❌ This defeats the purpose of MCP's extensibility
- ❌ **The user explicitly requested this be editable**

**Existing UI Support (that can't work due to policy):**
The UI already has full MCP management capabilities:

- `useMcpConfigStore.ts` - Full CRUD operations
- Create/Update/Delete MCP servers
- Load presets
- Draft management

But the **backend blocks** any MCP not in the hardcoded list.

---

## Warnings & Non-Blocking Issues

### 3. Rust: Unused Variable Warning

| Field         | Value                                                   |
| ------------- | ------------------------------------------------------- |
| **Severity**  | 🟡 Warning                                              |
| **Component** | KronosChamber Desktop (Tauri)                           |
| **File**      | `/kronosChamber/packages/desktop/src-tauri/src/main.rs` |
| **Line**      | 2631                                                    |

**Warning:**

```
warning: unused variable: `window`
    --> src/main.rs:2631:5
     |
2631 |     window: tauri::Window,
     |     ^^^^^^^ help: if this is intentional, prefix it with an underscore: `_window`
```

**Function:** `desktop_browser_selection_state`

**Issue:** The `window` parameter is declared but never used. Function returns `Ok(None)` directly.

**Severity:** Low (compilation succeeds)

---

### 4. Vite HMR Server Not Ready

| Field         | Value                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| **Severity**  | 🟡 Warning                                                                                |
| **Component** | KronosChamber Desktop                                                                     |
| **Log**       | `[WARN] [desktop] Vite dev server not ready, using local API UI at http://127.0.0.1:3001` |

**Issue:** The Vite HMR server failed to start, so the desktop app fell back to using the local API UI.

**Severity:** Low - functionality still works but without hot module replacement

---

### 5. OpenCode Binary Path Configuration

| Field         | Value                 |
| ------------- | --------------------- |
| **Severity**  | 🟡 Warning            |
| **Component** | KronosChamber Desktop |

**Log:**

```
Configured settings.opencodeBinary is not executable: /Users/albsheralsadi/kronosfinal/kronoscoder/packages/opencode/bin/opencode
Resolved opencode CLI: /opt/homebrew/bin/opencode
```

**Issue:** The configured opencode binary path is not executable, but the system found an alternative.

**Severity:** Low (fallback works)

---

### 6. Zen Model Validation (Non-Blocking)

| Field         | Value                 |
| ------------- | --------------------- |
| **Severity**  | 🟢 Info               |
| **Component** | KronosChamber Desktop |

**Log:**

```
[zen] Startup model validation failed (non-blocking): Unable to connect. Is the computer able to access the url?
```

**Issue:** Model validation failed but is non-blocking.

---

## Console Errors

### 7. Enterprise Package Missing (rg warning)

| Field        | Value                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------- |
| **Severity** | 🟡 Warning                                                                                   |
| **Error**    | `rg: ./packages/enterprise/src/custom-elements.d.ts: No such file or directory (os error 2)` |

**Issue:** Some grep/search operations are failing due to missing enterprise package files.

---

## Recommended Fixes

### Fix 1: Add Storage Index Export (CRITICAL)

Create `/packages/kronoscode/src/storage/index.ts`:

```typescript
// Re-export all storage modules for easy importing
export { db, Database, NotFoundError } from "./db"
export * from "./storage"
export * from "./schema"
export * from "./schema.sql"
export * from "./json-migration"
```

### Fix 2: Make MCP Editable (CRITICAL - User Requested)

**Option A: Remove Policy Restrictions Entirely**

Edit `/packages/kronoscode/src/mcp/policy.ts`:

```typescript
// REMOVE the hardcoded list and allow ALL MCP servers
export const MCP_POLICY_ALLOWED = ["*"] as const // Allow all

// OR make it configurable via environment
export const MCP_POLICY_ALLOWED = process.env.MCP_ALLOWED?.split(",") || (["*"] as const)
```

**Option B: Add UI Toggle for Policy Bypass**

Edit `/packages/kronoscode/src/mcp/policy.ts`:

```typescript
// Add environment variable override
const envAllowed = process.env.MCP_SERVERS_ALLOWED?.split(",").map((s) => s.trim().toLowerCase()) || []

export const MCP_POLICY_ALLOWED = [
  ...(process.env.MCP_SERVERS_ALLOWED
    ? envAllowed
    : ["apple_mcp", "automation-mcp", "browseros", "computer-use-mcp", "sequential-thinking", "openfang"]),
] as const
```

Then users can add custom MCPs by setting:

```bash
export MCP_SERVERS_ALLOWED="github,jira,slack,custom-mcp,*"
```

**Option C: Add Config File Support**

Allow `kronoscode.json` to define allowed MCPs:

```json
{
  "mcp": {
    "allowed": ["*"] // or list specific servers
  }
}
```

### Fix 3: Fix Rust Warning

Edit `/kronosChamber/packages/desktop/src-tauri/src/main.rs` line 2631:

```rust
fn desktop_browser_selection_state(
    _window: tauri::Window,  // Add underscore to suppress warning
) -> Result<Option<SelectionState>, String> {
    Ok(None)
}
```

---

## Summary

| Issue                          | Severity    | Status                     |
| ------------------------------ | ----------- | -------------------------- |
| TUI `@/storage` import missing | 🔴 Critical | Needs Fix                  |
| MCP policy hardcoded           | 🔴 Critical | Needs Fix (User Requested) |
| Rust unused variable           | 🟡 Warning  | Fix Optional               |
| Vite HMR not ready             | 🟡 Warning  | Fix Optional               |
| OpenCode binary path           | 🟡 Warning  | Fix Optional               |

---

## Next Steps

1. **Fix the storage index export** - This is blocking TUI from starting
2. **Decide on MCP policy approach** - User requested it be editable
3. **Apply Rust fix** - Clean up warnings
4. **Test both dev environments** - Verify fixes work

---

_Generated by Sisyphus - KronosCode Analysis Agent_
