import { cmd } from "./cmd"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { MCP } from "../../mcp"
import { McpAuth } from "../../mcp/auth"
import { McpOAuthProvider } from "../../mcp/oauth-provider"
import { Config } from "../../config/config"
import { Instance } from "../../project/instance"
import { Installation } from "../../installation"
import path from "path"
import { Global } from "../../global"
import { modify, applyEdits } from "jsonc-parser"
import { Filesystem } from "../../util/filesystem"
import { Bus } from "../../bus"
import {
  assertMcpPolicyAllowed,
  isMcpPolicyAllowed,
  mcpPolicyErrorMessage,
  normalizeMcpPolicyName,
} from "../../mcp/policy"

function getAuthStatusIcon(status: MCP.AuthStatus): string {
  switch (status) {
    case "authenticated":
      return "✓"
    case "expired":
      return "⚠"
    case "not_authenticated":
      return "✗"
  }
}

function getAuthStatusText(status: MCP.AuthStatus): string {
  switch (status) {
    case "authenticated":
      return "authenticated"
    case "expired":
      return "expired"
    case "not_authenticated":
      return "not authenticated"
  }
}

type McpEntry = NonNullable<Config.Info["mcp"]>[string]

type McpConfigured = Config.Mcp
function isMcpConfigured(config: McpEntry): config is McpConfigured {
  return typeof config === "object" && config !== null && "type" in config
}

type McpRemote = Extract<McpConfigured, { type: "remote" }>
function isMcpRemote(config: McpEntry): config is McpRemote {
  return isMcpConfigured(config) && config.type === "remote"
}

type McpAddArgs = {
  preset?: string
  scope?: "user" | "project"
  name?: string
}

type OpenfangMcpPreset = {
  id: string
  name?: string
  transport?: {
    type?: string | null
    command?: string | null
    url?: string | null
    args?: unknown
  }
  requiredEnv?: unknown
}

const OPENFANG_PRESET_CATALOG_PATH = path.join("third_party", "generated", "openfang-mcp-presets.json")

const normalizeMcpName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")

const resolveConfiguredMcpEntry = (config: NonNullable<Config.Info["mcp"]> | undefined, requestedName: string) => {
  const normalized = normalizeMcpPolicyName(requestedName)
  if (!normalized || !config) return null
  for (const [rawName, rawEntry] of Object.entries(config)) {
    if (!isMcpConfigured(rawEntry)) continue
    if (normalizeMcpPolicyName(rawName) !== normalized) continue
    return { name: normalized, rawName, entry: rawEntry }
  }
  return null
}

const parseScopeArg = (value: unknown): "user" | "project" | undefined => {
  if (value === "user" || value === "project") return value
  return undefined
}

const parsePresetTransportType = (value: unknown): "remote" | "stdio" => {
  if (typeof value === "string" && value.trim().toLowerCase() === "remote") {
    return "remote"
  }
  return "stdio"
}

const parsePresetArgs = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

const parsePresetRequiredEnv = (value: unknown): Record<string, string> | undefined => {
  if (!Array.isArray(value)) return undefined

  const output = Object.fromEntries(
    value
      .filter((item) => typeof item === "object" && item !== null)
      .map((item) => (typeof (item as { name?: unknown }).name === "string" ? (item as { name: string }).name : ""))
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .map((name) => [name, ""]),
  )

  return Object.keys(output).length > 0 ? output : undefined
}

const resolvePresetCatalogPath = async (startDir: string): Promise<string | null> => {
  const matches = await Filesystem.findUp(OPENFANG_PRESET_CATALOG_PATH, startDir)
  return matches[0] ?? null
}

const loadOpenfangPresetCatalog = async (catalogPath: string): Promise<OpenfangMcpPreset[]> => {
  const raw = await Filesystem.readText(catalogPath)
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (item): item is OpenfangMcpPreset =>
      typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string",
  )
}

