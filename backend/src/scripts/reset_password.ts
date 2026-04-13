import { db } from "../db/index";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

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
