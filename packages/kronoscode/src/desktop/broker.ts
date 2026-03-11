// @ts-nocheck
import { z } from "zod"
import { Log } from "@/util/log"
import { db } from "@/storage"
import { DesktopSessionTable, SessionAuditLogTable } from "./desktop.sql"
import { QueueManager } from "@/queue"
import { eq, and, lt, desc } from "drizzle-orm"
import { randomUUID } from "crypto"

const log = Log.create({ service: "sandbox.broker" })

// Feature flags
const ENABLE_REAL_E2B = process.env.KRONOSCODE_ENABLE_REAL_E2B === "true"
const ENABLE_REAL_SELF_HOSTED = process.env.KRONOSCODE_ENABLE_REAL_SELF_HOSTED === "true"

export namespace SandboxBroker {
  export const SessionState = z.enum([
    "provisioning",
    "active",
    "paused",
    "takeover_pending",
    "controlled_by_user",
    "controlled_by_agent",
    "expiring",
    "expired",
    "failed",
  ])
  export type SessionState = z.infer<typeof SessionState>

  export const SessionType = z.enum(["browser", "terminal", "desktop"])
  export type SessionType = z.infer<typeof SessionType>

  export const ProviderName = z.enum(["e2b", "self-hosted"])
  export type ProviderName = z.infer<typeof ProviderName>

  export type ProviderSummary = {
    id: ProviderName
    label: string
    enabled: boolean
    implemented: boolean
    available: boolean
    default: boolean
    reason: string | null
    supportedSessionTypes: SessionType[]
  }

  export type QuotaSummary = {
    limits: Record<SessionType, number>
    usage: Record<SessionType, number>
  }

  const SESSION_QUOTA_LIMITS: Record<SessionType, number> = {
    browser: 10,
    terminal: 5,
    desktop: 2,
  }

  const QUOTA_COUNTED_STATES = new Set<SessionState>([
    "provisioning",
    "active",
    "paused",
    "takeover_pending",
    "controlled_by_user",
    "controlled_by_agent",
    "expiring",
  ])

  const buildProviderSummaries = (): ProviderSummary[] => {
    const summaries: ProviderSummary[] = [
      {
        id: "e2b",
        label: "E2B Desktop",
        enabled: ENABLE_REAL_E2B,
        implemented: true,
        available: ENABLE_REAL_E2B,
        default: false,
        reason: ENABLE_REAL_E2B
          ? null
          : "Set KRONOSCODE_ENABLE_REAL_E2B=true to enable production E2B provisioning.",
        supportedSessionTypes: ["browser", "terminal", "desktop"],
      },
      {
        id: "self-hosted",
        label: "Self-hosted Sandbox",
        enabled: ENABLE_REAL_SELF_HOSTED,
        implemented: false,
        available: false,
        default: false,
        reason: ENABLE_REAL_SELF_HOSTED
          ? "Self-hosted sandboxing is flagged on, but the server integration is not implemented yet."
          : "Set KRONOSCODE_ENABLE_REAL_SELF_HOSTED=true after wiring the self-hosted provider.",
        supportedSessionTypes: ["browser", "terminal", "desktop"],
      },
    ]

    const defaultProvider = summaries.find((summary) => summary.available)?.id ?? null
    return summaries.map((summary) => ({
      ...summary,
      default: summary.id === defaultProvider,
    }))
  }

  const STATE_TRANSITIONS: Record<SessionState, SessionState[]> = {
    provisioning: ["active", "failed"],
    active: ["paused", "takeover_pending", "controlled_by_agent", "expiring", "failed"],
    paused: ["active", "expiring", "failed"],
    takeover_pending: ["controlled_by_user", "active", "failed"],
    controlled_by_user: ["controlled_by_agent", "active", "expiring", "failed"],
    controlled_by_agent: ["controlled_by_user", "active", "expiring", "failed"],
    expiring: ["expired", "failed"],
    expired: [],
    failed: ["provisioning"], // Allow retry
  }

