import { Log } from "@/util/log"
import { db } from "@/storage"
import { InstalledIntegrationTable, AuthConnectionTable } from "./marketplace.sql"
import { MarketplaceRegistry } from "./registry"
import { QueueManager } from "@/queue"
import { eq, and } from "drizzle-orm"
import { randomUUID } from "crypto"
import { InstallState as InstallStateSchema, type InstallState as InstallStateValue } from "./model"

const log = Log.create({ service: "marketplace.installer" })

type InstallConfig = Record<string, unknown> & { authToken?: string }

const STATE_TRANSITIONS: Record<InstallStateValue, InstallStateValue[]> = {
  requested: ["validating", "failed"],
  validating: ["awaiting_auth", "installing", "failed"],
  awaiting_auth: ["installing", "failed"],
  installing: ["discovering", "failed"],
  discovering: ["connected", "failed"],
  connected: ["disabled", "failed"],
  failed: ["requested", "disabled"],
  disabled: ["requested"],
}

export namespace InstallerService {
  export type InstallState = InstallStateValue

  export async function requestInstall(
    userId: string,
    orgId: string,
    marketplaceEntryId: string,
    config: Record<string, unknown> = {},
  ): Promise<{ integrationId: string; jobId: string }> {
    const existing = await db
      .select()
      .from(InstalledIntegrationTable)
      .where(
        and(
          eq(InstalledIntegrationTable.org_id, orgId),
          eq(InstalledIntegrationTable.marketplace_entry_id, marketplaceEntryId),
        ),
      )
      .limit(1)

    if (existing[0]) {
      throw new Error("Integration already installed for this organization")
    }

    const entry = await MarketplaceRegistry.getEntry(marketplaceEntryId)
    if (!entry) throw new Error("Marketplace entry not found")

    const integrationId = randomUUID()
    const now = Date.now()
    await db.insert(InstalledIntegrationTable).values({
      id: integrationId,
      user_id: userId,
      org_id: orgId,
      marketplace_entry_id: marketplaceEntryId,
      name: entry.name,
      version: entry.version,
      install_state: "requested",
      status: "installed",
      config,
      retry_count: 0,
      time_created: now,
      time_updated: now,
    })

    const job = await QueueManager.addInstallJob({
      userId,
      orgId,
      integrationId,
      marketplaceEntryId,
      config,
      retryCount: 0,
    })

    const jobId = job.id?.toString() ?? ""
    await db.update(InstalledIntegrationTable).set({ job_id: jobId }).where(eq(InstalledIntegrationTable.id, integrationId))

    log.info("Install requested", { integrationId, userId, orgId, jobId })
    return { integrationId, jobId }
  }

  export async function processInstall(
    userId: string,
    orgId: string,
    integrationId: string,
    marketplaceEntryId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    try {
      await transitionState(integrationId, "validating")

      const entry = await MarketplaceRegistry.getEntry(marketplaceEntryId)
      if (!entry) throw new Error("Marketplace entry not found")

      const manifest = await MarketplaceRegistry.fetchManifest(entry.manifestUrl)
      const validation = await MarketplaceRegistry.validateManifest(manifest)
      if (!validation.valid) {
        throw new Error(`Manifest validation failed: ${validation.errors.join(", ")}`)
      }

      const installConfig = config as InstallConfig
      if (manifest.auth.required) {
        await transitionState(integrationId, "awaiting_auth")
        if (!installConfig.authToken) {
          throw new Error("Authentication required but not provided")
        }
      }

      await transitionState(integrationId, "installing")

      let authConnectionId: string | undefined
      if (manifest.auth.required && installConfig.authToken && manifest.auth.type) {
        authConnectionId = await createAuthConnection(
          userId,
          orgId,
          integrationId,
          manifest.auth.type,
          { token: installConfig.authToken },
          manifest.auth.scopes,
        )
      }

      await transitionState(integrationId, "discovering")
      await transitionState(integrationId, "connected")

      await db
        .update(InstalledIntegrationTable)
        .set({
          auth_connection_id: authConnectionId,
          health_status: "healthy",
          time_updated: Date.now(),
        })
        .where(eq(InstalledIntegrationTable.id, integrationId))

      log.info("Install completed successfully", { integrationId, userId, orgId })
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown install error"
      log.error("Install failed", { error, integrationId, userId, orgId })

      await transitionState(integrationId, "failed", message)

      const current = await db
        .select({ retry_count: InstalledIntegrationTable.retry_count })
        .from(InstalledIntegrationTable)
        .where(eq(InstalledIntegrationTable.id, integrationId))
        .limit(1)
      const nextRetryCount = (current[0]?.retry_count ?? 0) + 1
      await db
        .update(InstalledIntegrationTable)
        .set({ retry_count: nextRetryCount, time_updated: Date.now() })
        .where(eq(InstalledIntegrationTable.id, integrationId))

      throw error
    }
  }

