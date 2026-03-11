import { Log } from "@/util/log"
import { db } from "@/storage"
import { MarketplaceEntryTable, InstalledIntegrationTable } from "./marketplace.sql"
import { eq, and, or, desc, asc, like } from "drizzle-orm"
import { randomUUID } from "crypto"
import {
  type HealthStatus,
  type InstalledIntegration as InstalledIntegrationModel,
  type IntegrationStatus,
  type MarketplaceEntry as MarketplaceEntryModel,
  SearchFilters as SearchFiltersSchema,
  toInstalledIntegration,
  toMarketplaceEntry,
} from "./model"

const log = Log.create({ service: "marketplace" })

export namespace Marketplace {
  export type SearchFilters = import("./model").SearchFilters
  export type MarketplaceEntry = MarketplaceEntryModel
  export type InstalledIntegration = InstalledIntegrationModel

  export async function searchEntries(filters: SearchFilters): Promise<MarketplaceEntryModel[]> {
    const parsed = SearchFiltersSchema.parse(filters)
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

    const results = await filteredQuery
      .orderBy(parsed.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn))
      .limit(parsed.limit)
      .offset(parsed.offset)

    return results.map(toMarketplaceEntry)
  }

  export async function getEntry(id: string): Promise<MarketplaceEntryModel | null> {
    const result = await db.select().from(MarketplaceEntryTable).where(eq(MarketplaceEntryTable.id, id)).limit(1)
    return result[0] ? toMarketplaceEntry(result[0]) : null
  }

  export async function installIntegration(
    userId: string,
    orgId: string,
    marketplaceEntryId: string,
    config: Record<string, unknown> = {},
  ): Promise<InstalledIntegrationModel> {
    const entry = await getEntry(marketplaceEntryId)
    if (!entry) throw new Error("Marketplace entry not found")

    const now = Date.now()
    const integration = {
      id: randomUUID(),
      user_id: userId,
      org_id: orgId,
      marketplace_entry_id: marketplaceEntryId,
      name: entry.name,
      version: entry.version,
      install_state: "requested",
      status: "installed",
      config,
      retry_count: 0,
      health_status: "unknown",
      time_created: now,
      time_updated: now,
    } as const

    await db.insert(InstalledIntegrationTable).values(integration)
    log.info("Integration install requested", { userId, orgId, integrationId: integration.id, name: entry.name })

    const inserted = await db
      .select()
      .from(InstalledIntegrationTable)
      .where(eq(InstalledIntegrationTable.id, integration.id))
      .limit(1)
    if (!inserted[0]) throw new Error("Failed to load installed integration")
    return toInstalledIntegration(inserted[0])
  }

  export async function getUserIntegrations(userId: string, orgId: string): Promise<InstalledIntegrationModel[]> {
    const results = await db
      .select()
      .from(InstalledIntegrationTable)
      .where(and(eq(InstalledIntegrationTable.user_id, userId), eq(InstalledIntegrationTable.org_id, orgId)))
      .orderBy(desc(InstalledIntegrationTable.time_created))

    return results.map(toInstalledIntegration)
  }

  export async function updateIntegrationStatus(
    integrationId: string,
    status: IntegrationStatus,
    healthStatus?: HealthStatus,
    healthError?: string,
  ): Promise<void> {
    const updates: {
      status: IntegrationStatus
      time_updated: number
      health_status?: HealthStatus
      last_health_check?: number
      health_error?: string | null
    } = {
      status,
      time_updated: Date.now(),
    }

    if (healthStatus) {
      updates.health_status = healthStatus
      updates.last_health_check = Date.now()
    }
    if (healthError !== undefined) {
      updates.health_error = healthError || null
    }

    await db.update(InstalledIntegrationTable).set(updates).where(eq(InstalledIntegrationTable.id, integrationId))
  }

  export async function removeIntegration(userId: string, orgId: string, integrationId: string): Promise<void> {
    await db
      .delete(InstalledIntegrationTable)
      .where(
        and(
          eq(InstalledIntegrationTable.id, integrationId),
          eq(InstalledIntegrationTable.user_id, userId),
          eq(InstalledIntegrationTable.org_id, orgId),
        ),
      )

    log.info("Integration removed", { userId, orgId, integrationId })
  }
}
