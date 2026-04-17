ALTER TABLE "system_configs" ADD COLUMN "ai_provider" "ai_provider" DEFAULT 'gemini';--> statement-breakpoint
ALTER TABLE "system_configs" ADD COLUMN "ai_api_key" varchar(500);--> statement-breakpoint
ALTER TABLE "system_configs" ADD COLUMN "ai_model" varchar(100);--> statement-breakpoint
ALTER TABLE "system_configs" ADD COLUMN "ai_base_url" varchar(500);