const configFromPreset = (preset: OpenfangMcpPreset): Config.Mcp => {
  const transport = preset.transport ?? {}
  const transportType = parsePresetTransportType(transport.type)

  if (transportType === "remote") {
    const url = typeof transport.url === "string" ? transport.url.trim() : ""
    if (!url || !URL.canParse(url)) {
      throw new Error(`Preset "${preset.id}" has an invalid remote URL`)
    }

    return {
      type: "remote",
      url,
    }
  }

  const command = typeof transport.command === "string" ? transport.command.trim() : ""
  const args = parsePresetArgs(transport.args)
  const commandVector = [command, ...args].filter((item) => item.length > 0)
  if (commandVector.length === 0) {
    throw new Error(`Preset "${preset.id}" is missing a local command`)
  }

  const environment = parsePresetRequiredEnv(preset.requiredEnv)

  return {
    type: "local",
    command: commandVector,
    ...(environment ? { environment } : {}),
  }
}

async function resolveConfigPathByScope(
  projectConfigPath: string,
  globalConfigPath: string,
  projectVcs: string | undefined,
  scope: "user" | "project" | undefined,
) {
  if (scope === "project") return projectConfigPath
  if (scope === "user") return globalConfigPath

  if (projectVcs === "git") {
    const scopeResult = await prompts.select({
      message: "Location",
      options: [
        {
          label: "Current project",
          value: projectConfigPath,
          hint: projectConfigPath,
        },
        {
          label: "Global",
          value: globalConfigPath,
          hint: globalConfigPath,
        },
      ],
    })
    if (prompts.isCancel(scopeResult)) throw new UI.CancelledError()
    return scopeResult
  }

  return globalConfigPath
}

export const McpCommand = cmd({
  command: "mcp",
  describe: "manage MCP (Model Context Protocol) servers",
  builder: (yargs) =>
    yargs
      .command(McpAddCommand)
      .command(McpListCommand)
      .command(McpAuthCommand)
      .command(McpLogoutCommand)
      .command(McpDebugCommand)
      .demandCommand(),
  async handler() {},
})

export const McpListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list MCP servers and their status",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("MCP Servers")

        const config = await Config.get()
        const mcpServers = config.mcp ?? {}
        const statuses = await MCP.status()

        const configuredServers = Object.entries(mcpServers).filter((entry): entry is [string, McpConfigured] =>
          isMcpConfigured(entry[1]),
        )
        const serversByName = new Map<string, McpConfigured>()
        let blockedCount = 0
        for (const [rawName, serverConfig] of configuredServers) {
          if (!isMcpPolicyAllowed(rawName)) {
            blockedCount += 1
            continue
          }
          const normalizedName = normalizeMcpPolicyName(rawName)
          if (!normalizedName || serversByName.has(normalizedName)) {
            continue
          }
          serversByName.set(normalizedName, serverConfig)
        }
        const servers = Array.from(serversByName.entries())

        if (servers.length === 0) {
          prompts.log.warn("No allowlisted MCP servers configured")
          if (blockedCount > 0) {
            prompts.log.info(`${blockedCount} blocked MCP server(s) were excluded by policy.`)
          }
          prompts.outro("Add servers with: kronoscode mcp add")
          return
        }

        if (blockedCount > 0) {
          prompts.log.warn(`${blockedCount} configured MCP server(s) are blocked by policy and hidden from active runtime.`)
        }

        for (const [name, serverConfig] of servers) {
          const status = statuses[name]
          const hasOAuth = isMcpRemote(serverConfig) && !!serverConfig.oauth
          const hasStoredTokens = await MCP.hasStoredTokens(name)

          let statusIcon: string
          let statusText: string
          let hint = ""

          if (!status) {
            statusIcon = "○"
            statusText = "not initialized"
          } else if (status.status === "connected") {
            statusIcon = "✓"
            statusText = "connected"
            if (hasOAuth && hasStoredTokens) {
              hint = " (OAuth)"
            }
          } else if (status.status === "disabled") {
            statusIcon = "○"
            statusText = "disabled"
          } else if (status.status === "needs_auth") {
            statusIcon = "⚠"
            statusText = "needs authentication"
          } else if (status.status === "needs_client_registration") {
            statusIcon = "✗"
            statusText = "needs client registration"
            hint = "\n    " + status.error
          } else {
            statusIcon = "✗"
            statusText = "failed"
            hint = "\n    " + status.error
          }

          const typeHint = serverConfig.type === "remote" ? serverConfig.url : serverConfig.command.join(" ")
          prompts.log.info(
            `${statusIcon} ${name} ${UI.Style.TEXT_DIM}${statusText}${hint}\n    ${UI.Style.TEXT_DIM}${typeHint}`,
          )
        }

        prompts.outro(`${servers.length} server(s)`)
      },
    })
  },
})

