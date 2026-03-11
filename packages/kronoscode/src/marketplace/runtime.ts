import { Log } from "@/util/log"
import { db } from "@/storage"
import { InstalledIntegrationTable, ToolPermissionTable, InvocationLogTable } from "./marketplace.sql"
import { MarketplaceRegistry } from "./registry"
import { and, eq } from "drizzle-orm"
import { randomUUID } from "crypto"
import NodeCache from "node-cache"
import type { IntegrationManifest } from "./model"

const log = Log.create({ service: "marketplace.runtime" })
const ENABLE_REAL_MCP = process.env.KRONOSCODE_ENABLE_REAL_MCP === "true"
const capabilityCache = new NodeCache({ stdTTL: 1800 })

export namespace RuntimeService {
  export interface Tool {
    name: string
    description: string
    inputSchema: Record<string, unknown>
    dangerous: boolean
    readOnly: boolean
  }

  export interface Resource {
    name: string
    uri: string
    description: string
    mimeType?: string
  }

  export interface Prompt {
    name: string
    description: string
    arguments: Array<{
      name: string
      description: string
      required: boolean
    }>
  }

  export interface RuntimeContext {
    userId: string
    orgId: string
    sessionId?: string
    permissions: Map<string, "allowed" | "denied" | "prompt">
  }

  interface MCPClient {
    connect(): Promise<void>
    disconnect(): Promise<void>
    listTools(): Promise<Tool[]>
    listResources(): Promise<Resource[]>
    listPrompts(): Promise<Prompt[]>
    callTool(name: string, args: Record<string, unknown>): Promise<unknown>
    readResource(uri: string): Promise<unknown>
    getPrompt(name: string, args?: Record<string, unknown>): Promise<unknown>
    ping(): Promise<void>
  }

  type ConnectedIntegrationRow = {
    id: string
    org_id: string
    marketplace_entry_id: string
    name: string
  }

  class MCPClientManager {
    private clients = new Map<string, MCPClient>()

    async getClient(integrationId: string, orgId: string): Promise<MCPClient | null> {
      const clientKey = `${orgId}:${integrationId}`
      const existingClient = this.clients.get(clientKey)
      if (existingClient) return existingClient

      const integration = await db
        .select({
          id: InstalledIntegrationTable.id,
          org_id: InstalledIntegrationTable.org_id,
          marketplace_entry_id: InstalledIntegrationTable.marketplace_entry_id,
          name: InstalledIntegrationTable.name,
        })
        .from(InstalledIntegrationTable)
        .where(
          and(
            eq(InstalledIntegrationTable.id, integrationId),
            eq(InstalledIntegrationTable.org_id, orgId),
            eq(InstalledIntegrationTable.install_state, "connected"),
          ),
        )
        .limit(1)

      const row = integration[0]
      if (!row) return null

      try {
        const entry = await MarketplaceRegistry.getEntry(row.marketplace_entry_id)
        if (!entry) return null
        const manifest = await MarketplaceRegistry.fetchManifest(entry.manifestUrl)
        const client = await this.createClient(manifest, row)
        await client.connect()
        this.clients.set(clientKey, client)
        return client
      } catch (error) {
        log.error("Failed to create MCP client", { error, integrationId, orgId })
        return null
      }
    }

    private async createClient(manifest: IntegrationManifest, integration: ConnectedIntegrationRow): Promise<MCPClient> {
      if (!ENABLE_REAL_MCP) {
        log.warn("Real MCP integration disabled - using mock client", {
          integrationId: integration.id,
          feature: "KRONOSCODE_ENABLE_REAL_MCP",
        })
        return new MockMCPClient(manifest, integration)
      }
      throw new Error("Real MCP integration not yet implemented. Set KRONOSCODE_ENABLE_REAL_MCP=false to use mock.")
    }

    async removeClient(integrationId: string, orgId: string): Promise<void> {
      const key = `${orgId}:${integrationId}`
      const client = this.clients.get(key)
      if (!client) return
      await client.disconnect()
      this.clients.delete(key)
    }
  }

  class MockMCPClient implements MCPClient {
    constructor(
      private readonly manifest: IntegrationManifest,
      private readonly integration: ConnectedIntegrationRow,
    ) {}

    async connect(): Promise<void> {
      log.debug("Mock MCP client connected", { integrationId: this.integration.id })
    }

    async disconnect(): Promise<void> {
      log.debug("Mock MCP client disconnected", { integrationId: this.integration.id })
    }

