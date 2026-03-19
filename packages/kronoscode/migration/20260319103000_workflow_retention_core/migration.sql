CREATE TABLE `workflow_run` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`workflow_id` text NOT NULL,
	`playbook_id` text NOT NULL,
	`workflow_stage` text NOT NULL,
	`status` text NOT NULL,
	`workflow_outcome` text,
	`session_resume_token` text,
	`idempotency_key` text,
	`input` text,
	`output` text,
	`error` text,
	`time_started` integer,
	`time_completed` integer,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `workflow_run_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `workflow_run_node` (
	`run_id` text NOT NULL,
	`node_id` text NOT NULL,
	`node_type` text NOT NULL,
	`label` text NOT NULL,
	`workflow_stage` text NOT NULL,
	`status` text NOT NULL,
	`position` integer NOT NULL,
	`time_started` integer,
	`time_completed` integer,
	`error` text,
	`metadata` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	PRIMARY KEY(`run_id`, `node_id`),
	CONSTRAINT `workflow_run_node_run_id_workflow_run_id_fk` FOREIGN KEY (`run_id`) REFERENCES `workflow_run`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `workflow_run_session_idx` ON `workflow_run` (`session_id`);--> statement-breakpoint
CREATE INDEX `workflow_run_status_idx` ON `workflow_run` (`status`);--> statement-breakpoint
CREATE INDEX `workflow_run_created_idx` ON `workflow_run` (`time_created`);--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_run_idempotency_idx` ON `workflow_run` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `workflow_run_node_run_idx` ON `workflow_run_node` (`run_id`);--> statement-breakpoint
CREATE INDEX `workflow_run_node_status_idx` ON `workflow_run_node` (`status`);
