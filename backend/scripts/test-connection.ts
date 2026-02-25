import { Pool } from 'pg';
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
  dotenv.config();
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

console.log('🔗 Testing connection...');
console.log('Connection string (masked):', connectionString.replace(/:[^:@]+@/, ':****@'));

// Parse the connection string to check format
try {
  const url = new URL(connectionString);
  console.log('✅ Connection string format is valid');
  console.log('   Protocol:', url.protocol);
  console.log('   Host:', url.hostname);
  console.log('   Port:', url.port || '5432 (default)');
  console.log('   Database:', url.pathname.slice(1));
  console.log('   Username:', url.username);
  console.log('   Password:', url.password ? '***' : 'not set');
  console.log('   Query params:', url.search);
} catch (e) {
  console.error('❌ Invalid connection string format:', e);
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.query('SELECT NOW() as time, current_database() as database')
  .then((res) => {
    console.log('\n✅ Connection successful!');
    console.log('   Database:', res.rows[0].database);
    console.log('   Server time:', res.rows[0].time);
    pool.end();
  })
  .catch((err) => {
    console.error('\n❌ Connection failed:', err.message);
    if (err.code) {
      console.error('   Error code:', err.code);
    }
    if (err.message.includes('password')) {
      console.error('\n💡 Password authentication issue detected.');
      console.error('   Try URL-encoding special characters in the password.');
      console.error('   Or check if the password in Neon dashboard matches.');
    }
    process.exit(1);
  });
