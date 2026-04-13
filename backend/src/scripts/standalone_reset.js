const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const { pgTable, varchar, uuid } = require("drizzle-orm/pg-core");
const { eq } = require("drizzle-orm");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function reset() {
  const email = "super@admin.com";
  const pass = "admin123";
  
  console.log("--- Reset de Senha Independente ---");
  console.log("Conectando ao banco:", process.env.DATABASE_URL.replace(/:[^:]+@/, ":****@"));

  try {
    const passwordHash = await bcrypt.hash(pass, 12);
    const result = await db.update(users)
      .set({ passwordHash: passwordHash })
      .where(eq(users.email, email))
      .returning();
    
    if (result.length > 0) {
      console.log(`✅ SUCESSO: Senha de ${email} resetada para: ${pass}`);
    } else {
      console.log(`❌ ERRO: Usuário ${email} não encontrado no banco.`);
    }
  } catch (error) {
    console.error("❌ FALHA TÉCNICA:", error.message);
  } finally {
    process.exit(0);
  }
}

reset();
