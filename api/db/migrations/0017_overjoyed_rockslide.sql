CREATE TABLE `deployment_workers` (
	`id` text PRIMARY KEY NOT NULL,
	`deployment_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`role` text,
	`pay_rate` real,
	`charge_rate` real,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_depworker_deployment` ON `deployment_workers` (`deployment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_depworker_deploy_worker` ON `deployment_workers` (`deployment_id`,`worker_id`);--> statement-breakpoint
CREATE TABLE `deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`labour_request_id` text NOT NULL,
	`account_id` text,
	`site_id` text,
	`gang_id` text,
	`status` text DEFAULT 'proposed' NOT NULL,
	`start_date` text,
	`finish_date` text,
	`compliance_snapshot` text,
	`confirmed_at` text,
	`conversation_id` text,
	`notes` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_deploy_request` ON `deployments` (`labour_request_id`);--> statement-breakpoint
ALTER TABLE `conversations` ADD `deployment_id` text;