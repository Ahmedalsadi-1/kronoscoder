import { z } from "zod"
import { MarketplaceEntryTable, InstalledIntegrationTable } from "./marketplace.sql"

export const Category = z.enum([
  "productivity",
  "development",
  "communication",
  "data",
  "ai",
  "automation",
  "monitoring",
  "security",
  "other",
])
export type Category = z.infer<typeof Category>

export const RiskLevel = z.enum(["low", "medium", "high"])
export type RiskLevel = z.infer<typeof RiskLevel>

export const AuthType = z.enum(["oauth", "api_key", "basic", "bearer"])
export type AuthType = z.infer<typeof AuthType>

export const PermissionLevel = z.enum(["allowed", "denied", "prompt"])
export type PermissionLevel = z.infer<typeof PermissionLevel>

export const IntegrationStatus = z.enum(["installed", "connected", "disabled", "failed"])
export type IntegrationStatus = z.infer<typeof IntegrationStatus>

export const InstallState = z.enum([
  "requested",
  "validating",
  "awaiting_auth",
  "installing",
  "discovering",
  "connected",
  "failed",
  "disabled",
])
export type InstallState = z.infer<typeof InstallState>

export const HealthStatus = z.enum(["healthy", "unhealthy", "unknown"])
export type HealthStatus = z.infer<typeof HealthStatus>

export const MarketplaceEntry = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  publisher: z.string(),
  category: Category,
  version: z.string(),
  homepageUrl: z.string().optional(),
  repositoryUrl: z.string().optional(),
  documentationUrl: z.string().optional(),
  iconUrl: z.string().optional(),
  verified: z.boolean().default(false),
  featured: z.boolean().default(false),
  downloadCount: z.number().default(0),
  ratingAverage: z.number().default(0),
  ratingCount: z.number().default(0),
  tags: z.array(z.string()).default([]),
  screenshots: z.array(z.string()).default([]),
  manifestUrl: z.string(),
  authRequired: z.boolean().default(false),
  authType: AuthType.optional(),
  authScopes: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  toolsExposed: z.array(z.string()).default([]),
  riskLevel: RiskLevel.default("low"),
  riskNotes: z.string().optional(),
  timeCreated: z.number(),
  timeUpdated: z.number(),
})
export type MarketplaceEntry = z.infer<typeof MarketplaceEntry>

export const InstalledIntegration = z.object({
  id: z.string(),
  userId: z.string(),
  orgId: z.string(),
  marketplaceEntryId: z.string(),
  name: z.string(),
  version: z.string(),
  installState: InstallState,
  status: IntegrationStatus,
  config: z.record(z.string(), z.unknown()).default({}),
  authConnectionId: z.string().optional(),
  lastHealthCheck: z.number().optional(),
  healthStatus: HealthStatus.default("unknown"),
  healthError: z.string().optional(),
  failureReason: z.string().optional(),
  retryCount: z.number().default(0),
  jobId: z.string().optional(),
  timeCreated: z.number(),
  timeUpdated: z.number(),
})
export type InstalledIntegration = z.infer<typeof InstalledIntegration>

