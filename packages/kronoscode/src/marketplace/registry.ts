import { Log } from "@/util/log"
import { db } from "@/storage"
import { MarketplaceEntryTable } from "./marketplace.sql"
import { eq, and, or, desc, asc, like } from "drizzle-orm"
import NodeCache from "node-cache"
import {
  IntegrationManifest as IntegrationManifestSchema,
  type IntegrationManifest as IntegrationManifestModel,
  type MarketplaceEntry,
  SearchFilters as SearchFiltersSchema,
  toMarketplaceEntry,
} from "./model"

const log = Log.create({ service: "marketplace.registry" })
const cache = new NodeCache({ stdTTL: 300 })
const MCP_REGISTRY_BASE_URL = process.env.KRONOSCODE_MCP_REGISTRY_BASE_URL || "https://registry.modelcontextprotocol.io"

type ManifestValidationResult = { valid: boolean; errors: string[] }
type RegistryMeta = {
  "io.modelcontextprotocol.registry/official"?: {
    status?: string
    statusChangedAt?: string
    publishedAt?: string
    updatedAt?: string
    isLatest?: boolean
  }
}
type RegistryServer = {
  name: string
  title?: string | null
  description?: string | null
  version?: string | null
  websiteUrl?: string | null
  repository?: { url?: string; source?: string; id?: string; subfolder?: string }
  remotes?: Array<{ type?: string; url?: string }>
  packages?: Array<{
    registryType?: string
    identifier?: string
    version?: string
    runtimeHint?: string
    transport?: { type?: string; url?: string }
    environmentVariables?: Array<{ name?: string; isRequired?: boolean; description?: string; default?: string }>
    packageArguments?: Array<{ name?: string; isRequired?: boolean; description?: string; default?: string }>
  }>
  tools?: Array<{ name?: string; description?: string }>
  resources?: Array<{ name?: string; description?: string; mimeType?: string }>
  prompts?: Array<{ name?: string; description?: string; arguments?: Array<{ name?: string; description?: string; required?: boolean }> }>
}
type RegistryEntry = { server: RegistryServer; _meta?: RegistryMeta }
type RegistryListResponse = { servers: RegistryEntry[]; next_cursor?: string | null }
type RegistryVersionResponse = RegistryEntry

export namespace MarketplaceRegistry {
  export type IntegrationManifest = import("./model").IntegrationManifest
  export type SearchFilters = import("./model").SearchFilters

  export async function searchEntries(filters: SearchFilters): Promise<MarketplaceEntry[]> {
    const parsed = SearchFiltersSchema.parse(filters)
    const cacheKey = `search:${JSON.stringify(parsed)}`
    const cached = cache.get(cacheKey)
    if (cached) return cached as MarketplaceEntry[]

    const baseQuery = db.select().from(MarketplaceEntryTable)
    const conditions = []

    if (parsed.query) {
      conditions.push(
        or(
          like(MarketplaceEntryTable.name, `%${parsed.query}%`),
          like(MarketplaceEntryTable.display_name, `%${parsed.query}%`),
          like(MarketplaceEntryTable.description, `%${parsed.query}%`),
        ),
      )
    }
    if (parsed.category) {
      conditions.push(eq(MarketplaceEntryTable.category, parsed.category))
    }
    if (parsed.verified !== undefined) {
      conditions.push(eq(MarketplaceEntryTable.verified, parsed.verified))
    }
    if (parsed.featured !== undefined) {
      conditions.push(eq(MarketplaceEntryTable.featured, parsed.featured))
    }
    if (parsed.riskLevel) {
      conditions.push(eq(MarketplaceEntryTable.risk_level, parsed.riskLevel))
    }

    const filteredQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery

    const sortColumn = {
      name: MarketplaceEntryTable.display_name,
      downloads: MarketplaceEntryTable.download_count,
      rating: MarketplaceEntryTable.rating_average,
      updated: MarketplaceEntryTable.time_updated,
    }[parsed.sortBy]

    const rows = await filteredQuery
      .orderBy(parsed.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn))
      .limit(parsed.limit)
      .offset(parsed.offset)
    const localResults = rows.map(toMarketplaceEntry)

    if (localResults.length >= parsed.limit || process.env.KRONOSCODE_MARKETPLACE_DISABLE_REMOTE === "true") {
      cache.set(cacheKey, localResults)
      return localResults
    }

