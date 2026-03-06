#!/usr/bin/env node

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")

const args = new Set(process.argv.slice(2))
const asJson = args.has("--json")
const strict = args.has("--strict")
const skipBrowseros = args.has("--skip-browseros")

const userConfigPath = path.join(os.homedir(), ".config", "kronoscode", "kronoscode.json")
const browserosSetupScript = path.join(repoRoot, "scripts", "setup-browseros-agent.mjs")
const localCliPath = path.join(repoRoot, "packages", "kronoscode", "bin", "kronoscode")

const summary = {
  ok: true,
  cli: {
    resolved: null,
    globalAssetsSynced: false,
    message: null,
  },
  browseros: {
    skipped: skipBrowseros,
    setupAvailable: false,
    mcpUrl: null,
    configSynced: false,
    message: null,
  },
}

const text = (...parts) => {
  if (!asJson) console.log(...parts)
}

const runSync = (command, commandArgs, options = {}) =>
  spawnSync(command, commandArgs, {
    cwd: options.cwd || repoRoot,
    env: options.env || process.env,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: false,
  })

const toErrorMessage = (error, fallback) => {
  if (error instanceof Error && error.message.trim().length > 0) return error.message
  return fallback
}

const parseJson = (value) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const resolveCliPath = () => {
  const candidates = [
    process.env.KRONOSCODE_BINARY,
    process.env.KRONOSCHAMBER_KRONOSCODE_PATH,
    localCliPath,
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0 && fs.existsSync(candidate)) {
      return candidate
    }
  }

  const locator = process.platform === "win32" ? "where" : "which"
  const found = runSync(locator, ["kronoscode"], { capture: true })
  if (!found.error && found.status === 0) {
    const first = String(found.stdout || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find(Boolean)
    if (first) return first
  }

  return null
}

const syncGlobalAssets = (cliPath) => {
  if (!cliPath) {
    summary.cli.message = "kronoscode binary not found; skipped global asset sync."
    return
  }

  summary.cli.resolved = cliPath
  const result = runSync(cliPath, ["debug", "sync-global-assets"], { capture: true })
  if (result.error || result.status !== 0) {
    summary.ok = false
    summary.cli.globalAssetsSynced = false
    summary.cli.message =
      toErrorMessage(result.error, String(result.stderr || result.stdout || "sync-global-assets failed").trim()) ||
      "sync-global-assets failed"
    return
  }

  summary.cli.globalAssetsSynced = true
  summary.cli.message = "global assets synced"
}

const readUserConfig = () => {
  if (!fs.existsSync(userConfigPath)) return {}
  const raw = fs.readFileSync(userConfigPath, "utf8").trim()
  if (!raw) return {}
  const parsed = parseJson(raw)
  return parsed && typeof parsed === "object" ? parsed : {}
}

const writeUserConfig = (config) => {
  fs.mkdirSync(path.dirname(userConfigPath), { recursive: true })
  fs.writeFileSync(userConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
}

const syncBrowserosMcpConfig = (mcpUrl) => {
  if (!mcpUrl || typeof mcpUrl !== "string") {
    summary.browseros.message = "KronosOS MCP URL missing; skipped MCP config sync."
    return
  }

  const config = readUserConfig()
  const currentMcp = config.mcp && typeof config.mcp === "object" ? config.mcp : {}
  config.mcp = {
    ...currentMcp,
    browseros: {
      type: "remote",
      url: mcpUrl,
      enabled: true,
    },
  }
  writeUserConfig(config)
  summary.browseros.configSynced = true
  summary.browseros.message = "KronosOS MCP config synced"
}

const resolveBrowserosStatus = () => {
  if (skipBrowseros) return

  summary.browseros.setupAvailable = fs.existsSync(browserosSetupScript)
  if (!summary.browseros.setupAvailable) {
    summary.browseros.message = `setup script missing: ${browserosSetupScript}`
    return
  }

  const result = runSync(process.execPath, [browserosSetupScript, "status"], { capture: true })
  if (result.error || result.status !== 0) {
    summary.browseros.message =
      toErrorMessage(result.error, String(result.stderr || result.stdout || "status failed").trim()) || "status failed"
    return
  }

  const parsed = parseJson(String(result.stdout || "").trim())
  if (!parsed || typeof parsed !== "object") {
    summary.browseros.message = "setup status returned invalid JSON"
    return
  }

  const mcpUrl = typeof parsed.mcpUrl === "string" && parsed.mcpUrl.trim().length > 0 ? parsed.mcpUrl.trim() : null
  summary.browseros.mcpUrl = mcpUrl
  syncBrowserosMcpConfig(mcpUrl)
}

const main = () => {
  const cliPath = resolveCliPath()
  syncGlobalAssets(cliPath)
  resolveBrowserosStatus()

  if (strict && !summary.ok) {
    if (asJson) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
    } else {
      text("[apply-config] failed:", summary.cli.message || "unknown error")
    }
    process.exit(1)
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
    return
  }

  text("[apply-config] complete")
  text(`- cli: ${summary.cli.message || "no changes"}`)
  if (!summary.browseros.skipped) {
    text(`- browseros: ${summary.browseros.message || "no changes"}`)
    if (summary.browseros.mcpUrl) {
      text(`- browseros mcp: ${summary.browseros.mcpUrl}`)
    }
  }
}

try {
  main()
} catch (error) {
  const message = toErrorMessage(error, "apply-kronos-config failed")
  if (asJson) {
    summary.ok = false
    summary.cli.message = summary.cli.message || message
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } else {
    console.error("[apply-config] error:", message)
  }
  process.exit(strict ? 1 : 0)
}
