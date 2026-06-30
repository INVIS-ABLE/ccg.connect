ALTER TABLE `commercial_sites` ADD `geofence_radius_m` real;--> statement-breakpoint
ALTER TABLE `deployment_attendance` ADD `geofence_ok` integer;--> statement-breakpoint
ALTER TABLE `deployment_attendance` ADD `geofence_distance_m` real;