export const McpAuthCommand = cmd({
  command: "auth [name]",
  describe: "authenticate with an OAuth-enabled MCP server",
  builder: (yargs) =>
    yargs
      .positional("name", {
        describe: "name of the MCP server",
        type: "string",
      })
      .command(McpAuthListCommand),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("MCP OAuth Authentication")

        const config = await Config.get()
        const mcpServers = config.mcp ?? {}

        // Get OAuth-capable servers (remote servers with oauth not explicitly disabled)
        const oauthServers = Object.entries(mcpServers).filter(
          (entry): entry is [string, McpRemote] =>
            isMcpRemote(entry[1]) && entry[1].oauth !== false && isMcpPolicyAllowed(entry[0]),
        )

        if (oauthServers.length === 0) {
          prompts.log.warn("No OAuth-capable MCP servers configured")
          prompts.log.info("Remote MCP servers support OAuth by default. Add a remote server in kronoscode.json:")
          prompts.log.info(`
  "mcp": {
    "my-server": {
      "type": "remote",
      "url": "https://example.com/mcp"
    }
  }`)
          prompts.outro("Done")
          return
        }

        let serverName = args.name
        if (serverName) {
          try {
            serverName = assertMcpPolicyAllowed(serverName)
          } catch (error) {
            prompts.log.error(error instanceof Error ? error.message : mcpPolicyErrorMessage(serverName))
            prompts.outro("Done")
            return
          }
        }
        if (!serverName) {
          // Build options with auth status
          const options = await Promise.all(
            oauthServers.map(async ([rawName, cfg]) => {
              const name = normalizeMcpPolicyName(rawName)
              const authStatus = await MCP.getAuthStatus(name)
              const icon = getAuthStatusIcon(authStatus)
              const statusText = getAuthStatusText(authStatus)
              const url = cfg.url
              return {
                label: `${icon} ${name} (${statusText})`,
                value: name,
                hint: url,
              }
            }),
          )

          const selected = await prompts.select({
            message: "Select MCP server to authenticate",
            options,
          })
          if (prompts.isCancel(selected)) throw new UI.CancelledError()
          serverName = selected
        }

        const serverEntry = resolveConfiguredMcpEntry(mcpServers, serverName)
        if (!serverEntry) {
          prompts.log.error(`MCP server not found: ${serverName}`)
          prompts.outro("Done")
          return
        }
        serverName = serverEntry.name
        const serverConfig = serverEntry.entry

        if (!isMcpRemote(serverConfig) || serverConfig.oauth === false) {
          prompts.log.error(`MCP server ${serverName} is not an OAuth-capable remote server`)
          prompts.outro("Done")
          return
        }

        // Check if already authenticated
        const authStatus = await MCP.getAuthStatus(serverName)
        if (authStatus === "authenticated") {
          const confirm = await prompts.confirm({
            message: `${serverName} already has valid credentials. Re-authenticate?`,
          })
          if (prompts.isCancel(confirm) || !confirm) {
            prompts.outro("Cancelled")
            return
          }
        } else if (authStatus === "expired") {
          prompts.log.warn(`${serverName} has expired credentials. Re-authenticating...`)
        }

        const spinner = prompts.spinner()
        spinner.start("Starting OAuth flow...")

        // Subscribe to browser open failure events to show URL for manual opening
        const unsubscribe = Bus.subscribe(MCP.BrowserOpenFailed, (evt) => {
          if (evt.properties.mcpName === serverName) {
            spinner.stop("Could not open browser automatically")
            prompts.log.warn("Please open this URL in your browser to authenticate:")
            prompts.log.info(evt.properties.url)
            spinner.start("Waiting for authorization...")
          }
        })

        try {
          const status = await MCP.authenticate(serverName)

          if (status.status === "connected") {
            spinner.stop("Authentication successful!")
          } else if (status.status === "needs_client_registration") {
            spinner.stop("Authentication failed", 1)
            prompts.log.error(status.error)
            prompts.log.info("Add clientId to your MCP server config:")
            prompts.log.info(`
  "mcp": {
    "${serverName}": {
      "type": "remote",
      "url": "${serverConfig.url}",
      "oauth": {
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret"
      }
    }
  }`)
          } else if (status.status === "failed") {
            spinner.stop("Authentication failed", 1)
            prompts.log.error(status.error)
          } else {
            spinner.stop("Unexpected status: " + status.status, 1)
          }
        } catch (error) {
          spinner.stop("Authentication failed", 1)
          prompts.log.error(error instanceof Error ? error.message : String(error))
        } finally {
          unsubscribe()
        }

        prompts.outro("Done")
      },
    })
  },
})

