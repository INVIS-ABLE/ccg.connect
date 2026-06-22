CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`previous_values` text,
	`new_values` text,
	`timestamp` text,
	`reason` text,
	`correlation_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`event_type` text DEFAULT 'other' NOT NULL,
	`start_datetime` text NOT NULL,
	`end_datetime` text,
	`all_day` integer DEFAULT false NOT NULL,
	`job_id` text,
	`contractor_id` text,
	`client_id` text,
	`location` text,
	`colour` text DEFAULT 'orange' NOT NULL,
	`visible_to_contractor` integer DEFAULT true NOT NULL,
	`visible_to_client` integer DEFAULT false NOT NULL,
	`created_by` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `checklist_template_items` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`required` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`requires_file` integer DEFAULT false NOT NULL,
	`requires_signature` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `checklist_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`job_type` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`client_reference` text,
	`client_type` text DEFAULT 'company' NOT NULL,
	`individual_or_company_name` text NOT NULL,
	`main_contact_name` text,
	`email` text,
	`phone` text,
	`billing_email` text,
	`billing_address` text,
	`default_site_address` text,
	`default_postcode` text,
	`account_status` text DEFAULT 'active' NOT NULL,
	`portal_enabled` integer DEFAULT false NOT NULL,
	`private_admin_notes` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contractor_availability` (
	`id` text PRIMARY KEY NOT NULL,
	`contractor_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`availability_type` text DEFAULT 'available' NOT NULL,
	`all_day` integer DEFAULT true NOT NULL,
	`notes` text,
	`recurring_pattern` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contractor_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`contractor_id` text NOT NULL,
	`credential_type_id` text NOT NULL,
	`issuer` text,
	`registration_or_policy_number` text,
	`issue_date` text,
	`expiry_date` text,
	`file_url` text,
	`verification_status` text DEFAULT 'awaiting_review' NOT NULL,
	`verification_source` text,
	`verified_by` text,
	`verified_at` text,
	`rejection_reason` text,
	`visibility` text DEFAULT 'contractor_and_admin' NOT NULL,
	`reminder_60_sent` integer DEFAULT false NOT NULL,
	`reminder_30_sent` integer DEFAULT false NOT NULL,
	`reminder_14_sent` integer DEFAULT false NOT NULL,
	`reminder_7_sent` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contractor_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`contractor_reference` text,
	`approval_status` text DEFAULT 'pending' NOT NULL,
	`trading_name` text,
	`legal_name` text,
	`company_number` text,
	`tax_or_vat_reference` text,
	`primary_trade` text,
	`biography` text,
	`base_postcode` text,
	`postcode_district` text,
	`service_radius_miles` real,
	`maximum_travel_miles` real,
	`transport_available` integer DEFAULT true NOT NULL,
	`day_rate` real,
	`hourly_rate` real,
	`availability_status` text DEFAULT 'available' NOT NULL,
	`preferred_contractor` integer DEFAULT false NOT NULL,
	`internal_risk_status` text DEFAULT 'low' NOT NULL,
	`private_admin_notes` text,
	`onboarding_completed` integer DEFAULT false NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`suspended_reason` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contractor_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`contractor_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`proficiency_level` text DEFAULT 'experienced' NOT NULL,
	`years_experience` real,
	`primary_skill` integer DEFAULT false NOT NULL,
	`admin_verified` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `credential_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`requires_expiry` integer DEFAULT true NOT NULL,
	`verification_url_template` text,
	`default_client_visible` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`contractor_id` text,
	`client_id` text,
	`invoice_number` text,
	`invoice_type` text DEFAULT 'contractor_to_ccg' NOT NULL,
	`issue_date` text,
	`due_date` text,
	`net_amount` real,
	`vat_rate` real DEFAULT 20 NOT NULL,
	`vat_amount` real,
	`gross_amount` real,
	`status` text DEFAULT 'draft' NOT NULL,
	`file_url` text,
	`linked_timesheet_ids` text,
	`exported_to` text,
	`external_reference` text,
	`payment_date` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`contractor_id` text NOT NULL,
	`assignment_status` text DEFAULT 'active' NOT NULL,
	`agreed_rate_type` text DEFAULT 'daily' NOT NULL,
	`agreed_rate` real,
	`planned_start` text,
	`planned_finish` text,
	`actual_start` text,
	`actual_finish` text,
	`assigned_by` text,
	`assigned_at` text,
	`cancellation_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`template_item_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_by` text,
	`completed_at` text,
	`notes` text,
	`evidence_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`document_type` text,
	`title` text NOT NULL,
	`file_url` text,
	`uploaded_by` text,
	`version` integer DEFAULT 1 NOT NULL,
	`approval_status` text DEFAULT 'draft' NOT NULL,
	`client_visible` integer DEFAULT false NOT NULL,
	`contractor_visible` integer DEFAULT false NOT NULL,
	`signed_at` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`contractor_id` text NOT NULL,
	`eligibility_status` text DEFAULT 'eligible' NOT NULL,
	`total_score` real,
	`skill_score` real,
	`distance_score` real,
	`availability_score` real,
	`credential_score` real,
	`delivery_history_score` real,
	`admin_preference_score` real,
	`explanation` text,
	`offer_status` text DEFAULT 'not_sent' NOT NULL,
	`notified_at` text,
	`viewed_at` text,
	`responded_at` text,
	`decline_reason` text,
	`contractor_message` text,
	`selected_by_admin` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_media` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`contractor_id` text,
	`client_id` text,
	`media_type` text DEFAULT 'image' NOT NULL,
	`category` text DEFAULT 'progress' NOT NULL,
	`file_url` text NOT NULL,
	`thumbnail_url` text,
	`original_filename` text,
	`caption` text,
	`captured_at` text,
	`uploaded_at` text,
	`latitude` real,
	`longitude` real,
	`client_visible` integer DEFAULT false NOT NULL,
	`internal_only` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`job_id` text NOT NULL,
	`sender_user_id` text NOT NULL,
	`message_text` text,
	`message_type` text DEFAULT 'text' NOT NULL,
	`attachment_url` text,
	`client_visible` integer DEFAULT false NOT NULL,
	`internal_only` integer DEFAULT false NOT NULL,
	`reply_to_message_id` text,
	`sent_at` text,
	`edited_at` text,
	`read_at` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_required_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`credential_type_id` text NOT NULL,
	`mandatory` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_required_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`required_level` text DEFAULT 'any' NOT NULL,
	`mandatory` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`thread_type` text DEFAULT 'internal_operations' NOT NULL,
	`client_visible` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_reference` text,
	`client_id` text,
	`title` text NOT NULL,
	`short_description` text,
	`full_scope` text,
	`site_address` text,
	`site_postcode` text,
	`latitude` real,
	`longitude` real,
	`trade_category` text,
	`urgency` text DEFAULT 'medium' NOT NULL,
	`start_date` text,
	`end_date` text,
	`estimated_duration` text,
	`budget` real,
	`hourly_rate` real,
	`day_rate` real,
	`headcount_required` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`client_contact_name` text,
	`client_contact_phone` text,
	`access_instructions` text,
	`parking_instructions` text,
	`health_and_safety_notes` text,
	`internal_notes` text,
	`client_visible_notes` text,
	`assignment_locked` integer DEFAULT false NOT NULL,
	`created_from_lead` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`company` text,
	`email` text NOT NULL,
	`phone` text,
	`site_postcode` text,
	`work_type` text,
	`description` text,
	`desired_dates` text,
	`preferred_contact_method` text DEFAULT 'either' NOT NULL,
	`attachment_urls` text,
	`consent` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`converted_job_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text,
	`notification_type` text,
	`title` text NOT NULL,
	`body` text,
	`deep_link` text,
	`channel` text DEFAULT 'in_app' NOT NULL,
	`delivery_status` text DEFAULT 'pending' NOT NULL,
	`sent_at` text,
	`read_at` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`description` text,
	`synonyms` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timesheet_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`timesheet_id` text NOT NULL,
	`work_date` text NOT NULL,
	`start_time` text,
	`finish_time` text,
	`break_minutes` integer DEFAULT 0 NOT NULL,
	`total_hours` real,
	`rate` real,
	`description` text,
	`evidence_url` text,
	`contractor_signature` text,
	`client_signature` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timesheets` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`contractor_id` text NOT NULL,
	`week_start` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`submitted_at` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`rejection_reason` text,
	`total_hours` real,
	`total_amount` real,
	`exported_at` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'contractor' NOT NULL,
	`first_name` text,
	`last_name` text,
	`display_name` text,
	`email` text,
	`phone` text,
	`profile_photo_url` text,
	`account_status` text DEFAULT 'pending' NOT NULL,
	`last_active_at` text,
	`terms_accepted_at` text,
	`privacy_accepted_at` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
