CREATE TABLE `deployment_replacements` (
	`id` text PRIMARY KEY NOT NULL,
	`deployment_id` text NOT NULL,
	`original_worker_id` text NOT NULL,
	`replacement_worker_id` text,
	`reason` text,
	`status` text DEFAULT 'filled' NOT NULL,
	`requested_by` text,
	`filled_at` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_repl_deployment` ON `deployment_replacements` (`deployment_id`);