export const McpAuthListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list OAuth-capable MCP servers and their auth status",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("MCP OAuth Status")

        const config = await Config.get()
        const mcpServers = config.mcp ?? {}

        // Get OAuth-capable servers
        const oauthServers = Object.entries(mcpServers).filter(
          (entry): entry is [string, McpRemote] =>
            isMcpRemote(entry[1]) && entry[1].oauth !== false && isMcpPolicyAllowed(entry[0]),
        )

        if (oauthServers.length === 0) {
          prompts.log.warn("No OAuth-capable MCP servers configured")
          prompts.outro("Done")
          return
        }

        for (const [rawName, serverConfig] of oauthServers) {
          const name = normalizeMcpPolicyName(rawName)
          const authStatus = await MCP.getAuthStatus(name)
          const icon = getAuthStatusIcon(authStatus)
          const statusText = getAuthStatusText(authStatus)
          const url = serverConfig.url

          prompts.log.info(`${icon} ${name} ${UI.Style.TEXT_DIM}${statusText}\n    ${UI.Style.TEXT_DIM}${url}`)
        }

        prompts.outro(`${oauthServers.length} OAuth-capable server(s)`)
      },
    })
  },
})

export const McpLogoutCommand = cmd({
  command: "logout [name]",
  describe: "remove OAuth credentials for an MCP server",
  builder: (yargs) =>
    yargs.positional("name", {
      describe: "name of the MCP server",
      type: "string",
    }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("MCP OAuth Logout")

        const credentials = await McpAuth.all()
        const credentialsByName = Object.fromEntries(
          Object.entries(credentials)
            .map(([rawName, entry]) => [normalizeMcpPolicyName(rawName), entry] as const)
            .filter(([name]) => name.length > 0 && isMcpPolicyAllowed(name)),
        ) as Record<string, (typeof credentials)[string]>
        const serverNames = Object.keys(credentialsByName)

        if (serverNames.length === 0) {
          prompts.log.warn("No allowlisted MCP OAuth credentials stored")
          prompts.outro("Done")
          return
        }

        let serverName = args.name
        if (serverName) {
          try {
            serverName = assertMcpPolicyAllowed(serverName)
          } catch (error) {
            prompts.log.error(error instanceof Error ? error.message : mcpPolicyErrorMessage(serverName))
            prompts.outro("Done")
            return
          }
        }
        if (!serverName) {
          const selected = await prompts.select({
            message: "Select MCP server to logout",
            options: serverNames.map((name) => {
              const entry = credentialsByName[name]
              const hasTokens = !!entry.tokens
              const hasClient = !!entry.clientInfo
              let hint = ""
              if (hasTokens && hasClient) hint = "tokens + client"
              else if (hasTokens) hint = "tokens"
              else if (hasClient) hint = "client registration"
              return {
                label: name,
                value: name,
                hint,
              }
            }),
          })
          if (prompts.isCancel(selected)) throw new UI.CancelledError()
          serverName = selected
        }

        if (!credentialsByName[serverName]) {
          prompts.log.error(`No credentials found for: ${serverName}`)
          prompts.outro("Done")
          return
        }

        await MCP.removeAuth(serverName)
        prompts.log.success(`Removed OAuth credentials for ${serverName}`)
        prompts.outro("Done")
      },
    })
  },
})

