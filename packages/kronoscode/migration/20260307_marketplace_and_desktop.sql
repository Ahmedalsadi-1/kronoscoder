-- Add marketplace tables with org scoping and state machines
CREATE TABLE IF NOT EXISTS marketplace_entry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  publisher TEXT NOT NULL,
  category TEXT NOT NULL,
  version TEXT NOT NULL,
  homepage_url TEXT,
  repository_url TEXT,
  documentation_url TEXT,
  icon_url TEXT,
  verified INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  rating_average INTEGER DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]',
  screenshots TEXT DEFAULT '[]',
  manifest_url TEXT NOT NULL,
  auth_required INTEGER DEFAULT 0,
  auth_type TEXT,
  auth_scopes TEXT DEFAULT '[]',
  permissions TEXT DEFAULT '[]',
  tools_exposed TEXT DEFAULT '[]',
  risk_level TEXT DEFAULT 'low',
  risk_notes TEXT,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS marketplace_category_idx ON marketplace_entry(category);
CREATE INDEX IF NOT EXISTS marketplace_publisher_idx ON marketplace_entry(publisher);
CREATE INDEX IF NOT EXISTS marketplace_verified_idx ON marketplace_entry(verified);

CREATE TABLE IF NOT EXISTS installed_integration (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  marketplace_entry_id TEXT NOT NULL REFERENCES marketplace_entry(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  install_state TEXT NOT NULL DEFAULT 'requested',
  status TEXT NOT NULL DEFAULT 'installed',
  config TEXT DEFAULT '{}',
  auth_connection_id TEXT,
  last_health_check INTEGER,
  health_status TEXT DEFAULT 'unknown',
  health_error TEXT,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  job_id TEXT,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS installed_integration_user_idx ON installed_integration(user_id);
CREATE INDEX IF NOT EXISTS installed_integration_org_idx ON installed_integration(org_id);
CREATE INDEX IF NOT EXISTS installed_integration_status_idx ON installed_integration(status);
CREATE INDEX IF NOT EXISTS installed_integration_state_idx ON installed_integration(install_state);
CREATE UNIQUE INDEX IF NOT EXISTS installed_integration_unique_idx ON installed_integration(org_id, marketplace_entry_id);

CREATE TABLE IF NOT EXISTS auth_connection (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  integration_id TEXT NOT NULL REFERENCES installed_integration(id) ON DELETE CASCADE,
  auth_type TEXT NOT NULL,
  credentials TEXT NOT NULL,
  scopes TEXT DEFAULT '[]',
  expires_at INTEGER,
  refresh_token TEXT,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_connection_user_idx ON auth_connection(user_id);
CREATE INDEX IF NOT EXISTS auth_connection_org_idx ON auth_connection(org_id);
CREATE INDEX IF NOT EXISTS auth_connection_integration_idx ON auth_connection(integration_id);

CREATE TABLE IF NOT EXISTS tool_permission (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  integration_id TEXT NOT NULL REFERENCES installed_integration(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'denied',
  granted_at INTEGER,
  granted_by TEXT,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tool_permission_user_idx ON tool_permission(user_id);
CREATE INDEX IF NOT EXISTS tool_permission_org_idx ON tool_permission(org_id);
CREATE INDEX IF NOT EXISTS tool_permission_integration_idx ON tool_permission(integration_id);

CREATE TABLE IF NOT EXISTS invocation_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  integration_id TEXT NOT NULL REFERENCES installed_integration(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  session_id TEXT,
  input_params TEXT,
  output_result TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  duration_ms INTEGER,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS invocation_log_user_idx ON invocation_log(user_id);
CREATE INDEX IF NOT EXISTS invocation_log_org_idx ON invocation_log(org_id);
CREATE INDEX IF NOT EXISTS invocation_log_integration_idx ON invocation_log(integration_id);
CREATE INDEX IF NOT EXISTS invocation_log_session_idx ON invocation_log(session_id);

-- Add desktop session tables with state machine and takeover locking
CREATE TABLE IF NOT EXISTS desktop_session (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  session_type TEXT NOT NULL,
  session_state TEXT NOT NULL DEFAULT 'provisioning',
  status TEXT NOT NULL DEFAULT 'pending',
  sandbox_id TEXT,
  sandbox_provider TEXT DEFAULT 'e2b',
  sandbox_credentials TEXT DEFAULT '{}',
  config TEXT DEFAULT '{}',
  metadata TEXT DEFAULT '{}',
  started_at INTEGER,
  paused_at INTEGER,
  stopped_at INTEGER,
  last_activity_at INTEGER,
  last_heartbeat_at INTEGER,
  control_mode TEXT NOT NULL DEFAULT 'agent',
  takeover_user_id TEXT,
  takeover_started_at INTEGER,
  takeover_lock_expires_at INTEGER,
  usage_minutes INTEGER DEFAULT 0,
  usage_compute_units INTEGER DEFAULT 0,
  billing_tier TEXT DEFAULT 'free',
  job_id TEXT,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS desktop_session_user_idx ON desktop_session(user_id);
CREATE INDEX IF NOT EXISTS desktop_session_org_idx ON desktop_session(org_id);
CREATE INDEX IF NOT EXISTS desktop_session_status_idx ON desktop_session(status);
CREATE INDEX IF NOT EXISTS desktop_session_state_idx ON desktop_session(session_state);
CREATE INDEX IF NOT EXISTS desktop_session_type_idx ON desktop_session(session_type);
CREATE INDEX IF NOT EXISTS desktop_session_heartbeat_idx ON desktop_session(last_heartbeat_at);

CREATE TABLE IF NOT EXISTS session_audit_log (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES desktop_session(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS session_audit_session_idx ON session_audit_log(session_id);
CREATE INDEX IF NOT EXISTS session_audit_user_idx ON session_audit_log(user_id);
CREATE INDEX IF NOT EXISTS session_audit_action_idx ON session_audit_log(action);

CREATE TABLE IF NOT EXISTS session_usage (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES desktop_session(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  usage_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  billing_period TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS session_usage_session_idx ON session_usage(session_id);
CREATE INDEX IF NOT EXISTS session_usage_user_idx ON session_usage(user_id);
CREATE INDEX IF NOT EXISTS session_usage_org_idx ON session_usage(org_id);
CREATE INDEX IF NOT EXISTS session_usage_period_idx ON session_usage(billing_period);
