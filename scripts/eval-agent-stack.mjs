#!/usr/bin/env node

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")

const EXPECTED_RUNTIME_CONTRACT = (process.env.KRONOSCHAMBER_RUNTIME_CONTRACT_VERSION || "kronoschamber-runtime-contract-v1").trim()
const runtimeBaseUrl = (process.env.KRONOSCHAMBER_RUNTIME_URL || "http://127.0.0.1:3001").replace(/\/+$/, "")
const runtimeStatusUrl = `${runtimeBaseUrl}/api/runtime/status`

const allowedHealth = new Set(["healthy", "degraded", "offline"])

const checks = []

const pushCheck = (name, ok, details = {}) => {
  checks.push({ name, ok: Boolean(ok), ...details })
}

const runStaticChecks = () => {
  const systemPath = path.join(repoRoot, "packages", "kronoscode", "src", "session", "system.ts")
  const configPath = path.join(repoRoot, "packages", "kronoscode", "src", "config", "config.ts")

  const system = fs.readFileSync(systemPath, "utf8")
  const config = fs.readFileSync(configPath, "utf8")

  pushCheck("prompt stack contract text", system.includes("router -> planner -> executor -> critic -> summarizer"), {
    file: systemPath,
  })
  pushCheck("agent schema includes schema_version", config.includes("schema_version"), {
    file: configPath,
  })
  pushCheck("agent schema includes required_mcp", config.includes("required_mcp"), {
    file: configPath,
  })
  pushCheck("agent schema includes fallback", config.includes("fallback"), {
    file: configPath,
  })
}

const runRuntimeChecks = async () => {
  try {
    const response = await fetch(runtimeStatusUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      pushCheck("runtime status endpoint reachable", false, {
        status: response.status,
        url: runtimeStatusUrl,
      })
      return
    }

    const payload = await response.json()
    pushCheck("runtime status endpoint reachable", true, { url: runtimeStatusUrl })

    pushCheck(
      "runtime contract version matches",
      payload?.runtimeContract?.version === EXPECTED_RUNTIME_CONTRACT,
      {
        expected: EXPECTED_RUNTIME_CONTRACT,
        actual: payload?.runtimeContract?.version ?? null,
      },
    )

    pushCheck(
      "default browsing mode is browseros",
      payload?.defaultPolicy?.browsingMode === "browseros",
      { actual: payload?.defaultPolicy?.browsingMode ?? null },
    )

    const order = Array.isArray(payload?.routingPolicy?.userDesktopOrder) ? payload.routingPolicy.userDesktopOrder : []
    pushCheck(
      "user desktop order is computer-use -> automation -> ts-tools",
      order[0] === "computer-use-mcp" && order[1] === "automation-mcp" && order[2] === "ts-tools",
      { actual: order },
    )

    pushCheck(
      "ui policy browser open mode is intent+events",
      payload?.uiPolicy?.browserOpenMode === "intent+events",
      { actual: payload?.uiPolicy?.browserOpenMode ?? null },
    )
    pushCheck(
      "ui policy link mode is in-panel",
      payload?.uiPolicy?.linkOpenMode === "in-panel",
      { actual: payload?.uiPolicy?.linkOpenMode ?? null },
    )

    const connectors = payload?.connectors && typeof payload.connectors === "object" ? payload.connectors : {}
    for (const [name, connector] of Object.entries(connectors)) {
      pushCheck(`connector ${name} has health class`, allowedHealth.has(connector?.health), {
        actual: connector?.health ?? null,
      })
    }
  } catch (error) {
    pushCheck("runtime status endpoint reachable", false, {
      error: error instanceof Error ? error.message : String(error),
      url: runtimeStatusUrl,
    })
  }
}

runStaticChecks()
await runRuntimeChecks()

const passed = checks.filter((item) => item.ok).length
const failed = checks.filter((item) => !item.ok).length
const ok = failed === 0

const report = {
  ok,
  passed,
  failed,
  runtimeStatusUrl,
  checks,
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
process.exit(ok ? 0 : 1)
