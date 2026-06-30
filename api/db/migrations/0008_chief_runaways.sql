CREATE TABLE `message_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_reaction_msg_user_emoji` ON `message_reactions` (`message_id`,`user_id`,`emoji`);--> statement-breakpoint
CREATE INDEX `ix_reaction_message` ON `message_reactions` (`message_id`);--> statement-breakpoint
ALTER TABLE `direct_messages` ADD `reply_to_id` text;