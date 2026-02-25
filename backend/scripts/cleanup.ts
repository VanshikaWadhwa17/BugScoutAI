import { Pool } from 'pg';
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

const backendEnv = join(process.cwd(), '.env');
const rootEnv = join(process.cwd(), '..', '.env');

if (existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

const connectionString = process.env.DATABASE_URL;
const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS || '30', 10);

if (!connectionString) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : undefined
});

async function cleanup() {
  try {
    const result = await pool.query(
      `DELETE FROM events WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [RETENTION_DAYS]
    );
    console.log(`✅ Deleted ${result.rowCount ?? 0} events older than ${RETENTION_DAYS} days`);
  } catch (err: any) {
    console.error('❌ Cleanup error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanup();
