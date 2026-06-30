CREATE TABLE `gang_members` (
	`id` text PRIMARY KEY NOT NULL,
	`gang_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`role` text DEFAULT 'permanent' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_gangmember_gang` ON `gang_members` (`gang_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_gangmember_gang_worker` ON `gang_members` (`gang_id`,`worker_id`);--> statement-breakpoint
CREATE TABLE `gangs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`gang_leader_worker_id` text,
	`base_postcode` text,
	`service_radius_miles` real,
	`usual_day_rate` real,
	`vehicles` text,
	`plant_capability` text,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
