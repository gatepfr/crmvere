
import { db } from '../db';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

async function checkTables() {
  try {
    const res = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    console.log('Tables in database:', res.rows.map(r => r.table_name).join(', '));
  } catch (error: any) {
    console.error('Failed to list tables:', error.message);
  } finally {
    process.exit();
  }
}

checkTables();
