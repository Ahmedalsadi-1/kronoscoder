import z from "zod"
import { Session } from "@/session"
import { Todo } from "@/session/todo"
import { Database, and, asc, desc, eq, inArray, or, gte } from "@/storage/db"
import { fn } from "@/util/fn"
import { WorkflowRunNodeTable, WorkflowRunTable } from "./workflow.sql"

const PLAYBOOK_CATALOG = {
  plan_todo_task_bootstrap: {
    id: "plan_todo_task_bootstrap",
    name: "Plan -> Todo -> Task Bootstrap",
    description: "Creates planning momentum by entering plan mode, syncing todos, and identifying the next task.",
    nodes: [
      { nodeID: "plan_enter", nodeType: "plan_enter", label: "Plan Enter", workflowStage: "planning", position: 0 },
      { nodeID: "todoread", nodeType: "todoread", label: "Read Todos", workflowStage: "todo", position: 1 },
      {
        nodeID: "todowrite",
        nodeType: "todowrite",
        label: "Seed Todos",
        workflowStage: "todo",
        position: 2,
      },
      { nodeID: "task", nodeType: "task", label: "Pick Task", workflowStage: "execution", position: 3 },
      { nodeID: "plan_exit", nodeType: "plan_exit", label: "Plan Exit", workflowStage: "complete", position: 4 },
    ],
  },
  todo_execution_cycle: {
    id: "todo_execution_cycle",
    name: "Todo Execution Cycle",
    description: "Reconciles todo state and selects execution focus for the next loop.",
    nodes: [
      { nodeID: "todoread", nodeType: "todoread", label: "Read Todos", workflowStage: "todo", position: 0 },
      { nodeID: "task", nodeType: "task", label: "Execute Task", workflowStage: "execution", position: 1 },
      {
        nodeID: "todowrite",
        nodeType: "todowrite",
        label: "Refresh Todos",
        workflowStage: "todo",
        position: 2,
      },
    ],
  },
  review_wrapup: {
    id: "review_wrapup",
    name: "Review + Wrap-up",
    description: "Runs review-focused wrap-up with changes context and handoff recommendation.",
    nodes: [
      {
        nodeID: "review_user_changes",
        nodeType: "review_user_changes",
        label: "Review Changes",
        workflowStage: "review",
        position: 0,
      },
      { nodeID: "plan_exit", nodeType: "plan_exit", label: "Wrap Up", workflowStage: "complete", position: 1 },
    ],
  },
} as const

const WORKFLOW_RUN_STATUS = z.enum(["queued", "running", "completed", "failed", "cancelled"])
const WORKFLOW_NODE_STATUS = z.enum(["pending", "running", "completed", "failed", "cancelled"])
const RELIABILITY_STATUS = z.enum(["success", "degraded", "failed"])
const PLAYBOOK_IDS = z.enum(["plan_todo_task_bootstrap", "todo_execution_cycle", "review_wrapup"])

type WorkflowRunStatus = z.infer<typeof WORKFLOW_RUN_STATUS>
type WorkflowNodeStatus = z.infer<typeof WORKFLOW_NODE_STATUS>
type PlaybookID = z.infer<typeof PLAYBOOK_IDS>

const WorkflowReliabilitySchema = z.object({
  status: RELIABILITY_STATUS,
  confidence: z.number(),
  recoverable: z.boolean(),
  suggested_next_action: z.string().optional(),
})

