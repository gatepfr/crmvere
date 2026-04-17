ALTER TABLE "demand_categories" ALTER COLUMN "tenant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "demand_categories" ALTER COLUMN "color" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "demand_categories" ADD COLUMN "icon" varchar(50) DEFAULT 'Tag';