// @ts-nocheck
// DO NOT IMPORT FROM SERVER ROUTES
// @deprecated Use desktop/broker.ts instead
// This module contains legacy direct-DB operations and mock sandbox creation
// It is kept only for backward compatibility with existing internal code

import { z } from "zod"
import { Log } from "@/util/log"
import { db } from "@/storage"
import { DesktopSessionTable, SessionAuditLogTable, SessionUsageTable } from "./desktop.sql"
import { eq, and, desc, gte, lte, or, isNull, lt } from "drizzle-orm"
import { randomUUID } from "crypto"
import { QueueManager } from "@/queue"

const log = Log.create({ service: "desktop-session-broker" })

export namespace DesktopSessionBroker {
  export const SessionType = z.enum(["browser", "terminal", "desktop"])
  export const SessionStatus = z.enum(["pending", "starting", "active", "paused", "stopped", "failed"])
  export const AuditAction = z.enum(["create", "start", "pause", "resume", "stop", "takeover", "release"])
  export const UsageType = z.enum(["minutes", "compute_units", "storage_mb", "bandwidth_mb"])

  export const SessionConfig = z.object({
    timeoutMinutes: z.number().min(1).max(480).default(60),
    memoryLimitMb: z.number().min(512).max(8192).default(2048),
    cpuLimit: z.number().min(0.5).max(4).default(1),
    environment: z.record(z.string()).default({}),
    allowedDomains: z.array(z.string()).default([]),
  })
  export type SessionConfig = z.infer<typeof SessionConfig>

  export const SessionMetadata = z.object({
    agentId: z.string().optional(),
    sessionName: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
  })
  export type SessionMetadata = z.infer<typeof SessionMetadata>

  export const DesktopSession = z.object({
    id: z.string(),
    userId: z.string(),
    organizationId: z.string().optional(),
    sessionType: SessionType,
    status: SessionStatus,
    sandboxId: z.string().optional(),
    sandboxProvider: z.string().default("e2b"),
    sandboxCredentials: z.record(z.any()).default({}),
    config: SessionConfig,
    metadata: SessionMetadata,
    startedAt: z.number().optional(),
    pausedAt: z.number().optional(),
    stoppedAt: z.number().optional(),
    lastActivityAt: z.number().optional(),
    takeoverUserId: z.string().optional(),
    takeoverStartedAt: z.number().optional(),
    usageMinutes: z.number().default(0),
    usageComputeUnits: z.number().default(0),
    billingTier: z.string().default("free"),
    timeCreated: z.number(),
    timeUpdated: z.number(),
  })
  export type DesktopSession = z.infer<typeof DesktopSession>

  export const CreateSessionRequest = z.object({
    sessionType: SessionType,
    config: SessionConfig.optional(),
    metadata: SessionMetadata.optional(),
    organizationId: z.string().optional(),
  })
  export type CreateSessionRequest = z.infer<typeof CreateSessionRequest>

  // Session management
  export async function createSession(
    userId: string,
    request: CreateSessionRequest
  ): Promise<DesktopSession> {
    // Check user entitlements
    await checkUserEntitlements(userId, request.sessionType)

    const sessionId = randomUUID()
    const now = Date.now()

    const session = {
      id: sessionId,
      user_id: userId,
      organization_id: request.organizationId,
      session_type: request.sessionType,
      status: "pending" as const,
      sandbox_provider: "e2b",
      config: request.config || {},
      metadata: request.metadata || {},
      usage_minutes: 0,
      usage_compute_units: 0,
      billing_tier: "free",
      time_created: now,
      time_updated: now,
    }

    await db.insert(DesktopSessionTable).values(session)

    await auditLog(sessionId, userId, "create", {
      sessionType: request.sessionType,
      config: request.config,
    })

    log.info("Desktop session created", { sessionId, userId, type: request.sessionType })

    return transformDesktopSession({ ...session, sandbox_id: null, sandbox_credentials: {}, started_at: null, paused_at: null, stopped_at: null, last_activity_at: null, takeover_user_id: null, takeover_started_at: null })
  }

  export async function getSession(sessionId: string, userId: string): Promise<DesktopSession | null> {
    const result = await db
      .select()
      .from(DesktopSessionTable)
      .where(
        and(
          eq(DesktopSessionTable.id, sessionId),
          eq(DesktopSessionTable.user_id, userId)
        )
      )
      .limit(1)

    return result[0] ? transformDesktopSession(result[0]) : null
  }

  export async function getUserSessions(userId: string): Promise<DesktopSession[]> {
    const results = await db
      .select()
      .from(DesktopSessionTable)
      .where(eq(DesktopSessionTable.user_id, userId))
      .orderBy(desc(DesktopSessionTable.time_created))

    return results.map(transformDesktopSession)
  }

