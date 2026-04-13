const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const { pgTable, varchar, uuid } = require("drizzle-orm/pg-core");
const { eq } = require("drizzle-orm");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Definição mínima da tabela para o script funcionar sozinho
const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role").notNull(),
});

async function forceAdmin() {
  const email = "super@admin.com";
  const pass = "admin123";
  
  console.log("--- Forçando Criação/Reset do Super Admin ---");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    const hash = await bcrypt.hash(pass, 12);
    
    // Tenta encontrar o usuário
    const existing = await db.select().from(users).where(eq(users.email, email));
    
    if (existing.length > 0) {
      // Se existe, dá um reset na senha e garante que é super_admin
      await db.update(users)
        .set({ passwordHash: hash, role: 'super_admin' })
        .where(eq(users.email, email));
      console.log(`✅ SUCESSO: Usuário ${email} atualizado para senha ${pass}`);
    } else {
      // Se não existe, cria do zero
      await db.insert(users).values({
        email: email,
        passwordHash: hash,
        role: 'super_admin'
      });
      console.log(`✅ SUCESSO: Usuário ${email} CRIADO com senha ${pass}`);
    }
  } catch (error) {
    console.error("❌ ERRO:", error.message);
  } finally {
    process.exit(0);
  }
}

forceAdmin();
