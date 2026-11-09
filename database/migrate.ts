import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { createPgDriver, runPendingMigrations } from '../backend/src/config/migrations.ts';

dotenv.config();

const { Pool } = pg;

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gfms_db';
  console.log('[Migration Tool] Connecting to PostgreSQL at:', connectionString.replace(/:[^:]*@/, ':****@'));

  const pool = new Pool({ connectionString });
  try {
    await pool.query('SELECT 1 as ping');
    console.log('[Migration Tool] Connected successfully.');

    const report = await runPendingMigrations(createPgDriver(pool), {
      migrationsDir: path.resolve(process.cwd(), 'database/migrations'),
      seedsDir: path.resolve(process.cwd(), 'database/seeds'),
      includeSeeds: true,
    });

    console.log('[Migration Tool] Bootstrapped legacy:', report.bootstrappedLegacyEntries);
    console.log('[Migration Tool] Applied migrations:', report.appliedMigrations);
    console.log('[Migration Tool] Applied seeds:', report.appliedSeeds);
    console.log('[Migration Tool] Skipped already-applied migrations:', report.skippedMigrations);
    console.log('[Migration Tool] Skipped already-applied seeds:', report.skippedSeeds);
    console.log('[Migration Tool] Database is fully up to date.');
  } catch (err: any) {
    console.error('[Migration Tool] Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