  export interface SandboxProvider {
    name: string
    createSandbox(type: SessionType, config: any): Promise<{ sandboxId: string; credentials: any }>
    pauseSandbox(sandboxId: string): Promise<void>
    resumeSandbox(sandboxId: string): Promise<void>
    destroySandbox(sandboxId: string): Promise<void>
    getSandboxStatus(sandboxId: string): Promise<{ status: string; metadata?: any }>
  }

  class E2BProvider implements SandboxProvider {
    name = "e2b"

    private activeSandboxes = new Map<string, any>()

    async createSandbox(type: SessionType, config: any): Promise<{ sandboxId: string; credentials: any }> {
      if (!ENABLE_REAL_E2B) {
        throw new Error(
          "E2B provider not enabled. Set KRONOSCODE_ENABLE_REAL_E2B=true to enable production E2B integration.",
        )
      }

      try {
        const { Sandbox } = await import("@e2b/desktop")

        const sandbox = await Sandbox.create()

        const sandboxId = sandbox.sandboxId
        const credentials = {
          sandboxId,
          createdAt: Date.now(),
        }

        this.activeSandboxes.set(sandboxId, sandbox)

        log.info("E2B sandbox created", { sandboxId, type })

        return { sandboxId, credentials }
      } catch (error) {
        log.error("Failed to create E2B sandbox", { error })
        throw new Error(`Failed to create E2B sandbox: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    async pauseSandbox(sandboxId: string): Promise<void> {
      if (!ENABLE_REAL_E2B) {
        throw new Error("E2B provider not enabled")
      }

      log.warn("E2B pause not supported, destroying sandbox instead", { sandboxId })
      await this.destroySandbox(sandboxId)
    }

    async resumeSandbox(sandboxId: string): Promise<void> {
      if (!ENABLE_REAL_E2B) {
        throw new Error("E2B provider not enabled")
      }

      const sandbox = this.activeSandboxes.get(sandboxId)
      if (sandbox) {
        log.info("E2B sandbox already active", { sandboxId })
        return
      }

      throw new Error("E2B Desktop sandboxes cannot be resumed. Please create a new session.")
    }

    async destroySandbox(sandboxId: string): Promise<void> {
      if (!ENABLE_REAL_E2B) {
        throw new Error("E2B provider not enabled")
      }

      try {
        const sandbox = this.activeSandboxes.get(sandboxId)
        if (sandbox) {
          await sandbox.kill()
          this.activeSandboxes.delete(sandboxId)
          log.info("E2B sandbox destroyed", { sandboxId })
        }
      } catch (error) {
        log.error("Failed to destroy E2B sandbox", { sandboxId, error })
        this.activeSandboxes.delete(sandboxId)
      }
    }

    async getSandboxStatus(sandboxId: string): Promise<{ status: string; metadata?: any }> {
      if (!ENABLE_REAL_E2B) {
        throw new Error("E2B provider not enabled")
      }

      const sandbox = this.activeSandboxes.get(sandboxId)
      if (!sandbox) {
        return { status: "destroyed" }
      }

      return {
        status: "active",
        metadata: {
          sandboxId,
        },
      }
    }
  }

  class SelfHostedProvider implements SandboxProvider {
    name = "self-hosted"

    async createSandbox(type: SessionType, config: any): Promise<{ sandboxId: string; credentials: any }> {
      if (!ENABLE_REAL_SELF_HOSTED) {
        throw new Error(
          "Self-hosted provider not enabled. Set KRONOSCODE_ENABLE_REAL_SELF_HOSTED=true to enable production self-hosted integration.",
        )
      }

      // TODO: Implement real self-hosted sandbox integration
      throw new Error("Real self-hosted integration not yet implemented")
    }

    async pauseSandbox(sandboxId: string): Promise<void> {
      if (!ENABLE_REAL_SELF_HOSTED) {
        throw new Error("Self-hosted provider not enabled")
      }
      throw new Error("Real self-hosted integration not yet implemented")
    }

    async resumeSandbox(sandboxId: string): Promise<void> {
      if (!ENABLE_REAL_SELF_HOSTED) {
        throw new Error("Self-hosted provider not enabled")
      }
      throw new Error("Real self-hosted integration not yet implemented")
    }

    async destroySandbox(sandboxId: string): Promise<void> {
      if (!ENABLE_REAL_SELF_HOSTED) {
        throw new Error("Self-hosted provider not enabled")
      }
      throw new Error("Real self-hosted integration not yet implemented")
    }

    async getSandboxStatus(sandboxId: string): Promise<{ status: string; metadata?: any }> {
      if (!ENABLE_REAL_SELF_HOSTED) {
        throw new Error("Self-hosted provider not enabled")
      }
      throw new Error("Real self-hosted integration not yet implemented")
    }
  }

  class ProviderRegistry {
    private providers = new Map<string, SandboxProvider>()

    constructor() {
      this.providers.set("e2b", new E2BProvider())
      this.providers.set("self-hosted", new SelfHostedProvider())
    }

    getProvider(name: string): SandboxProvider | null {
      return this.providers.get(name) || null
    }

    getProviderSummary(name: string): ProviderSummary | null {
      return buildProviderSummaries().find((summary) => summary.id === name) ?? null
    }

    listProviderSummaries(): ProviderSummary[] {
      return buildProviderSummaries()
    }

    getDefaultProviderName(): ProviderName | null {
      return buildProviderSummaries().find((summary) => summary.default)?.id ?? null
    }

    getDefaultProvider(): SandboxProvider {
      const providerName = this.getDefaultProviderName()
      if (!providerName) {
        throw new Error("No desktop sandbox provider is available.")
      }
      return this.providers.get(providerName)!
    }
  }

  const providerRegistry = new ProviderRegistry()

  export async function createSession(
    userId: string,
    orgId: string,
    sessionType: SessionType,
    config: any = {},
    metadata: any = {},
    providerName?: ProviderName | null,
  ): Promise<{ sessionId: string; jobId: string }> {
    // Check org quotas
    await checkOrgQuotas(orgId, sessionType)

    const resolvedProviderName = providerName ?? providerRegistry.getDefaultProviderName()
    if (!resolvedProviderName) {
      throw new Error("No desktop sandbox provider is currently available.")
    }

    const providerSummary = providerRegistry.getProviderSummary(resolvedProviderName)
    if (!providerSummary?.available) {
      throw new Error(providerSummary?.reason || `Desktop sandbox provider '${resolvedProviderName}' is not available.`)
    }

    const sessionId = randomUUID()
    const now = Date.now()

    // Create session in provisioning state
    await db.insert(DesktopSessionTable).values({
      id: sessionId,
      user_id: userId,
      org_id: orgId,
      session_type: sessionType,
      session_state: "provisioning",
      status: "pending",
      sandbox_provider: resolvedProviderName,
      config,
      metadata,
      usage_minutes: 0,
      usage_compute_units: 0,
      billing_tier: "free",
      time_created: now,
      time_updated: now,
    })

    // Queue provisioning job
    const job = await QueueManager.addSessionProvisionJob({
      sessionId,
      userId,
      orgId,
      sessionType,
      config,
      provider: resolvedProviderName,
    })

    // Update with job ID
    await db
      .update(DesktopSessionTable)
      .set({ job_id: job.id?.toString() })
      .where(eq(DesktopSessionTable.id, sessionId))

    await auditLog(sessionId, userId, "create", { sessionType, config, provider: resolvedProviderName })

    log.info("Session creation requested", { sessionId, userId, orgId, sessionType, provider: resolvedProviderName })

    return { sessionId, jobId: job.id?.toString() || "" }
  }

  export async function provisionSession(
    sessionId: string,
    userId: string,
    orgId: string,
    sessionType: SessionType,
    config: any,
    providerName?: ProviderName | null,
  ): Promise<void> {
    try {
      const session = await getSession(sessionId, orgId)
      if (!session) {
        throw new Error("Session not found")
      }

      const resolvedProviderName =
        providerName
        ?? (typeof session.sandbox_provider === "string" ? (session.sandbox_provider as ProviderName) : null)
        ?? providerRegistry.getDefaultProviderName()

      if (!resolvedProviderName) {
        throw new Error("No desktop sandbox provider is currently available.")
      }

      const providerSummary = providerRegistry.getProviderSummary(resolvedProviderName)
      if (!providerSummary?.available) {
        throw new Error(providerSummary?.reason || `Desktop sandbox provider '${resolvedProviderName}' is not available.`)
      }

      const provider = providerRegistry.getProvider(resolvedProviderName)
      if (!provider) {
        throw new Error(`Unknown desktop sandbox provider: ${resolvedProviderName}`)
      }

      // Create sandbox
      const { sandboxId, credentials } = await provider.createSandbox(sessionType, config)

      // Transition to active state
      await transitionState(sessionId, orgId, "active")

      // Update session with sandbox details
      const now = Date.now()
      await db
        .update(DesktopSessionTable)
        .set({
          sandbox_id: sandboxId,
          sandbox_provider: resolvedProviderName,
          sandbox_credentials: credentials,
          started_at: now,
          last_activity_at: now,
          last_heartbeat_at: now,
          status: "active",
          time_updated: now,
        })
        .where(eq(DesktopSessionTable.id, sessionId))

      await auditLog(sessionId, userId, "start", { sandboxId })

      // Start heartbeat monitoring
      startHeartbeatMonitoring(sessionId, orgId)

      log.info("Session provisioned successfully", { sessionId, sandboxId })
    } catch (error) {
      log.error("Session provisioning failed", { error, sessionId })

      await transitionState(sessionId, orgId, "failed")
      await db
        .update(DesktopSessionTable)
        .set({
          status: "failed",
          time_updated: Date.now(),
        })
        .where(eq(DesktopSessionTable.id, sessionId))

      throw error
    }
  }

  export async function requestTakeover(
    sessionId: string,
    userId: string,
    orgId: string,
  ): Promise<{ success: boolean; lockExpiresAt?: number }> {
    const session = await getSession(sessionId, orgId)
    if (!session) {
      throw new Error("Session not found")
    }

    if (
      session.session_state !== "active" &&
      session.session_state !== "controlled_by_agent" &&
      session.session_state !== "controlled_by_user"
    ) {
      throw new Error(`Cannot takeover session in state: ${session.session_state}`)
    }

    const now = Date.now()
    // Check if already under takeover and lock is still valid
    if (session.takeover_lock_expires_at && session.takeover_lock_expires_at > now) {
      if (session.takeover_user_id !== userId) {
        return { success: false }
      }
      // User already has the lock, we'll extend it
    }

    // Acquire takeover lock (30 minute timeout as per Phase 5)
    const lockDuration = 30 * 60 * 1000
    const lockExpiresAt = now + lockDuration

    // Atomic update with database lock
    await db
      .update(DesktopSessionTable)
      .set({
        session_state: "controlled_by_user",
        control_mode: "user",
        takeover_user_id: userId,
        takeover_started_at: now,
        takeover_lock_expires_at: lockExpiresAt,
        time_updated: now,
      })
      .where(eq(DesktopSessionTable.id, sessionId))

    await auditLog(sessionId, userId, "takeover", { lockExpiresAt })

    // Schedule lock expiration job via queue (restart-safe)
    await QueueManager.addJob(
      "session-lock-expiry",
      {
        sessionId,
        userId,
        expiresAt: lockExpiresAt,
      },
      {
        delay: lockDuration,
        jobId: `lock-expiry-${sessionId}`,
        removeOnComplete: true,
      },
    )

    log.info("Takeover acquired", { sessionId, userId, lockExpiresAt })

    return { success: true, lockExpiresAt }
  }

  export async function releaseTakeover(sessionId: string, userId: string, orgId: string): Promise<void> {
    const session = await getSession(sessionId, orgId)
    if (!session) {
      throw new Error("Session not found")
    }

    if (session.takeover_user_id !== userId) {
      throw new Error("User does not have takeover control")
    }

    await db
      .update(DesktopSessionTable)
      .set({
        session_state: "active",
        control_mode: "agent",
        takeover_user_id: null,
        takeover_started_at: null,
        takeover_lock_expires_at: null,
        time_updated: Date.now(),
      })
      .where(eq(DesktopSessionTable.id, sessionId))

    // Cancel lock expiration job
    await QueueManager.removeJob(`lock-expiry-${sessionId}`)

    await auditLog(sessionId, userId, "release", {})

    log.info("Takeover released", { sessionId, userId })
  }

  // Lock expiration job processor (Restart-safe)
  export async function processLockExpiry(jobData: {
    sessionId: string
    userId: string
    expiresAt: number
  }): Promise<void> {
    const { sessionId, userId, expiresAt } = jobData
    const now = Date.now()

    const session = await db.select().from(DesktopSessionTable).where(eq(DesktopSessionTable.id, sessionId)).limit(1)

    if (!session[0]) return

    const current = session[0]

    // Only expire if lock hasn't been renewed or changed
    if (current.takeover_user_id === userId && current.takeover_lock_expires_at === expiresAt && now >= expiresAt) {
      await db
        .update(DesktopSessionTable)
        .set({
          session_state: "active",
          control_mode: "agent",
          takeover_user_id: null,
          takeover_started_at: null,
          takeover_lock_expires_at: null,
          time_updated: now,
        })
        .where(eq(DesktopSessionTable.id, sessionId))

      await auditLog(sessionId, userId, "lock_expired", { expiresAt })
      log.info("Session takeover lock expired", { sessionId, userId })
    }
  }

  export async function updateHeartbeat(sessionId: string, orgId: string): Promise<void> {
    await db
      .update(DesktopSessionTable)
      .set({
        last_heartbeat_at: Date.now(),
        last_activity_at: Date.now(),
        time_updated: Date.now(),
      })
      .where(and(eq(DesktopSessionTable.id, sessionId), eq(DesktopSessionTable.org_id, orgId)))
  }

  export async function transitionState(sessionId: string, orgId: string, newState: SessionState): Promise<void> {
    const current = await db
      .select()
      .from(DesktopSessionTable)
      .where(and(eq(DesktopSessionTable.id, sessionId), eq(DesktopSessionTable.org_id, orgId)))
      .limit(1)

    if (!current[0]) {
      throw new Error("Session not found")
    }

    const currentState = current[0].session_state as SessionState
    const allowedTransitions = STATE_TRANSITIONS[currentState]

    if (!allowedTransitions.includes(newState)) {
      throw new Error(`Invalid state transition from ${currentState} to ${newState}`)
    }

    await db
      .update(DesktopSessionTable)
      .set({
        session_state: newState,
        time_updated: Date.now(),
      })
      .where(eq(DesktopSessionTable.id, sessionId))

    log.info("Session state transition", { sessionId, from: currentState, to: newState })
  }

  async function getSession(sessionId: string, orgId: string): Promise<any> {
    const result = await db
      .select()
      .from(DesktopSessionTable)
      .where(and(eq(DesktopSessionTable.id, sessionId), eq(DesktopSessionTable.org_id, orgId)))
      .limit(1)

    return result[0] || null
  }

  export async function getSessionByIdForOrg(orgId: string, sessionId: string): Promise<any> {
    return getSession(sessionId, orgId)
  }

  export async function listSessionsForOrg(orgId: string): Promise<any[]> {
    return db
      .select()
      .from(DesktopSessionTable)
      .where(eq(DesktopSessionTable.org_id, orgId))
      .orderBy(desc(DesktopSessionTable.time_updated))
  }

  export async function getQuotaSummary(orgId: string): Promise<QuotaSummary> {
    const sessions = await db
      .select({
        session_type: DesktopSessionTable.session_type,
        session_state: DesktopSessionTable.session_state,
      })
      .from(DesktopSessionTable)
      .where(eq(DesktopSessionTable.org_id, orgId))

    const usage: Record<SessionType, number> = {
      browser: 0,
      terminal: 0,
      desktop: 0,
    }

    for (const session of sessions) {
      const type = SessionType.safeParse(session.session_type)
      const state = SessionState.safeParse(session.session_state)
      if (!type.success || !state.success) {
        continue
      }
      if (QUOTA_COUNTED_STATES.has(state.data)) {
        usage[type.data] += 1
      }
    }

    return {
      limits: { ...SESSION_QUOTA_LIMITS },
      usage,
    }
  }

  export function getProviderCatalog(): ProviderSummary[] {
    return providerRegistry.listProviderSummaries()
  }

  async function checkOrgQuotas(orgId: string, sessionType: SessionType): Promise<void> {
    const quotas = await getQuotaSummary(orgId)
    if (quotas.usage[sessionType] >= quotas.limits[sessionType]) {
      throw new Error(`Organization quota exceeded for ${sessionType} sessions (limit: ${quotas.limits[sessionType]})`)
    }
  }

  function startHeartbeatMonitoring(sessionId: string, orgId: string): void {
    // In production, this would be handled by a separate worker process
    setTimeout(async () => {
      try {
        const session = await db
          .select()
          .from(DesktopSessionTable)
          .where(eq(DesktopSessionTable.id, sessionId))
          .limit(1)

        if (!session[0]) return

        const lastHeartbeat = session[0].last_heartbeat_at || 0
        const timeoutMs = 5 * 60 * 1000 // 5 minutes

        if (Date.now() - lastHeartbeat > timeoutMs) {
          log.warn("Session heartbeat timeout", { sessionId })
          await transitionState(sessionId, orgId, "expiring")
        }
      } catch (error) {
        log.error("Heartbeat monitoring error", { error, sessionId })
      }
    }, 60000) // Check every minute
  }

  async function auditLog(
    sessionId: string,
    userId: string,
    action: string,
    details: Record<string, any>,
  ): Promise<void> {
    await db.insert(SessionAuditLogTable).values({
      id: randomUUID(),
      session_id: sessionId,
      user_id: userId,
      action,
      details,
      time_created: Date.now(),
      time_updated: Date.now(),
    })
  }

  // Cleanup expired sessions (would run as scheduled job)
  export async function cleanupExpiredSessions(): Promise<void> {
    const expiredSessions = await db
      .select()
      .from(DesktopSessionTable)
      .where(
        and(
          eq(DesktopSessionTable.session_state, "expired"),
          lt(DesktopSessionTable.time_updated, Date.now() - 24 * 60 * 60 * 1000), // 24 hours old
        ),
      )

    for (const session of expiredSessions) {
      if (session.sandbox_id) {
        const providerName = typeof session.sandbox_provider === "string" ? session.sandbox_provider : null
        const provider = providerName ? providerRegistry.getProvider(providerName) : null
        if (provider) {
          try {
            await provider.destroySandbox(session.sandbox_id)
          } catch (error) {
            log.error("Failed to destroy expired sandbox", { error, sandboxId: session.sandbox_id })
          }
        }
      }
    }

    log.info("Cleaned up expired sessions", { count: expiredSessions.length })
  }
}