async function resolveConfigPath(baseDir: string, global = false) {
  // Check for existing config files (prefer .jsonc over .json, check .kronoscode/ subdirectory too)
  const candidates = [path.join(baseDir, "kronoscode.json"), path.join(baseDir, "kronoscode.jsonc")]

  if (!global) {
    candidates.push(path.join(baseDir, ".kronoscode", "kronoscode.json"), path.join(baseDir, ".kronoscode", "kronoscode.jsonc"))
  }

  for (const candidate of candidates) {
    if (await Filesystem.exists(candidate)) {
      return candidate
    }
  }

  // Default to kronoscode.json if none exist
  return candidates[0]
}

async function addMcpToConfig(name: string, mcpConfig: Config.Mcp, configPath: string) {
  let text = "{}"
  if (await Filesystem.exists(configPath)) {
    text = await Filesystem.readText(configPath)
  }

  // Use jsonc-parser to modify while preserving comments
  const edits = modify(text, ["mcp", name], mcpConfig, {
    formattingOptions: { tabSize: 2, insertSpaces: true },
  })
  const result = applyEdits(text, edits)

  await Filesystem.write(configPath, result)

  return configPath
}

export const McpAddCommand = cmd({
  command: "add",
  describe: "add an MCP server",
  builder: (yargs) =>
    yargs
      .option("preset", {
        type: "string",
        describe: "OpenFang preset ID from third_party/generated/openfang-mcp-presets.json",
      })
      .option("scope", {
        type: "string",
        choices: ["user", "project"] as const,
        describe: "Scope for config update (default prompts in git projects)",
      })
      .option("name", {
        type: "string",
        describe: "Override MCP server name when used with --preset",
      }),
  async handler(args: McpAddArgs) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Add MCP server")

        const project = Instance.project

        // Resolve config paths eagerly for hints
        const [projectConfigPath, globalConfigPath] = await Promise.all([
          resolveConfigPath(Instance.worktree),
          resolveConfigPath(Global.Path.config, true),
        ])

        const requestedScope = parseScopeArg(args.scope)

        if (typeof args.preset === "string" && args.preset.trim().length > 0) {
          const configPath = await resolveConfigPathByScope(projectConfigPath, globalConfigPath, project.vcs, requestedScope)
          const presetCatalogPath = await resolvePresetCatalogPath(Instance.directory)
          if (!presetCatalogPath) {
            prompts.log.error(`Preset catalog not found: ${OPENFANG_PRESET_CATALOG_PATH}`)
            prompts.log.info("Run scripts/sync-upstream-integrations.mjs to generate preset artifacts.")
            prompts.outro("Done")
            return
          }

          const presetID = args.preset.trim()
          const presets = await loadOpenfangPresetCatalog(presetCatalogPath)
          const preset = presets.find((entry) => entry.id === presetID || entry.id.toLowerCase() === presetID.toLowerCase())
          if (!preset) {
            const sample = presets.slice(0, 12).map((entry) => entry.id).join(", ")
            prompts.log.error(`Preset not found: ${presetID}`)
            if (sample) {
              prompts.log.info(`Available presets: ${sample}${presets.length > 12 ? ", ..." : ""}`)
            }
            prompts.outro("Done")
            return
          }

          const candidateName = normalizeMcpName(typeof args.name === "string" ? args.name : preset.id)
          if (!candidateName) {
            prompts.log.error("Preset server name resolved to an empty value. Use --name with a valid identifier.")
            prompts.outro("Done")
            return
          }
          let resolvedName: string
          try {
            resolvedName = assertMcpPolicyAllowed(candidateName)
          } catch (error) {
            prompts.log.error(error instanceof Error ? error.message : mcpPolicyErrorMessage(candidateName))
            prompts.outro("Done")
            return
          }

          const config = await Config.get()
          if (resolveConfiguredMcpEntry(config.mcp, resolvedName)) {
            prompts.log.error(`MCP server "${resolvedName}" already exists`)
            prompts.log.info("Use --name <server-name> to install the preset under a different id.")
            prompts.outro("Done")
            return
          }

          const mcpConfig = configFromPreset(preset)
          await addMcpToConfig(resolvedName, mcpConfig, configPath)
          prompts.log.success(`MCP preset "${preset.id}" added as "${resolvedName}" to ${configPath}`)

          if (mcpConfig.type === "local" && mcpConfig.environment) {
            const requiredEnv = Object.keys(mcpConfig.environment)
            if (requiredEnv.length > 0) {
              prompts.log.info(`Required env vars initialized: ${requiredEnv.join(", ")}`)
            }
          }

          prompts.outro("MCP server added successfully")
          return
        }

        const configPath = await resolveConfigPathByScope(projectConfigPath, globalConfigPath, project.vcs, requestedScope)

        const enteredName = await prompts.text({
          message: "Enter MCP server name",
          validate: (x) => (x && x.length > 0 ? undefined : "Required"),
        })
        if (prompts.isCancel(enteredName)) throw new UI.CancelledError()

        const normalizedName = normalizeMcpName(enteredName)
        if (!normalizedName) {
          prompts.log.error("MCP server name must contain letters, numbers, hyphens, or underscores.")
          prompts.outro("Done")
          return
        }
        let name: string
        try {
          name = assertMcpPolicyAllowed(normalizedName)
        } catch (error) {
          prompts.log.error(error instanceof Error ? error.message : mcpPolicyErrorMessage(normalizedName))
          prompts.outro("Done")
          return
        }

        const existingConfig = await Config.get()
        if (resolveConfiguredMcpEntry(existingConfig.mcp, name)) {
          prompts.log.error(`MCP server "${name}" already exists`)
          prompts.outro("Done")
          return
        }

        const type = await prompts.select({
          message: "Select MCP server type",
          options: [
            {
              label: "Local",
              value: "local",
              hint: "Run a local command",
            },
            {
              label: "Remote",
              value: "remote",
              hint: "Connect to a remote URL",
            },
          ],
        })
        if (prompts.isCancel(type)) throw new UI.CancelledError()

        if (type === "local") {
          const command = await prompts.text({
            message: "Enter command to run",
            placeholder: "e.g., kronoscode x @modelcontextprotocol/server-filesystem",
            validate: (x) => (x && x.length > 0 ? undefined : "Required"),
          })
          if (prompts.isCancel(command)) throw new UI.CancelledError()

          const mcpConfig: Config.Mcp = {
            type: "local",
            command: command.split(" "),
          }

          await addMcpToConfig(name, mcpConfig, configPath)
          prompts.log.success(`MCP server "${name}" added to ${configPath}`)
          prompts.outro("MCP server added successfully")
          return
        }

        if (type === "remote") {
          const url = await prompts.text({
            message: "Enter MCP server URL",
            placeholder: "e.g., https://example.com/mcp",
            validate: (x) => {
              if (!x) return "Required"
              if (x.length === 0) return "Required"
              const isValid = URL.canParse(x)
              return isValid ? undefined : "Invalid URL"
            },
          })
          if (prompts.isCancel(url)) throw new UI.CancelledError()

          const useOAuth = await prompts.confirm({
            message: "Does this server require OAuth authentication?",
            initialValue: false,
          })
          if (prompts.isCancel(useOAuth)) throw new UI.CancelledError()

          let mcpConfig: Config.Mcp

          if (useOAuth) {
            const hasClientId = await prompts.confirm({
              message: "Do you have a pre-registered client ID?",
              initialValue: false,
            })
            if (prompts.isCancel(hasClientId)) throw new UI.CancelledError()

            if (hasClientId) {
              const clientId = await prompts.text({
                message: "Enter client ID",
                validate: (x) => (x && x.length > 0 ? undefined : "Required"),
              })
              if (prompts.isCancel(clientId)) throw new UI.CancelledError()

              const hasSecret = await prompts.confirm({
                message: "Do you have a client secret?",
                initialValue: false,
              })
              if (prompts.isCancel(hasSecret)) throw new UI.CancelledError()

              let clientSecret: string | undefined
              if (hasSecret) {
                const secret = await prompts.password({
                  message: "Enter client secret",
                })
                if (prompts.isCancel(secret)) throw new UI.CancelledError()
                clientSecret = secret
              }

              mcpConfig = {
                type: "remote",
                url,
                oauth: {
                  clientId,
                  ...(clientSecret && { clientSecret }),
                },
              }
            } else {
              mcpConfig = {
                type: "remote",
                url,
                oauth: {},
              }
            }
          } else {
            mcpConfig = {
              type: "remote",
              url,
            }
          }

          await addMcpToConfig(name, mcpConfig, configPath)
          prompts.log.success(`MCP server "${name}" added to ${configPath}`)
        }

        prompts.outro("MCP server added successfully")
      },
    })
  },
})

