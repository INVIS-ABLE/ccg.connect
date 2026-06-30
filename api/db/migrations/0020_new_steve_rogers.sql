CREATE TABLE `deployment_attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`deployment_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'present' NOT NULL,
	`check_in_time` text,
	`check_out_time` text,
	`method` text,
	`confirmed_by` text,
	`reason` text,
	`replacement_needed` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_att_deploy_date` ON `deployment_attendance` (`deployment_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_att_deploy_worker_date` ON `deployment_attendance` (`deployment_id`,`worker_id`,`date`);