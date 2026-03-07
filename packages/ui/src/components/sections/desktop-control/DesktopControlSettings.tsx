import React from "react"
import {
  RiArrowRightLine,
  RiCheckLine,
  RiComputerLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiPlug2Line,
  RiPlayCircleLine,
  RiRefreshLine,
  RiRobot2Line,
  RiStopCircleLine,
  RiTerminalLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  DESKTOP_CONTROL_MCP_SERVERS,
  getDesktopControlKnowledge,
  type DesktopControlKnowledge,
  type DesktopControlMcpServer,
} from "@/lib/desktop-control"
import { useMcpStore } from "@/stores/useMcpStore"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useSessionStore } from "@/stores/useSessionStore"
import { useUIStore } from "@/stores/useUIStore"
import { updateDesktopSettings } from "@/lib/persistence"

interface DesktopControlSettingsProps {
  className?: string
}

const MCP_SERVER_ORDER = ["browseros", "computer-use-mcp", "automation-mcp"] as const

const statusTone = (status?: string) => {
  if (status === "connected") return "success"
  if (status === "failed") return "error"
  if (status === "needs_auth" || status === "needs_client_registration") return "warning"
  return "default"
}

const statusLabel = (status?: string) => {
  if (status === "connected") return "Connected"
  if (status === "failed") return "Failed"
  if (status === "needs_auth") return "Needs auth"
  if (status === "needs_client_registration") return "Needs registration"
  return "Disconnected"
}

const toneClass = (tone: string) => {
  if (tone === "success") return "bg-status-success"
  if (tone === "error") return "bg-status-error"
  if (tone === "warning") return "bg-status-warning"
  return "bg-muted-foreground/40"
}

const CatalogCard = ({ server }: { server: DesktopControlMcpServer }) => (
  <div className="flex items-start gap-4 rounded-xl border border-border/50 p-4">
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
      <RiComputerLine className="h-5 w-5 text-primary" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center gap-2">
        <h4 className="truncate font-medium">{server.name}</h4>
        <Badge variant="secondary" className="text-xs">
          {server.language}
        </Badge>
      </div>
      <p className="mb-2 text-sm text-muted-foreground">{server.description}</p>
      <code className="text-xs text-muted-foreground">{server.installCommand}</code>
    </div>
  </div>
)

type IntegrationSettings = {
  screenpipeEnabled: boolean
  screenpipeAutoContext: boolean
  openfangEnabled: boolean
  openfangCliCommand: string
  openfangAutoConfigureMcp: boolean
  desktopQuickAssistEnabled: boolean
  desktopQuickAssistTemplatesEnabled: boolean
  desktopHoverAssistEnabled: boolean
  desktopHoverAutoShowOnTaskSend: boolean
  desktopHoverAlwaysOnTop: boolean
}

const defaultIntegrationSettings: IntegrationSettings = {
  screenpipeEnabled: true,
  screenpipeAutoContext: true,
  openfangEnabled: false,
  openfangCliCommand: "openfang",
  openfangAutoConfigureMcp: false,
  desktopQuickAssistEnabled: false,
  desktopQuickAssistTemplatesEnabled: false,
  desktopHoverAssistEnabled: false,
  desktopHoverAutoShowOnTaskSend: true,
  desktopHoverAlwaysOnTop: true,
}

type OpenfangStatus = {
  enabled: boolean
  cliDetected: boolean
  command: string
  daemonHealthy: boolean
  daemonUrl: string
  mcpConfigured: boolean
  mcpConnected: boolean
  managedProcess?: {
    running: boolean
    pid: number | null
    startedAt: number | null
  } | null
  lastError?: string | null
}

