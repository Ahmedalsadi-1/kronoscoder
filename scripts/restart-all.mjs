#!/usr/bin/env node

import { spawn, spawnSync } from "child_process"
import { fileURLToPath } from "url"
import path from "path"
import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")

const args = new Set(process.argv.slice(2))
const withDesktop = args.has("--with-desktop")
const withBrowseros = args.has("--with-browseros") || args.has("--with-kronosos")
const asJson = args.has("--json")
const noKill = args.has("--no-kill")

const BACKEND_PORT = 4096
const WEB_PORT = Number(process.env.KRONOSCHAMBER_PORT || "3001")
const RUNTIME_CONTRACT_VERSION = (process.env.KRONOSCHAMBER_RUNTIME_CONTRACT_VERSION || "kronoschamber-runtime-contract-v1").trim()
const BROWSEROS_SETUP_SCRIPT = path.join(repoRoot, "scripts", "setup-browseros-agent.mjs")
const USER_CONFIG_PATH = path.join(process.env.HOME || "", ".config", "kronoscode", "kronoscode.json")

const backendHealthUrl = `http://127.0.0.1:${BACKEND_PORT}/global/health`
const webHealthUrl = `http://127.0.0.1:${WEB_PORT}/health`
const runtimeStatusUrl = `http://127.0.0.1:${WEB_PORT}/api/runtime/status`

const sharedEnv = {
  ...process.env,
  KRONOSCODE_PORT: String(BACKEND_PORT),
  OPENCODE_PORT: String(BACKEND_PORT),
}

const backendEnv = {
  ...sharedEnv,
}

const webEnv = {
  ...sharedEnv,
  KRONOSCODE_SKIP_START: "true",
  KRONOSCODE_EXTERNAL_ONLY: "true",
  KRONOSCHAMBER_KRONOSCODE_PORT: String(BACKEND_PORT),
  KRONOSCHAMBER_SKIP_KRONOSCODE_START: "true",
  KRONOSCHAMBER_EXTERNAL_ONLY: "true",
  OPENCODE_SKIP_START: "true",
  OPENCODE_EXTERNAL_ONLY: "true",
  OPENCHAMBER_OPENCODE_PORT: String(BACKEND_PORT),
  OPENCHAMBER_SKIP_OPENCODE_START: "true",
  OPENCHAMBER_EXTERNAL_ONLY: "true",
  KRONOSCHAMBER_PORT: String(WEB_PORT),
}

const summary = {
  backend: { started: false, pid: null, running: false, healthy: false, url: `http://127.0.0.1:${BACKEND_PORT}`, log: null },
  web: { started: false, pid: null, running: false, healthy: false, url: `http://127.0.0.1:${WEB_PORT}`, log: null },
  runtime: {
    healthy: false,
    url: runtimeStatusUrl,
    expectedContractVersion: RUNTIME_CONTRACT_VERSION,
    contractVersion: null,
    contractBuildID: null,
    contractMatch: false,
    error: null,
  },
  desktop: { started: false, pid: null },
  browseros: {
    requested: withBrowseros,
    started: false,
    running: false,
    healthy: false,
    mcpUrl: null,
    healthUrl: null,
    serverPort: null,
    status: null,
    error: null,
    warning: null,
  },
  killed: {
    ports: [],
    patterns: [],
  },
}

const text = (...parts) => {
  if (asJson) return
  console.log(...parts)
}

const runSync = (cmd, cmdArgs, options = {}) => {
  return spawnSync(cmd, cmdArgs, {
    cwd: repoRoot,
    env: sharedEnv,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "ignore",
    shell: false,
  })
}

const resolveBunBinary = () => {
  const fromEnv = String(process.env.BUN_BINARY || "").trim()
  if (fromEnv) return fromEnv
  if (path.basename(process.execPath).toLowerCase().includes("bun")) {
    return process.execPath
  }
  const found = runSync("which", ["bun"], { capture: true })
  if (!found.error && found.status === 0) {
    const candidate = String(found.stdout || "").trim().split(/\s+/)[0]
    if (candidate) return candidate
  }
  return "bun"
}

const bunBinary = resolveBunBinary()

