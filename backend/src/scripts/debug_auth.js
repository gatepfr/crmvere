const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const { users } = require("../db/schema");
const { eq } = require("drizzle-orm");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function debug() {
  const email = "super@admin.com";
  const pass = "admin123";
  const secret = process.env.JWT_SECRET || 'secret';
  
  console.log("--- Depuração de Autenticação ---");
  console.log("Configuração:");
  console.log("- E-mail testado:", email);
  console.log("- JWT_SECRET definido:", !!process.env.JWT_SECRET);
  console.log("- NODE_ENV:", process.env.NODE_ENV);

  try {
    const userList = await db.select().from(users).where(eq(users.email, email));
    const user = userList[0];

    if (!user) {
      console.log("❌ ERRO: Usuário não encontrado no banco.");
      return;
    }

    console.log("✅ Usuário encontrado no banco.");
    console.log("- Cargo:", user.role);

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    console.log("- Comparação de senha (admin123):", isMatch ? "CORRETA" : "FALHOU");

    if (isMatch) {
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        secret,
        { expiresIn: '1d' }
      );
      console.log("- Geração de Token JWT: SUCESSO");
    }

  } catch (err) {
    console.error("❌ Erro técnico:", err);
  } finally {
    process.exit(0);
  }
}

debug();
