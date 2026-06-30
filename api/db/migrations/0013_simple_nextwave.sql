CREATE TABLE `commercial_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`project_number` text,
	`region_division` text,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_project_account` ON `commercial_projects` (`account_id`);--> statement-breakpoint
CREATE TABLE `commercial_sites` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`site_address` text,
	`postcode` text,
	`what3words` text,
	`latitude` real,
	`longitude` real,
	`principal_contractor` text,
	`site_manager` text,
	`commercial_manager` text,
	`working_hours` text,
	`parking_access` text,
	`induction_instructions` text,
	`ppe_requirements` text,
	`drug_alcohol_policy` text,
	`emergency_arrangements` text,
	`welfare_info` text,
	`site_rules` text,
	`required_cards` text,
	`prohibited_activities` text,
	`check_in_method` text,
	`po_number` text,
	`cost_code` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_site_project` ON `commercial_sites` (`project_id`);--> statement-breakpoint
CREATE INDEX `ix_site_account` ON `commercial_sites` (`account_id`);--> statement-breakpoint
CREATE TABLE `corporate_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`trading_name` text,
	`registration_number` text,
	`status` text DEFAULT 'active' NOT NULL,
	`vat_treatment` text,
	`cis_treatment` text,
	`payment_terms` text,
	`framework_agreement` text,
	`insurance_requirements` text,
	`required_accreditations` text,
	`invoice_instructions` text,
	`supplier_portal_reference` text,
	`data_retention_note` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `corporate_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`email` text,
	`phone` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_corpcontact_account` ON `corporate_contacts` (`account_id`);