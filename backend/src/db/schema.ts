import { pgTable, uuid, varchar, timestamp, pgEnum, boolean, integer, unique } from "drizzle-orm/pg-core";
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
  // AI Control
  dailyTokenLimit: integer("daily_token_limit").default(50000).notNull(), // Default 50k tokens
  tokenUsageTotal: integer("token_usage_total").default(0).notNull(),
  blocked: boolean("blocked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: roleEnum("role").default("assessor").notNull(),
  passwordResetToken: varchar("password_reset_token", { length: 255 }),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const statusEnum = pgEnum("status", ["nova", "em_andamento", "concluida", "cancelada"]);

export const municipes = pgTable("municipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  cep: varchar("cep", { length: 20 }),
  bairro: varchar("bairro", { length: 255 }),
  birthDate: timestamp("birth_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    uniqueMunicipe: unique().on(table.tenantId, table.phone)
  };
});

export const demandCategories = pgTable("demand_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#2563eb"),
  icon: varchar("icon", { length: 50 }).default("Tag"),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  tenantNameUnq: unique("cat_tenant_name_unq").on(table.tenantId, table.name),
}));

export const atendimentos = pgTable("atendimentos", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  municipeId: uuid("municipe_id").references(() => municipes.id, { onDelete: "cascade" }).notNull(),
  resumoIa: varchar("resumo_ia", { length: 10000 }).notNull(),
  categoria: varchar("categoria", { length: 255 }), // Triagem da conversa
  prioridade: varchar("prioridade", { length: 50 }), // Triagem da conversa
  precisaRetorno: boolean("precisa_retorno").default(false),
  lastHumanInteractionAt: timestamp("last_human_interaction_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const demandas = pgTable("demandas", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  municipeId: uuid("municipe_id").references(() => municipes.id, { onDelete: "cascade" }).notNull(),
  atendimentoId: uuid("atendimento_id").references(() => atendimentos.id), // Vinculo opcional com a conversa
  categoria: varchar("categoria", { length: 255 }).notNull(),
  descricao: varchar("descricao", { length: 10000 }).notNull(),
  status: varchar("status", { length: 20 }).default("nova").notNull(),
  prioridade: varchar("prioridade", { length: 20 }).default("media").notNull(),
  
  // Campos Legislativos
  isLegislativo: boolean("is_legislative").default(false),
  numeroIndicacao: varchar("numero_indicacao", { length: 50 }),
  documentUrl: varchar("document_url", { length: 500 }),
  
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

export const systemConfigs = pgTable("system_configs", {
  id: varchar("id", { length: 50 }).primaryKey().default("default"),
  defaultDailyTokenLimit: integer("default_daily_token_limit").default(50000).notNull(),
  aiProvider: aiProviderEnum("ai_provider").default("gemini"),
  aiApiKey: varchar("ai_api_key", { length: 500 }),
  aiModel: varchar("ai_model", { length: 100 }),
  aiBaseUrl: varchar("ai_base_url", { length: 500 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- MÓDULO DE INTELIGÊNCIA ELEITORAL (TSE) ---

export const tseCandidatos = pgTable("tse_candidatos", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  anoEleicao: integer("ano_eleicao").notNull(),
  nmCandidato: varchar("nm_candidato", { length: 255 }).notNull(),
  nrCandidato: varchar("nr_candidato", { length: 20 }).notNull(),
  sgPartido: varchar("sg_partido", { length: 20 }),
  cdMunicipio: varchar("cd_municipio", { length: 20 }),
  nmMunicipio: varchar("nm_municipio", { length: 255 }),
  dsSituacao: varchar("ds_situacao", { length: 100 }),
  qtVotosTotal: integer("qt_votos_total").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const tseLocaisVotacao = pgTable("tse_locais_votacao", {
  id: uuid("id").primaryKey().defaultRandom(),
  anoEleicao: integer("ano_eleicao").notNull(),
  cdMunicipio: varchar("cd_municipio", { length: 20 }),
  nrZona: integer("nr_zona"),
  nrLocalVotacao: integer("nr_local_votacao"),
  nmLocalVotacao: varchar("nm_local_votacao", { length: 255 }),
  dsEndereco: varchar("ds_endereco", { length: 500 }),
  nmBairro: varchar("nm_bairro", { length: 255 }),
  nrCep: varchar("nr_cep", { length: 20 }),
  qtEleitores: integer("qt_eleitores"),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const tseVotosSecao = pgTable("tse_votos_secao", {
  id: uuid("id").primaryKey().defaultRandom(),
  anoEleicao: integer("ano_eleicao").notNull(),
  cdMunicipio: varchar("cd_municipio", { length: 20 }),
  nrZona: integer("nr_zona"),
  nrSecao: integer("nr_secao"),
  nrLocalVotacao: integer("nr_local_votacao"),
  nrCandidato: varchar("nr_candidato", { length: 20 }),
  qtVotos: integer("qt_votos"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const tsePerfilEleitorado = pgTable("tse_perfil_eleitorado", {
  id: uuid("id").primaryKey().defaultRandom(),
  anoEleicao: integer("ano_eleicao").notNull(),
  cdMunicipio: varchar("cd_municipio", { length: 20 }),
  nmBairro: varchar("nm_bairro", { length: 255 }),
  dsGenero: varchar("ds_genero", { length: 50 }),
  dsFaixaEtaria: varchar("ds_faixa_etaria", { length: 50 }),
  dsGrauEscolaridade: varchar("ds_grau_escolaridade", { length: 100 }),
  qtEleitores: integer("qt_eleitores"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
