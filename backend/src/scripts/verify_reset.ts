import { db } from "../db/index";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function verifyAndReset() {
  const email = "super@admin.com";
  const pass = "admin123";
  
  console.log("--- Reset de Senha Garantido ---");
  const hash = await bcrypt.hash(pass, 12);
  
  try {
    await db.update(users).set({ passwordHash: hash }).where(eq(users.email, email));
    console.log(`✅ Senha de ${email} resetada para: ${pass}`);
    
    // Test match immediately
    const [user] = await db.select().from(users).where(eq(users.email, email));
    const match = await bcrypt.compare(pass, user.passwordHash);
    console.log(`🔍 Teste interno de senha: ${match ? "SUCESSO" : "FALHA"}`);
    
  } catch (err) {
    console.error("❌ Erro:", err);
  } finally {
    process.exit(0);
  }
}

verifyAndReset();
