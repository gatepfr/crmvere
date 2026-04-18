CREATE TYPE "public"."intelligence_action_status" AS ENUM('pendente', 'executada');--> statement-breakpoint
CREATE TYPE "public"."intelligence_action_type" AS ENUM('vacuo', 'meta_nao_batida');--> statement-breakpoint
CREATE TABLE "territorial_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ano" integer NOT NULL,
	"nm_bairro" varchar(255) NOT NULL,
	"meta_votos" integer DEFAULT 0,
	"meta_contatos" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "territorial_intelligence_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nm_bairro" varchar(255) NOT NULL,
	"tipo_acao" "intelligence_action_type" NOT NULL,
	"status" "intelligence_action_status" DEFAULT 'pendente' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atendimentos" DROP CONSTRAINT "atendimento_tenant_municipe_unq";--> statement-breakpoint
ALTER TABLE "atendimentos" ADD COLUMN "last_human_interaction_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "birthday_message" varchar(2000);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "legislative_message" varchar(2000);--> statement-breakpoint
ALTER TABLE "territorial_goals" ADD CONSTRAINT "territorial_goals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territorial_intelligence_actions" ADD CONSTRAINT "territorial_intelligence_actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;