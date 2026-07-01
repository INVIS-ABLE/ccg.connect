CREATE TABLE `deployment_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`deployment_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'material' NOT NULL,
	`unit` text,
	`planned_qty` real,
	`issued_qty` real,
	`used_qty` real,
	`returned_qty` real,
	`lost_qty` real,
	`supplier` text,
	`delivery_ref` text,
	`supplier_cost` real,
	`client_charge` real,
	`chargeable` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_material_deployment` ON `deployment_materials` (`deployment_id`);