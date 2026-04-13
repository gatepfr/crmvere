import { db } from "../db/index";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

async function diagnose() {
  console.log("--- Diagnóstico de Usuário ---");
  const email = "super@admin.com";
  
  try {
    const userList = await db.select().from(users).where(eq(users.email, email));
    const user = userList[0];

    if (!user) {
      console.log("❌ ERRO: Usuário não encontrado no banco de dados.");
      
      // List all users to see what's there
      const allUsers = await db.select({ email: users.email, role: users.role }).from(users);
      console.log("Usuários existentes:", allUsers);
    } else {
      console.log("✅ Usuário encontrado:");
      console.log("- ID:", user.id);
      console.log("- Email:", user.email);
      console.log("- Role:", user.role);
      console.log("- TenantId:", user.tenantId);
      console.log("- Hash da Senha (primeiros 10 chars):", user.passwordHash.substring(0, 10) + "...");
    }
  } catch (error) {
    console.error("❌ Falha na conexão com o banco de dados:", error);
  } finally {
    process.exit(0);
  }
}

diagnose();
