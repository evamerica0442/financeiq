const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Auto-migrate: run the schema.sql on startup to ensure all tables exist.
 * Uses CREATE IF NOT EXISTS so it's safe to run repeatedly.
 */
async function runMigrations() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const migrationPath = path.join(__dirname, 'migration.sql');

  // Read and clean SQL — strip comments first
  function readSql(filePath) {
    if (!fs.existsSync(filePath)) return '';
    const raw = fs.readFileSync(filePath, 'utf-8');
    // Remove single-line comments
    const noComments = raw
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        // Skip full-line comments and empty lines
        if (trimmed.startsWith('--') || trimmed === '') return '';
        // Remove inline comments (everything after --)
        const commentIdx = trimmed.indexOf(' --');
        return commentIdx >= 0 ? trimmed.substring(0, commentIdx) : trimmed;
      })
      .filter(line => line.length > 0)
      .join('\n');
    return noComments;
  }

  const schemaSql = readSql(schemaPath);
  const migrationSql = readSql(migrationPath);

  // Split by semicolon and execute each statement
  async function executeStatements(sql) {
    if (!sql) return;
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err) {
        // Ignore "already exists" for indexes, "duplicate column" etc.
        if (err.code === '42P07' || err.code === '42710' || err.code === '42P16') {
          // skip — index/constraint already exists
        } else {
          console.warn('Migration warning (' + err.code + '):', err.message.substring(0, 120));
        }
      }
    }
  }

  try {
    await executeStatements(schemaSql);
    await executeStatements(migrationSql);
    console.log('✓ Database migrations complete');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

// Run migrations immediately on startup
runMigrations();

module.exports = pool;