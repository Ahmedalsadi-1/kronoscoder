/**
 * @deprecated DO NOT USE - Blacklist sanitization is insecure
 * Use explicit DTO serializers in route handlers instead
 * 
 * This file is kept only for reference and will be removed
 */

// SECURITY: Never rely on property deletion for secret removal
// Always use explicit whitelisting via serializer functions

export interface DesktopSession {
  id: string
  user_id: string
  org_id: string
  session_type: string
  session_state: string
  status: string
  sandbox_id?: string | null
  sandbox_provider?: string | null
  sandbox_credentials?: Record<string, any> | null // SENSITIVE
  config?: Record<string, any>
  metadata?: Record<string, any>
  started_at?: number | null
  paused_at?: number | null
  stopped_at?: number | null
  last_activity_at?: number | null
  last_heartbeat_at?: number | null
  takeover_user_id?: string | null
  takeover_started_at?: number | null
  takeover_lock_expires_at?: number | null
  usage_minutes?: number
  usage_compute_units?: number
  billing_tier?: string
  job_id?: string | null
  created_at?: number
  updated_at?: number
}

export interface InstalledIntegration {
  id: string
  user_id: string
  org_id: string
  marketplace_entry_id: string
  install_state: string
  config?: Record<string, any>
  auth_config?: Record<string, any> // SENSITIVE
  capabilities?: string[]
  permissions?: Record<string, any>
  installed_at?: number | null
  last_used_at?: number | null
  error_message?: string | null
  job_id?: string | null
  created_at?: number
  updated_at?: number
}

/**
 * Sanitize desktop session for API response
 * Removes sensitive fields like sandbox_credentials
 */
export function sanitizeDesktopSession(session: DesktopSession) {
  const {
    sandbox_credentials, // Remove sensitive field
    ...sanitized
  } = session
  
  return sanitized
}

/**
 * Sanitize installed integration for API response  
 * Removes sensitive fields like auth_config
 */
export function sanitizeInstalledIntegration(integration: InstalledIntegration) {
  const {
    auth_config, // Remove sensitive field
    ...sanitized
  } = integration
  
  return sanitized
}

/**
 * Sanitize array of desktop sessions
 */
export function sanitizeDesktopSessions(sessions: DesktopSession[]) {
  return sessions.map(sanitizeDesktopSession)
}

/**
 * Sanitize array of installed integrations
 */
export function sanitizeInstalledIntegrations(integrations: InstalledIntegration[]) {
  return integrations.map(sanitizeInstalledIntegration)
}
