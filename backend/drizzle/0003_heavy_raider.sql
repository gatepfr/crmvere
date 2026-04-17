ALTER TABLE "tenants" ADD COLUMN "daily_token_limit" integer DEFAULT 50000 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "token_usage_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "blocked" boolean DEFAULT false NOT NULL;