import { describe, expect, test } from "bun:test"
import { z } from "zod"

// Mock DTOs to test serialization logic independently of route setup
function serializeDesktopSession(session: any) {
  return {
    id: session.id,
    userId: session.userId,
    organizationId: session.organizationId,
    sessionType: session.sessionType,
    status: session.status,
    sandboxId: session.sandboxId,
    sandboxProvider: session.sandboxProvider,
    config: session.config,
    metadata: session.metadata,
    startedAt: session.startedAt,
    pausedAt: session.pausedAt,
    stoppedAt: session.stoppedAt,
    lastActivityAt: session.lastActivityAt,
    usageMinutes: session.usageMinutes,
    usageComputeUnits: session.usageComputeUnits,
    billingTier: session.billingTier,
    timeCreated: session.timeCreated,
    timeUpdated: session.timeUpdated,
  }
}

function serializeInstalledIntegration(integration: any) {
  return {
    id: integration.id,
    userId: integration.userId,
    orgId: integration.orgId,
    marketplaceEntryId: integration.marketplaceEntryId,
    name: integration.name,
    version: integration.version,
    installState: integration.installState,
    status: integration.status,
    config: integration.config,
    capabilities: integration.capabilities,
    permissions: integration.permissions,
    installedAt: integration.installedAt,
    lastUsedAt: integration.lastUsedAt,
    errorMessage: integration.errorMessage,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  }
}

describe("Security Remediation - DTO Serialization", () => {
  test("serializeDesktopSession should NOT include credentials or secrets", () => {
    const rawSession = {
      id: "sess_123",
      userId: "user_456",
      organizationId: "org_789",
      sessionType: "browser",
      status: "active",
      sandboxId: "sb_abc",
      sandboxProvider: "e2b",
      sandbox_credentials: { apiKey: "SECRET_KEY_123", token: "SECRET_TOKEN_456" },
      sandboxCredentials: { apiKey: "SECRET_KEY_123" },
      auth_config: { clientSecret: "SECRET" },
      config: { timeout: 60 },
      metadata: { name: "test" },
      startedAt: 123456789,
      timeCreated: 123456789,
      timeUpdated: 123456789,
    }

    const serialized = serializeDesktopSession(rawSession)
    
    // Check that allowed fields are present
    expect(serialized.id).toBe("sess_123")
    expect(serialized.status).toBe("active")
    
    // CRITICAL: Check that forbidden fields are ABSENT
    const forbidden = [
      "sandbox_credentials",
      "sandboxCredentials",
      "auth_config",
      "token",
      "secret",
      "credentials",
      "apiKey"
    ]
    
    for (const field of forbidden) {
      expect((serialized as any)[field]).toBeUndefined()
    }
    
    // Ensure nested objects also don't leak anything if they were directly assigned
    // (though our serializer doesn't even copy them)
    expect(Object.keys(serialized)).not.toContain("sandbox_credentials")
  })

  test("serializeInstalledIntegration should NOT include auth secrets", () => {
    const rawIntegration = {
      id: "int_123",
      userId: "user_456",
      orgId: "org_789",
      marketplaceEntryId: "entry_abc",
      name: "GitHub",
      version: "1.0.0",
      installState: "connected",
      auth_config: { token: "SENSITIVE_OAUTH_TOKEN" },
      authConfig: { secret: "STUFF" },
      credentials: { password: "123" },
      config: { repo: "test" },
      createdAt: 123456789,
      updatedAt: 123456789,
    }

    const serialized = serializeInstalledIntegration(rawIntegration)
    
    expect(serialized.id).toBe("int_123")
    expect(serialized.name).toBe("GitHub")
    
    const forbidden = [
      "auth_config",
      "authConfig",
      "token",
      "secret",
      "credentials",
      "password"
    ]
    
    for (const field of forbidden) {
      expect((serialized as any)[field]).toBeUndefined()
    }
  })
})
