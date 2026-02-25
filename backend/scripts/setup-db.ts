import { Pool } from 'pg';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

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

async function setupDatabase() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    console.error('   Make sure you have a .env file with DATABASE_URL set');
    process.exit(1);
  }
  
  console.log('🔗 Connecting to database...');
  console.log('   Connection string:', connectionString.replace(/:[^:@]+@/, ':****@')); // Hide password
  
  const pool = new Pool({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Neon
    }
  });

  try {
    // Test connection first
    console.log('🔍 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
    
    console.log('📊 Setting up database...');
    
    // Check if tables exist and drop them if needed (for clean setup)
    console.log('🧹 Cleaning up existing tables (if any)...');
    await pool.query(`
      DROP TABLE IF EXISTS issues CASCADE;
      DROP TABLE IF EXISTS events CASCADE;
      DROP TABLE IF EXISTS sessions CASCADE;
      DROP TABLE IF EXISTS projects CASCADE;
    `);
    console.log('✅ Cleaned up existing tables');
    
    // Read and execute schema (relative to project root)
    const schemaPath = join(process.cwd(), 'src/db/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    // Parse SQL statements properly (handling multi-line statements)
    // Remove comments and split by semicolons, then reconstruct complete statements
    const lines = schema.split('\n');
    const statements: string[] = [];
    let currentStatement = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comment lines
      if (trimmed.startsWith('--') || trimmed.length === 0) {
        continue;
      }
      
      currentStatement += (currentStatement ? ' ' : '') + line;
      
      // If line ends with semicolon, we have a complete statement
      if (trimmed.endsWith(';')) {
        const statement = currentStatement.trim();
        if (statement.length > 0) {
          statements.push(statement);
        }
        currentStatement = '';
      }
    }
    
    // Add any remaining statement (shouldn't happen with proper SQL, but just in case)
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }
    
    // Separate CREATE TABLE and CREATE INDEX statements
    const createTableStatements = statements.filter(s => 
      s.toUpperCase().replace(/\s+/g, ' ').includes('CREATE TABLE')
    );
    const createIndexStatements = statements.filter(s => 
      s.toUpperCase().replace(/\s+/g, ' ').includes('CREATE INDEX')
    );
    
    console.log(`📝 Found ${createTableStatements.length} table(s) and ${createIndexStatements.length} index(es) to create`);
    
    console.log(`📝 Creating ${createTableStatements.length} tables...`);
    for (let i = 0; i < createTableStatements.length; i++) {
      const statement = createTableStatements[i];
      try {
        await pool.query(statement);
        const tableMatch = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
        const tableName = tableMatch?.[1] || `table_${i + 1}`;
        console.log(`   ✅ Created table: ${tableName}`);
      } catch (err: any) {
        console.error(`   ❌ Error creating table:`, err.message);
        console.error(`   Statement preview: ${statement.substring(0, 200)}...`);
        throw err;
      }
    }
    
    console.log(`📝 Creating ${createIndexStatements.length} indexes...`);
    for (let i = 0; i < createIndexStatements.length; i++) {
      const statement = createIndexStatements[i];
      try {
        await pool.query(statement);
        const indexMatch = statement.match(/CREATE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
        const indexName = indexMatch?.[1] || `index_${i + 1}`;
        console.log(`   ✅ Created index: ${indexName}`);
      } catch (err: any) {
        console.error(`   ❌ Error creating index:`, err.message);
        console.error(`   Statement preview: ${statement.substring(0, 200)}...`);
        throw err;
      }
    }
    
    console.log('✅ Schema created successfully');
    
    // Create a test project if none exists
    const projectCheck = await pool.query('SELECT COUNT(*) FROM projects');
    if (parseInt(projectCheck.rows[0].count) === 0) {
      const testApiKey = 'test-api-key-' + Math.random().toString(36).substring(7);
      await pool.query(
        'INSERT INTO projects (name, api_key) VALUES ($1, $2)',
        ['Test Project', testApiKey]
      );
      console.log(`✅ Created test project with API key: ${testApiKey}`);
      console.log(`   Use this API key in X-API-Key header for testing`);
      console.log(`   Example: curl -H "X-API-Key: ${testApiKey}" http://localhost:3000/ingest ...`);
    } else {
      console.log('ℹ️  Projects already exist, skipping test project creation');
    }
    
    console.log('🎉 Database setup complete!');
  } catch (error: any) {
    console.error('❌ Error setting up database:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.message.includes('password')) {
      console.error('\n💡 Tip: Make sure your DATABASE_URL connection string is correct.');
      console.error('   Check that the password in the connection string is properly formatted.');
      console.error('   Neon connection strings should include ?sslmode=require');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
