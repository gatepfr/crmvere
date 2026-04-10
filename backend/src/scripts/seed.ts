import { db } from "../db/index";
import { users } from "../db/schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding super_admin...");
  
  const passwordHash = await bcrypt.hash("admin123", 12);
  
  try {
    await db.insert(users).values({
      email: "super@admin.com",
      passwordHash: passwordHash,
      role: "super_admin",
      // Super admin has no tenantId
    });
    
    console.log("✅ Super Admin created: super@admin.com / admin123");
  } catch (error) {
    console.error("❌ Failed to seed super_admin:", error);
  } finally {
    process.exit(0);
  }
}

seed();