  export async function transitionState(
    integrationId: string,
    newState: InstallStateValue,
    failureReason?: string,
  ): Promise<void> {
    const current = await db
      .select({ install_state: InstalledIntegrationTable.install_state })
      .from(InstalledIntegrationTable)
      .where(eq(InstalledIntegrationTable.id, integrationId))
      .limit(1)
    if (!current[0]) throw new Error("Integration not found")

    const currentState = InstallStateSchema.parse(current[0].install_state)
    const allowedTransitions = STATE_TRANSITIONS[currentState]
    if (!allowedTransitions.includes(newState)) {
      throw new Error(`Invalid state transition from ${currentState} to ${newState}`)
    }

    const updates: {
      install_state: InstallStateValue
      time_updated: number
      failure_reason?: string | null
      health_status?: "healthy" | "unhealthy"
    } = { install_state: newState, time_updated: Date.now() }

    if (newState === "failed" && failureReason) {
      updates.failure_reason = failureReason
      updates.health_status = "unhealthy"
    }
    if (newState === "connected") {
      updates.failure_reason = null
      updates.health_status = "healthy"
    }

    await db.update(InstalledIntegrationTable).set(updates).where(eq(InstalledIntegrationTable.id, integrationId))
    log.info("State transition", { integrationId, from: currentState, to: newState })
  }

  export async function retryInstall(integrationId: string): Promise<void> {
    const integration = await db.select().from(InstalledIntegrationTable).where(eq(InstalledIntegrationTable.id, integrationId)).limit(1)
    if (!integration[0]) throw new Error("Integration not found")

    const record = integration[0]
    if (record.install_state !== "failed") throw new Error("Can only retry failed installations")
    if ((record.retry_count ?? 0) >= 3) throw new Error("Maximum retry attempts exceeded")

    await transitionState(integrationId, "requested")

    const job = await QueueManager.addInstallJob({
      userId: record.user_id,
      orgId: record.org_id,
      integrationId: record.id,
      marketplaceEntryId: record.marketplace_entry_id,
      config: (record.config as Record<string, unknown> | null) ?? {},
      retryCount: record.retry_count ?? 0,
    })

    await db
      .update(InstalledIntegrationTable)
      .set({ job_id: job.id?.toString() ?? "", time_updated: Date.now() })
      .where(eq(InstalledIntegrationTable.id, integrationId))

    log.info("Install retry queued", { integrationId, retryCount: record.retry_count ?? 0 })
  }

  async function createAuthConnection(
    userId: string,
    orgId: string,
    integrationId: string,
    authType: string,
    credentials: Record<string, unknown>,
    scopes: string[],
  ): Promise<string> {
    const connectionId = randomUUID()
    await db.insert(AuthConnectionTable).values({
      id: connectionId,
      user_id: userId,
      org_id: orgId,
      integration_id: integrationId,
      auth_type: authType,
      credentials,
      scopes,
      time_created: Date.now(),
      time_updated: Date.now(),
    })
    return connectionId
  }

  export async function getInstallStatus(
    integrationId: string,
    orgId: string,
  ): Promise<{ state: InstallStateValue; status: string; failureReason?: string; retryCount: number; jobId?: string } | null> {
    const result = await db
      .select()
      .from(InstalledIntegrationTable)
      .where(and(eq(InstalledIntegrationTable.id, integrationId), eq(InstalledIntegrationTable.org_id, orgId)))
      .limit(1)
    if (!result[0]) return null

    return {
      state: InstallStateSchema.parse(result[0].install_state),
      status: result[0].status,
      failureReason: result[0].failure_reason ?? undefined,
      retryCount: result[0].retry_count ?? 0,
      jobId: result[0].job_id ?? undefined,
    }
  }
}
