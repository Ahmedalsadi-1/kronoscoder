CREATE TABLE `desktop_session` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`org_id` text NOT NULL,
	`session_type` text NOT NULL,
	`session_state` text DEFAULT 'provisioning' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`sandbox_id` text,
	`sandbox_provider` text DEFAULT 'e2b',
	`sandbox_credentials` text,
	`config` text DEFAULT '{}',
	`metadata` text DEFAULT '{}',
	`started_at` integer,
	`paused_at` integer,
	`stopped_at` integer,
	`last_activity_at` integer,
	`last_heartbeat_at` integer,
	`control_mode` text DEFAULT 'agent' NOT NULL,
	`takeover_user_id` text,
	`takeover_started_at` integer,
	`takeover_lock_expires_at` integer,
	`usage_minutes` integer DEFAULT 0,
	`usage_compute_units` integer DEFAULT 0,
	`billing_tier` text DEFAULT 'free',
	`job_id` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_audit_log` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`details` text DEFAULT '{}',
	`ip_address` text,
	`user_agent` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_session_audit_log_session_id_desktop_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `desktop_session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `session_usage` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`org_id` text NOT NULL,
	`usage_type` text NOT NULL,
	`amount` integer NOT NULL,
	`billing_period` text NOT NULL,
	`recorded_at` integer NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_session_usage_session_id_desktop_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `desktop_session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `auth_connection` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`org_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`auth_type` text NOT NULL,
	`credentials` text NOT NULL,
	`scopes` text DEFAULT '[]',
	`expires_at` integer,
	`refresh_token` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_auth_connection_integration_id_installed_integration_id_fk` FOREIGN KEY (`integration_id`) REFERENCES `installed_integration`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `installed_integration` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`org_id` text NOT NULL,
	`marketplace_entry_id` text NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`install_state` text DEFAULT 'requested' NOT NULL,
	`status` text DEFAULT 'installed' NOT NULL,
	`config` text DEFAULT '{}',
	`auth_connection_id` text,
	`last_health_check` integer,
	`health_status` text DEFAULT 'unknown',
	`health_error` text,
	`failure_reason` text,
	`retry_count` integer DEFAULT 0,
	`job_id` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_installed_integration_marketplace_entry_id_marketplace_entry_id_fk` FOREIGN KEY (`marketplace_entry_id`) REFERENCES `marketplace_entry`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `invocation_log` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`org_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`session_id` text,
	`input_params` text,
	`output_result` text,
	`status` text NOT NULL,
	`error_message` text,
	`duration_ms` integer,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_invocation_log_integration_id_installed_integration_id_fk` FOREIGN KEY (`integration_id`) REFERENCES `installed_integration`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `marketplace_entry` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text,
	`publisher` text NOT NULL,
	`category` text NOT NULL,
	`version` text NOT NULL,
	`homepage_url` text,
	`repository_url` text,
	`documentation_url` text,
	`icon_url` text,
	`verified` integer DEFAULT false,
	`featured` integer DEFAULT false,
	`download_count` integer DEFAULT 0,
	`rating_average` integer DEFAULT 0,
	`rating_count` integer DEFAULT 0,
	`tags` text DEFAULT '[]',
	`screenshots` text DEFAULT '[]',
	`manifest_url` text NOT NULL,
	`auth_required` integer DEFAULT false,
	`auth_type` text,
	`auth_scopes` text DEFAULT '[]',
	`permissions` text DEFAULT '[]',
	`tools_exposed` text DEFAULT '[]',
	`risk_level` text DEFAULT 'low',
	`risk_notes` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tool_permission` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`org_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`permission_level` text DEFAULT 'denied' NOT NULL,
	`granted_at` integer,
	`granted_by` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_tool_permission_integration_id_installed_integration_id_fk` FOREIGN KEY (`integration_id`) REFERENCES `installed_integration`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `desktop_session_user_idx` ON `desktop_session` (`user_id`);--> statement-breakpoint
CREATE INDEX `desktop_session_org_idx` ON `desktop_session` (`org_id`);--> statement-breakpoint
CREATE INDEX `desktop_session_status_idx` ON `desktop_session` (`status`);--> statement-breakpoint
CREATE INDEX `desktop_session_state_idx` ON `desktop_session` (`session_state`);--> statement-breakpoint
CREATE INDEX `desktop_session_type_idx` ON `desktop_session` (`session_type`);--> statement-breakpoint
CREATE INDEX `desktop_session_heartbeat_idx` ON `desktop_session` (`last_heartbeat_at`);--> statement-breakpoint
CREATE INDEX `session_audit_session_idx` ON `session_audit_log` (`session_id`);--> statement-breakpoint
CREATE INDEX `session_audit_user_idx` ON `session_audit_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_audit_action_idx` ON `session_audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `session_usage_session_idx` ON `session_usage` (`session_id`);--> statement-breakpoint
CREATE INDEX `session_usage_user_idx` ON `session_usage` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_usage_org_idx` ON `session_usage` (`org_id`);--> statement-breakpoint
CREATE INDEX `session_usage_period_idx` ON `session_usage` (`billing_period`);--> statement-breakpoint
CREATE INDEX `auth_connection_user_idx` ON `auth_connection` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_connection_org_idx` ON `auth_connection` (`org_id`);--> statement-breakpoint
CREATE INDEX `auth_connection_integration_idx` ON `auth_connection` (`integration_id`);--> statement-breakpoint
CREATE INDEX `installed_integration_user_idx` ON `installed_integration` (`user_id`);--> statement-breakpoint
CREATE INDEX `installed_integration_org_idx` ON `installed_integration` (`org_id`);--> statement-breakpoint
CREATE INDEX `installed_integration_status_idx` ON `installed_integration` (`status`);--> statement-breakpoint
CREATE INDEX `installed_integration_state_idx` ON `installed_integration` (`install_state`);--> statement-breakpoint
CREATE UNIQUE INDEX `installed_integration_unique_idx` ON `installed_integration` (`org_id`,`marketplace_entry_id`);--> statement-breakpoint
CREATE INDEX `invocation_log_user_idx` ON `invocation_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `invocation_log_org_idx` ON `invocation_log` (`org_id`);--> statement-breakpoint
CREATE INDEX `invocation_log_integration_idx` ON `invocation_log` (`integration_id`);--> statement-breakpoint
CREATE INDEX `invocation_log_session_idx` ON `invocation_log` (`session_id`);--> statement-breakpoint
CREATE INDEX `marketplace_category_idx` ON `marketplace_entry` (`category`);--> statement-breakpoint
CREATE INDEX `marketplace_publisher_idx` ON `marketplace_entry` (`publisher`);--> statement-breakpoint
CREATE INDEX `marketplace_verified_idx` ON `marketplace_entry` (`verified`);--> statement-breakpoint
CREATE INDEX `tool_permission_user_idx` ON `tool_permission` (`user_id`);--> statement-breakpoint
CREATE INDEX `tool_permission_org_idx` ON `tool_permission` (`org_id`);--> statement-breakpoint
CREATE INDEX `tool_permission_integration_idx` ON `tool_permission` (`integration_id`);