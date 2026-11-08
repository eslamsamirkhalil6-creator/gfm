import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { newDb } from 'pg-mem';
import { env } from './env.ts';

const { Pool } = pg;

export type DatabaseMode = 'PostgreSQL (Live Connection)' | 'PostgreSQL (In-Memory Engine)';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DatabaseStatus {
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  mode: DatabaseMode;
  engine: string;
  latencyMs: number;
  tablesCount: number;
  usersCount: number;
  rolesCount: number;
  auditLogsCount: number;
  databaseUrlConfigured: boolean;
  error?: string;
}

interface DbClient {
  query: <T = any>(text: string, params?: any[]) => Promise<QueryResult<T>>;
}

let activePool: pg.Pool | null = null;
let memoryDbPool: any = null;
let currentMode: DatabaseMode = 'PostgreSQL (In-Memory Engine)';
let isInitialized = false;

/**
 * Initialize PostgreSQL connection or in-memory fallback.
 */
export async function initDatabase(): Promise<void> {
  if (isInitialized) return;

  const migrationsDir = path.resolve(process.cwd(), 'database/migrations');
  const seedsDir = path.resolve(process.cwd(), 'database/seeds');

  const migrationFiles = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
    : [];

  const seedFiles = fs.existsSync(seedsDir)
    ? fs.readdirSync(seedsDir).filter(f => f.endsWith('.sql')).sort()
    : [];

  if (env.DATABASE_URL && env.DATABASE_URL.trim() !== '') {
    try {
      console.log('[DB] Connecting to live PostgreSQL at:', env.DATABASE_URL.replace(/:[^:]*@/, ':****@'));
      const pool = new Pool({
        connectionString: env.DATABASE_URL,
        ssl: env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      await pool.query('SELECT 1 as ping');
      activePool = pool;
      currentMode = 'PostgreSQL (Live Connection)';
      console.log('[DB] Connected to Live PostgreSQL successfully.');

      // Check if tables exist, run migrations if needed
      const checkTables = await pool.query(
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
      );
      if (parseInt(checkTables.rows[0].count, 10) === 0) {
        console.log('[DB] Running incremental migrations on live PostgreSQL...');
        for (const file of migrationFiles) {
          console.log(`[DB] Applying migration: ${file}`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          await pool.query(sql);
        }
        for (const file of seedFiles) {
          console.log(`[DB] Applying seed: ${file}`);
          const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
          await pool.query(sql);
        }
        console.log('[DB] Live PostgreSQL migrations and seeds completed.');
      } else {
        // Run any subsequent migrations (e.g. 002_) if production_halls table doesn't exist
        const checkProduction = await pool.query(
          "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_halls'"
        );
        if (parseInt(checkProduction.rows[0].count, 10) === 0) {
          console.log('[DB] Applying Part 2 Production Module migrations...');
          for (const file of migrationFiles.filter(f => !f.startsWith('001_'))) {
            console.log(`[DB] Applying incremental migration: ${file}`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            await pool.query(sql);
          }
          for (const file of seedFiles.filter(f => !f.startsWith('001_'))) {
            console.log(`[DB] Applying incremental seed: ${file}`);
            const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
            await pool.query(sql);
          }
        }
      }

      // Check if Part 4 Department Manager role exists
      const checkDeptManager = await pool.query(
        "SELECT count(*) FROM roles WHERE role_name = 'Department Manager'"
      );
      if (parseInt(checkDeptManager.rows[0].count, 10) === 0) {
        console.log('[DB] Applying Part 4 Department Manager migrations & seeds...');
        for (const file of migrationFiles.filter(f => f.startsWith('004_'))) {
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          await pool.query(sql);
        }
        for (const file of seedFiles.filter(f => f.startsWith('004_'))) {
          const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
          await pool.query(sql);
        }
      }

      isInitialized = true;
      return;
    } catch (err: any) {
      console.log('[DB] Live PostgreSQL unavailable (' + err.message + '). Active engine: PostgreSQL In-Memory Engine (pg-mem).');
    }
  }

  // Fallback or preview mode: pg-mem
  console.log('[DB] Initializing PostgreSQL In-Memory Engine with all DDL migrations and seed data...');
  const memDb = newDb({
    autoCreateForeignKeyIndices: true,
  });

  // Mock standard PostgreSQL helper functions
  (memDb.public as any).registerFunction({
    name: 'setval',
    args: ['text', 'integer'],
    returns: 'integer',
    implementation: (_seq: string, val: number) => val,
  });

  (memDb.public as any).registerFunction({
    name: 'pg_get_serial_sequence',
    args: ['text', 'text'],
    returns: 'text',
    implementation: (table: string, column: string) => `${table}_${column}_seq`,
  });

  // Apply all migrations in order
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    memDb.public.none(sql);
  }

  // Apply all seeds in order
  for (const file of seedFiles) {
    const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
    memDb.public.none(sql);
  }

  const pgAdapter = memDb.adapters.createPg();
  memoryDbPool = new pgAdapter.Pool();
  currentMode = 'PostgreSQL (In-Memory Engine)';
  isInitialized = true;
  console.log('[DB] PostgreSQL In-Memory Engine initialized and seeded successfully with all modules.');
}

/**
 * Execute parameterized query on PostgreSQL
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
  if (!isInitialized) {
    await initDatabase();
  }

  const client: DbClient = activePool || memoryDbPool;
  if (!client) {
    throw new Error('Database is not initialized.');
  }

  try {
    const res = await client.query(sql, params);
    return {
      rows: res.rows || [],
      rowCount: res.rowCount !== undefined ? res.rowCount : (res.rows ? res.rows.length : 0),
    };
  } catch (err: any) {
    console.error(`[DB Query Error] Query: "${sql.slice(0, 100)}..." Message: ${err.message}`);
    throw err;
  }
}

/**
 * Health check & status verification
 */
export async function checkConnection(): Promise<DatabaseStatus> {
  const startTime = Date.now();
  try {
    await query('SELECT NOW() as server_timestamp, 1 as ping');
    const latencyMs = Date.now() - startTime;

    const [tablesRes, usersRes, rolesRes, auditRes] = await Promise.all([
      query(`SELECT count(DISTINCT table_name) as cnt FROM information_schema.tables WHERE table_schema = 'public'`),
      query('SELECT count(*) as cnt FROM users'),
      query('SELECT count(*) as cnt FROM roles'),
      query('SELECT count(*) as cnt FROM audit_logs'),
    ]);

    return {
      status: 'CONNECTED',
      mode: currentMode,
      engine: currentMode === 'PostgreSQL (Live Connection)' ? 'PostgreSQL 16.x (TCP)' : 'PostgreSQL Engine (pg-mem v3.0)',
      latencyMs,
      tablesCount: parseInt(tablesRes.rows[0]?.cnt || '6', 10),
      usersCount: parseInt(usersRes.rows[0]?.cnt || '0', 10),
      rolesCount: parseInt(rolesRes.rows[0]?.cnt || '0', 10),
      auditLogsCount: parseInt(auditRes.rows[0]?.cnt || '0', 10),
      databaseUrlConfigured: Boolean(env.DATABASE_URL && env.DATABASE_URL.trim() !== ''),
    };
  } catch (err: any) {
    return {
      status: 'ERROR',
      mode: currentMode,
      engine: 'PostgreSQL',
      latencyMs: Date.now() - startTime,
      tablesCount: 0,
      usersCount: 0,
      rolesCount: 0,
      auditLogsCount: 0,
      databaseUrlConfigured: Boolean(env.DATABASE_URL && env.DATABASE_URL.trim() !== ''),
      error: err.message,
    };
  }
}
