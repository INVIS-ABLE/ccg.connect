CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`client_id` text,
	`quote_number` text,
	`recipient_name` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`line_items` text,
	`net_amount` real,
	`vat_rate` real DEFAULT 20 NOT NULL,
	`vat_amount` real,
	`gross_amount` real,
	`valid_until` text,
	`notes` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
