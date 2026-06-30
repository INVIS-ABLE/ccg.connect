CREATE TABLE `rate_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`trade` text NOT NULL,
	`role` text,
	`unit` text DEFAULT 'hour' NOT NULL,
	`pay_rate` real,
	`charge_rate` real,
	`overtime_rate` real,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_ratecard_account` ON `rate_cards` (`account_id`);