const { Pool } = require("pg");
require("dotenv").config();

async function listDebug() {
  console.log("--- DIAGNÓSTICO DE ACESSO ---");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("\n1. GABINETES (TENANTS):");
    const tenants = await pool.query("SELECT id, name, slug FROM tenants");
    console.table(tenants.rows);

    console.log("\n2. USUÁRIOS:");
    const users = await pool.query("SELECT email, role, tenant_id FROM users");
    console.table(users.rows);

    console.log("\n--- FIM DO DIAGNÓSTICO ---");
  } catch (error) {
    console.error("❌ ERRO:", error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

listDebug();
