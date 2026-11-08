import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gfms_db';
  console.log('[Migration Tool] Connecting to PostgreSQL at:', connectionString.replace(/:[^:]*@/, ':****@'));

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('[Migration Tool] Connected successfully.');

    const migrationsDir = path.resolve(__dirname, 'migrations');
    const seedsDir = path.resolve(__dirname, 'seeds');

    const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    const seedFiles = fs.readdirSync(seedsDir).filter(f => f.endsWith('.sql')).sort();

    for (const mFile of migrationFiles) {
      console.log(`[Migration Tool] Executing migration ${mFile}...`);
      const migrationSql = fs.readFileSync(path.join(migrationsDir, mFile), 'utf8');
      await client.query(migrationSql);
    }
    console.log('[Migration Tool] All schema migrations executed successfully.');

    const checkProduction = await client.query(
      "SELECT count(*) as cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_halls'"
    );

    if (parseInt(checkProduction.rows[0].cnt, 10) > 0) {
      const checkHalls = await client.query('SELECT count(*) as cnt FROM production_halls');
      if (parseInt(checkHalls.rows[0].cnt, 10) === 0) {
        console.log('[Migration Tool] Seeding production data...');
        for (const sFile of seedFiles) {
          console.log(`[Migration Tool] Executing seed ${sFile}...`);
          const seedSql = fs.readFileSync(path.join(seedsDir, sFile), 'utf8');
          await client.query(seedSql);
        }
        console.log('[Migration Tool] Seed data inserted successfully.');
      }
    }

    console.log('[Migration Tool] Database is fully up to date.');
  } catch (err: any) {
    console.error('[Migration Tool] Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
