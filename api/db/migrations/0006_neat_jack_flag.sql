CREATE TABLE `contact_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`address_type` text DEFAULT 'contact' NOT NULL,
	`line_1` text,
	`line_2` text,
	`town_city` text,
	`county` text,
	`postcode` text,
	`latitude` real,
	`longitude` real,
	`is_primary` integer DEFAULT false NOT NULL,
	`privacy_level` text DEFAULT 'private' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `preferred_contact_method` text;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `onboarding_completed_at` text;