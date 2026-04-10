import { pgTable, uuid, varchar, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["super_admin", "admin", "vereador", "assessor"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  active: boolean("active").default(true),
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
  resumoIa: varchar("resumo_ia", { length: 1000 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
