import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// Try loading .env from backend directory first, then parent directory
const backendEnv = join(process.cwd(), '.env');
const rootEnv = join(process.cwd(), '..', '.env');

if (existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config(); // Fallback to default behavior
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString: connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased timeout for Neon
  ssl: {
    rejectUnauthorized: false // Required for Neon SSL connections
  }
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
};

export const getClient = async (): Promise<PoolClient> => {
  return await pool.connect();
};

export default pool;