const WorkflowNodeSchema = z.object({
  workflow_run_id: z.string(),
  node_id: z.string(),
  node_type: z.string(),
  label: z.string(),
  workflow_stage: z.string(),
  status: WORKFLOW_NODE_STATUS,
  position: z.number(),
  time_started: z.number().optional(),
  time_completed: z.number().optional(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  reliability: WorkflowReliabilitySchema.optional(),
})

const WorkflowRunSchema = z.object({
  id: z.string(),
  workflow_run_id: z.string(),
  session_id: z.string(),
  workflow_id: z.string(),
  playbook_id: PLAYBOOK_IDS,
  workflow_stage: z.string(),
  status: WORKFLOW_RUN_STATUS,
  workflow_outcome: z.string().optional(),
  session_resume_token: z.string().optional(),
  idempotency_key: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  time: z.object({
    created: z.number(),
    updated: z.number(),
    started: z.number().optional(),
    completed: z.number().optional(),
  }),
  nodes: WorkflowNodeSchema.array(),
})

const ActiveRunSchema = z.object({
  workflow_run_id: z.string(),
  session_id: z.string(),
  playbook_id: PLAYBOOK_IDS,
  workflow_stage: z.string(),
  status: WORKFLOW_RUN_STATUS,
  workflow_outcome: z.string().optional(),
})

type WorkflowRunNode = z.infer<typeof WorkflowNodeSchema>
export type WorkflowRunInfo = z.infer<typeof WorkflowRunSchema>

const createWorkflowRunID = () => `wfr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

const createResumeToken = (input: { sessionID: string; runID: string; playbookID: string }) => {
  const payload = {
    sessionID: input.sessionID,
    workflow_run_id: input.runID,
    playbook_id: input.playbookID,
    issued_at: Date.now(),
  }
  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

const toReliability = (value: unknown): z.infer<typeof WorkflowReliabilitySchema> | undefined => {
  const parsed = WorkflowReliabilitySchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

const nodeFromRow = (row: typeof WorkflowRunNodeTable.$inferSelect): WorkflowRunNode => {
  const metadata = row.metadata ?? undefined
  return {
    workflow_run_id: row.run_id,
    node_id: row.node_id,
    node_type: row.node_type,
    label: row.label,
    workflow_stage: row.workflow_stage,
    status: row.status as WorkflowNodeStatus,
    position: row.position,
    time_started: row.time_started ?? undefined,
    time_completed: row.time_completed ?? undefined,
    error: row.error ?? undefined,
    metadata,
    reliability: toReliability(metadata?.reliability),
  }
}

const runFromRows = (
  runRow: typeof WorkflowRunTable.$inferSelect,
  nodeRows: Array<typeof WorkflowRunNodeTable.$inferSelect>,
): WorkflowRunInfo => {
  const nodes = nodeRows.map(nodeFromRow).toSorted((a, b) => a.position - b.position)
  return {
    id: runRow.id,
    workflow_run_id: runRow.id,
    session_id: runRow.session_id,
    workflow_id: runRow.workflow_id,
    playbook_id: runRow.playbook_id as PlaybookID,
    workflow_stage: runRow.workflow_stage,
    status: runRow.status as WorkflowRunStatus,
    workflow_outcome: runRow.workflow_outcome ?? undefined,
    session_resume_token: runRow.session_resume_token ?? undefined,
    idempotency_key: runRow.idempotency_key ?? undefined,
    input: runRow.input ?? undefined,
    output: runRow.output ?? undefined,
    error: runRow.error ?? undefined,
    time: {
      created: runRow.time_created,
      updated: runRow.time_updated,
      started: runRow.time_started ?? undefined,
      completed: runRow.time_completed ?? undefined,
    },
    nodes,
  }
}

const getRunRow = (runID: string) =>
  Database.use((db) => db.select().from(WorkflowRunTable).where(eq(WorkflowRunTable.id, runID)).get())

const getNodesByRun = (runID: string) =>
  Database.use((db) =>
    db
      .select()
      .from(WorkflowRunNodeTable)
      .where(eq(WorkflowRunNodeTable.run_id, runID))
      .orderBy(asc(WorkflowRunNodeTable.position))
      .all(),
  )

const getObjectiveText = async (sessionID: string) => {
  const messages = await Session.messages({ sessionID, limit: 50 })
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message.info.role !== "user") continue
    const textPart = message.parts.find((part) => part.type === "text" && !part.ignored)
    if (textPart?.type === "text") {
      const content = textPart.text.trim()
      if (content.length > 0) {
        return content
      }
    }
  }
  return null
}

const executePlaybookNode = async (input: {
  sessionID: string
  playbookID: PlaybookID
  nodeType: string
  workflowStage: string
}): Promise<{ output: Record<string, unknown>; reliability: z.infer<typeof WorkflowReliabilitySchema> }> => {
  switch (input.nodeType) {
    case "plan_enter": {
      const objective = await getObjectiveText(input.sessionID)
      return {
        output: {
          message: "Plan mode entered",
          objective,
        },
        reliability: {
          status: "success",
          confidence: 0.92,
          recoverable: true,
          suggested_next_action: objective
            ? "Refine this objective into 2-5 concrete todo items."
            : "Capture a clear objective before planning continues.",
        },
      }
    }

    case "todoread": {
      const todos = Todo.get(input.sessionID)
      return {
        output: {
          todo_count: todos.length,
          todos,
        },
        reliability: {
          status: "success",
          confidence: 0.95,
          recoverable: true,
          suggested_next_action:
            todos.length > 0
              ? "Prioritize the first pending item and execute it."
              : "No todos found. Seed todos from the current objective.",
        },
      }
    }

    case "todowrite": {
      const existing = Todo.get(input.sessionID)
      let seeded = false
      if (existing.length === 0) {
        const objective = (await getObjectiveText(input.sessionID)) ?? "Continue current objective"
        Todo.update({
          sessionID: input.sessionID,
          todos: [
            {
              content: objective.slice(0, 140),
              status: "pending",
              priority: "high",
            },
            {
              content: "Validate results and update todo statuses",
              status: "pending",
              priority: "medium",
            },
          ],
        })
        seeded = true
      }
      return {
        output: {
          seeded,
          todos: Todo.get(input.sessionID),
        },
        reliability: {
          status: "success",
          confidence: seeded ? 0.86 : 0.97,
          recoverable: true,
          suggested_next_action: "Start work on the highest priority pending todo.",
        },
      }
    }

    case "task": {
      const todos = Todo.get(input.sessionID)
      const candidate = todos.find((todo) => todo.status !== "completed") ?? null
      return {
        output: {
          next_task: candidate?.content ?? null,
          priority: candidate?.priority ?? null,
          status: candidate?.status ?? null,
        },
        reliability: {
          status: candidate ? "success" : "degraded",
          confidence: candidate ? 0.9 : 0.62,
          recoverable: true,
          suggested_next_action: candidate
            ? `Execute task: ${candidate.content}`
            : "No actionable todo found. Add or refresh todo items first.",
        },
      }
    }

    case "review_user_changes": {
      const diff = await Session.diff(input.sessionID)
      const changedFiles = diff.length
      return {
        output: {
          changed_files: changedFiles,
          changed_paths: diff.map((item) => item.file),
        },
        reliability: {
          status: "success",
          confidence: 0.88,
          recoverable: true,
          suggested_next_action:
            changedFiles > 0
              ? "Review changed files and capture follow-up fixes before wrap-up."
              : "No diffs captured yet; run validation before final wrap-up.",
        },
      }
    }

    case "plan_exit":
      return {
        output: {
          message: "Plan mode exited",
          playbook: input.playbookID,
          stage: input.workflowStage,
        },
        reliability: {
          status: "success",
          confidence: 0.94,
          recoverable: true,
          suggested_next_action: "Continue objective execution from the latest workflow stage.",
        },
      }

    default:
      return {
        output: {
          message: `No executor implemented for node ${input.nodeType}`,
        },
        reliability: {
          status: "degraded",
          confidence: 0.5,
          recoverable: true,
          suggested_next_action: "Inspect workflow node configuration before retrying.",
        },
      }
  }
}

const setRunStatus = (input: {
  runID: string
  status: WorkflowRunStatus
  workflowStage: string
  workflowOutcome?: string
  output?: Record<string, unknown>
  error?: string
  startedAt?: number
  completedAt?: number
}) => {
  Database.use((db) => {
    db.update(WorkflowRunTable)
      .set({
        status: input.status,
        workflow_stage: input.workflowStage,
        workflow_outcome: input.workflowOutcome ?? null,
        output: input.output ?? null,
        error: input.error ?? null,
        time_started: input.startedAt,
        time_completed: input.completedAt,
        time_updated: Date.now(),
      })
      .where(eq(WorkflowRunTable.id, input.runID))
      .run()
  })
}

const setNodeStatus = (input: {
  runID: string
  nodeID: string
  status: WorkflowNodeStatus
  error?: string
  metadata?: Record<string, unknown>
  startedAt?: number
  completedAt?: number
}) => {
  Database.use((db) => {
    db.update(WorkflowRunNodeTable)
      .set({
        status: input.status,
        error: input.error ?? null,
        metadata: input.metadata,
        time_started: input.startedAt,
        time_completed: input.completedAt,
        time_updated: Date.now(),
      })
      .where(and(eq(WorkflowRunNodeTable.run_id, input.runID), eq(WorkflowRunNodeTable.node_id, input.nodeID)))
      .run()
  })
}

const executeRun = async (runID: string) => {
  const run = getRunRow(runID)
  if (!run || (run.status !== "queued" && run.status !== "running")) return

  const startedAt = Date.now()
  const nodes = getNodesByRun(runID)
  if (nodes.length === 0) {
    setRunStatus({
      runID,
      status: "failed",
      workflowStage: "failed",
      workflowOutcome: "failed",
      error: "Playbook has no nodes to execute",
      startedAt,
      completedAt: Date.now(),
    })
    return
  }

  setRunStatus({
    runID,
    status: "running",
    workflowStage: nodes[0].workflow_stage,
    startedAt,
  })

  const output: Record<string, unknown> = {}

  for (const node of nodes) {
    const current = getRunRow(runID)
    if (!current) return
    if (current.status === "cancelled") {
      setNodeStatus({
        runID,
        nodeID: node.node_id,
        status: "cancelled",
        error: "Run cancelled",
        completedAt: Date.now(),
      })
      continue
    }

    const nodeStart = Date.now()
    setNodeStatus({
      runID,
      nodeID: node.node_id,
      status: "running",
      startedAt: nodeStart,
    })

    try {
      const execution = await executePlaybookNode({
        sessionID: current.session_id,
        playbookID: current.playbook_id as PlaybookID,
        nodeType: node.node_type,
        workflowStage: node.workflow_stage,
      })
      const completedAt = Date.now()
      output[node.node_id] = execution.output
      setNodeStatus({
        runID,
        nodeID: node.node_id,
        status: "completed",
        startedAt: nodeStart,
        completedAt,
        metadata: {
          output: execution.output,
          reliability: execution.reliability,
        },
      })
      setRunStatus({
        runID,
        status: "running",
        workflowStage: node.workflow_stage,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const completedAt = Date.now()
      setNodeStatus({
        runID,
        nodeID: node.node_id,
        status: "failed",
        startedAt: nodeStart,
        completedAt,
        error: message,
        metadata: {
          reliability: {
            status: "failed",
            confidence: 0.2,
            recoverable: true,
            suggested_next_action: "Retry the workflow run after resolving the node error.",
          },
        },
      })
      setRunStatus({
        runID,
        status: "failed",
        workflowStage: node.workflow_stage,
        workflowOutcome: "failed",
        error: message,
        output,
        completedAt,
      })
      return
    }
  }

  const latest = getRunRow(runID)
  if (!latest) return
  if (latest.status === "cancelled") {
    setRunStatus({
      runID,
      status: "cancelled",
      workflowStage: latest.workflow_stage,
      workflowOutcome: "cancelled",
      output,
      completedAt: Date.now(),
    })
    return
  }

  setRunStatus({
    runID,
    status: "completed",
    workflowStage: "complete",
    workflowOutcome: "success",
    output,
    completedAt: Date.now(),
  })
}

export namespace WorkflowRun {
  export const Playbook = z
    .object({
      id: PLAYBOOK_IDS,
      name: z.string(),
      description: z.string(),
      nodes: z.array(
        z.object({
          nodeID: z.string(),
          nodeType: z.string(),
          label: z.string(),
          workflowStage: z.string(),
          position: z.number(),
        }),
      ),
    })
    .meta({ ref: "WorkflowPlaybook" })
  export type Playbook = z.infer<typeof Playbook>

  export const Info = WorkflowRunSchema.meta({ ref: "WorkflowRun" })
  export type Info = z.infer<typeof Info>

  export const Node = WorkflowNodeSchema.meta({ ref: "WorkflowRunNode" })
  export type Node = z.infer<typeof Node>

  export const Active = ActiveRunSchema.meta({ ref: "ActiveWorkflowRun" })
  export type Active = z.infer<typeof Active>

  export const listPlaybooks = fn(z.void(), async () => Object.values(PLAYBOOK_CATALOG))

  export const list = fn(
    z
      .object({
        sessionID: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .optional(),
    async (input) => {
      const limit = input?.limit ?? 20
      const rows = Database.use((db) => {
        if (input?.sessionID) {
          return db
            .select()
            .from(WorkflowRunTable)
            .where(eq(WorkflowRunTable.session_id, input.sessionID))
            .orderBy(desc(WorkflowRunTable.time_created))
            .limit(limit)
            .all()
        }
        return db.select().from(WorkflowRunTable).orderBy(desc(WorkflowRunTable.time_created)).limit(limit).all()
      })

      if (rows.length === 0) return []
      const runIDs = rows.map((row) => row.id)
      const nodeRows = Database.use((db) =>
        db
          .select()
          .from(WorkflowRunNodeTable)
          .where(inArray(WorkflowRunNodeTable.run_id, runIDs))
          .orderBy(asc(WorkflowRunNodeTable.run_id), asc(WorkflowRunNodeTable.position))
          .all(),
      )

      const nodesByRun = new Map<string, Array<typeof WorkflowRunNodeTable.$inferSelect>>()
      for (const node of nodeRows) {
        const list = nodesByRun.get(node.run_id)
        if (list) list.push(node)
        else nodesByRun.set(node.run_id, [node])
      }

      return rows.map((row) => runFromRows(row, nodesByRun.get(row.id) ?? []))
    },
  )

  export const get = fn(z.string(), async (runID) => {
    const runRow = getRunRow(runID)
    if (!runRow) {
      throw new Error(`Workflow run not found: ${runID}`)
    }
    return runFromRows(runRow, getNodesByRun(runID))
  })

  export const latestBySession = fn(z.string(), async (sessionID) => {
    const row = Database.use((db) =>
      db
        .select()
        .from(WorkflowRunTable)
        .where(eq(WorkflowRunTable.session_id, sessionID))
        .orderBy(desc(WorkflowRunTable.time_created))
        .limit(1)
        .get(),
    )
    if (!row) return null
    return runFromRows(row, getNodesByRun(row.id))
  })

  export const listActive = fn(
    z
      .object({
        sessionID: z.string().optional(),
      })
      .optional(),
    async (input) => {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000
      const rows = Database.use((db) => {
        const whereClause = input?.sessionID
          ? and(
              eq(WorkflowRunTable.session_id, input.sessionID),
              inArray(WorkflowRunTable.status, ["queued", "running"] as WorkflowRunStatus[]),
              gte(WorkflowRunTable.time_created, cutoff),
            )
          : and(
              inArray(WorkflowRunTable.status, ["queued", "running"] as WorkflowRunStatus[]),
              gte(WorkflowRunTable.time_created, cutoff),
            )
        return db.select().from(WorkflowRunTable).where(whereClause).orderBy(desc(WorkflowRunTable.time_created)).all()
      })

      return rows.map((row) => ({
        workflow_run_id: row.id,
        session_id: row.session_id,
        playbook_id: row.playbook_id as PlaybookID,
        workflow_stage: row.workflow_stage,
        status: row.status as WorkflowRunStatus,
        workflow_outcome: row.workflow_outcome ?? undefined,
      }))
    },
  )

  export const start = fn(
    z.object({
      sessionID: z.string(),
      playbookID: PLAYBOOK_IDS,
      idempotencyKey: z.string().optional(),
      input: z.record(z.string(), z.unknown()).optional(),
    }),
    async (input) => {
      await Session.get(input.sessionID)

      if (input.idempotencyKey) {
        const idempotencyKey = input.idempotencyKey
        const existing = Database.use((db) =>
          db
            .select()
            .from(WorkflowRunTable)
            .where(
              and(
                eq(WorkflowRunTable.session_id, input.sessionID),
                eq(WorkflowRunTable.playbook_id, input.playbookID),
                eq(WorkflowRunTable.idempotency_key, idempotencyKey),
              ),
            )
            .orderBy(desc(WorkflowRunTable.time_created))
            .limit(1)
            .get(),
        )
        if (existing) {
          return runFromRows(existing, getNodesByRun(existing.id))
        }
      }

      const activeDuplicate = Database.use((db) =>
        db
          .select()
          .from(WorkflowRunTable)
          .where(
            and(
              eq(WorkflowRunTable.session_id, input.sessionID),
              eq(WorkflowRunTable.playbook_id, input.playbookID),
              inArray(WorkflowRunTable.status, ["queued", "running"] as WorkflowRunStatus[]),
              gte(WorkflowRunTable.time_created, Date.now() - 60_000),
            ),
          )
          .orderBy(desc(WorkflowRunTable.time_created))
          .limit(1)
          .get(),
      )
      if (activeDuplicate) {
        return runFromRows(activeDuplicate, getNodesByRun(activeDuplicate.id))
      }

      const now = Date.now()
      const runID = createWorkflowRunID()
      const playbook = PLAYBOOK_CATALOG[input.playbookID]
      const sessionResumeToken = createResumeToken({
        sessionID: input.sessionID,
        runID,
        playbookID: input.playbookID,
      })

      Database.transaction((db) => {
        db.insert(WorkflowRunTable)
          .values({
            id: runID,
            session_id: input.sessionID,
            workflow_id: `playbook:${input.playbookID}`,
            playbook_id: input.playbookID,
            workflow_stage: playbook.nodes[0]?.workflowStage ?? "queued",
            status: "queued",
            workflow_outcome: null,
            session_resume_token: sessionResumeToken,
            idempotency_key: input.idempotencyKey ?? null,
            input: input.input ?? null,
            output: null,
            error: null,
            time_started: null,
            time_completed: null,
            time_created: now,
            time_updated: now,
          })
          .run()

        if (playbook.nodes.length > 0) {
          db.insert(WorkflowRunNodeTable)
            .values(
              playbook.nodes.map((node) => ({
                run_id: runID,
                node_id: node.nodeID,
                node_type: node.nodeType,
                label: node.label,
                workflow_stage: node.workflowStage,
                status: "pending",
                position: node.position,
                time_started: null,
                time_completed: null,
                error: null,
                metadata: null,
                time_created: now,
                time_updated: now,
              })),
            )
            .run()
        }
      })

      void executeRun(runID).catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        setRunStatus({
          runID,
          status: "failed",
          workflowStage: "failed",
          workflowOutcome: "failed",
          error: message,
          completedAt: Date.now(),
        })
      })

      return runFromRows(getRunRow(runID)!, getNodesByRun(runID))
    },
  )

  export const cancel = fn(z.object({ workflowRunID: z.string() }), async (input) => {
    const existing = getRunRow(input.workflowRunID)
    if (!existing) {
      throw new Error(`Workflow run not found: ${input.workflowRunID}`)
    }

    if (existing.status === "completed" || existing.status === "failed" || existing.status === "cancelled") {
      return runFromRows(existing, getNodesByRun(existing.id))
    }

    const now = Date.now()
    Database.transaction((db) => {
      db.update(WorkflowRunTable)
        .set({
          status: "cancelled",
          workflow_outcome: "cancelled",
          workflow_stage: "cancelled",
          time_completed: now,
          time_updated: now,
        })
        .where(eq(WorkflowRunTable.id, input.workflowRunID))
        .run()

      db.update(WorkflowRunNodeTable)
        .set({
          status: "cancelled",
          error: "Cancelled by user",
          time_completed: now,
          time_updated: now,
        })
        .where(
          and(
            eq(WorkflowRunNodeTable.run_id, input.workflowRunID),
            or(eq(WorkflowRunNodeTable.status, "pending"), eq(WorkflowRunNodeTable.status, "running")),
          ),
        )
        .run()
    })

    return runFromRows(getRunRow(input.workflowRunID)!, getNodesByRun(input.workflowRunID))
  })
}
