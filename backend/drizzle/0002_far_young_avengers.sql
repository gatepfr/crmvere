CREATE TYPE "public"."subscription_status" AS ENUM('trial', 'active', 'past_due', 'unpaid', 'lifetime');--> statement-breakpoint
ALTER TABLE "demandas" ALTER COLUMN "resumo_ia" SET DATA TYPE varchar(10000);--> statement-breakpoint
ALTER TABLE "demandas" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subscription_status" "subscription_status" DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "trial_ends_at" timestamp DEFAULT CURRENT_TIMESTAMP + interval '7 days' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "grace_period_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_subscription_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "is_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "monthly_price" integer DEFAULT 24700 NOT NULL;