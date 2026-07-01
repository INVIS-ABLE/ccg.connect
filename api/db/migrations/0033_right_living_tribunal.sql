CREATE TABLE `deployment_media` (
	`id` text PRIMARY KEY NOT NULL,
	`deployment_id` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`media_type` text DEFAULT 'image' NOT NULL,
	`category` text DEFAULT 'progress' NOT NULL,
	`file_url` text NOT NULL,
	`original_filename` text,
	`caption` text,
	`captured_at` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_depmedia_deployment` ON `deployment_media` (`deployment_id`);