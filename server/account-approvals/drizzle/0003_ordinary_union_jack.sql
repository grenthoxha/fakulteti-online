CREATE TABLE `account_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`subject` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_audit_created` ON `account_audit` (`created_at`);--> statement-breakpoint
ALTER TABLE `cloud_accounts` ADD `last_login` integer DEFAULT 0 NOT NULL;