const parsePids = (value) =>
  String(value || "")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => /^\d+$/.test(item))

const syncBrowserosMcpConfig = (mcpUrl) => {
  if (!mcpUrl || typeof mcpUrl !== "string") return false
  try {
    fs.mkdirSync(path.dirname(USER_CONFIG_PATH), { recursive: true })
    let current = {}
    if (fs.existsSync(USER_CONFIG_PATH)) {
      const raw = fs.readFileSync(USER_CONFIG_PATH, "utf8").trim()
      if (raw) {
        current = JSON.parse(raw)
      }
    }
    current.mcp = current.mcp && typeof current.mcp === "object" ? current.mcp : {}
    current.mcp.browseros = {
      type: "remote",
      url: mcpUrl,
      enabled: true,
    }
    fs.writeFileSync(USER_CONFIG_PATH, `${JSON.stringify(current, null, 2)}\n`, "utf8")
    return true
  } catch (error) {
    text(`[restart-all] Warning: failed to sync browseros MCP config: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

const killPortListeners = (port) => {
  const found = runSync("lsof", ["-ti", `tcp:${port}`], { capture: true })
  if (found.error || found.status !== 0) return []
  const pids = parsePids(found.stdout)
  if (pids.length === 0) return []
  for (const pid of pids) {
    runSync("kill", ["-9", pid])
  }
  return pids
}

const killPattern = (pattern) => {
  const result = runSync("pkill", ["-f", pattern], { capture: true })
  return result.status === 0
}

const findDesktopAppPid = () => {
  const result = runSync("pgrep", ["-n", "-f", "openchamber-desktop"], { capture: true })
  if (result.error || result.status !== 0) return null
  const pids = parsePids(result.stdout)
  return pids.length > 0 ? Number(pids[0]) : null
}

const createLogPath = (name) => {
  const logDir = path.join(repoRoot, ".kronoscode", "runtime-logs")
  fs.mkdirSync(logDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  return path.join(logDir, `${name}-${stamp}.log`)
}

const spawnDetached = (command, cmdArgs, env = sharedEnv, logPath = null) => {
  const stdio = logPath
    ? ["ignore", fs.openSync(logPath, "a"), fs.openSync(logPath, "a")]
    : "ignore"
  const child = spawn(command, cmdArgs, {
    cwd: repoRoot,
    env,
    detached: true,
    stdio,
    shell: false,
  })
  child.unref()
  return child.pid ?? null
}

const isProcessAlive = (pid) => {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const runBrowserosSetup = (mode) => {
  if (!fs.existsSync(BROWSEROS_SETUP_SCRIPT)) {
    throw new Error(`KronosOS setup script not found: ${BROWSEROS_SETUP_SCRIPT}`)
  }
  const result = runSync(process.execPath, [BROWSEROS_SETUP_SCRIPT, mode], { capture: true })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim() || `exit code ${result.status ?? "unknown"}`
    throw new Error(detail)
  }
  const payloadText = String(result.stdout || "").trim()
  if (!payloadText) {
    throw new Error("KronosOS setup returned no output")
  }
  try {
    return JSON.parse(payloadText)
  } catch (error) {
    throw new Error(`Failed to parse KronosOS setup output: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const applyBrowserosStatus = (status, healthyOverride = null) => {
  const serverPort = Number(status?.serverPort || 0) || null
  const healthUrl = typeof status?.healthUrl === "string"
    ? status.healthUrl
    : (serverPort ? `http://127.0.0.1:${serverPort}/health` : null)
  const healthy = typeof healthyOverride === "boolean"
    ? healthyOverride
    : Boolean(status?.healthy)

  summary.browseros.started = true
  summary.browseros.serverPort = serverPort
  summary.browseros.healthUrl = healthUrl
  summary.browseros.mcpUrl = typeof status?.mcpUrl === "string" ? status.mcpUrl : null
  summary.browseros.status = status
  summary.browseros.running = Boolean(status?.running) || healthy
  summary.browseros.healthy = healthy
  summary.browseros.configSynced = syncBrowserosMcpConfig(summary.browseros.mcpUrl)
  summary.browseros.error = null
}

const waitForHttp = async (url, timeoutMs = 45000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(2500) })
      if (response.ok) {
        return true
      }
    } catch {
      // retry
    }
    await sleep(500)
  }
  return false
}

