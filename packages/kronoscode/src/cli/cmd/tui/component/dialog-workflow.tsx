import { TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { useDialog } from "@tui/ui/dialog"
import { useRoute } from "@tui/context/route"
import { useSDK } from "@tui/context/sdk"
import { useTheme } from "../context/theme"
import { useToast } from "../ui/toast"
import { For, Show, createMemo, createResource, createSignal, onMount } from "solid-js"

type PlaybookID = "plan_todo_task_bootstrap" | "todo_execution_cycle" | "review_wrapup"

type WorkflowPlaybook = {
  id: PlaybookID
  name: string
  description: string
}

type WorkflowNode = {
  node_id: string
  node_type: string
  label: string
  workflow_stage: string
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  position: number
  reliability?: {
    status?: "success" | "degraded" | "failed"
    confidence?: number
    recoverable?: boolean
    suggested_next_action?: string
  }
}

type WorkflowRun = {
  workflow_run_id: string
  session_id: string
  playbook_id: PlaybookID
  workflow_stage: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  workflow_outcome?: string
  time?: {
    created?: number
    updated?: number
    started?: number
    completed?: number
  }
  nodes: WorkflowNode[]
}

const PLAYBOOK_ORDER: PlaybookID[] = ["plan_todo_task_bootstrap", "todo_execution_cycle", "review_wrapup"]

const STATUS_LABEL: Record<WorkflowRun["status"], string> = {
  queued: "queued",
  running: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
}

const NODE_STATUS_LABEL: Record<WorkflowNode["status"], string> = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
}

