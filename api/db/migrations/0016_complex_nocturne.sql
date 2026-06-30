CREATE TABLE `labour_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`project_id` text,
	`site_id` text,
	`title` text NOT NULL,
	`work_package` text,
	`trade` text,
	`number_required` integer DEFAULT 1 NOT NULL,
	`gang_composition` text,
	`start_date` text,
	`finish_date` text,
	`shift_pattern` text,
	`minimum_qualifications` text,
	`experience_required` text,
	`employment_model` text,
	`rate_offered` real,
	`charge_rate` real,
	`overtime_rate` real,
	`travel_lodge_allowance` text,
	`po_number` text,
	`urgency` text DEFAULT 'medium' NOT NULL,
	`replacement_sla` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_labreq_account` ON `labour_requests` (`account_id`);--> statement-breakpoint
CREATE INDEX `ix_labreq_site` ON `labour_requests` (`site_id`);