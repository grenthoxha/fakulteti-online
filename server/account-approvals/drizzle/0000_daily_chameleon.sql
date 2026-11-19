CREATE TABLE `approval_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `approval_admin_links` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `approval_nonces` (
	`key` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`public_key` text NOT NULL,
	`requested_role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`landing` text DEFAULT 'auto' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `approval_requests_status` ON `approval_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `approval_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
