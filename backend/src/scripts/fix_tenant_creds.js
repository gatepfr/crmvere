const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const { pgTable, varchar, uuid } = require("drizzle-orm/pg-core");
const { eq } = require("drizzle-orm");
require("dotenv").config();

const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey(),
  slug: varchar("slug", { length: 255 }),
  evolutionApiUrl: varchar("evolution_api_url", { length: 255 }),
  evolutionGlobalToken: varchar("evolution_global_token", { length: 255 }),
});

async function fixCreds() {
  const slug = "danyloacioli";
  const url = "https://wa.crmvere.com.br";
  const token = "429683C4C977415CAAFCCE10F7D57E11";
  
  console.log(`--- Corrigindo Credenciais do Gabinete: ${slug} ---`);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    const result = await db.update(tenants)
      .set({ 
        evolutionApiUrl: url, 
        evolutionGlobalToken: token 
      })
      .where(eq(tenants.slug, slug))
      .returning();
    
    if (result.length > 0) {
      console.log(`✅ SUCESSO: Credenciais atualizadas para ${slug}`);
    } else {
      console.log(`❌ ERRO: Gabinete com slug '${slug}' não encontrado.`);
    }
  } catch (error) {
    console.error("❌ FALHA:", error.message);
  } finally {
    process.exit(0);
  }
}

fixCreds();
