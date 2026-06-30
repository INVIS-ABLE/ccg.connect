CREATE TABLE `corporate_account_users` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`user_id` text NOT NULL,
	`granted_by` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_cau_user` ON `corporate_account_users` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_cau_account_user` ON `corporate_account_users` (`account_id`,`user_id`);