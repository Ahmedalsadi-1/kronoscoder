import { Prompt, type PromptRef } from "@tui/component/prompt"
import { createMemo, Match, onMount, Show, Switch } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useKeybind } from "@tui/context/keybind"
import { Logo } from "../component/logo"
import { Tips } from "../component/tips"
import { Locale } from "@/util/locale"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useDirectory } from "../context/directory"
import { useRouteData } from "@tui/context/route"
import { usePromptRef } from "../context/prompt"
import { Installation } from "@/installation"
import { useKV } from "../context/kv"
import { useCommandDialog } from "../component/dialog-command"

// TODO: what is the best way to do this?
let once = false

export function Home() {
  const sync = useSync()
  const kv = useKV()
  const { theme } = useTheme()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const command = useCommandDialog()
  const mcp = createMemo(() => Object.keys(sync.data.mcp).length > 0)
  const mcpError = createMemo(() => {
    return Object.values(sync.data.mcp).some((x) => x.status === "failed")
  })

  const connectedMcpCount = createMemo(() => {
    return Object.values(sync.data.mcp).filter((x) => x.status === "connected").length
  })
  type OperatorUI = {
    enabled?: boolean
  }
  const operator = createMemo<OperatorUI>(() => {
    return (sync.data.config.tui as { operator_ui?: OperatorUI } | undefined)?.operator_ui ?? {}
  })
  const operatorEnabled = createMemo(() => {
    const enabled = operator().enabled
    if (enabled !== undefined) return !!enabled
    return true
  })

  const isFirstTimeUser = createMemo(() => sync.data.session.length === 0)
  const tipsHidden = createMemo(() => kv.get("tips_hidden", false))
  const showTips = createMemo(() => {
    // Don't show tips for first-time users
    if (isFirstTimeUser()) return false
    return !tipsHidden()
  })

  command.register(() => [
    {
      title: tipsHidden() ? "Show tips" : "Hide tips",
      value: "tips.toggle",
      keybind: "tips_toggle",
      category: "System",
      onSelect: (dialog) => {
        kv.set("tips_hidden", !tipsHidden())
        dialog.clear()
      },
    },
  ])

  const Hint = (
    <Show when={connectedMcpCount() > 0}>
      <box flexShrink={0} flexDirection="row" gap={1}>
        <text fg={theme.text}>
          <Switch>
            <Match when={mcpError()}>
              <span style={{ fg: theme.error }}>•</span> mcp errors{" "}
              <span style={{ fg: theme.textMuted }}>ctrl+x s</span>
            </Match>
            <Match when={true}>
              <span style={{ fg: theme.success }}>•</span>{" "}
              {Locale.pluralize(connectedMcpCount(), "{} mcp server", "{} mcp servers")}
            </Match>
          </Switch>
        </text>
      </box>
    </Show>
  )

  let prompt: PromptRef
  const args = useArgs()
  onMount(() => {
    if (once) return
    if (route.initialPrompt) {
      prompt.set(route.initialPrompt)
      once = true
    } else if (args.prompt) {
      prompt.set({ input: args.prompt, parts: [] })
      once = true
      prompt.submit()
    }
  })
  const directory = useDirectory()

  const keybind = useKeybind()

  return (
    <>
      <box
        flexGrow={1}
        alignItems="center"
        paddingLeft={2}
        paddingRight={2}
        backgroundColor={operatorEnabled() ? theme.surface_base : theme.background}
      >
        <box flexGrow={1} minHeight={0} alignItems="center" justifyContent="center" width="100%">
          <box
            flexShrink={0}
            border={operatorEnabled()}
            borderColor={operatorEnabled() ? theme.border_subtle : theme.border}
            backgroundColor={operatorEnabled() ? theme.surface_elev_1 : theme.background}
            paddingTop={1}
            paddingBottom={1}
            paddingLeft={2}
            paddingRight={2}
          >
            <Logo />
          </box>
        </box>
        <Show when={showTips()}>
          <box
            width="100%"
            maxWidth={92}
            alignItems="center"
            paddingBottom={1}
            flexShrink={0}
            backgroundColor={operatorEnabled() ? theme.surface_base : theme.background}
          >
            <Tips />
          </box>
        </Show>
        <box
          width="100%"
          maxWidth={92}
          zIndex={1000}
          paddingBottom={1}
          flexShrink={0}
          border={operatorEnabled()}
          borderColor={operatorEnabled() ? theme.border_subtle : theme.border}
          backgroundColor={operatorEnabled() ? theme.surface_elev_1 : theme.backgroundPanel}
          paddingLeft={1}
          paddingRight={1}
          paddingTop={1}
        >
          <Prompt
            ref={(r) => {
              prompt = r
              promptRef.set(r)
            }}
            hint={Hint}
          />
        </box>
        <Toast />
      </box>
      <box
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        flexDirection="row"
        flexShrink={0}
        gap={2}
        border={["top"]}
        borderColor={operatorEnabled() ? theme.border_subtle : theme.border}
        backgroundColor={operatorEnabled() ? theme.surface_elev_1 : theme.background}
      >
        <text fg={theme.text_secondary}>{directory()}</text>
        <box gap={1} flexDirection="row" flexShrink={0}>
          <Show when={mcp()}>
            <text fg={theme.text_primary}>
              <Switch>
                <Match when={mcpError()}>
                  <span style={{ fg: theme.error }}>⊙ </span>
                </Match>
                <Match when={true}>
                  <span style={{ fg: connectedMcpCount() > 0 ? theme.accent_success : theme.text_muted }}>⊙ </span>
                </Match>
              </Switch>
              {connectedMcpCount()} MCP
            </text>
            <text fg={theme.text_secondary}>/status</text>
          </Show>
        </box>
        <box flexGrow={1} />
        <box flexShrink={0}>
          <text fg={theme.text_secondary}>{Installation.VERSION}</text>
        </box>
      </box>
    </>
  )
}