const waitForJson = async (url, timeoutMs = 45000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(2500) })
      if (response.ok) {
        return await response.json()
      }
    } catch {
      // retry
    }
    await sleep(500)
  }
  return null
}

const startAll = async () => {
  if (!noKill) {
    for (const port of [BACKEND_PORT, WEB_PORT, 3100]) {
      const killed = killPortListeners(port)
      if (killed.length > 0) {
        summary.killed.ports.push({ port, pids: killed })
      }
    }

    for (const pattern of ["kronoschamber-server", "openchamber-server", "browseros-agent-server", "kronoscode desktop", "openchamber-desktop", "tauri"]) {
      const killed = killPattern(pattern)
      if (killed) {
        summary.killed.patterns.push(pattern)
      }
    }
  }

  if (withBrowseros) {
    try {
      const started = runBrowserosSetup("start")
      const serverPort = Number(started?.serverPort || 0) || null
      const healthUrl = typeof started?.healthUrl === "string" ? started.healthUrl : (serverPort ? `http://127.0.0.1:${serverPort}/health` : null)
      const healthy = healthUrl ? await waitForHttp(healthUrl, 45_000) : false
      applyBrowserosStatus(started, healthy || Boolean(started?.healthy))
      summary.browseros.warning = null
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      summary.browseros.started = false
      summary.browseros.error = errorMessage
      summary.browseros.warning = null
      summary.browseros.running = false
      summary.browseros.healthy = false

      try {
        const status = runBrowserosSetup("status")
        const healthUrl = typeof status?.healthUrl === "string"
          ? status.healthUrl
          : (status?.serverPort ? `http://127.0.0.1:${status.serverPort}/health` : null)
        const healthy = healthUrl ? await waitForHttp(healthUrl, 15_000) : Boolean(status?.healthy)
        if (healthy || Boolean(status?.running)) {
          applyBrowserosStatus(status, healthy || Boolean(status?.healthy))
          summary.browseros.warning = `KronosOS start returned an install error, but an existing healthy service was detected: ${errorMessage}`
        }
      } catch {
        // keep the original error
      }
    }
  }

  const cliBinary = path.join(repoRoot, "packages", "kronoscode", "bin", "kronoscode")
  const backendLog = createLogPath("backend")
  summary.backend.log = backendLog
  const backendPid = fs.existsSync(cliBinary)
    ? spawnDetached(cliBinary, ["serve", "--port", String(BACKEND_PORT)], backendEnv, backendLog)
    : spawnDetached("kronoscode", ["serve", "--port", String(BACKEND_PORT)], backendEnv, backendLog)
  summary.backend.started = Boolean(backendPid)
  summary.backend.pid = backendPid
  summary.backend.running = isProcessAlive(backendPid)
  summary.backend.healthy = await waitForHttp(backendHealthUrl, 45_000)
  summary.backend.running = isProcessAlive(backendPid)

  if (!summary.backend.healthy) {
    return
  }

  const webLog = createLogPath("web")
  summary.web.log = webLog
  const webPid = spawnDetached(
    bunBinary,
    [
      "run",
      "--cwd",
      path.join(repoRoot, "packages", "web"),
      "dev:server",
    ],
    webEnv,
    webLog,
  )
  summary.web.started = Boolean(webPid)
  summary.web.pid = webPid
  summary.web.running = isProcessAlive(webPid)
  summary.web.healthy = await waitForHttp(webHealthUrl, 45_000)
  summary.web.running = isProcessAlive(webPid)
  summary.runtime.healthy = await waitForHttp(runtimeStatusUrl, withDesktop ? 90_000 : 45_000)
  if (summary.runtime.healthy) {
    const runtimeStatus = await waitForJson(runtimeStatusUrl, 10_000)
    const contractVersion =
      runtimeStatus && runtimeStatus.runtimeContract && typeof runtimeStatus.runtimeContract.version === "string"
        ? runtimeStatus.runtimeContract.version
        : null
    const contractBuildID =
      runtimeStatus && runtimeStatus.runtimeContract && typeof runtimeStatus.runtimeContract.buildID === "string"
        ? runtimeStatus.runtimeContract.buildID
        : null
    summary.runtime.contractVersion = contractVersion
    summary.runtime.contractBuildID = contractBuildID
    summary.runtime.contractMatch = contractVersion === RUNTIME_CONTRACT_VERSION
    if (!summary.runtime.contractMatch) {
      summary.runtime.healthy = false
      summary.runtime.error = contractVersion
        ? `runtime contract mismatch (expected ${RUNTIME_CONTRACT_VERSION}, got ${contractVersion})`
        : "runtime contract missing from /api/runtime/status"
    }
  }

  if (withBrowseros && !summary.browseros.started) {
    try {
      const started = runBrowserosSetup("start")
      const serverPort = Number(started?.serverPort || 0) || null
      const healthUrl = typeof started?.healthUrl === "string" ? started.healthUrl : (serverPort ? `http://127.0.0.1:${serverPort}/health` : null)
      const healthy = healthUrl ? await waitForHttp(healthUrl, 45_000) : false
      applyBrowserosStatus(started, healthy || Boolean(started?.healthy))
      summary.browseros.warning = null
    } catch (error) {
      summary.browseros.started = false
      summary.browseros.error = error instanceof Error ? error.message : String(error)
      summary.browseros.warning = null
      summary.browseros.running = false
      summary.browseros.healthy = false
    }
  }

  if (withDesktop) {
    const desktopStarterPid = fs.existsSync(cliBinary)
      ? spawnDetached(cliBinary, ["desktop"])
      : spawnDetached("kronoscode", ["desktop"])
    await sleep(3000)
    let desktopAppPid = findDesktopAppPid()
    if (desktopAppPid && !isProcessAlive(desktopAppPid)) {
      await sleep(1500)
      desktopAppPid = findDesktopAppPid()
    }
    summary.desktop.started = Boolean(desktopStarterPid || desktopAppPid)
    summary.desktop.pid = desktopAppPid ?? desktopStarterPid
  }
}

