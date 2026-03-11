import { Hono } from "hono"
import { z } from "zod"
import { MarketplaceRegistry } from "../../marketplace/registry"
import { InstallerService } from "../../marketplace/installer"
import { RuntimeService } from "../../marketplace/runtime"
import { Category } from "../../marketplace/model"
import { Marketplace } from "../../marketplace"
import { SandboxBroker } from "../../desktop/broker"
import { Log } from "../../util/log"
import { describeRoute, validator, resolver } from "hono-openapi"
import { errors } from "../error"
import { requireAuth } from "../../auth/auth0"

const log = Log.create({ service: "api.marketplace" })

// Explicit DTO serializers - never expose credentials
function serializeDesktopSession(session: any) {
  return {
    id: session.id,
    userId: session.user_id,
    organizationId: session.org_id,
    sessionType: session.session_type,
    sessionState: session.session_state,
    status: session.status,
    sandboxId: session.sandbox_id,
    sandboxProvider: session.sandbox_provider,
    config: session.config,
    metadata: session.metadata,
    startedAt: session.started_at,
    pausedAt: session.paused_at,
    stoppedAt: session.stopped_at,
    lastActivityAt: session.last_activity_at,
    lastHeartbeatAt: session.last_heartbeat_at,
    controlMode: session.control_mode,
    takeoverUserId: session.takeover_user_id,
    takeoverStartedAt: session.takeover_started_at,
    takeoverLockExpiresAt: session.takeover_lock_expires_at,
    usageMinutes: session.usage_minutes,
    usageComputeUnits: session.usage_compute_units,
    billingTier: session.billing_tier,
    jobId: session.job_id,
    timeCreated: session.time_created,
    timeUpdated: session.time_updated,
  }
}