export const McpDebugCommand = cmd({
  command: "debug <name>",
  describe: "debug OAuth connection for an MCP server",
  builder: (yargs) =>
    yargs.positional("name", {
      describe: "name of the MCP server",
      type: "string",
      demandOption: true,
    }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("MCP OAuth Debug")

        const config = await Config.get()
        const mcpServers = config.mcp ?? {}
        let serverName: string
        try {
          serverName = assertMcpPolicyAllowed(args.name)
        } catch (error) {
          prompts.log.error(error instanceof Error ? error.message : mcpPolicyErrorMessage(args.name))
          prompts.outro("Done")
          return
        }

        const serverEntry = resolveConfiguredMcpEntry(mcpServers, serverName)
        if (!serverEntry) {
          prompts.log.error(`MCP server not found: ${serverName}`)
          prompts.outro("Done")
          return
        }
        const serverConfig = serverEntry.entry

        if (!isMcpRemote(serverConfig)) {
          prompts.log.error(`MCP server ${serverName} is not a remote server`)
          prompts.outro("Done")
          return
        }

        if (serverConfig.oauth === false) {
          prompts.log.warn(`MCP server ${serverName} has OAuth explicitly disabled`)
          prompts.outro("Done")
          return
        }

        prompts.log.info(`Server: ${serverName}`)
        prompts.log.info(`URL: ${serverConfig.url}`)

        // Check stored auth status
        const authStatus = await MCP.getAuthStatus(serverName)
        prompts.log.info(`Auth status: ${getAuthStatusIcon(authStatus)} ${getAuthStatusText(authStatus)}`)

        const entry = await McpAuth.get(serverName)
        if (entry?.tokens) {
          prompts.log.info(`  Access token: ${entry.tokens.accessToken.substring(0, 20)}...`)
          if (entry.tokens.expiresAt) {
            const expiresDate = new Date(entry.tokens.expiresAt * 1000)
            const isExpired = entry.tokens.expiresAt < Date.now() / 1000
            prompts.log.info(`  Expires: ${expiresDate.toISOString()} ${isExpired ? "(EXPIRED)" : ""}`)
          }
          if (entry.tokens.refreshToken) {
            prompts.log.info(`  Refresh token: present`)
          }
        }
        if (entry?.clientInfo) {
          prompts.log.info(`  Client ID: ${entry.clientInfo.clientId}`)
          if (entry.clientInfo.clientSecretExpiresAt) {
            const expiresDate = new Date(entry.clientInfo.clientSecretExpiresAt * 1000)
            prompts.log.info(`  Client secret expires: ${expiresDate.toISOString()}`)
          }
        }

        const spinner = prompts.spinner()
        spinner.start("Testing connection...")

        // Test basic HTTP connectivity first
        try {
          const response = await fetch(serverConfig.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json, text/event-stream",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "initialize",
              params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "kronoscode-debug", version: Installation.VERSION },
              },
              id: 1,
            }),
          })

          spinner.stop(`HTTP response: ${response.status} ${response.statusText}`)

          // Check for WWW-Authenticate header
          const wwwAuth = response.headers.get("www-authenticate")
          if (wwwAuth) {
            prompts.log.info(`WWW-Authenticate: ${wwwAuth}`)
          }

          if (response.status === 401) {
            prompts.log.warn("Server returned 401 Unauthorized")

            // Try to discover OAuth metadata
            const oauthConfig = typeof serverConfig.oauth === "object" ? serverConfig.oauth : undefined
            const authProvider = new McpOAuthProvider(
              serverName,
              serverConfig.url,
              {
                clientId: oauthConfig?.clientId,
                clientSecret: oauthConfig?.clientSecret,
                scope: oauthConfig?.scope,
              },
              {
                onRedirect: async () => {},
              },
            )

            prompts.log.info("Testing OAuth flow (without completing authorization)...")

            // Try creating transport with auth provider to trigger discovery
            const transport = new StreamableHTTPClientTransport(new URL(serverConfig.url), {
              authProvider,
            })

            try {
              const client = new Client({
                name: "kronoscode-debug",
                version: Installation.VERSION,
              })
              await client.connect(transport)
              prompts.log.success("Connection successful (already authenticated)")
              await client.close()
            } catch (error) {
              if (error instanceof UnauthorizedError) {
                prompts.log.info(`OAuth flow triggered: ${error.message}`)

                // Check if dynamic registration would be attempted
                const clientInfo = await authProvider.clientInformation()
                if (clientInfo) {
                  prompts.log.info(`Client ID available: ${clientInfo.client_id}`)
                } else {
                  prompts.log.info("No client ID - dynamic registration will be attempted")
                }
              } else {
                prompts.log.error(`Connection error: ${error instanceof Error ? error.message : String(error)}`)
              }
            }
          } else if (response.status >= 200 && response.status < 300) {
            prompts.log.success("Server responded successfully (no auth required or already authenticated)")
            const body = await response.text()
            try {
              const json = JSON.parse(body)
              if (json.result?.serverInfo) {
                prompts.log.info(`Server info: ${JSON.stringify(json.result.serverInfo)}`)
              }
            } catch {
              // Not JSON, ignore
            }
          } else {
            prompts.log.warn(`Unexpected status: ${response.status}`)
            const body = await response.text().catch(() => "")
            if (body) {
              prompts.log.info(`Response body: ${body.substring(0, 500)}`)
            }
          }
        } catch (error) {
          spinner.stop("Connection failed", 1)
          prompts.log.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
        }

        prompts.outro("Debug complete")
      },
    })
  },
})
