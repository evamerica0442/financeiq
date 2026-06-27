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
 * Auto-migrate: run the schema.sql and migration.sql on startup to ensure 
 * all tables and columns exist. Uses CREATE/ADD IF NOT EXISTS so it's safe 
 * to run repeatedly.
 * Returns a promise that resolves when migrations are complete.
 */
function runMigrations() {
  return new Promise(async (resolve) => {
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const migrationPath = path.join(__dirname, 'migration.sql');
      const networthMigrationPath = path.join(__dirname, 'migrations', 'networth.sql');
      const journalMigrationPath = path.join(__dirname, 'migrations', 'journal.sql');

      // Read SQL file, strip comments, return executable statements
      function readSql(filePath) {
        if (!fs.existsSync(filePath)) return '';
        const raw = fs.readFileSync(filePath, 'utf-8');
        return raw
          .split('\n')
          .map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('--') || trimmed === '') return '';
            const commentIdx = trimmed.indexOf(' --');
            return commentIdx >= 0 ? trimmed.substring(0, commentIdx) : trimmed;
          })
          .filter(line => line.length > 0)
          .join('\n');
      }

      const schemaSql = readSql(schemaPath);
      const migrationSql = readSql(migrationPath);

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
            // Ignore "already exists" errors — these are expected on re-runs
            if (!['42P07', '42710', '42P16', '42701', '42P04'].includes(err.code)) {
              console.warn('Migration: ' + err.message.substring(0, 120));
            }
          }
        }
      }

      await executeStatements(schemaSql);
      await executeStatements(migrationSql);

      // Run networth migration
      const networthSql = readSql(networthMigrationPath);
      await executeStatements(networthSql);

      // Run journal migration
      const journalSql = readSql(journalMigrationPath);
      await executeStatements(journalSql);

      console.log('✓ Database migrations complete');
      resolve();
    } catch (err) {
      console.error('Migration error:', err.message);
      resolve(); // Don't crash — tables may already exist
    }
  });
}

const migrationPromise = runMigrations();

// Export a function to await migrations before starting the server
module.exports = pool;
module.exports.waitForMigrations = () => migrationPromise;