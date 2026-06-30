CREATE TABLE `conversation_prefs` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`muted` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_convpref_conv_user` ON `conversation_prefs` (`conversation_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `ix_convpref_user` ON `conversation_prefs` (`user_id`);