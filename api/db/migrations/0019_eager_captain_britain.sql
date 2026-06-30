CREATE TABLE `commercial_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text,
	`deployment_id` text,
	`invoice_number` text,
	`period_start` text,
	`period_end` text,
	`line_items` text,
	`net_amount` real DEFAULT 0 NOT NULL,
	`vat_rate` real DEFAULT 0.2 NOT NULL,
	`vat_amount` real DEFAULT 0 NOT NULL,
	`gross_amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_cinv_account` ON `commercial_invoices` (`account_id`);