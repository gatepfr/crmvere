const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const { pgTable, varchar, uuid, timestamp, pgEnum } = require("drizzle-orm/pg-core");
const { eq } = require("drizzle-orm");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id"),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role").notNull(),
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function debug() {
  const email = "super@admin.com";
  const pass = "admin123";
  const secret = process.env.JWT_SECRET || 'supersecret';
  
  console.log("--- Depuração de Autenticação Autônoma ---");
  console.log("Configuração:");
  console.log("- E-mail testado:", email);
  console.log("- DATABASE_URL presente:", !!process.env.DATABASE_URL);
  console.log("- JWT_SECRET presente:", !!process.env.JWT_SECRET);

  try {
    const userList = await db.select().from(users).where(eq(users.email, email));
    const user = userList[0];

    if (!user) {
      console.log("❌ ERRO: Usuário não encontrado no banco.");
      const all = await db.select({ email: users.email }).from(users).limit(5);
      console.log("Outros usuários no banco:", all.map(u => u.email));
      return;
    }

    console.log("✅ Usuário encontrado:", user.email);
    console.log("- Cargo:", user.role);

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    console.log("- Comparação de senha (admin123):", isMatch ? "CORRETA" : "FALHOU");

    if (!isMatch) {
        console.log("- Hash no banco:", user.passwordHash);
    }

  } catch (err) {
    console.error("❌ Erro técnico:", err);
  } finally {
    process.exit(0);
  }
}

debug();
