CREATE TABLE "system_configs" (
	"id" varchar(50) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"default_daily_token_limit" integer DEFAULT 50000 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
