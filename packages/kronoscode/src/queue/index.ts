import Bull from "bull"
import type { Job } from "bull"
import Redis from "ioredis"
import { Log } from "@/util/log"
import { z } from "zod"

const log = Log.create({ service: "job-queue" })

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379")

// Job payload schemas
export const InstallJobPayload = z.object({
  userId: z.string(),
  orgId: z.string(),
  integrationId: z.string(),
  marketplaceEntryId: z.string(),
  config: z.record(z.string(), z.any()).default({}),
  retryCount: z.number().default(0),
})
export type InstallJobPayload = z.infer<typeof InstallJobPayload>

export const HealthCheckJobPayload = z.object({
  integrationId: z.string(),
  orgId: z.string(),
})
export type HealthCheckJobPayload = z.infer<typeof HealthCheckJobPayload>

export const SessionProvisionJobPayload = z.object({
  sessionId: z.string(),
  userId: z.string(),
  orgId: z.string(),
  sessionType: z.enum(["browser", "terminal", "desktop"]),
  config: z.record(z.string(), z.any()),
  provider: z.enum(["e2b", "self-hosted"]).optional(),
})
export type SessionProvisionJobPayload = z.infer<typeof SessionProvisionJobPayload>

// Create queues
export const installQueue = new Bull("integration-install", {
  redis: { port: 6379, host: "localhost" },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
})

export const healthCheckQueue = new Bull("health-check", {
  redis: { port: 6379, host: "localhost" },
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    repeat: { cron: "*/5 * * * *" }, // Every 5 minutes
  },
})

export const sessionQueue = new Bull("session-provision", {
  redis: { port: 6379, host: "localhost" },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: { type: "fixed", delay: 5000 },
  },
})

// Job processors
export class JobProcessors {
  static async processInstall(job: Job<InstallJobPayload>) {
    const { userId, orgId, integrationId, marketplaceEntryId, config } = job.data
    
    log.info("Processing install job", { integrationId, userId, orgId })
    
    try {
      // Import here to avoid circular dependencies
      const { MarketplaceRegistry } = await import("@/marketplace/registry")
      const { InstallerService } = await import("@/marketplace/installer")
      
      await InstallerService.processInstall(userId, orgId, integrationId, marketplaceEntryId, config)
      
      log.info("Install job completed", { integrationId, userId, orgId })
    } catch (error) {
      log.error("Install job failed", { error, integrationId, userId, orgId })
      throw error
    }
  }

  static async processHealthCheck(job: Job<HealthCheckJobPayload>) {
    const { integrationId, orgId } = job.data
    
    try {
      const { RuntimeService } = await import("@/marketplace/runtime")
      await RuntimeService.performHealthCheck(integrationId, orgId)
    } catch (error) {
      log.error("Health check failed", { error, integrationId, orgId })
      // Don't throw - health checks should not retry indefinitely
    }
  }

  static async processSessionProvision(job: Job<SessionProvisionJobPayload>) {
    const { sessionId, userId, orgId, sessionType, config, provider } = job.data
    
    log.info("Processing session provision", { sessionId, userId, orgId, sessionType })
    
    try {
      const { SandboxBroker } = await import("@/desktop/broker")
      await SandboxBroker.provisionSession(sessionId, userId, orgId, sessionType, config, provider ?? null)
      
      log.info("Session provision completed", { sessionId, userId, orgId })
    } catch (error) {
      log.error("Session provision failed", { error, sessionId, userId, orgId })
      throw error
    }
  }
}

// Register processors
installQueue.process(JobProcessors.processInstall)
healthCheckQueue.process(JobProcessors.processHealthCheck)
sessionQueue.process(JobProcessors.processSessionProvision)

// Queue management
export class QueueManager {
  static async addInstallJob(payload: InstallJobPayload): Promise<Job<InstallJobPayload>> {
    // Prevent duplicate installs
    const jobId = `install:${payload.orgId}:${payload.marketplaceEntryId}`
    
    return installQueue.add(payload, {
      jobId,
      delay: 0,
    })
  }

  static async addHealthCheckJob(payload: HealthCheckJobPayload): Promise<Job<HealthCheckJobPayload>> {
    const jobId = `health:${payload.orgId}:${payload.integrationId}`
    
    return healthCheckQueue.add(payload, {
      jobId,
    })
  }

  static async addSessionProvisionJob(payload: SessionProvisionJobPayload): Promise<Job<SessionProvisionJobPayload>> {
    return sessionQueue.add(payload, {
      delay: 0,
    })
  }

  static async getJobStatus(queueName: string, jobId: string) {
    const queue = queueName === "install" ? installQueue : 
                  queueName === "health" ? healthCheckQueue : 
                  sessionQueue
    
    const job = await queue.getJob(jobId)
    if (!job) return null
    
    return {
      id: job.id,
      status: await job.getState(),
      progress: job.progress(),
      data: job.data,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    }
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  log.info("Shutting down job queues...")
  await Promise.all([
    installQueue.close(),
    healthCheckQueue.close(),
    sessionQueue.close(),
  ])
})
