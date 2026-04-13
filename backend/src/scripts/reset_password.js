const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const { users } = require("../db/schema");
const { eq } = require("drizzle-orm");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function reset() {
  console.log("Resetando senha do Super Admin...");
  
  const passwordHash = await bcrypt.hash("admin123", 12);
  
  try {
    await db.update(users)
      .set({ passwordHash: passwordHash })
      .where(eq(users.email, "super@admin.com"));
    
    console.log("✅ Senha resetada com sucesso para: admin123");
  } catch (error) {
    console.error("❌ Falha ao resetar senha:", error);
  } finally {
    process.exit(0);
  }
}

reset();
