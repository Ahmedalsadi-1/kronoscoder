import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core"
import { SessionTable } from "@/session/session.sql"
import { Timestamps } from "@/storage/schema.sql"

export const WorkflowRunTable = sqliteTable(
  "workflow_run",
  {
    id: text().primaryKey(),
    session_id: text()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    workflow_id: text().notNull(),
    playbook_id: text().notNull(),
    workflow_stage: text().notNull(),
    status: text().notNull(),
    workflow_outcome: text(),
    session_resume_token: text(),
    idempotency_key: text(),
    input: text({ mode: "json" }).$type<Record<string, unknown>>(),
    output: text({ mode: "json" }).$type<Record<string, unknown>>(),
    error: text(),
    time_started: integer(),
    time_completed: integer(),
    ...Timestamps,
  },
  (table) => [
    index("workflow_run_session_idx").on(table.session_id),
    index("workflow_run_status_idx").on(table.status),
    index("workflow_run_created_idx").on(table.time_created),
    uniqueIndex("workflow_run_idempotency_idx").on(table.idempotency_key),
  ],
)

export const WorkflowRunNodeTable = sqliteTable(
  "workflow_run_node",
  {
    run_id: text()
      .notNull()
      .references(() => WorkflowRunTable.id, { onDelete: "cascade" }),
    node_id: text().notNull(),
    node_type: text().notNull(),
    label: text().notNull(),
    workflow_stage: text().notNull(),
    status: text().notNull(),
    position: integer().notNull(),
    time_started: integer(),
    time_completed: integer(),
    error: text(),
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>(),
    ...Timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.run_id, table.node_id] }),
    index("workflow_run_node_run_idx").on(table.run_id),
    index("workflow_run_node_status_idx").on(table.status),
  ],
)
