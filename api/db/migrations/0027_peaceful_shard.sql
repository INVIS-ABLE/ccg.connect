CREATE TABLE `kid_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`deployment_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`employment_business` text,
	`contract_type` text,
	`payment_model` text,
	`pay_rate` real,
	`pay_frequency` text,
	`paid_by` text,
	`deductions` text,
	`holiday_entitlement` text,
	`holiday_pay` text,
	`other_fees` text,
	`example_calculation` text,
	`notes` text,
	`issued_at` text,
	`acknowledged_at` text,
	`acknowledged_signature` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_kid_deployment` ON `kid_documents` (`deployment_id`);--> statement-breakpoint
CREATE INDEX `ix_kid_worker` ON `kid_documents` (`worker_id`);