CREATE TYPE "public"."ai_provider" AS ENUM('gemini', 'openai', 'anthropic', 'groq', 'custom', 'openrouter');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('nova', 'em_andamento', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TABLE "campaign_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demandas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"municipe_id" uuid NOT NULL,
	"categoria" varchar(255) NOT NULL,
	"status" "status" DEFAULT 'nova' NOT NULL,
	"prioridade" varchar(255) NOT NULL,
	"resumo_ia" varchar(1000) NOT NULL,
	"precisa_retorno" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(100) NOT NULL,
	"text_content" varchar(10000),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"column_id" uuid NOT NULL,
	"municipe_id" uuid,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(255),
	"notes" varchar(2000),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "municipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(255) NOT NULL,
	"bairro" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'assessor'::text;--> statement-breakpoint
DROP TYPE "public"."role";--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('super_admin', 'admin', 'vereador', 'assessor');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'assessor'::"public"."role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "ai_provider" "ai_provider" DEFAULT 'gemini';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "ai_api_key" varchar(500);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "ai_model" varchar(100);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "ai_base_url" varchar(500);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "system_prompt" varchar(10000);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "whatsapp_instance_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "whatsapp_token" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "whatsapp_notification_number" varchar(50);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "evolution_api_url" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "evolution_global_token" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "calendar_url" varchar(1000);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "municipio" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "uf" varchar(2);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "partido" varchar(100);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "mandato" varchar(100);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "foto_url" varchar(500);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_columns" ADD CONSTRAINT "campaign_columns_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas" ADD CONSTRAINT "demandas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas" ADD CONSTRAINT "demandas_municipe_id_municipes_id_fk" FOREIGN KEY ("municipe_id") REFERENCES "public"."municipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_column_id_campaign_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."campaign_columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_municipe_id_municipes_id_fk" FOREIGN KEY ("municipe_id") REFERENCES "public"."municipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipes" ADD CONSTRAINT "municipes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password";