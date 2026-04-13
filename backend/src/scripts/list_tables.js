const { Pool } = require("pg");
require("dotenv").config();

async function listTables() {
  console.log("--- Listando Tabelas do Banco ---");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log("Tabelas encontradas:");
    if (res.rows.length === 0) {
      console.log("⚠️ NENHUMA TABELA ENCONTRADA. O banco está vazio!");
    } else {
      res.rows.forEach(row => console.log("- " + row.table_name));
    }
  } catch (error) {
    console.error("❌ ERRO AO CONECTAR:", error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

listTables();
