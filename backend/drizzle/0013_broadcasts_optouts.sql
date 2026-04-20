-- Enums
CREATE TYPE "broadcast_status" AS ENUM('rascunho', 'enfileirado', 'enviando', 'concluido', 'cancelado');
CREATE TYPE "segment_type" AS ENUM('bairro', 'lideranca', 'aniversariantes', 'categoria_demanda', 'custom', 'todos');
CREATE TYPE "recipient_status" AS ENUM('pendente', 'enviado', 'erro', 'opt_out');

-- broadcasts
CREATE TABLE "broadcasts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "message" varchar(4000) NOT NULL,
  "media_url" varchar(500),
  "segment_type" "segment_type" NOT NULL,
  "segment_value" varchar(255),
  "status" "broadcast_status" DEFAULT 'rascunho' NOT NULL,
  "total_recipients" integer DEFAULT 0 NOT NULL,
  "sent_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "scheduled_for" timestamp,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp
);

-- broadcast_recipients
CREATE TABLE "broadcast_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "broadcast_id" uuid NOT NULL REFERENCES "broadcasts"("id") ON DELETE CASCADE,
  "municipe_id" uuid NOT NULL REFERENCES "municipes"("id") ON DELETE CASCADE,
  "phone" varchar(50) NOT NULL,
  "status" "recipient_status" DEFAULT 'pendente' NOT NULL,
  "error_message" varchar(500),
  "sent_at" timestamp
);

-- optouts
CREATE TABLE "optouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "phone" varchar(50) NOT NULL,
  "reason" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "optout_tenant_phone_unq" UNIQUE("tenant_id", "phone")
);
