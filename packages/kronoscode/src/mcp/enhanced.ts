// @ts-nocheck
import { MCP } from "@/mcp"
import { Marketplace } from "@/marketplace"
import { Log } from "@/util/log"

const log = Log.create({ service: "mcp.enhanced" })

export namespace MCPEnhanced {
  // Enhanced MCP client with marketplace integration
  export class EnhancedMCPClient extends MCP.MCPClient {
    private integrationId?: string
    private userId: string

    constructor(config: any, userId: string, integrationId?: string) {
      super(config)
      this.userId = userId
      this.integrationId = integrationId
    }

    async callTool(name: string, args: any): Promise<any> {
      // Check tool permissions before execution
      if (this.integrationId) {
        const hasPermission = await checkToolPermission(this.userId, this.integrationId, name)
        if (!hasPermission) {
          throw new Error(`Permission denied for tool: ${name}`)
        }
      }

      const startTime = Date.now()
      let result: any
      let error: string | undefined

      try {
        result = await super.callTool(name, args)
        
        // Log successful invocation
        if (this.integrationId) {
          await Marketplace.logInvocation(
            this.userId,
            this.integrationId,
            name,
            args,
            result,
            "success",
            Date.now() - startTime
          )
        }

        return result
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
        
        // Log failed invocation
        if (this.integrationId) {
          await Marketplace.logInvocation(
            this.userId,
            this.integrationId,
            name,
            args,
            null,
            "error",
            Date.now() - startTime,
            error
          )
        }

        throw err
      }
    }
  }

  // Registry for managing MCP connections
  export class MCPRegistry {
    private clients = new Map<string, EnhancedMCPClient>()
    private healthChecks = new Map<string, NodeJS.Timeout>()

    async registerIntegration(userId: string, integration: Marketplace.InstalledIntegration): Promise<void> {
      const clientKey = `${userId}:${integration.id}`
      
      try {
        // Get marketplace entry for manifest URL
        const entry = await Marketplace.getEntry(integration.marketplaceEntryId)
        if (!entry) {
          throw new Error("Marketplace entry not found")
        }

        // Fetch and parse MCP manifest
        const manifest = await this.fetchManifest(entry.manifestUrl)
        
        // Create MCP client configuration
        const config = {
          name: integration.name,
          transport: manifest.transport,
          ...integration.config
        }

        // Handle authentication if required
        if (entry.authRequired && integration.authConnectionId) {
          const authConnection = await Marketplace.getAuthConnection(integration.authConnectionId)
          if (authConnection) {
            config.auth = authConnection.credentials
          }
        }

        // Create enhanced MCP client
        const client = new EnhancedMCPClient(config, userId, integration.id)
        await client.connect()

        this.clients.set(clientKey, client)
        
        // Start health monitoring
        this.startHealthCheck(clientKey, integration.id)

        // Update integration status
        await Marketplace.updateIntegrationStatus(integration.id, "connected", "healthy")

        log.info("MCP integration registered", { userId, integrationId: integration.id, name: integration.name })
      } catch (error) {
        log.error("Failed to register MCP integration", { error, userId, integrationId: integration.id })
        await Marketplace.updateIntegrationStatus(integration.id, "failed", "unhealthy", error.message)
        throw error
      }
    }

    async unregisterIntegration(userId: string, integrationId: string): Promise<void> {
      const clientKey = `${userId}:${integrationId}`
      const client = this.clients.get(clientKey)
      
      if (client) {
        await client.disconnect()
        this.clients.delete(clientKey)
      }

      // Stop health check
      const healthCheck = this.healthChecks.get(clientKey)
      if (healthCheck) {
        clearInterval(healthCheck)
        this.healthChecks.delete(clientKey)
      }

      log.info("MCP integration unregistered", { userId, integrationId })
    }

    getClient(userId: string, integrationId: string): EnhancedMCPClient | undefined {
      const clientKey = `${userId}:${integrationId}`
      return this.clients.get(clientKey)
    }

    async getAvailableTools(userId: string): Promise<Array<{ name: string; description: string; integration: string }>> {
      const tools: Array<{ name: string; description: string; integration: string }> = []
      
      for (const [clientKey, client] of this.clients.entries()) {
        if (clientKey.startsWith(`${userId}:`)) {
          try {
            const clientTools = await client.tools()
            for (const tool of clientTools) {
              tools.push({
                name: tool.name,
                description: tool.description || "",
                integration: client.name || "Unknown"
              })
            }
          } catch (error) {
            log.warn("Failed to get tools from client", { error, clientKey })
          }
        }
      }

      return tools
    }

    private async fetchManifest(manifestUrl: string): Promise<any> {
      const response = await fetch(manifestUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.statusText}`)
      }
      return response.json()
    }

    private startHealthCheck(clientKey: string, integrationId: string): void {
      const healthCheck = setInterval(async () => {
        const client = this.clients.get(clientKey)
        if (!client) {
          clearInterval(healthCheck)
          this.healthChecks.delete(clientKey)
          return
        }

        try {
          // Simple ping to check if client is responsive
          await client.ping?.() || Promise.resolve()
          await Marketplace.updateIntegrationStatus(integrationId, "connected", "healthy")
        } catch (error) {
          log.warn("MCP client health check failed", { error, clientKey })
          await Marketplace.updateIntegrationStatus(integrationId, "connected", "unhealthy", error.message)
        }
      }, 60000) // Check every minute

      this.healthChecks.set(clientKey, healthCheck)
    }
  }

  // Global registry instance
  export const registry = new MCPRegistry()

  // Helper functions
  async function checkToolPermission(userId: string, integrationId: string, toolName: string): Promise<boolean> {
    // TODO: Implement permission checking logic
    // For now, allow all tools
    return true
  }
}

// Extend the Marketplace namespace with additional functions
declare module "@/marketplace" {
  namespace Marketplace {
    function getAuthConnection(connectionId: string): Promise<any>
    function logInvocation(
      userId: string,
      integrationId: string,
      toolName: string,
      inputParams: any,
      outputResult: any,
      status: "success" | "error" | "timeout",
      durationMs: number,
      errorMessage?: string
    ): Promise<void>
  }
}
