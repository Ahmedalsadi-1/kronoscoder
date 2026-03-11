import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core"
import { Timestamps } from "@/storage/schema.sql"

// Marketplace registry entries
export const MarketplaceEntryTable = sqliteTable(
  "marketplace_entry",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    display_name: text().notNull(),
    description: text(),
    publisher: text().notNull(),
    category: text().notNull(),
    version: text().notNull(),
    homepage_url: text(),
    repository_url: text(),
    documentation_url: text(),
    icon_url: text(),
    verified: integer({ mode: "boolean" }).default(false),
    featured: integer({ mode: "boolean" }).default(false),
    download_count: integer().default(0),
    rating_average: integer().default(0),
    rating_count: integer().default(0),
    tags: text({ mode: "json" }).$type<string[]>().default([]),
    screenshots: text({ mode: "json" }).$type<string[]>().default([]),
    manifest_url: text().notNull(),
    auth_required: integer({ mode: "boolean" }).default(false),
    auth_type: text(), // oauth, api_key, etc
    auth_scopes: text({ mode: "json" }).$type<string[]>().default([]),
    permissions: text({ mode: "json" }).$type<string[]>().default([]),
    tools_exposed: text({ mode: "json" }).$type<string[]>().default([]),
    risk_level: text().default("low"), // low, medium, high
    risk_notes: text(),
    ...Timestamps,
  },
  (table) => [
    index("marketplace_category_idx").on(table.category),
    index("marketplace_publisher_idx").on(table.publisher),
    index("marketplace_verified_idx").on(table.verified),
  ],
)

// User installed integrations
export const InstalledIntegrationTable = sqliteTable(
  "installed_integration",
  {
    id: text().primaryKey(),
    user_id: text().notNull(),
    org_id: text().notNull(),
    marketplace_entry_id: text()
      .notNull()
      .references(() => MarketplaceEntryTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    version: text().notNull(),
    install_state: text().notNull().default("requested"), // requested, validating, awaiting_auth, installing, discovering, connected, failed, disabled
    status: text().notNull().default("installed"), // installed, connected, disabled, failed
    config: text({ mode: "json" }).$type<Record<string, any>>().default({}),
    auth_connection_id: text(),
    last_health_check: integer(),
    health_status: text().default("unknown"), // healthy, unhealthy, unknown
    health_error: text(),
    failure_reason: text(),
    retry_count: integer().default(0),
    job_id: text(),
    ...Timestamps,
  },
  (table) => [
    index("installed_integration_user_idx").on(table.user_id),
    index("installed_integration_org_idx").on(table.org_id),
    index("installed_integration_status_idx").on(table.status),
    index("installed_integration_state_idx").on(table.install_state),
    // Prevent duplicate installs per org
    uniqueIndex("installed_integration_unique_idx").on(table.org_id, table.marketplace_entry_id),
  ],
)

// Auth connections for integrations
export const AuthConnectionTable = sqliteTable(
  "auth_connection",
  {
    id: text().primaryKey(),
    user_id: text().notNull(),
    org_id: text().notNull(),
    integration_id: text()
      .notNull()
      .references(() => InstalledIntegrationTable.id, { onDelete: "cascade" }),
    auth_type: text().notNull(),
    credentials: text({ mode: "json" }).$type<Record<string, any>>().notNull(),
    scopes: text({ mode: "json" }).$type<string[]>().default([]),
    expires_at: integer(),
    refresh_token: text(),
    ...Timestamps,
  },
  (table) => [
    index("auth_connection_user_idx").on(table.user_id),
    index("auth_connection_org_idx").on(table.org_id),
    index("auth_connection_integration_idx").on(table.integration_id),
  ],
)

// Tool permissions for integrations
export const ToolPermissionTable = sqliteTable(
  "tool_permission",
  {
    id: text().primaryKey(),
    user_id: text().notNull(),
    org_id: text().notNull(),
    integration_id: text()
      .notNull()
      .references(() => InstalledIntegrationTable.id, { onDelete: "cascade" }),
    tool_name: text().notNull(),
    permission_level: text().notNull().default("denied"), // allowed, denied, prompt
    granted_at: integer(),
    granted_by: text(),
    ...Timestamps,
  },
  (table) => [
    index("tool_permission_user_idx").on(table.user_id),
    index("tool_permission_org_idx").on(table.org_id),
    index("tool_permission_integration_idx").on(table.integration_id),
  ],
)

// Invocation logs for audit
export const InvocationLogTable = sqliteTable(
  "invocation_log",
  {
    id: text().primaryKey(),
    user_id: text().notNull(),
    org_id: text().notNull(),
    integration_id: text()
      .notNull()
      .references(() => InstalledIntegrationTable.id, { onDelete: "cascade" }),
    tool_name: text().notNull(),
    session_id: text(),
    input_params: text({ mode: "json" }).$type<Record<string, any>>(),
    output_result: text({ mode: "json" }).$type<Record<string, any>>(),
    status: text().notNull(), // success, error, timeout
    error_message: text(),
    duration_ms: integer(),
    ...Timestamps,
  },
  (table) => [
    index("invocation_log_user_idx").on(table.user_id),
    index("invocation_log_org_idx").on(table.org_id),
    index("invocation_log_integration_idx").on(table.integration_id),
    index("invocation_log_session_idx").on(table.session_id),
  ],
)
