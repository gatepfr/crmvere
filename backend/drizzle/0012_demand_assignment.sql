-- FASE 1: Atribuição de Demandas
-- Add assignment fields to demandas
ALTER TABLE "demandas" ADD COLUMN "assigned_to_id" uuid REFERENCES "users"("id");
ALTER TABLE "demandas" ADD COLUMN "assigned_at" timestamp;
ALTER TABLE "demandas" ADD COLUMN "due_date" timestamp;
ALTER TABLE "demandas" ADD COLUMN "closed_at" timestamp;

-- Demand comments (work log)
CREATE TABLE "demand_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "demand_id" uuid NOT NULL REFERENCES "demandas"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "comment" varchar(2000) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Demand activity log (audit trail)
CREATE TABLE "demand_activity_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "demand_id" uuid NOT NULL REFERENCES "demandas"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "action" varchar(50) NOT NULL,
  "old_value" varchar(500),
  "new_value" varchar(500),
  "created_at" timestamp DEFAULT now() NOT NULL
);
