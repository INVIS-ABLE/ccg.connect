CREATE TABLE `performance_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`deployment_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`direction` text NOT NULL,
	`scores` text,
	`overall` real,
	`would_repeat` integer,
	`comment` text,
	`evidence` text,
	`status` text DEFAULT 'recorded' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_perf_deployment` ON `performance_reviews` (`deployment_id`);--> statement-breakpoint
CREATE INDEX `ix_perf_worker` ON `performance_reviews` (`worker_id`);