    const remoteResults = await fetchRemoteEntries(parsed.query, parsed.limit).catch((error) => {
      log.warn("Failed to fetch remote marketplace entries", { error })
      return [] as MarketplaceEntry[]
    })
    const merged = new Map<string, MarketplaceEntry>()
    for (const entry of localResults) merged.set(entry.id, entry)
    for (const entry of remoteResults) {
      if (!entry.category || (parsed.category && entry.category !== parsed.category)) continue
      merged.set(entry.id, entry)
    }
    const results = Array.from(merged.values()).slice(0, parsed.limit)

    cache.set(cacheKey, results)
    return results
  }

  export async function getEntry(id: string): Promise<MarketplaceEntry | null> {
    const cacheKey = `entry:${id}`
    const cached = cache.get(cacheKey)
    if (cached) return cached as MarketplaceEntry

    const result = await db.select().from(MarketplaceEntryTable).where(eq(MarketplaceEntryTable.id, id)).limit(1)
    const entry = result[0] ? toMarketplaceEntry(result[0]) : null
    if (entry) {
      cache.set(cacheKey, entry)
      return entry
    }

    if (process.env.KRONOSCODE_MARKETPLACE_DISABLE_REMOTE === "true") {
      return null
    }

    const remoteEntry = await fetchRemoteEntry(id).catch((error) => {
      log.warn("Failed to fetch remote marketplace entry", { id, error })
      return null
    })
    if (!remoteEntry) return null
    cache.set(cacheKey, remoteEntry)
    return remoteEntry
  }

  export async function fetchManifest(manifestUrl: string): Promise<IntegrationManifest> {
    const cacheKey = `manifest:${manifestUrl}`
    const cached = cache.get(cacheKey)
    if (cached) return cached as IntegrationManifest

    try {
      const response = await fetch(manifestUrl, {
        headers: { "User-Agent": "KronosCode-Registry/1.0" },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`)
      }

      const payload = await response.json()
      const manifest = mapPayloadToManifest(payload, manifestUrl)
      cache.set(cacheKey, manifest, 3600)
      return manifest
    } catch (error) {
      log.error("Failed to fetch integration manifest", { error, manifestUrl })
      const message = error instanceof Error ? error.message : "unknown fetch error"
      throw new Error(`Invalid or unreachable manifest: ${message}`)
    }
  }

  export async function validateManifest(manifest: IntegrationManifest): Promise<ManifestValidationResult> {
    const errors: string[] = []

    if (!manifest.publisher.verified && manifest.security.riskLevel === "low") {
      errors.push("Unverified publishers cannot have low risk level")
    }

    const dangerousTools = manifest.capabilities.tools.filter((tool) => tool.dangerous)
    if (dangerousTools.length > 0 && manifest.security.riskLevel === "low") {
      errors.push("Integrations with dangerous tools cannot have low risk level")
    }

    if (manifest.sandbox.required && manifest.sandbox.types.length === 0) {
      errors.push("Sandbox required but no sandbox types specified")
    }

    if (manifest.auth.required && !manifest.auth.type) {
      errors.push("Auth required but no auth type specified")
    }

    return { valid: errors.length === 0, errors }
  }

  export function invalidateCache(pattern?: string): void {
    if (pattern) {
      cache.del(cache.keys().filter((key) => key.includes(pattern)))
      return
    }
    cache.flushAll()
  }
}

function mapPayloadToManifest(payload: unknown, _manifestUrl: string): IntegrationManifestModel {
  if (isRegistryVersionPayload(payload)) {
    return registryToManifest(payload.server)
  }
  return IntegrationManifestSchema.parse(payload)
}

function isRegistryVersionPayload(payload: unknown): payload is RegistryVersionResponse {
  if (!payload || typeof payload !== "object") return false
  const server = (payload as { server?: unknown }).server
  return !!server && typeof server === "object" && typeof (server as { name?: unknown }).name === "string"
}

function inferCategory(server: RegistryServer): MarketplaceEntry["category"] {
  const text = `${server.name} ${server.description ?? ""}`.toLowerCase()
  if (text.includes("monitor") || text.includes("observability")) return "monitoring"
  if (text.includes("security") || text.includes("auth")) return "security"
  if (text.includes("dev") || text.includes("github") || text.includes("git")) return "development"
  if (text.includes("data") || text.includes("sql") || text.includes("database")) return "data"
  if (text.includes("automation") || text.includes("workflow")) return "automation"
  if (text.includes("chat") || text.includes("slack") || text.includes("discord")) return "communication"
  if (text.includes("ai") || text.includes("model")) return "ai"
  if (text.includes("calendar") || text.includes("task")) return "productivity"
  return "other"
}

function toRemoteManifestUrl(name: string): string {
  return `${MCP_REGISTRY_BASE_URL}/v0/servers/${encodeURIComponent(name)}/versions/latest`
}

async function upsertEntry(entry: MarketplaceEntry): Promise<void> {
  await db
    .insert(MarketplaceEntryTable)
    .values({
      id: entry.id,
      name: entry.name,
      display_name: entry.displayName,
      description: entry.description ?? null,
      publisher: entry.publisher,
      category: entry.category,
      version: entry.version,
      homepage_url: entry.homepageUrl ?? null,
      repository_url: entry.repositoryUrl ?? null,
      documentation_url: entry.documentationUrl ?? null,
      icon_url: entry.iconUrl ?? null,
      verified: entry.verified,
      featured: entry.featured,
      download_count: entry.downloadCount,
      rating_average: entry.ratingAverage,
      rating_count: entry.ratingCount,
      tags: entry.tags,
      screenshots: entry.screenshots,
      manifest_url: entry.manifestUrl,
      auth_required: entry.authRequired,
      auth_type: entry.authType ?? null,
      auth_scopes: entry.authScopes,
      permissions: entry.permissions,
      tools_exposed: entry.toolsExposed,
      risk_level: entry.riskLevel,
      risk_notes: entry.riskNotes ?? null,
      time_created: entry.timeCreated,
      time_updated: entry.timeUpdated,
    })
    .onConflictDoUpdate({
      target: MarketplaceEntryTable.id,
      set: {
        name: entry.name,
        display_name: entry.displayName,
        description: entry.description ?? null,
        publisher: entry.publisher,
        category: entry.category,
        version: entry.version,
        homepage_url: entry.homepageUrl ?? null,
        repository_url: entry.repositoryUrl ?? null,
        documentation_url: entry.documentationUrl ?? null,
        icon_url: entry.iconUrl ?? null,
        verified: entry.verified,
        featured: entry.featured,
        download_count: entry.downloadCount,
        rating_average: entry.ratingAverage,
        rating_count: entry.ratingCount,
        tags: entry.tags,
        screenshots: entry.screenshots,
        manifest_url: entry.manifestUrl,
        auth_required: entry.authRequired,
        auth_type: entry.authType ?? null,
        auth_scopes: entry.authScopes,
        permissions: entry.permissions,
        tools_exposed: entry.toolsExposed,
        risk_level: entry.riskLevel,
        risk_notes: entry.riskNotes ?? null,
        time_updated: entry.timeUpdated,
      },
    })
}

function mapRegistryEntryToMarketplace(entry: RegistryEntry): MarketplaceEntry {
  const server = entry.server
  const publisher = server.name.includes("/") ? server.name.split("/")[0]! : "community"
  const displayName = (server.title || server.name.split("/").at(-1) || server.name).trim()
  const now = Date.now()
  const official = entry._meta?.["io.modelcontextprotocol.registry/official"]
  const updatedAt = official?.updatedAt ? Date.parse(official.updatedAt) : now
  const publishedAt = official?.publishedAt ? Date.parse(official.publishedAt) : updatedAt

  return {
    id: server.name,
    name: server.name,
    displayName,
    description: server.description ?? undefined,
    publisher,
    category: inferCategory(server),
    version: server.version || "latest",
    homepageUrl: server.websiteUrl ?? undefined,
    repositoryUrl: server.repository?.url,
    documentationUrl: server.websiteUrl ?? server.repository?.url,
    iconUrl: undefined,
    verified: official?.status === "active",
    featured: official?.status === "active",
    downloadCount: 0,
    ratingAverage: 0,
    ratingCount: 0,
    tags: [publisher],
    screenshots: [],
    manifestUrl: toRemoteManifestUrl(server.name),
    authRequired: false,
    authType: undefined,
    authScopes: [],
    permissions: [],
    toolsExposed: (server.tools ?? []).map((tool) => tool.name).filter((name): name is string => !!name),
    riskLevel: "low",
    riskNotes: undefined,
    timeCreated: Number.isFinite(publishedAt) ? publishedAt : now,
    timeUpdated: Number.isFinite(updatedAt) ? updatedAt : now,
  }
}

async function fetchRemoteEntries(query: string | undefined, limit: number): Promise<MarketplaceEntry[]> {
  const params = new URLSearchParams({
    version: "latest",
    limit: String(Math.max(1, Math.min(limit, 50))),
  })
  if (query?.trim()) params.set("search", query.trim())
  const url = `${MCP_REGISTRY_BASE_URL}/v0/servers?${params.toString()}`

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error(`Registry list request failed: ${response.status}`)
  const payload = (await response.json()) as RegistryListResponse
  const entries = (payload.servers || []).map(mapRegistryEntryToMarketplace)
  await Promise.all(entries.map((entry) => upsertEntry(entry)))
  return entries
}

async function fetchRemoteEntry(id: string): Promise<MarketplaceEntry | null> {
  const url = toRemoteManifestUrl(id)
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Registry entry request failed: ${response.status}`)
  const payload = (await response.json()) as RegistryVersionResponse
  const entry = mapRegistryEntryToMarketplace(payload)
  await upsertEntry(entry)
  return entry
}

function runtimeForPackage(pkg: NonNullable<RegistryServer["packages"]>[number]): string[] {
  const identifier = pkg.identifier
  if (!identifier) return []
  const version = pkg.version && pkg.version !== "latest" ? pkg.version : undefined

  if (pkg.registryType === "npm") {
    return ["npx", "-y", version ? `${identifier}@${version}` : identifier]
  }
  if (pkg.registryType === "pypi") {
    return ["uvx", version ? `${identifier}==${version}` : identifier]
  }
  if (pkg.registryType === "oci") {
    return ["docker", "run", "--rm", "-i", identifier]
  }
  return []
}

function registryToManifest(server: RegistryServer): IntegrationManifestModel {
  const firstRemote = server.remotes?.find((remote) => typeof remote.url === "string" && !!remote.url)
  const firstPackage = server.packages?.[0]

  let transport: IntegrationManifestModel["transport"]
  if (firstRemote?.url) {
    const remoteType = firstRemote.type || "streamable-http"
    transport = {
      type: remoteType === "sse" ? "sse" : remoteType === "websocket" ? "websocket" : "sse",
      url: firstRemote.url,
      args: [],
      env: {},
    }
  } else if (firstPackage) {
    transport = {
      type: "stdio",
      command: runtimeForPackage(firstPackage).join(" "),
      args: runtimeForPackage(firstPackage).slice(1),
      env: {},
    }
  } else {
    transport = {
      type: "stdio",
      command: "",
      args: [],
      env: {},
    }
  }

  const envRequirements = (firstPackage?.environmentVariables || [])
    .map((item) => item.name)
    .filter((name): name is string => !!name)

  return IntegrationManifestSchema.parse({
    id: server.name,
    version: server.version || "latest",
    publisher: {
      name: server.name.includes("/") ? server.name.split("/")[0] : "community",
      email: "noreply@example.com",
      verified: true,
    },
    metadata: {
      name: server.name,
      displayName: server.title || server.name.split("/").at(-1) || server.name,
      description: server.description || "MCP integration",
      category: inferCategory(server),
      tags: [],
      homepageUrl: server.websiteUrl || undefined,
      repositoryUrl: server.repository?.url || undefined,
      documentationUrl: server.websiteUrl || server.repository?.url || undefined,
    },
    transport,
    auth: {
      required: false,
      scopes: [],
    },
    capabilities: {
      tools: (server.tools || [])
        .filter((tool) => !!tool.name)
        .map((tool) => ({
          name: tool.name!,
          description: tool.description || "",
          inputSchema: {},
          dangerous: false,
          readOnly: true,
        })),
      resources: (server.resources || [])
        .filter((resource) => !!resource.name)
        .map((resource) => ({
          name: resource.name!,
          description: resource.description || "",
          mimeType: resource.mimeType || undefined,
        })),
      prompts: (server.prompts || [])
        .filter((prompt) => !!prompt.name)
        .map((prompt) => ({
          name: prompt.name!,
          description: prompt.description || "",
          arguments: (prompt.arguments || [])
            .filter((arg) => !!arg.name)
            .map((arg) => ({
              name: arg.name!,
              description: arg.description || "",
              required: Boolean(arg.required),
            })),
        })),
    },
    sandbox: {
      required: false,
      types: [],
      resources: { memory: 1024, cpu: 1, timeout: 3600 },
    },
    security: {
      riskLevel: "low",
      permissions: envRequirements,
      dataAccess: [],
    },
    healthCheck: {
      enabled: false,
      interval: 300,
      timeout: 30,
    },
  })
}
