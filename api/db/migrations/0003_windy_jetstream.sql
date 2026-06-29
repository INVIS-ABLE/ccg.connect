CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`pair_key` text NOT NULL,
	`a_user_id` text NOT NULL,
	`b_user_id` text NOT NULL,
	`last_message_at` text,
	`last_message_preview` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_pair_key_unique` ON `conversations` (`pair_key`);--> statement-breakpoint
CREATE TABLE `direct_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_user_id` text NOT NULL,
	`body` text NOT NULL,
	`read_at` text,
	`created_at` integer NOT NULL
);
