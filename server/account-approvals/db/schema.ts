import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const requests = sqliteTable('approval_requests', {
  id: text('id').primaryKey(), email: text('email').notNull(), name: text('name').notNull(),
  publicKey: text('public_key').notNull(), requestedRole: text('requested_role').notNull(),
  status: text('status').notNull().default('pending'), role: text('role').notNull().default('student'),
  permissions: text('permissions').notNull().default('[]'), landing: text('landing').notNull().default('auto'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
  version: integer('version').notNull().default(1)
}, table => [index('approval_requests_status').on(table.status, table.createdAt)]);
export const settings = sqliteTable('approval_settings', { key: text('key').primaryKey(), value: text('value').notNull() });
export const nonces = sqliteTable('approval_nonces', { key: text('key').primaryKey(), expiresAt: integer('expires_at').notNull() });
export const links = sqliteTable('approval_admin_links', {
  tokenHash: text('token_hash').primaryKey(), requestId: text('request_id').notNull(), expiresAt: integer('expires_at').notNull(),
  csrfHash: text('csrf_hash'), csrfOwner: text('csrf_owner')
});
export const limits = sqliteTable('approval_limits', { key: text('key').primaryKey(), count: integer('count').notNull() });

// Learning data and documents deliberately remain on each device.
export const accounts = sqliteTable('cloud_accounts', {
  id: text('id').primaryKey(), email: text('email').notNull().unique(),
  salt: text('salt').notNull(), passwordHash: text('password_hash').notNull(),
  recoveryHash: text('recovery_hash').notNull(), revision: integer('revision').notNull().default(1),
  approvalId: text('approval_id').notNull().references(() => requests.id),
  profile: text('profile').notNull(), profileVersion: integer('profile_version').notNull().default(1),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
  lastLogin: integer('last_login').notNull().default(0)
});
export const devices = sqliteTable('cloud_devices', {
  id: text('id').primaryKey().references(() => requests.id),
  accountId: text('account_id').notNull().references(() => accounts.id),
  revision: integer('revision').notNull(), linkedAt: integer('linked_at').notNull()
}, table => [index('cloud_devices_account').on(table.accountId)]);

export const audit = sqliteTable('account_audit', {
  id: text('id').primaryKey(), actor: text('actor').notNull(), subject: text('subject').notNull(),
  action: text('action').notNull(), createdAt: integer('created_at').notNull()
}, table => [index('account_audit_created').on(table.createdAt)]);
