import { pgTable, uuid, varchar, timestamp, pgEnum, boolean, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const subscriptionStatusEnum = pgEnum("subscription_status", ["trial", "active", "past_due", "unpaid", "lifetime"]);
export const roleEnum = pgEnum("role", ["super_admin", "admin", "vereador", "assessor"]);
export const aiProviderEnum = pgEnum("ai_provider", ["gemini", "openai", "anthropic", "groq", "custom", "openrouter"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  active: boolean("active").default(true),
  aiProvider: aiProviderEnum("ai_provider").default("gemini"),
  aiApiKey: varchar("ai_api_key", { length: 500 }),
  aiModel: varchar("ai_model", { length: 100 }),
  aiBaseUrl: varchar("ai_base_url", { length: 500 }),
  systemPrompt: varchar("system_prompt", { length: 10000 }),
  whatsappInstanceId: varchar("whatsapp_instance_id", { length: 255 }),
  whatsappToken: varchar("whatsapp_token", { length: 255 }),
  whatsappNotificationNumber: varchar("whatsapp_notification_number", { length: 50 }),
  evolutionApiUrl: varchar("evolution_api_url", { length: 255 }),
  evolutionGlobalToken: varchar("evolution_global_token", { length: 255 }),
  calendarUrl: varchar("calendar_url", { length: 1000 }),
  // Cabinet Info
  municipio: varchar("municipio", { length: 255 }),
  uf: varchar("uf", { length: 2 }),
  partido: varchar("partido", { length: 100 }),
  mandato: varchar("mandato", { length: 100 }),
  fotoUrl: varchar("foto_url", { length: 500 }),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").default("trial").notNull(),
  trialEndsAt: timestamp("trial_ends_at").default(sql`CURRENT_TIMESTAMP + interval '7 days'`).notNull(),
  gracePeriodEndsAt: timestamp("grace_period_ends_at"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  isManual: boolean("is_manual").default(false).notNull(),
  monthlyPrice: integer("monthly_price").default(24700).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: roleEnum("role").default("assessor").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const statusEnum = pgEnum("status", ["nova", "em_andamento", "concluida", "cancelada"]);

export const municipes = pgTable("municipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 255 }).notNull(),
  bairro: varchar("bairro", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    uniqueMunicipe: sql`unique(${table.tenantId}, ${table.phone})`
  };
});

export const demandas = pgTable("demandas", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  municipeId: uuid("municipe_id")
    .references(() => municipes.id, { onDelete: "cascade" })
    .notNull(),
  categoria: varchar("categoria", { length: 255 }).notNull(),
  status: statusEnum("status").default("nova").notNull(),
  prioridade: varchar("prioridade", { length: 255 }).notNull(),
  resumoIa: varchar("resumo_ia", { length: 10000 }).notNull(),
  precisaRetorno: boolean("precisa_retorno").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  textContent: varchar("text_content", { length: 10000 }), // Store extracted text
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaignColumns = pgTable("campaign_columns", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .references(() => campaigns.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  order: integer("order").notNull(),
});

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  campaignId: uuid("campaign_id")
    .references(() => campaigns.id, { onDelete: "cascade" })
    .notNull(),
  columnId: uuid("column_id")
    .references(() => campaignColumns.id, { onDelete: "cascade" })
    .notNull(),
  municipeId: uuid("municipe_id")
    .references(() => municipes.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 255 }),
  notes: varchar("notes", { length: 2000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
