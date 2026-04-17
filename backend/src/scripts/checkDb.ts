
import { db } from '../db';
import { demandCategories } from '../db/schema';
import 'dotenv/config';

async function checkDb() {
  try {
    console.log('Checking database connection...');
    const result = await db.select().from(demandCategories).limit(1);
    console.log('Database connection successful! Records found:', result.length);
  } catch (error: any) {
    console.error('Database connection failed:', error.message);
  } finally {
    process.exit();
  }
}

checkDb();
