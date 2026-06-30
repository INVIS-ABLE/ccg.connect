CREATE TABLE `form_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text,
	`deployment_id` text,
	`form_type` text DEFAULT 'rams' NOT NULL,
	`title` text NOT NULL,
	`reference` text,
	`site_name` text,
	`prepared_by` text,
	`content` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`issued_at` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_formdoc_deployment` ON `form_documents` (`deployment_id`);--> statement-breakpoint
CREATE TABLE `form_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`form_type` text DEFAULT 'rams' NOT NULL,
	`description` text,
	`content` text,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_formtpl_type` ON `form_templates` (`form_type`);