import pg from 'pg';
import type { newDb } from 'pg-mem';
import { env } from './env.ts';
import {
  attachPgMemImmutabilityGuards,
  createConfiguredPgMemDb,
  createPgDriver,
  createPgMemDriver,
  runPendingMigrations,
} from './migrations.ts';

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

export type QueryFn = <T = any>(sql: string, params?: any[]) => Promise<QueryResult<T>>;

interface DbClient {
  query: <T = any>(text: string, params?: any[]) => Promise<QueryResult<T>>;
}

let activePool: pg.Pool | null = null;
let memoryDbPool: any = null;
let memoryDbInstance: ReturnType<typeof newDb> | null = null;
let memoryTxQueue: Promise<void> = Promise.resolve();
let currentMode: DatabaseMode = 'PostgreSQL (In-Memory Engine)';
let isInitialized = false;

/**
 * Initialize PostgreSQL connection or in-memory fallback with tracked migrations.
 */
export async function initDatabase(): Promise<void> {
  if (isInitialized) return;

  if (env.DATABASE_URL && env.DATABASE_URL.trim() !== '') {
    let connectedPool: pg.Pool | null = null;
    try {
      console.log('[DB] Connecting to live PostgreSQL at:', env.DATABASE_URL.replace(/:[^:]*@/, ':****@'));
      const pool = new Pool({
        connectionString: env.DATABASE_URL,
        ssl: env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 5000,
      });

      // Test network/TCP connectivity only
      await pool.query('SELECT 1 as ping');
      connectedPool = pool;
    } catch (err: any) {
      console.log('[DB] Live PostgreSQL unavailable (' + err.message + '). Active engine: PostgreSQL In-Memory Engine (pg-mem).');
    }

    if (connectedPool) {
      activePool = connectedPool;
      currentMode = 'PostgreSQL (Live Connection)';
      console.log('[DB] Connected to Live PostgreSQL successfully. Running tracked migrations...');
      // Migration failures MUST surface loudly and never be swallowed into pg-mem fallback
      const report = await runPendingMigrations(createPgDriver(connectedPool));
      console.log(
        `[DB] Live PostgreSQL migrations complete (applied: ${report.appliedMigrations.length} migrations, ${report.appliedSeeds.length} seeds; skipped: ${report.skippedMigrations.length} migrations).`
      );
      isInitialized = true;
      return;
    }
  }

  // Fallback or preview mode: pg-mem
  console.log('[DB] Initializing PostgreSQL In-Memory Engine with tracked DDL migrations and seed data...');
  const memDb = createConfiguredPgMemDb();
  const report = await runPendingMigrations(createPgMemDriver(memDb));

  const pgAdapter = memDb.adapters.createPg();
  memoryDbInstance = memDb;
  memoryDbPool = new pgAdapter.Pool();
  currentMode = 'PostgreSQL (In-Memory Engine)';
  isInitialized = true;
  console.log(
    `[DB] PostgreSQL In-Memory Engine initialized (applied: ${report.appliedMigrations.length} migrations, ${report.appliedSeeds.length} seeds).`
  );
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
 * Execute a callback inside an atomic database transaction.
 * - On live PostgreSQL: uses a dedicated pool client with BEGIN / COMMIT / ROLLBACK.
 * - On pg-mem fallback: serializes execution and restores a backup snapshot on error.
 */
export async function withTransaction<T>(fn: (txQuery: QueryFn) => Promise<T>): Promise<T> {
  if (!isInitialized) {
    await initDatabase();
  }

  if (activePool) {
    const client = await activePool.connect();
    const txQuery: QueryFn = async <R = any>(sql: string, params: any[] = []): Promise<QueryResult<R>> => {
      try {
        const res = await client.query(sql, params);
        return {
          rows: res.rows || [],
          rowCount: res.rowCount !== undefined && res.rowCount !== null ? res.rowCount : (res.rows ? res.rows.length : 0),
        };
      } catch (err: any) {
        console.error(`[DB TX Query Error] Query: "${sql.slice(0, 100)}..." Message: ${err.message}`);
        throw err;
      }
    };

    try {
      await client.query('BEGIN');
      const result = await fn(txQuery);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr: any) {
        console.error('[DB TX Rollback Error]:', rollbackErr?.message || rollbackErr);
      }
      throw err;
    } finally {
      client.release();
    }
  }

  if (memoryDbInstance) {
    const memDb = memoryDbInstance;
    let releaseLock!: () => void;
    const prev = memoryTxQueue;
    memoryTxQueue = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    await prev;
    const snapshot = memDb.backup();
    try {
      return await fn(query);
    } catch (err) {
      snapshot.restore();
      attachPgMemImmutabilityGuards(memDb);
      throw err;
    } finally {
      releaseLock();
    }
  }

  throw new Error('Database is not initialized.');
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
