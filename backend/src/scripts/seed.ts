import { db } from "../db/index";
import { users, systemConfigs } from "../db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🚀 Iniciando Seeding do Sistema...");
  
  const passwordHash = await bcrypt.hash("admin123", 12);
  
  try {
    // 1. Criar Super Admin
    const [existingAdmin] = await db.select().from(users).where(eq(users.email, "super@admin.com"));
    
    if (!existingAdmin) {
      await db.insert(users).values({
        email: "super@admin.com",
        passwordHash: passwordHash,
        role: "super_admin",
      });
      console.log("✅ Super Admin criado: super@admin.com / admin123");
    } else {
      console.log("ℹ️ Super Admin já existe.");
    }

    // 2. Criar Configurações Globais de IA
    const [existingConfig] = await db.select().from(systemConfigs).where(eq(systemConfigs.id, "default"));
    
    if (!existingConfig) {
      await db.insert(systemConfigs).values({
        id: "default",
        defaultDailyTokenLimit: 50000,
      });
      console.log("✅ Configurações Globais de IA inicializadas (50k tokens padrão).");
    } else {
      console.log("ℹ️ Configurações Globais já existem.");
    }
    
    console.log("✨ Seeding concluído com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao realizar seeding:", error);
  } finally {
    process.exit(0);
  }
}

seed();
