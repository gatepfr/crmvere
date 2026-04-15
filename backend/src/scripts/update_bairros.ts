import { db } from "../db";
import { municipes } from "../db/schema";
import { sql } from "drizzle-orm";

async function updateBairros() {
  console.log("Iniciando atualização de bairros para MAIÚSCULO...");
  try {
    const result = await db.update(municipes)
      .set({
        bairro: sql`UPPER(${municipes.bairro})`
      })
      .where(sql`${municipes.bairro} IS NOT NULL`);
    
    console.log("Atualização concluída com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("Erro ao atualizar bairros:", error);
    process.exit(1);
  }
}

updateBairros();