await startAll()

const ok = summary.backend.healthy && summary.web.healthy && summary.runtime.healthy && (!withBrowseros || summary.browseros.healthy)

if (asJson) {
  process.stdout.write(JSON.stringify({ ok, ...summary }, null, 2) + "\n")
} else {
  text("Kronos restart-all summary")
  text(`- Backend (${summary.backend.url}): ${summary.backend.healthy ? "healthy" : "unhealthy"}${summary.backend.pid ? ` [pid ${summary.backend.pid}]` : ""}${summary.backend.running ? "" : " [not running]"}${summary.backend.log ? ` [log ${summary.backend.log}]` : ""}`)
  text(`- Web (${summary.web.url}): ${summary.web.healthy ? "healthy" : "unhealthy"}${summary.web.pid ? ` [pid ${summary.web.pid}]` : ""}${summary.web.running ? "" : " [not running]"}${summary.web.log ? ` [log ${summary.web.log}]` : ""}`)
  text(`- Runtime status (${summary.runtime.url}): ${summary.runtime.healthy ? "healthy" : "unhealthy"} [contract ${summary.runtime.contractVersion || "missing"}; expected ${summary.runtime.expectedContractVersion}]${summary.runtime.error ? ` [error ${summary.runtime.error}]` : ""}`)
  if (withBrowseros) {
    text(`- KronosOS: ${summary.browseros.healthy ? "healthy" : "unhealthy"}${summary.browseros.serverPort ? ` [port ${summary.browseros.serverPort}]` : ""}${summary.browseros.mcpUrl ? ` [mcp ${summary.browseros.mcpUrl}]` : ""}${summary.browseros.warning ? ` [warning ${summary.browseros.warning}]` : ""}${summary.browseros.error ? ` [error ${summary.browseros.error}]` : ""}`)
  }
  if (withDesktop) {
    text(`- Desktop launch: ${summary.desktop.started ? "started" : "not started"}`)
  }
}

process.exit(ok ? 0 : 1)
