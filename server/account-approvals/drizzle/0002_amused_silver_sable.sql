CREATE TABLE `cloud_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`recovery_hash` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`approval_id` text NOT NULL,
	`profile` text NOT NULL,
	`profile_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`approval_id`) REFERENCES `approval_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cloud_accounts_email_unique` ON `cloud_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `cloud_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`revision` integer NOT NULL,
	`linked_at` integer NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `approval_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `cloud_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cloud_devices_account` ON `cloud_devices` (`account_id`);