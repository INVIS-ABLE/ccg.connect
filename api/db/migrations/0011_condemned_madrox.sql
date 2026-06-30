CREATE TABLE `job_checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`contractor_id` text,
	`user_id` text NOT NULL,
	`check_type` text DEFAULT 'arrival' NOT NULL,
	`checked_in_at` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`accuracy_m` real,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_checkin_job` ON `job_checkins` (`job_id`);