const parseIntegrationSettings = (payload: unknown): IntegrationSettings => {
  if (!payload || typeof payload !== "object") {
    return defaultIntegrationSettings
  }

  const candidate = payload as Record<string, unknown>
  return {
    screenpipeEnabled:
      typeof candidate.screenpipeEnabled === "boolean"
        ? candidate.screenpipeEnabled
        : defaultIntegrationSettings.screenpipeEnabled,
    screenpipeAutoContext:
      typeof candidate.screenpipeAutoContext === "boolean"
        ? candidate.screenpipeAutoContext
        : defaultIntegrationSettings.screenpipeAutoContext,
    openfangEnabled:
      typeof candidate.openfangEnabled === "boolean"
        ? candidate.openfangEnabled
        : defaultIntegrationSettings.openfangEnabled,
    openfangCliCommand:
      typeof candidate.openfangCliCommand === "string" && candidate.openfangCliCommand.trim().length > 0
        ? candidate.openfangCliCommand.trim()
        : defaultIntegrationSettings.openfangCliCommand,
    openfangAutoConfigureMcp:
      typeof candidate.openfangAutoConfigureMcp === "boolean"
        ? candidate.openfangAutoConfigureMcp
        : defaultIntegrationSettings.openfangAutoConfigureMcp,
    desktopQuickAssistEnabled:
      typeof candidate.desktopQuickAssistEnabled === "boolean"
        ? candidate.desktopQuickAssistEnabled
        : defaultIntegrationSettings.desktopQuickAssistEnabled,
    desktopQuickAssistTemplatesEnabled:
      typeof candidate.desktopQuickAssistTemplatesEnabled === "boolean"
        ? candidate.desktopQuickAssistTemplatesEnabled
        : defaultIntegrationSettings.desktopQuickAssistTemplatesEnabled,
    desktopHoverAssistEnabled:
      typeof candidate.desktopHoverAssistEnabled === "boolean"
        ? candidate.desktopHoverAssistEnabled
        : defaultIntegrationSettings.desktopHoverAssistEnabled,
    desktopHoverAutoShowOnTaskSend:
      typeof candidate.desktopHoverAutoShowOnTaskSend === "boolean"
        ? candidate.desktopHoverAutoShowOnTaskSend
        : defaultIntegrationSettings.desktopHoverAutoShowOnTaskSend,
    desktopHoverAlwaysOnTop:
      typeof candidate.desktopHoverAlwaysOnTop === "boolean"
        ? candidate.desktopHoverAlwaysOnTop
        : defaultIntegrationSettings.desktopHoverAlwaysOnTop,
  }
}

