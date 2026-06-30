CREATE TABLE `commercial_timesheets` (
	`id` text PRIMARY KEY NOT NULL,
	`deployment_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`week_start` text NOT NULL,
	`basic_hours` real DEFAULT 0 NOT NULL,
	`overtime_hours` real DEFAULT 0 NOT NULL,
	`pay_rate` real,
	`charge_rate` real,
	`oncost_rate` real,
	`overtime_multiplier` real,
	`travel` real,
	`lodge` real,
	`expenses` real,
	`deductions` real,
	`status` text DEFAULT 'draft' NOT NULL,
	`rejection_reason` text,
	`notes` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_ts_deployment` ON `commercial_timesheets` (`deployment_id`);