  export async function startSession(sessionId: string, userId: string): Promise<void> {
    const session = await getSession(sessionId, userId)
    if (!session) {
      throw new Error("Session not found")
    }

    if (session.status !== "pending" && session.status !== "paused") {
      throw new Error(`Cannot start session in status: ${session.status}`)
    }

    // Create sandbox based on session type
    const sandboxResult = await createSandbox(session)

    const now = Date.now()
    await db
      .update(DesktopSessionTable)
      .set({
        status: "starting",
        sandbox_id: sandboxResult.sandboxId,
        sandbox_credentials: sandboxResult.credentials,
        started_at: now,
        last_activity_at: now,
        time_updated: now,
      })
      .where(eq(DesktopSessionTable.id, sessionId))

    await auditLog(sessionId, userId, "start", { sandboxId: sandboxResult.sandboxId })

    // Start background monitoring
    startSessionMonitoring(sessionId)

    log.info("Desktop session started", { sessionId, sandboxId: sandboxResult.sandboxId })
  }

  export async function pauseSession(sessionId: string, userId: string): Promise<void> {
    const session = await getSession(sessionId, userId)
    if (!session) {
      throw new Error("Session not found")
    }

    if (session.status !== "active") {
      throw new Error(`Cannot pause session in status: ${session.status}`)
    }

    const now = Date.now()
    await db
      .update(DesktopSessionTable)
      .set({
        status: "paused",
        paused_at: now,
        time_updated: now,
      })
      .where(eq(DesktopSessionTable.id, sessionId))

    await auditLog(sessionId, userId, "pause", {})

    // Pause sandbox
    if (session.sandboxId) {
      await pauseSandbox(session.sandboxId)
    }

    log.info("Desktop session paused", { sessionId })
  }

  export async function stopSession(sessionId: string, userId: string): Promise<void> {
    const session = await getSession(sessionId, userId)
    if (!session) {
      throw new Error("Session not found")
    }

    if (session.status === "stopped") {
      return // Already stopped
    }

    const now = Date.now()
    await db
      .update(DesktopSessionTable)
      .set({
        status: "stopped",
        stopped_at: now,
        time_updated: now,
      })
      .where(eq(DesktopSessionTable.id, sessionId))

    await auditLog(sessionId, userId, "stop", {})

    // Destroy sandbox
    if (session.sandboxId) {
      await destroySandbox(session.sandboxId)
    }

    log.info("Desktop session stopped", { sessionId })
  }

  export async function takeoverSession(sessionId: string, userId: string): Promise<void> {
    const session = await getSession(sessionId, userId)
    if (!session) {
      throw new Error("Session not found")
    }

    if (session.status !== "active") {
      throw new Error(`Cannot takeover session in status: ${session.status}`)
    }

    // Check for existing takeover lock
    if (session.takeover_user_id && session.takeover_lock_expires_at) {
      const now = Date.now()
      if (now < session.takeover_lock_expires_at) {
        if (session.takeover_user_id !== userId) {
          throw new Error(`Session is locked by another user until ${new Date(session.takeover_lock_expires_at).toISOString()}`)
        }
        // User already has the lock, extend it
      }
    }

    const now = Date.now()
    const lockDuration = 30 * 60 * 1000 // 30 minutes
    const lockExpires = now + lockDuration

    // Atomic takeover with database lock
    const result = await db
      .update(DesktopSessionTable)
      .set({
        takeover_user_id: userId,
        takeover_started_at: now,
        takeover_lock_expires_at: lockExpires,
        session_state: "controlled_by_user",
        time_updated: now,
      })
      .where(
        and(
          eq(DesktopSessionTable.id, sessionId),
          // Only allow takeover if no active lock or lock expired
          or(
            isNull(DesktopSessionTable.takeover_lock_expires_at),
            lt(DesktopSessionTable.takeover_lock_expires_at, now)
          )
        )
      )

    if (result.changes === 0) {
      throw new Error("Failed to acquire takeover lock - session may be locked by another user")
    }

    await auditLog(sessionId, userId, "takeover", { lockExpires })

    // Schedule lock expiration job
    await QueueManager.addJob("session-lock-expiry", {
      sessionId,
      userId,
      expiresAt: lockExpires,
    }, {
      delay: lockDuration,
      jobId: `lock-expiry-${sessionId}`,
    })

    log.info("Desktop session takeover started", { sessionId, userId, lockExpires })
  }