export const SearchFilters = z.object({
  query: z.string().optional(),
  category: Category.optional(),
  verified: z.boolean().optional(),
  featured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  riskLevel: RiskLevel.optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(["name", "downloads", "rating", "updated"]).default("downloads"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})
export type SearchFilters = z.infer<typeof SearchFilters>

export const IntegrationManifest = z.object({
  id: z.string(),
  version: z.string(),
  publisher: z.object({
    name: z.string(),
    email: z.string().email(),
    verified: z.boolean().default(false),
  }),
  metadata: z.object({
    name: z.string(),
    displayName: z.string(),
    description: z.string(),
    category: Category,
    tags: z.array(z.string()).default([]),
    iconUrl: z.string().url().optional(),
    screenshots: z.array(z.string().url()).default([]),
    homepageUrl: z.string().url().optional(),
    repositoryUrl: z.string().url().optional(),
    documentationUrl: z.string().url().optional(),
  }),
  transport: z.object({
    type: z.enum(["stdio", "sse", "websocket"]),
    command: z.string().optional(),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).default({}),
    url: z.string().url().optional(),
  }),
  auth: z
    .object({
      required: z.boolean().default(false),
      type: AuthType.optional(),
      scopes: z.array(z.string()).default([]),
      authUrl: z.string().url().optional(),
      tokenUrl: z.string().url().optional(),
    })
    .default(() => ({ required: false, scopes: [] })),
  capabilities: z.object({
    tools: z
      .array(
        z.object({
          name: z.string(),
          description: z.string(),
          inputSchema: z.record(z.string(), z.unknown()),
          dangerous: z.boolean().default(false),
          readOnly: z.boolean().default(true),
        }),
      )
      .default([]),
    resources: z
      .array(
        z.object({
          name: z.string(),
          description: z.string(),
          mimeType: z.string().optional(),
        }),
      )
      .default([]),
    prompts: z
      .array(
        z.object({
          name: z.string(),
          description: z.string(),
          arguments: z
            .array(
              z.object({
                name: z.string(),
                description: z.string(),
                required: z.boolean().default(false),
              }),
            )
            .default([]),
        }),
      )
      .default([]),
  }),
  sandbox: z
    .object({
      required: z.boolean().default(false),
      types: z.array(z.enum(["browser", "terminal", "desktop"])).default([]),
      resources: z
        .object({
          memory: z.number().min(512).max(8192).default(1024),
          cpu: z.number().min(0.5).max(4).default(1),
          timeout: z.number().min(300).max(28800).default(3600),
        })
        .default({ memory: 1024, cpu: 1, timeout: 3600 }),
    })
    .default(() => ({
      required: false,
      types: [],
      resources: { memory: 1024, cpu: 1, timeout: 3600 },
    })),
  security: z.object({
    riskLevel: RiskLevel.default("low"),
    permissions: z.array(z.string()).default([]),
    riskNotes: z.string().optional(),
    dataAccess: z
      .array(z.enum(["filesystem", "network", "environment", "clipboard", "camera", "microphone"]))
      .default([]),
  }),
  healthCheck: z
    .object({
      enabled: z.boolean().default(true),
      interval: z.number().min(60).max(3600).default(300),
      timeout: z.number().min(5).max(60).default(30),
      endpoint: z.string().optional(),
    })
    .default(() => ({ enabled: true, interval: 300, timeout: 30 })),
})
export type IntegrationManifest = z.infer<typeof IntegrationManifest>

type MarketplaceEntryRow = typeof MarketplaceEntryTable.$inferSelect
type InstalledIntegrationRow = typeof InstalledIntegrationTable.$inferSelect

export function toMarketplaceEntry(row: MarketplaceEntryRow): MarketplaceEntry {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description ?? undefined,
    publisher: row.publisher,
    category: Category.parse(row.category),
    version: row.version,
    homepageUrl: row.homepage_url ?? undefined,
    repositoryUrl: row.repository_url ?? undefined,
    documentationUrl: row.documentation_url ?? undefined,
    iconUrl: row.icon_url ?? undefined,
    verified: Boolean(row.verified),
    featured: Boolean(row.featured),
    downloadCount: row.download_count ?? 0,
    ratingAverage: row.rating_average ?? 0,
    ratingCount: row.rating_count ?? 0,
    tags: row.tags ?? [],
    screenshots: row.screenshots ?? [],
    manifestUrl: row.manifest_url,
    authRequired: Boolean(row.auth_required),
    authType: row.auth_type ? AuthType.parse(row.auth_type) : undefined,
    authScopes: row.auth_scopes ?? [],
    permissions: row.permissions ?? [],
    toolsExposed: row.tools_exposed ?? [],
    riskLevel: row.risk_level ? RiskLevel.parse(row.risk_level) : "low",
    riskNotes: row.risk_notes ?? undefined,
    timeCreated: row.time_created,
    timeUpdated: row.time_updated,
  }
}

export function toInstalledIntegration(row: InstalledIntegrationRow): InstalledIntegration {
  return {
    id: row.id,
    userId: row.user_id,
    orgId: row.org_id,
    marketplaceEntryId: row.marketplace_entry_id,
    name: row.name,
    version: row.version,
    installState: InstallState.parse(row.install_state),
    status: IntegrationStatus.parse(row.status),
    config: (row.config as Record<string, unknown> | null) ?? {},
    authConnectionId: row.auth_connection_id ?? undefined,
    lastHealthCheck: row.last_health_check ?? undefined,
    healthStatus: row.health_status ? HealthStatus.parse(row.health_status) : "unknown",
    healthError: row.health_error ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    retryCount: row.retry_count ?? 0,
    jobId: row.job_id ?? undefined,
    timeCreated: row.time_created,
    timeUpdated: row.time_updated,
  }
}
