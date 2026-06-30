CREATE TABLE `worker_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`worker_id` text NOT NULL,
	`card_type` text NOT NULL,
	`reference` text,
	`issuer` text,
	`issue_date` text,
	`expiry_date` text,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`file_url` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_card_worker` ON `worker_cards` (`worker_id`);--> statement-breakpoint
CREATE TABLE `workers` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`photo_url` text,
	`mobile` text,
	`email` text,
	`home_address` text,
	`base_postcode` text,
	`latitude` real,
	`longitude` real,
	`emergency_contact_name` text,
	`emergency_contact_phone` text,
	`right_to_work_status` text DEFAULT 'unchecked' NOT NULL,
	`rtw_check_date` text,
	`rtw_checked_by` text,
	`rtw_expiry` text,
	`payment_model` text,
	`primary_trade` text,
	`additional_skills` text,
	`experience_years` real,
	`driving_licence` text,
	`plant_tickets` text,
	`preferred_travel_miles` real,
	`day_rate` real,
	`hourly_rate` real,
	`contractor_id` text,
	`user_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_worker_contractor` ON `workers` (`contractor_id`);