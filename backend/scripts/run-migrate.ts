import { Pool } from 'pg';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
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

if (!connectionString) {
  console.error('❌ DATABASE_URL not found. Set it in backend/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : undefined
});

async function run() {
  const sqlPath = join(process.cwd(), 'scripts', 'migrate-schema.sql');
  let sql = readFileSync(sqlPath, 'utf-8');
  // Strip full-line comments so statements that start with a comment line are still run
  sql = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log('🔄 Running migration (add columns, event_id, issue grouping)...\n');

  for (const statement of statements) {
    const oneLiner = statement.replace(/\s+/g, ' ').slice(0, 80);
    try {
      await pool.query(statement);
      console.log('  ✓', oneLiner + (oneLiner.length >= 80 ? '...' : ''));
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        console.log('  ⏭ (skip)', oneLiner.slice(0, 60) + '...');
      } else {
        console.error('  ✗', oneLiner);
        console.error('   ', err.message);
        process.exit(1);
      }
    }
  }

  console.log('\n✅ Migration complete.');
  await pool.end();
}

run();