  export async function releaseSession(sessionId: string, userId: string): Promise<void> {
    const session = await getSession(sessionId, userId)
    if (!session) {
      throw new Error("Session not found")
    }

    if (session.takeoverUserId !== userId) {
      throw new Error("User does not have takeover control")
    }

    // Clear takeover lock
    await db
      .update(DesktopSessionTable)
      .set({
        takeover_user_id: null,
        takeover_started_at: null,
        takeover_lock_expires_at: null,
        session_state: "active",
        time_updated: Date.now(),
      })
      .where(eq(DesktopSessionTable.id, sessionId))

    // Cancel lock expiration job
    await QueueManager.removeJob(`lock-expiry-${sessionId}`)

    await auditLog(sessionId, userId, "release", {})

    log.info("Desktop session takeover released", { sessionId, userId })
  }

  // Lock expiration job processor
  export async function processLockExpiry(jobData: { sessionId: string; userId: string; expiresAt: number }): Promise<void> {
    const { sessionId, userId, expiresAt } = jobData
    const now = Date.now()

    // Only expire if lock hasn't been renewed
    const session = await db
      .select()
      .from(DesktopSessionTable)
      .where(eq(DesktopSessionTable.id, sessionId))
      .limit(1)

    if (!session[0]) {
      log.warn("Lock expiry job: session not found", { sessionId })
      return
    }

    const currentSession = session[0]
    
    // Check if lock is still valid and belongs to the same user
    if (
      currentSession.takeover_user_id === userId &&
      currentSession.takeover_lock_expires_at === expiresAt &&
      now >= expiresAt
    ) {
      // Expire the lock
      await db
        .update(DesktopSessionTable)
        .set({
          takeover_user_id: null,
          takeover_started_at: null,
          takeover_lock_expires_at: null,
          session_state: "active",
          time_updated: now,
        })
        .where(eq(DesktopSessionTable.id, sessionId))

      await auditLog(sessionId, userId, "lock_expired", { expiresAt })
      log.info("Session takeover lock expired", { sessionId, userId })
    }
  }
  export async function recordUsage(
    sessionId: string,
    userId: string,
    usageType: UsageType,
    amount: number
  ): Promise<void> {
    const billingPeriod = new Date().toISOString().slice(0, 7) // YYYY-MM

    await db.insert(SessionUsageTable).values({
      id: randomUUID(),
      session_id: sessionId,
      user_id: userId,
      usage_type: usageType,
      amount,
      billing_period: billingPeriod,
      recorded_at: Date.now(),
      time_created: Date.now(),
      time_updated: Date.now(),
    })
  }

  // Helper functions
  async function checkUserEntitlements(userId: string, sessionType: SessionType): Promise<void> {
    // TODO: Implement entitlement checks based on user's billing tier
    // For now, allow all users to create sessions
  }

  async function createSandbox(session: DesktopSession): Promise<{ sandboxId: string; credentials: Record<string, any> }> {
    // TODO: Implement actual sandbox creation based on session type
    // This would integrate with E2B or other sandbox providers
    
    const sandboxId = `${session.sessionType}-${randomUUID()}`
    const credentials = {
      apiKey: "mock-api-key",
      endpoint: `https://sandbox.example.com/${sandboxId}`,
    }

    return { sandboxId, credentials }
  }

  async function pauseSandbox(sandboxId: string): Promise<void> {
    // TODO: Implement sandbox pause
    log.info("Sandbox paused", { sandboxId })
  }

  async function destroySandbox(sandboxId: string): Promise<void> {
    // TODO: Implement sandbox destruction
    log.info("Sandbox destroyed", { sandboxId })
  }

  async function startSessionMonitoring(sessionId: string): Promise<void> {
    // TODO: Implement session monitoring for timeouts and activity tracking
    log.info("Session monitoring started", { sessionId })
  }

  async function auditLog(
    sessionId: string,
    userId: string,
    action: AuditAction,
    details: Record<string, any>
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

  function transformDesktopSession(row: any): DesktopSession {
    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      sessionType: row.session_type,
      status: row.status,
      sandboxId: row.sandbox_id,
      sandboxProvider: row.sandbox_provider || "e2b",
      sandboxCredentials: row.sandbox_credentials || {},
      config: row.config || {},
      metadata: row.metadata || {},
      startedAt: row.started_at,
      pausedAt: row.paused_at,
      stoppedAt: row.stopped_at,
      lastActivityAt: row.last_activity_at,
      takeoverUserId: row.takeover_user_id,
      takeoverStartedAt: row.takeover_started_at,
      usageMinutes: row.usage_minutes || 0,
      usageComputeUnits: row.usage_compute_units || 0,
      billingTier: row.billing_tier || "free",
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }
  }
}
