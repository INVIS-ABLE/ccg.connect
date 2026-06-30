PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'direct' NOT NULL,
	`pair_key` text NOT NULL,
	`a_user_id` text,
	`b_user_id` text,
	`job_id` text,
	`title` text,
	`last_message_at` text,
	`last_message_preview` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_conversations`("id", "pair_key", "a_user_id", "b_user_id", "last_message_at", "last_message_preview", "created_at", "updated_at") SELECT "id", "pair_key", "a_user_id", "b_user_id", "last_message_at", "last_message_preview", "created_at", "updated_at" FROM `conversations`;--> statement-breakpoint
DROP TABLE `conversations`;--> statement-breakpoint
ALTER TABLE `__new_conversations` RENAME TO `conversations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_pair_key_unique` ON `conversations` (`pair_key`);