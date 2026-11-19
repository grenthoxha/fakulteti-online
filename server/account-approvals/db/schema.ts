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
  tokenHash: text('token_hash').primaryKey(), requestId: text('request_id').notNull(), expiresAt: integer('expires_at').notNull()
});
export const limits = sqliteTable('approval_limits', { key: text('key').primaryKey(), count: integer('count').notNull() });