export function MarketplaceRoutes() {
  const app = new Hono()

  const desktopSessionCreateSchema = z.object({
    sessionType: z.enum(["browser", "terminal", "desktop"]),
    provider: z.enum(["e2b", "self-hosted"]).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })

  // Marketplace endpoints - all require authentication
  app.get("/entries",
    requireAuth(),
    describeRoute({
      summary: "Search marketplace entries",
      operationId: "marketplace.search",
      responses: {
        200: {
          description: "Marketplace entries",
          content: {
            "application/json": {
              schema: resolver(z.object({ entries: z.array(z.any()) })),
            },
          },
        },
        ...errors(401, 500),
      },
    }),
    validator("query", z.object({
      search: z.string().optional(),
      category: Category.optional(),
      limit: z.coerce.number().optional(),
    })),
    async (c) => {
      try {
        const user = (c.req as any).user
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401)
        }

        const query = c.req.valid("query")
        const searchParams = {
          query: query.search,
          category: query.category,
          limit: query.limit || 20,
          offset: 0,
          sortBy: "downloads" as const,
          sortOrder: "desc" as const,
        }
        const entries = await MarketplaceRegistry.searchEntries(searchParams)
        return c.json({ entries })
      } catch (error) {
        log.error("Failed to search marketplace entries", { error })
        return c.json({ error: "Search failed" }, 500)
      }
    }
  )

  app.get("/entries/:id",
    requireAuth(),
    describeRoute({
      summary: "Get marketplace entry",
      operationId: "marketplace.getEntry",
      responses: {
        200: {
          description: "Marketplace entry",
          content: {
            "application/json": {
              schema: resolver(z.object({ entry: z.any() })),
            },
          },
        },
        404: {
          description: "Entry not found",
          content: {
            "application/json": {
              schema: resolver(z.object({ error: z.string() })),
            },
          },
        },
        ...errors(401, 500),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      try {
        const user = (c.req as any).user
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401)
        }

        const { id } = c.req.valid("param")
        const entry = await MarketplaceRegistry.getEntry(id)
        
        if (!entry) {
          return c.json({ error: "Entry not found" }, 404)
        }
        
        return c.json({ entry })
      } catch (error) {
        log.error("Failed to get marketplace entry", { error, id: c.req.param("id") })
        return c.json({ error: "Internal server error" }, 500)
      }
    }
  )

  // Install endpoint - async queue-based flow
  app.post("/integrations/:id/install",
    requireAuth(),
    describeRoute({
      summary: "Install marketplace integration",
      operationId: "marketplace.install",
      responses: {
        202: {
          description: "Install request accepted",
          content: {
            "application/json": {
              schema: resolver(z.object({ 
                integrationId: z.string(),
                jobId: z.string(),
                status: z.string(),
              })),
            },
          },
        },
        ...errors(400, 401, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    validator("json", z.object({
      config: z.record(z.string(), z.unknown()).optional(),
    })),
    async (c) => {
      try {
        const user = (c.req as any).user
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401)
        }

        const { id: marketplaceEntryId } = c.req.valid("param")
        const { config = {} } = c.req.valid("json")

        // Verify entry exists
        const entry = await MarketplaceRegistry.getEntry(marketplaceEntryId)
        if (!entry) {
          return c.json({ error: "Marketplace entry not found" }, 404)
        }

        // Request async install via queue
        const result = await InstallerService.requestInstall(
          user.id,
          user.orgId,
          marketplaceEntryId,
          config
        )

        log.info("Install requested", { 
          integrationId: result.integrationId, 
          userId: user.id, 
          orgId: user.orgId 
        })

        return c.json({ 
          integrationId: result.integrationId,
          jobId: result.jobId,
          status: "requested",
        }, 202)
      } catch (error) {
        log.error("Failed to request install", { error })
        return c.json({ error: "Install request failed" }, 400)
      }
    }
  )

  app.get("/integrations",
    requireAuth(),
    describeRoute({
      summary: "List installed integrations for current user/org",
      operationId: "marketplace.listInstalled",
      responses: {
        200: {
          description: "Installed integrations",
          content: {
            "application/json": {
              schema: resolver(z.object({ integrations: z.array(z.any()) })),
            },
          },
        },
        ...errors(401, 500),
      },
    }),
    async (c) => {
      try {
        const user = (c.req as any).user
        if (!user) return c.json({ error: "Unauthorized" }, 401)
        const integrations = await Marketplace.getUserIntegrations(user.id, user.orgId)
        return c.json({ integrations })
      } catch (error) {
        log.error("Failed to list installed integrations", { error })
        return c.json({ error: "Failed to list installed integrations" }, 500)
      }
    },
  )

  app.post("/integrations",
    requireAuth(),
    describeRoute({
      summary: "Install integration by marketplace entry id",
      operationId: "marketplace.installFromBody",
      responses: {
        202: {
          description: "Install request accepted",
          content: {
            "application/json": {
              schema: resolver(z.object({
                integrationId: z.string(),
                jobId: z.string(),
                status: z.string(),
              })),
            },
          },
        },
        ...errors(400, 401, 404),
      },
    }),
    validator("json", z.object({
      marketplaceEntryId: z.string(),
      config: z.record(z.string(), z.unknown()).optional(),
    })),
    async (c) => {
      try {
        const user = (c.req as any).user
        if (!user) return c.json({ error: "Unauthorized" }, 401)
        const { marketplaceEntryId, config = {} } = c.req.valid("json")
        const entry = await MarketplaceRegistry.getEntry(marketplaceEntryId)
        if (!entry) return c.json({ error: "Marketplace entry not found" }, 404)

        const result = await InstallerService.requestInstall(
          user.id,
          user.orgId,
          marketplaceEntryId,
          config,
        )
        return c.json({ integrationId: result.integrationId, jobId: result.jobId, status: "requested" }, 202)
      } catch (error) {
        log.error("Failed to install integration", { error })
        return c.json({ error: "Install request failed" }, 400)
      }
    },
  )

  app.delete("/integrations/:id",
    requireAuth(),
    describeRoute({
      summary: "Remove installed integration",
      operationId: "marketplace.removeInstalled",
      responses: {
        200: {
          description: "Removed",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.literal(true) })),
            },
          },
        },
        ...errors(400, 401, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      try {
        const user = (c.req as any).user
        if (!user) return c.json({ error: "Unauthorized" }, 401)
        const { id } = c.req.valid("param")
        await RuntimeService.disconnectIntegration(id, user.orgId)
        await Marketplace.removeIntegration(user.id, user.orgId, id)
        return c.json({ success: true as const })
      } catch (error) {
        log.error("Failed to remove integration", { error })
        return c.json({ error: "Failed to remove integration" }, 400)
      }
    },
  )

  // Desktop session endpoints  
  app.get("/desktop/sessions",
    requireAuth(),
    describeRoute({
      summary: "List desktop sessions",
      operationId: "desktop.listSessions",
      responses: {
        200: {
          description: "Desktop sessions and provisioning state",
          content: {
            "application/json": {
              schema: resolver(z.object({
                sessions: z.array(z.any()),
                providers: z.array(z.any()),
                quotas: z.object({
                  limits: z.record(z.string(), z.number()),
                  usage: z.record(z.string(), z.number()),
                }),
              })),
            },
          },
        },
        ...errors(401, 500),
      },
    }),
    async (c) => {
      try {
        const user = (c.req as any).user
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401)
        }

        const [sessions, quotas] = await Promise.all([
          SandboxBroker.listSessionsForOrg(user.orgId),
          SandboxBroker.getQuotaSummary(user.orgId),
        ])

        return c.json({
          sessions: sessions.map((session) => serializeDesktopSession(session)),
          providers: SandboxBroker.getProviderCatalog(),
          quotas,
        })
      } catch (error) {
        log.error("Failed to list desktop sessions", { error })
        return c.json({ error: "Failed to list desktop sessions" }, 500)
      }
    }
  )

  app.post("/desktop/sessions",
    requireAuth(),
    describeRoute({
      summary: "Create desktop session",
      operationId: "desktop.createSession",
      responses: {
        202: {
          description: "Session creation requested",
          content: {
            "application/json": {
              schema: resolver(z.object({ 
                sessionId: z.string(),
                jobId: z.string(),
                status: z.string(),
              })),
            },
          },
        },
        ...errors(400, 401),
      },
    }),
    validator("json", desktopSessionCreateSchema),
    async (c) => {
      try {
        const user = (c.req as any).user
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401)
        }

        const request = c.req.valid("json")
        
        // Use broker for async provisioning
        const result = await SandboxBroker.createSession(
          user.id,
          user.orgId,
          request.sessionType,
          request.config || {},
          request.metadata || {},
          request.provider || null,
        )

        log.info("Session creation requested", { 
          sessionId: result.sessionId, 
          userId: user.id, 
          orgId: user.orgId 
        })

        return c.json({ 
          sessionId: result.sessionId,
          jobId: result.jobId,
          status: "provisioning",
        }, 202)
      } catch (error) {
        log.error("Failed to create desktop session", { error })
        return c.json({ error: "Failed to create session" }, 400)
      }
    }
  )

  app.get("/desktop/sessions/:id",
    requireAuth(),
    describeRoute({
      summary: "Get desktop session",
      operationId: "desktop.getSession",
      responses: {
        200: {
          description: "Desktop session",
          content: {
            "application/json": {
              schema: resolver(z.object({ session: z.any() })),
            },
          },
        },
        ...errors(401, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      try {
        const user = (c.req as any).user
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401)
        }

        const { id } = c.req.valid("param")
        const session = await SandboxBroker.getSessionByIdForOrg(user.orgId, id)
        
        if (!session) {
          return c.json({ error: "Session not found" }, 404)
        }

        return c.json({ session: serializeDesktopSession(session) })
      } catch (error) {
        log.error("Failed to get session", { error })
        return c.json({ error: "Failed to get session" }, 500)
      }
    }
  )

  app.post("/desktop/sessions/:id/takeover",
    requireAuth(),
    describeRoute({
      summary: "Take over a desktop session",
      operationId: "desktop.takeoverSession",
      responses: {
        200: {
          description: "Takeover result",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                lockExpiresAt: z.number().optional(),
              })),
            },
          },
        },
        ...errors(401, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      try {
        const user = (c.req as any).user
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401)
        }

        const { id } = c.req.valid("param")
        const result = await SandboxBroker.requestTakeover(id, user.id, user.orgId)
        if (!result.success) {
          return c.json({ error: "Session is currently locked by another user." }, 409)
        }

        return c.json(result)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to request takeover"
        if (message === "Session not found") {
          return c.json({ error: message }, 404)
        }
        log.error("Failed to request desktop session takeover", { error })
        return c.json({ error: message }, 400)
      }
    }
  )

  app.post("/desktop/sessions/:id/release",
    requireAuth(),
    describeRoute({
      summary: "Release a desktop session takeover lock",
      operationId: "desktop.releaseSession",
      responses: {
        200: {
          description: "Takeover released",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.literal(true) })),
            },
          },
        },
        ...errors(401, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      try {
        const user = (c.req as any).user
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401)
        }

        const { id } = c.req.valid("param")
        await SandboxBroker.releaseTakeover(id, user.id, user.orgId)
        return c.json({ success: true as const })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to release takeover"
        if (message === "Session not found") {
          return c.json({ error: message }, 404)
        }
        log.error("Failed to release desktop session takeover", { error })
        return c.json({ error: message }, 400)
      }
    }
  )

  return app
}
