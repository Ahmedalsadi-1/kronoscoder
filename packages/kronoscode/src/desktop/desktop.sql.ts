import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "@/storage/schema.sql"

// Desktop session management
export const DesktopSessionTable = sqliteTable(
  "desktop_session",
  {
    id: text().primaryKey(),
    user_id: text().notNull(),
    org_id: text().notNull(),
    session_type: text().notNull(), // browser, terminal, desktop
    session_state: text().notNull().default("provisioning"), // provisioning, active, paused, takeover_pending, controlled_by_user, controlled_by_agent, expiring, expired, failed
    status: text().notNull().default("pending"), // pending, starting, active, paused, stopped, failed
    sandbox_id: text(),
    sandbox_provider: text().default("e2b"),
    sandbox_credentials: text({ mode: "json" }).$type<Record<string, any>>(),
    config: text({ mode: "json" }).$type<{
      timeout_minutes?: number
      memory_limit_mb?: number
      cpu_limit?: number
      environment?: Record<string, string>
      allowed_domains?: string[]
    }>().default({}),
    metadata: text({ mode: "json" }).$type<{
      agent_id?: string
      session_name?: string
      description?: string
      tags?: string[]
    }>().default({}),
    started_at: integer(),
    paused_at: integer(),
    stopped_at: integer(),
    last_activity_at: integer(),
    last_heartbeat_at: integer(),
    control_mode: text().notNull().default("agent"), // agent, user
    takeover_user_id: text(),
    takeover_started_at: integer(),
    takeover_lock_expires_at: integer(),
    usage_minutes: integer().default(0),
    usage_compute_units: integer().default(0),
    billing_tier: text().default("free"),
    job_id: text(),
    ...Timestamps,
  },
  (table) => [
    index("desktop_session_user_idx").on(table.user_id),
    index("desktop_session_org_idx").on(table.org_id),
    index("desktop_session_status_idx").on(table.status),
    index("desktop_session_state_idx").on(table.session_state),
    index("desktop_session_type_idx").on(table.session_type),
    index("desktop_session_heartbeat_idx").on(table.last_heartbeat_at),
  ],
)

// Session audit logs
export const SessionAuditLogTable = sqliteTable(
  "session_audit_log",
  {
    id: text().primaryKey(),
    session_id: text()
      .notNull()
      .references(() => DesktopSessionTable.id, { onDelete: "cascade" }),
    user_id: text().notNull(),
    action: text().notNull(), // create, start, pause, resume, stop, takeover, release
    details: text({ mode: "json" }).$type<Record<string, any>>().default({}),
    ip_address: text(),
    user_agent: text(),
    ...Timestamps,
  },
  (table) => [
    index("session_audit_session_idx").on(table.session_id),
    index("session_audit_user_idx").on(table.user_id),
    index("session_audit_action_idx").on(table.action),
  ],
)

// Session usage tracking for billing
export const SessionUsageTable = sqliteTable(
  "session_usage",
  {
    id: text().primaryKey(),
    session_id: text()
      .notNull()
      .references(() => DesktopSessionTable.id, { onDelete: "cascade" }),
    user_id: text().notNull(),
    org_id: text().notNull(),
    usage_type: text().notNull(), // minutes, compute_units, storage_mb, bandwidth_mb
    amount: integer().notNull(),
    billing_period: text().notNull(), // YYYY-MM format
    recorded_at: integer().notNull(),
    ...Timestamps,
  },
  (table) => [
    index("session_usage_session_idx").on(table.session_id),
    index("session_usage_user_idx").on(table.user_id),
    index("session_usage_org_idx").on(table.org_id),
    index("session_usage_period_idx").on(table.billing_period),
  ],
)