export function DesktopControlSettings({ className }: DesktopControlSettingsProps) {
  const directory = useDirectoryStore((state) => state.currentDirectory)
  const mcpStatus = useMcpStore((state) => state.getStatusForDirectory(directory))
  const refreshMcp = useMcpStore((state) => state.refresh)
  const connect = useMcpStore((state) => state.connect)
  const disconnect = useMcpStore((state) => state.disconnect)
  const setPendingInputText = useSessionStore((state) => state.setPendingInputText)
  const setActiveMainTab = useUIStore((state) => state.setActiveMainTab)

  const [knowledge, setKnowledge] = React.useState<DesktopControlKnowledge | null>(null)
  const [loadingStatus, setLoadingStatus] = React.useState(false)
  const [togglingServer, setTogglingServer] = React.useState<string | null>(null)
  const [showAll, setShowAll] = React.useState(false)
  const [integrationSettings, setIntegrationSettings] = React.useState<IntegrationSettings>(defaultIntegrationSettings)
  const [openfangStatus, setOpenfangStatus] = React.useState<OpenfangStatus | null>(null)
  const [openfangBusyAction, setOpenfangBusyAction] = React.useState<"start" | "stop" | "configure" | null>(null)
  const [quickAssistBusy, setQuickAssistBusy] = React.useState(false)
  const [quickActionBusy, setQuickActionBusy] = React.useState<"openfang" | "hover" | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(async () => {
    setLoadingStatus(true)
    setError(null)
    try {
      const [nextKnowledge, _mcpRefresh, settingsResponse, openfangStatusResponse] = await Promise.all([
        getDesktopControlKnowledge(directory),
        refreshMcp({ directory, silent: true }),
        fetch("/api/config/settings", {
          method: "GET",
          headers: { Accept: "application/json" },
        }).then((response) => (response.ok ? response.json() : null)).catch(() => null),
        fetch(`/api/integrations/openfang/status${directory ? `?directory=${encodeURIComponent(directory)}` : ""}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(directory ? { "x-kronoscode-directory": directory } : {}),
          },
        }).then((response) => (response.ok ? response.json() : null)).catch(() => null),
      ])
      setKnowledge(nextKnowledge)
      if (settingsResponse) {
        setIntegrationSettings(parseIntegrationSettings(settingsResponse))
      }
      setOpenfangStatus((openfangStatusResponse && typeof openfangStatusResponse === "object") ? (openfangStatusResponse as OpenfangStatus) : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load desktop control state")
    } finally {
      setLoadingStatus(false)
    }
  }, [directory, refreshMcp])

  const runOpenfangAction = React.useCallback(
    async (action: "start" | "stop" | "configure") => {
      setOpenfangBusyAction(action)
      setError(null)
      try {
        const endpoint =
          action === "start"
            ? "/api/integrations/openfang/start"
            : action === "stop"
              ? "/api/integrations/openfang/stop"
              : "/api/integrations/openfang/configure-mcp"
        const body = action === "configure"
          ? {
            scope: directory ? "project" : "user",
            directory: directory ?? undefined,
          }
          : undefined

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(directory ? { "x-kronoscode-directory": directory } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        })

        const payload = await response.json().catch(() => null) as null | { error?: string }
        if (!response.ok) {
          throw new Error(payload?.error || `OpenFang ${action} failed`)
        }

        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to ${action} OpenFang`)
      } finally {
        setOpenfangBusyAction(null)
      }
    },
    [directory, reload],
  )

  React.useEffect(() => {
    void reload()
  }, [reload])

  const handleToggleConnection = React.useCallback(
    async (name: string) => {
      const next = mcpStatus[name]?.status
      setTogglingServer(name)
      setError(null)
      try {
        if (next === "connected") {
          await disconnect(name, directory)
        } else {
          await connect(name, directory)
        }
        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to toggle ${name}`)
      } finally {
        setTogglingServer(null)
      }
    },
    [connect, directory, disconnect, mcpStatus, reload],
  )

  const quickSetPrompt = React.useCallback(
    (prompt: string) => {
      setPendingInputText(prompt, "replace")
      setActiveMainTab("chat")
    },
    [setActiveMainTab, setPendingInputText],
  )

  const updateIntegrationToggle = React.useCallback(
    async (changes: Partial<IntegrationSettings>) => {
      setIntegrationSettings((prev) => ({ ...prev, ...changes }))
      await updateDesktopSettings(changes)
    },
    [],
  )

  const buildScreenpipeContextPrefix = React.useCallback(async (): Promise<string> => {
    if (!integrationSettings.screenpipeEnabled || !integrationSettings.screenpipeAutoContext) {
      return ""
    }

    try {
      const response = await fetch("/api/integrations/screenpipe/context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          windowMinutes: 60,
          limit: 10,
          maxItems: 6,
        }),
      })

      if (!response.ok) {
        return ""
      }

      const payload = (await response.json().catch(() => null)) as null | {
        context?: string
        windowMinutes?: number
      }
      const context = typeof payload?.context === "string" ? payload.context.trim() : ""
      if (!context) {
        return ""
      }

      const windowMinutes =
        typeof payload?.windowMinutes === "number" && Number.isFinite(payload.windowMinutes)
          ? Math.max(1, Math.round(payload.windowMinutes))
          : 60

      return `[Screenpipe context | last ${windowMinutes}m]\n${context}\n\n`
    } catch {
      return ""
    }
  }, [integrationSettings.screenpipeAutoContext, integrationSettings.screenpipeEnabled])

  const launchQuickAssistTemplate = React.useCallback(
    async (kind: "screenshot" | "audio") => {
      if (!integrationSettings.desktopQuickAssistEnabled || !integrationSettings.desktopQuickAssistTemplatesEnabled) {
        setError("Enable experimental quick-assist templates to use shortcut workflows.")
        return
      }

      setQuickAssistBusy(true)
      setError(null)

      try {
        const screenpipePrefix = await buildScreenpipeContextPrefix()
        const screenshotInstruction =
          "Analyze the latest screenshot or visible screen state, summarize key findings, and propose prioritized next actions."
        const audioInstruction =
          "Run an audio/transcription workflow: summarize recent speech content, extract action items, and list unresolved questions."
        const body = kind === "screenshot" ? screenshotInstruction : audioInstruction
        quickSetPrompt(`/desktoptask user-desktop ${screenpipePrefix}${body}`)
      } finally {
        setQuickAssistBusy(false)
      }
    },
    [
      buildScreenpipeContextPrefix,
      integrationSettings.desktopQuickAssistEnabled,
      integrationSettings.desktopQuickAssistTemplatesEnabled,
      quickSetPrompt,
    ],
  )

  const catalog = React.useMemo(() => {
    const ids = new Set(MCP_SERVER_ORDER)
    return DESKTOP_CONTROL_MCP_SERVERS.filter((server) => !ids.has(server.mcpName as any))
  }, [])
  const displayedCatalog = showAll ? catalog : catalog.slice(0, 3)

  const userDesktopRouting = knowledge?.routingPolicy?.userDesktop
  const userDesktopOrder = knowledge?.routingPolicy?.userDesktopOrder ?? []

  const runIntegrationQuickAction = React.useCallback(async (action: "openfang" | "hover") => {
    setQuickActionBusy(action)
    setError(null)
    try {
      if (action === "openfang") {
        await updateIntegrationToggle({
          openfangEnabled: true,
          openfangAutoConfigureMcp: true,
        })
        await runOpenfangAction("configure")
        return
      }

      await updateIntegrationToggle({
        desktopHoverAssistEnabled: true,
        desktopHoverAutoShowOnTaskSend: true,
        desktopHoverAlwaysOnTop: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply quick action")
    } finally {
      setQuickActionBusy(null)
    }
  }, [runOpenfangAction, updateIntegrationToggle])

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <RiComputerLine className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold">Desktop Control</h3>
          <p className="text-sm text-muted-foreground">KronosOS Browser + User Desktop + E2B routing (remote-macos removed)</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4">
        <RiInformationLine className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Interactive browsing defaults to KronosOS Browser. Desktop tasks support explicit full-control vs background routing.</p>
          <ul className="list-inside list-disc space-y-1">
            <li><code>user-desktop</code> for full-control task routing</li>
            <li><code>e2b</code> for background worker tasks</li>
            <li>Remote macOS is no longer part of active routing</li>
          </ul>
        </div>
      </div>

      {knowledge && (
        <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-medium">Runtime Policy</h4>
            <Badge variant="secondary" className="text-xs">{knowledge.authMode.toUpperCase()}</Badge>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div><span className="font-medium">Browsing mode:</span> <code>{knowledge.defaultPolicy.browsingMode}</code></div>
            <div><span className="font-medium">Background modes:</span> <code>{knowledge.defaultPolicy.backgroundModes.join(", ")}</code></div>
            <div><span className="font-medium">User desktop order:</span> <code>{userDesktopOrder.join(" -> ") || "none"}</code></div>
            <div><span className="font-medium">Active route:</span> <code>{userDesktopRouting?.provider || "none"}{userDesktopRouting?.mode ? ` -> ${userDesktopRouting.mode}` : ""}</code></div>
            {typeof userDesktopRouting?.reason === "string" && userDesktopRouting.reason.length > 0 ? (
              <div>{userDesktopRouting.reason}</div>
            ) : null}
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-border/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-medium">Core Desktop MCP Servers</h4>
          <Button variant="ghost" size="icon" onClick={() => void reload()} disabled={loadingStatus}>
            <RiRefreshLine className={cn("h-4 w-4", loadingStatus && "animate-spin")} />
          </Button>
        </div>

        {MCP_SERVER_ORDER.map((name) => {
          const status = mcpStatus[name]?.status
          const tone = statusTone(status)
          const provider = knowledge?.providers?.[name]
          return (
            <div key={name} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", toneClass(tone))} />
                    <span className="truncate font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground">{statusLabel(status)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {provider?.capabilities?.join(" · ") || "Desktop control connector"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={togglingServer === name}
                  onClick={() => void handleToggleConnection(name)}
                >
                  <RiPlug2Line className="h-4 w-4" />
                  {togglingServer === name ? "Applying…" : status === "connected" ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-2 rounded-xl border border-border/60 p-4">
        <h4 className="font-medium">Quick Task Prompts</h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button variant="outline" className="justify-start gap-2" onClick={() => quickSetPrompt("/agentmode kronosos")}>
            <RiRobot2Line className="h-4 w-4" />
            KronosOS Mode
          </Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => quickSetPrompt("/desktoptask user-desktop ")}>
            <RiComputerLine className="h-4 w-4" />
            Full Control Task
          </Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => quickSetPrompt("/desktoptask e2b ")}>
            <RiTerminalLine className="h-4 w-4" />
            Background Task
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-medium">OpenFang CLI Connector</h4>
            <p className="text-xs text-muted-foreground">Kronos-first routing stays default. OpenFang is an optional secondary MCP connector.</p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {openfangStatus?.daemonHealthy ? "online" : "offline"}
          </Badge>
        </div>

        <div className="space-y-2 text-xs text-muted-foreground">
          <div><span className="font-medium">CLI command:</span> <code>{integrationSettings.openfangCliCommand}</code></div>
          <div><span className="font-medium">Daemon:</span> <code>{openfangStatus?.daemonUrl || "http://127.0.0.1:4200"}</code></div>
          <div><span className="font-medium">CLI detected:</span> {openfangStatus?.cliDetected ? "yes" : "no"}</div>
          <div><span className="font-medium">MCP configured:</span> {openfangStatus?.mcpConfigured ? "yes" : "no"}</div>
          <div><span className="font-medium">MCP connected:</span> {openfangStatus?.mcpConnected ? "yes" : "no"}</div>
          {openfangStatus?.lastError ? (
            <div className="text-status-error">{openfangStatus.lastError}</div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">Enable OpenFang connector stack</div>
              <div className="text-xs text-muted-foreground">Turns on OpenFang integration endpoints and CLI-based controls.</div>
            </div>
            <Switch
              checked={integrationSettings.openfangEnabled}
              onCheckedChange={(value) => {
                void updateIntegrationToggle({ openfangEnabled: value })
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">Auto configure MCP connector</div>
              <div className="text-xs text-muted-foreground">Automatically prepare the <code>openfang mcp</code> connector flow.</div>
            </div>
            <Switch
              checked={integrationSettings.openfangAutoConfigureMcp}
              onCheckedChange={(value) => {
                void updateIntegrationToggle({ openfangAutoConfigureMcp: value })
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            variant="outline"
            className="justify-start gap-2"
            disabled={!integrationSettings.openfangEnabled || openfangBusyAction !== null}
            onClick={() => {
              void runOpenfangAction("start")
            }}
          >
            <RiPlayCircleLine className="h-4 w-4" />
            {openfangBusyAction === "start" ? "Starting…" : "Start daemon"}
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-2"
            disabled={!integrationSettings.openfangEnabled || openfangBusyAction !== null}
            onClick={() => {
              void runOpenfangAction("stop")
            }}
          >
            <RiStopCircleLine className="h-4 w-4" />
            {openfangBusyAction === "stop" ? "Stopping…" : "Stop daemon"}
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-2"
            disabled={!integrationSettings.openfangEnabled || openfangBusyAction !== null}
            onClick={() => {
              void runOpenfangAction("configure")
            }}
          >
            <RiPlug2Line className="h-4 w-4" />
            {openfangBusyAction === "configure" ? "Configuring…" : "Configure MCP"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-medium">Integration Quick Actions</h4>
            <p className="text-xs text-muted-foreground">One-click setup for OpenFang MCP and Pluely-style hover assist.</p>
          </div>
          <Badge variant="secondary" className="text-xs">first run</Badge>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="justify-start gap-2"
            disabled={quickActionBusy !== null || openfangBusyAction !== null}
            onClick={() => {
              void runIntegrationQuickAction("openfang")
            }}
          >
            <RiPlug2Line className="h-4 w-4" />
            {quickActionBusy === "openfang" ? "Applying…" : "Enable OpenFang + Configure MCP"}
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-2"
            disabled={quickActionBusy !== null}
            onClick={() => {
              void runIntegrationQuickAction("hover")
            }}
          >
            <RiComputerLine className="h-4 w-4" />
            {quickActionBusy === "hover" ? "Applying…" : "Enable Hover Assist"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-medium">Quick Assist (Experimental)</h4>
            <p className="text-xs text-muted-foreground">Clean-room workflows inspired by Pluely behavior, powered by existing desktop controls.</p>
          </div>
          <Badge variant="secondary" className="text-xs">experimental</Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">Enable quick assist mode</div>
              <div className="text-xs text-muted-foreground">Turns on shortcut-based desktop helper workflows.</div>
            </div>
            <Switch
              checked={integrationSettings.desktopQuickAssistEnabled}
              onCheckedChange={(value) => {
                void updateIntegrationToggle({ desktopQuickAssistEnabled: value })
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">Enable workflow templates</div>
              <div className="text-xs text-muted-foreground">Prebuilt screenshot and audio/transcription prompts.</div>
            </div>
            <Switch
              checked={integrationSettings.desktopQuickAssistTemplatesEnabled}
              onCheckedChange={(value) => {
                void updateIntegrationToggle({ desktopQuickAssistTemplatesEnabled: value })
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">Screenpipe context routing</div>
              <div className="text-xs text-muted-foreground">Attach recent Screenpipe memory to quick-assist templates when available.</div>
            </div>
            <Switch
              checked={integrationSettings.screenpipeEnabled && integrationSettings.screenpipeAutoContext}
              onCheckedChange={(value) => {
                void updateIntegrationToggle({
                  screenpipeEnabled: value,
                  screenpipeAutoContext: value,
                })
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">Hover chat assist shell</div>
              <div className="text-xs text-muted-foreground">Enable compact floating chat surface for desktop task runs.</div>
            </div>
            <Switch
              checked={integrationSettings.desktopHoverAssistEnabled}
              onCheckedChange={(value) => {
                void updateIntegrationToggle({ desktopHoverAssistEnabled: value })
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">Auto-show hover on task send</div>
              <div className="text-xs text-muted-foreground">Auto-enter hover mode when sending <code>/desktoptask</code>.</div>
            </div>
            <Switch
              checked={integrationSettings.desktopHoverAutoShowOnTaskSend}
              onCheckedChange={(value) => {
                void updateIntegrationToggle({ desktopHoverAutoShowOnTaskSend: value })
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">Keep hover window always on top</div>
              <div className="text-xs text-muted-foreground">Apply always-on-top while hover assist is active.</div>
            </div>
            <Switch
              checked={integrationSettings.desktopHoverAlwaysOnTop}
              onCheckedChange={(value) => {
                void updateIntegrationToggle({ desktopHoverAlwaysOnTop: value })
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="justify-start gap-2"
            disabled={quickAssistBusy}
            onClick={() => {
              void launchQuickAssistTemplate("screenshot")
            }}
          >
            <RiComputerLine className="h-4 w-4" />
            Screenshot analysis template
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-2"
            disabled={quickAssistBusy}
            onClick={() => {
              void launchQuickAssistTemplate("audio")
            }}
          >
            <RiTerminalLine className="h-4 w-4" />
            Audio/transcription template
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Additional Desktop Control Servers</h4>
        {displayedCatalog.map((server) => (
          <CatalogCard key={server.id} server={server} />
        ))}
        {!showAll && catalog.length > 3 && (
          <Button variant="ghost" className="w-full" onClick={() => setShowAll(true)}>
            Show {catalog.length - 3} more
            <RiArrowRightLine className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-status-error/40 bg-status-error/10 px-3 py-2 text-sm text-status-error">
          <RiErrorWarningLine className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RiCheckLine className="h-4 w-4 text-status-success" />
        MCP rows are clickable and toggle connect/disconnect.
      </div>
    </div>
  )
}

export default DesktopControlSettings
