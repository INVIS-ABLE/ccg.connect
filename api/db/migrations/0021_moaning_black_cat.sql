CREATE TABLE `incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`account_id` text,
	`site_id` text,
	`deployment_id` text,
	`worker_id` text,
	`gang_id` text,
	`occurred_at` text,
	`description` text,
	`immediate_action` text,
	`witnesses` text,
	`investigation` text,
	`outcome` text,
	`restricted_notes` text,
	`urgent` integer DEFAULT false NOT NULL,
	`reported_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_incident_site` ON `incidents` (`site_id`);--> statement-breakpoint
CREATE INDEX `ix_incident_deployment` ON `incidents` (`deployment_id`);--> statement-breakpoint
CREATE TABLE `site_diary_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`deployment_id` text NOT NULL,
	`date` text NOT NULL,
	`weather` text,
	`headcount` integer,
	`work_summary` text,
	`deliveries` text,
	`visitors` text,
	`issues` text,
	`notes` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_diary_deployment` ON `site_diary_entries` (`deployment_id`);