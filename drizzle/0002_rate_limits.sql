CREATE TABLE "rate_limit_buckets" (
	"key_hash" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_buckets_key_hash_window_started_at_pk" PRIMARY KEY("key_hash","window_started_at"),
	CONSTRAINT "rate_limit_buckets_count_check" CHECK ("rate_limit_buckets"."count" > 0)
);
--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expiry_idx" ON "rate_limit_buckets" USING btree ("expires_at");