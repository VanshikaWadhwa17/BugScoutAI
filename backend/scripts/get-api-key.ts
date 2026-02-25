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
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function getApiKeys() {
  try {
    const result = await pool.query(
      'SELECT id, name, api_key FROM projects ORDER BY id'
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No projects found in database.');
      console.log('   Run: npm run db:setup to create a test project');
      process.exit(1);
    }
    
    console.log('📋 Available API Keys:\n');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. Project: ${row.name}`);
      console.log(`   API Key: ${row.api_key}`);
      console.log(`   Project ID: ${row.id}`);
      console.log('');
    });
    
    console.log('💡 Use any of these API keys in the X-API-Key header');
    console.log('   Example: curl -H "X-API-Key: ' + result.rows[0].api_key + '" ...');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

getApiKeys();
