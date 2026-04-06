CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"pubkey" text NOT NULL,
	"name" text NOT NULL,
	"tier" text NOT NULL,
	"rate_limit" integer DEFAULT 100 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "backfill_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"pubkey" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"events_processed" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text,
	"author_pubkey" text NOT NULL,
	"created_at" bigint NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"pubkey" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"pubkey" text NOT NULL,
	"tier" text NOT NULL,
	"amount_sats" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_hash" text,
	"bolt11" text,
	"paid_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"pubkey" text PRIMARY KEY NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "zap_events" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text,
	"recipient_pubkey" text NOT NULL,
	"sender_pubkey" text,
	"amount_sats" integer NOT NULL,
	"timestamp" bigint NOT NULL,
	"raw_event" jsonb
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_pubkey_users_pubkey_fk" FOREIGN KEY ("pubkey") REFERENCES "public"."users"("pubkey") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backfill_jobs" ADD CONSTRAINT "backfill_jobs_pubkey_users_pubkey_fk" FOREIGN KEY ("pubkey") REFERENCES "public"."users"("pubkey") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_pubkey_users_pubkey_fk" FOREIGN KEY ("pubkey") REFERENCES "public"."users"("pubkey") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_pubkey_users_pubkey_fk" FOREIGN KEY ("pubkey") REFERENCES "public"."users"("pubkey") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apikey_pubkey_idx" ON "api_keys" USING btree ("pubkey");--> statement-breakpoint
CREATE INDEX "backfill_status_idx" ON "backfill_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "backfill_pubkey_idx" ON "backfill_jobs" USING btree ("pubkey");--> statement-breakpoint
CREATE INDEX "post_author_idx" ON "posts" USING btree ("author_pubkey");--> statement-breakpoint
CREATE INDEX "session_pubkey_idx" ON "sessions" USING btree ("pubkey");--> statement-breakpoint
CREATE INDEX "session_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sub_pubkey_idx" ON "subscriptions" USING btree ("pubkey");--> statement-breakpoint
CREATE INDEX "sub_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sub_expires_idx" ON "subscriptions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "zap_recipient_ts_idx" ON "zap_events" USING btree ("recipient_pubkey","timestamp");--> statement-breakpoint
CREATE INDEX "zap_post_idx" ON "zap_events" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "zap_sender_idx" ON "zap_events" USING btree ("sender_pubkey");--> statement-breakpoint
CREATE INDEX "zap_ts_idx" ON "zap_events" USING btree ("timestamp");