const parseJson = async (response: Response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const formatClock = (value?: number) => {
  if (!value || !Number.isFinite(value)) return "-"
  try {
    return new Date(value).toLocaleTimeString()
  } catch {
    return "-"
  }
}

const reliabilitySuffix = (node: WorkflowNode) => {
  const confidence = node.reliability?.confidence
  const suggestion = node.reliability?.suggested_next_action
  if (typeof confidence === "number" && suggestion) {
    return ` (${Math.round(confidence * 100)}% · ${suggestion})`
  }
  if (typeof confidence === "number") {
    return ` (${Math.round(confidence * 100)}%)`
  }
  if (suggestion) {
    return ` (${suggestion})`
  }
  return ""
}

export function DialogWorkflowPanel() {
  const dialog = useDialog()
  const route = useRoute()
  const sdk = useSDK()
  const { theme } = useTheme()
  const toast = useToast()

  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [isMutating, setIsMutating] = createSignal(false)

  const sessionID = createMemo(() => (route.data.type === "session" ? route.data.sessionID : null))

  const [data, controls] = createResource(async () => {
    const [playbooksResponse, runsResponse] = await Promise.all([
      sdk.request({ path: "/workflow/playbook", method: "GET" }),
      sdk.request({
        path: "/workflow/run",
        method: "GET",
        query: {
          limit: 30,
          ...(sessionID() ? { sessionID: sessionID() } : {}),
        },
      }),
    ])

    const playbooksPayload = await parseJson(playbooksResponse)
    const runsPayload = await parseJson(runsResponse)

    const playbooks = (Array.isArray(playbooksPayload) ? playbooksPayload : []) as WorkflowPlaybook[]
    const runs = (Array.isArray(runsPayload) ? runsPayload : []) as WorkflowRun[]

    return {
      playbooks: playbooks.slice(),
      runs: runs.slice().sort((a, b) => {
        const left = a.time?.created ?? 0
        const right = b.time?.created ?? 0
        return right - left
      }),
    }
  })

  onMount(() => {
    dialog.setSize("large")
  })

  const selectedRun = createMemo(() => {
    const list = data()?.runs ?? []
    const index = selectedIndex()
    if (list.length === 0) return null
    if (index < 0) return list[0]
    if (index >= list.length) return list[list.length - 1]
    return list[index]
  })

  const moveSelection = (delta: number) => {
    const list = data()?.runs ?? []
    if (list.length === 0) return
    const next = Math.max(0, Math.min(list.length - 1, selectedIndex() + delta))
    setSelectedIndex(next)
  }

  const refresh = async () => {
    await controls.refetch()
  }

  const startPlaybook = async (playbookID: PlaybookID) => {
    if (!sessionID()) {
      toast.show({
        variant: "warning",
        message: "Open a session to start workflow playbooks",
      })
      return
    }

    try {
      setIsMutating(true)
      const response = await sdk.request({
        path: "/workflow/run",
        method: "POST",
        body: {
          sessionID: sessionID(),
          playbookID,
          idempotencyKey: `tui:${sessionID()}:${playbookID}`,
        },
      })
      if (!response.ok) {
        throw new Error(`Failed to start ${playbookID} (${response.status})`)
      }
      toast.show({
        variant: "info",
        message: `Started ${playbookID}`,
      })
      await refresh()
      setSelectedIndex(0)
    } catch (error) {
      toast.show({
        variant: "error",
        message: error instanceof Error ? error.message : "Failed to start workflow run",
      })
    } finally {
      setIsMutating(false)
    }
  }

  const cancelSelectedRun = async () => {
    const run = selectedRun()
    if (!run) return
    if (run.status !== "queued" && run.status !== "running") {
      toast.show({
        variant: "warning",
        message: "Selected run is not cancellable",
      })
      return
    }

    try {
      setIsMutating(true)
      const response = await sdk.request({
        path: `/workflow/run/${encodeURIComponent(run.workflow_run_id)}/cancel`,
        method: "POST",
      })
      if (!response.ok) {
        throw new Error(`Failed to cancel run (${response.status})`)
      }
      toast.show({
        variant: "info",
        message: `Cancelled ${run.playbook_id}`,
      })
      await refresh()
    } catch (error) {
      toast.show({
        variant: "error",
        message: error instanceof Error ? error.message : "Failed to cancel run",
      })
    } finally {
      setIsMutating(false)
    }
  }

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      dialog.clear()
      return
    }

    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault()
      moveSelection(-1)
      return
    }

    if (evt.name === "down" || evt.name === "j") {
      evt.preventDefault()
      moveSelection(1)
      return
    }

    if (evt.name === "r") {
      evt.preventDefault()
      void refresh()
      return
    }

    if (evt.name === "c") {
      evt.preventDefault()
      void cancelSelectedRun()
      return
    }

    if (evt.name === "1" || evt.name === "2" || evt.name === "3") {
      evt.preventDefault()
      const index = Number.parseInt(evt.name, 10) - 1
      const playbookID = PLAYBOOK_ORDER[index]
      if (playbookID) {
        void startPlaybook(playbookID)
      }
    }
  })

  return (
    <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Workflow
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>

      <text fg={theme.textMuted}>Session: {sessionID() ?? "none selected"}</text>
      <text fg={theme.textMuted}>
        Keys: 1/2/3 start playbook • c cancel selected • r refresh • ↑/↓ navigate
      </text>

      <Show when={!data.loading} fallback={<text fg={theme.textMuted}>Loading workflow data...</text>}>
        <Show
          when={(data()?.runs ?? []).length > 0}
          fallback={<text fg={theme.textMuted}>No workflow runs found. Press 1/2/3 to start one.</text>}
        >
          <box flexDirection="column" gap={0}>
            <For each={data()?.runs ?? []}>
              {(run, index) => {
                const selected = () => index() === selectedIndex()
                const statusColor = () => {
                  if (run.status === "completed") return theme.success
                  if (run.status === "failed") return theme.error
                  if (run.status === "running") return theme.warning
                  return theme.textMuted
                }
                return (
                  <box
                    paddingLeft={1}
                    paddingRight={1}
                    backgroundColor={selected() ? theme.primary : undefined}
                    onMouseUp={() => setSelectedIndex(index())}
                  >
                    <text fg={selected() ? theme.selectedListItemText : theme.text}>
                      {selected() ? ">" : " "} {run.playbook_id} •{" "}
                      <span style={{ fg: selected() ? theme.selectedListItemText : statusColor() }}>
                        {STATUS_LABEL[run.status]}
                      </span>{" "}
                      • {run.workflow_stage} • {formatClock(run.time?.updated)}
                    </text>
                  </box>
                )
              }}
            </For>
          </box>
        </Show>

        <Show when={selectedRun()}>
          {(runAccessor) => {
            const run = runAccessor()
            const nodes = () => run.nodes.slice().sort((a, b) => a.position - b.position)
            return (
              <box flexDirection="column" gap={0}>
                <text fg={theme.text} attributes={TextAttributes.BOLD}>
                  Nodes ({run.playbook_id})
                </text>
                <For each={nodes()}>
                  {(node) => {
                    const nodeColor = () => {
                      if (node.status === "completed") return theme.success
                      if (node.status === "failed") return theme.error
                      if (node.status === "running") return theme.warning
                      return theme.textMuted
                    }
                    return (
                      <text fg={theme.text} wrapMode="word">
                        • {node.label} [{node.workflow_stage}]{" "}
                        <span style={{ fg: nodeColor() }}>{NODE_STATUS_LABEL[node.status]}</span>
                        <span style={{ fg: theme.textMuted }}>{reliabilitySuffix(node)}</span>
                      </text>
                    )
                  }}
                </For>
              </box>
            )
          }}
        </Show>
      </Show>

      <Show when={isMutating()}>
        <text fg={theme.textMuted}>Updating workflow run…</text>
      </Show>
    </box>
  )
}
