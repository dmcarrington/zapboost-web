import {
  pgTable,
  text,
  integer,
  bigint,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  pubkey: text('pubkey').primaryKey(),
  tier: text('tier').notNull().default('free'), // free | creator | pro | platform
  createdAt: timestamp('created_at').defaultNow().notNull(),
  settings: jsonb('settings').default({}),
});

export const zapEvents = pgTable('zap_events', {
  id: text('id').primaryKey(), // nostr event id
  postId: text('post_id'),
  recipientPubkey: text('recipient_pubkey').notNull(),
  senderPubkey: text('sender_pubkey'),
  amountSats: integer('amount_sats').notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
  rawEvent: jsonb('raw_event'),
}, (table) => [
  index('zap_recipient_ts_idx').on(table.recipientPubkey, table.timestamp),
  index('zap_post_idx').on(table.postId),
  index('zap_sender_idx').on(table.senderPubkey),
  index('zap_ts_idx').on(table.timestamp),
]);

export const posts = pgTable('posts', {
  id: text('id').primaryKey(), // nostr event id
  content: text('content'),
  authorPubkey: text('author_pubkey').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  images: jsonb('images').default([]),
}, (table) => [
  index('post_author_idx').on(table.authorPubkey),
]);

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(), // payment hash or UUID
  pubkey: text('pubkey').notNull().references(() => users.pubkey),
  tier: text('tier').notNull(), // creator | pro
  amountSats: integer('amount_sats').notNull(),
  status: text('status').notNull().default('pending'), // pending | paid | expired | cancelled
  paymentHash: text('payment_hash'),
  bolt11: text('bolt11'), // Lightning invoice
  paidAt: timestamp('paid_at'),
  expiresAt: timestamp('expires_at').notNull(), // subscription end date
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('sub_pubkey_idx').on(table.pubkey),
  index('sub_status_idx').on(table.status),
  index('sub_expires_idx').on(table.expiresAt),
]);

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(), // the API key itself (zb_live_xxx or zb_test_xxx)
  pubkey: text('pubkey').notNull().references(() => users.pubkey),
  name: text('name').notNull(), // user-provided label
  tier: text('tier').notNull(), // inherited from user at creation time
  rateLimit: integer('rate_limit').notNull().default(100), // requests per minute
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
}, (table) => [
  index('apikey_pubkey_idx').on(table.pubkey),
]);

export const backfillJobs = pgTable('backfill_jobs', {
  id: text('id').primaryKey(), // UUID
  pubkey: text('pubkey').notNull().references(() => users.pubkey),
  status: text('status').notNull().default('pending'), // pending | running | completed | failed
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  eventsProcessed: integer('events_processed'),
  error: text('error'),
}, (table) => [
  index('backfill_status_idx').on(table.status),
  index('backfill_pubkey_idx').on(table.pubkey),
]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // JWT jti
  pubkey: text('pubkey').notNull().references(() => users.pubkey),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('session_pubkey_idx').on(table.pubkey),
  index('session_expires_idx').on(table.expiresAt),
]);