    async listTools(): Promise<Tool[]> {
      return this.manifest.capabilities.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        dangerous: tool.dangerous,
        readOnly: tool.readOnly,
      }))
    }

    async listResources(): Promise<Resource[]> {
      return this.manifest.capabilities.resources.map((resource) => ({
        name: resource.name,
        uri: `mcp://${this.manifest.id}/${resource.name}`,
        description: resource.description,
        mimeType: resource.mimeType,
      }))
    }

    async listPrompts(): Promise<Prompt[]> {
      return this.manifest.capabilities.prompts
    }

    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      return { result: `Mock result for ${name}`, args }
    }

    async readResource(uri: string): Promise<unknown> {
      return { content: `Mock content for ${uri}` }
    }

    async getPrompt(name: string, args?: Record<string, unknown>): Promise<unknown> {
      return { prompt: `Mock prompt for ${name}`, args }
    }

    async ping(): Promise<void> {}
  }

  const clientManager = new MCPClientManager()

  export async function getIntegrationCapabilities(
    integrationId: string,
    orgId: string,
  ): Promise<{ tools: Tool[]; resources: Resource[]; prompts: Prompt[] } | null> {
    const cacheKey = `capabilities:${orgId}:${integrationId}`
    const cached = capabilityCache.get(cacheKey)
    if (cached) return cached as { tools: Tool[]; resources: Resource[]; prompts: Prompt[] }

    const client = await clientManager.getClient(integrationId, orgId)
    if (!client) return null

    try {
      const [tools, resources, prompts] = await Promise.all([client.listTools(), client.listResources(), client.listPrompts()])
      const capabilities = { tools, resources, prompts }
      capabilityCache.set(cacheKey, capabilities)
      return capabilities
    } catch (error) {
      log.error("Failed to get capabilities", { error, integrationId, orgId })
      return null
    }
  }

  export async function invokeTool(
    integrationId: string,
    toolName: string,
    args: Record<string, unknown>,
    context: RuntimeContext,
  ): Promise<unknown> {
    const start = Date.now()

    try {
      const hasPermission = await checkToolPermission(integrationId, toolName, context)
      if (!hasPermission) throw new Error(`Permission denied for tool: ${toolName}`)

      const client = await clientManager.getClient(integrationId, context.orgId)
      if (!client) throw new Error("Integration not available")

      const result = await client.callTool(toolName, args)
      await logInvocation(integrationId, toolName, args, result, "success", Date.now() - start, context)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown runtime error"
      await logInvocation(integrationId, toolName, args, null, "error", Date.now() - start, context, message)
      throw error
    }
  }

  export async function performHealthCheck(integrationId: string, orgId: string): Promise<void> {
    try {
      const client = await clientManager.getClient(integrationId, orgId)
      if (!client) throw new Error("Client not available")
      await client.ping()

      await db
        .update(InstalledIntegrationTable)
        .set({
          health_status: "healthy",
          health_error: null,
          last_health_check: Date.now(),
          time_updated: Date.now(),
        })
        .where(and(eq(InstalledIntegrationTable.id, integrationId), eq(InstalledIntegrationTable.org_id, orgId)))
    } catch (error) {
      const message = error instanceof Error ? error.message : "health check failed"
      log.warn("Health check failed", { error, integrationId, orgId })

      await db
        .update(InstalledIntegrationTable)
        .set({
          health_status: "unhealthy",
          health_error: message,
          last_health_check: Date.now(),
          time_updated: Date.now(),
        })
        .where(and(eq(InstalledIntegrationTable.id, integrationId), eq(InstalledIntegrationTable.org_id, orgId)))
    }
  }

  async function checkToolPermission(integrationId: string, toolName: string, context: RuntimeContext): Promise<boolean> {
    const cached = context.permissions.get(toolName)
    if (cached === "allowed") return true
    if (cached === "denied") return false

    const permission = await db
      .select({ permission_level: ToolPermissionTable.permission_level })
      .from(ToolPermissionTable)
      .where(
        and(
          eq(ToolPermissionTable.integration_id, integrationId),
          eq(ToolPermissionTable.tool_name, toolName),
          eq(ToolPermissionTable.org_id, context.orgId),
        ),
      )
      .limit(1)

    const level = permission[0]?.permission_level ?? "denied"
    const normalized = level === "allowed" || level === "prompt" ? level : "denied"
    context.permissions.set(toolName, normalized)
    return normalized === "allowed"
  }

  async function logInvocation(
    integrationId: string,
    toolName: string,
    inputParams: Record<string, unknown>,
    outputResult: unknown,
    status: "success" | "error" | "timeout",
    durationMs: number,
    context: RuntimeContext,
    errorMessage?: string,
  ): Promise<void> {
    await db.insert(InvocationLogTable).values({
      id: randomUUID(),
      user_id: context.userId,
      org_id: context.orgId,
      integration_id: integrationId,
      tool_name: toolName,
      session_id: context.sessionId,
      input_params: inputParams,
      output_result: (outputResult as Record<string, unknown> | null) ?? null,
      status,
      error_message: errorMessage,
      duration_ms: durationMs,
      time_created: Date.now(),
      time_updated: Date.now(),
    })
  }

  export async function disconnectIntegration(integrationId: string, orgId: string): Promise<void> {
    await clientManager.removeClient(integrationId, orgId)
    capabilityCache.del(`capabilities:${orgId}:${integrationId}`)
    log.info("Integration disconnected", { integrationId, orgId })
  }

  export async function getAllUserCapabilities(
    _userId: string,
    orgId: string,
  ): Promise<Array<{ integrationId: string; name: string; tools: Tool[]; resources: Resource[]; prompts: Prompt[] }>> {
    const integrations = await db
      .select({ id: InstalledIntegrationTable.id, name: InstalledIntegrationTable.name })
      .from(InstalledIntegrationTable)
      .where(
        and(
          eq(InstalledIntegrationTable.org_id, orgId),
          eq(InstalledIntegrationTable.install_state, "connected"),
          eq(InstalledIntegrationTable.health_status, "healthy"),
        ),
      )

    const results: Array<{ integrationId: string; name: string; tools: Tool[]; resources: Resource[]; prompts: Prompt[] }> = []
    for (const integration of integrations) {
      const capabilities = await getIntegrationCapabilities(integration.id, orgId)
      if (!capabilities) continue
      results.push({
        integrationId: integration.id,
        name: integration.name,
        ...capabilities,
      })
    }
    return results
  }
}
