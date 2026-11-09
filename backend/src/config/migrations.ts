import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type pg from 'pg';
import { newDb } from 'pg-mem';

export type EngineKind = 'pg' | 'pg-mem';

export interface SqlFileEntry {
  migrationId: string;
  name: string;
  migrationType: 'migration' | 'seed';
  filePath: string;
  sql: string;
  checksum: string;
}

export interface MigrationExecutionReport {
  appliedMigrations: string[];
  appliedSeeds: string[];
  skippedMigrations: string[];
  skippedSeeds: string[];
  bootstrappedLegacyEntries: string[];
}

export interface MigrationDriver {
  kind: EngineKind;
  query: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;
  execScript: (sql: string) => Promise<void>;
  runInTransaction: <T>(fn: (tx: MigrationDriver) => Promise<T>) => Promise<T>;
  onPostMigrationHook?: () => Promise<void>;
}

/**
 * Create a pg-mem instance configured with standard GFMS PostgreSQL compatibility shims.
 */
export function createConfiguredPgMemDb(): ReturnType<typeof newDb> {
  const memDb = newDb({
    autoCreateForeignKeyIndices: true,
  });

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

  return memDb;
}

/**
 * Attach database-boundary immutability guard for stock_movements on pg-mem.
 * (pg-mem v3.0 does not parse CREATE TRIGGER / plpgsql; live PostgreSQL uses a real trigger.)
 */
export function attachPgMemImmutabilityGuards(memDb: ReturnType<typeof newDb>): void {
  try {
    const tbl = (memDb as any).getTable('stock_movements');
    if (tbl && typeof tbl.onBeforeChange === 'function' && !(tbl as any).__gfmsImmutableGuarded) {
      tbl.onBeforeChange('all', (oldRow: any) => {
        if (oldRow) {
          throw new Error(
            'IMMUTABLE_LEDGER: stock_movements rows are append-only and cannot be updated or deleted'
          );
        }
      });
      if (typeof tbl.onTruncate === 'function') {
        tbl.onTruncate(() => {
          throw new Error(
            'IMMUTABLE_LEDGER: stock_movements table cannot be truncated'
          );
        });
      }
      (tbl as any).__gfmsImmutableGuarded = true;
    }
  } catch {
    // Table may not exist yet before 005 migration runs
  }
}

/**
 * Install PostgreSQL-native trigger preventing UPDATE/DELETE on stock_movements.
 * Applied only on live PostgreSQL connections (not pg-mem).
 */
export async function applyPostgresImmutabilityGuards(driver: MigrationDriver): Promise<void> {
  if (driver.kind !== 'pg') return;

  const hasStockMovements = await driver.query<{ cnt: string }>(
    `SELECT count(*) as cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_movements'`
  );
  if (parseInt(String(hasStockMovements.rows[0]?.cnt || '0'), 10) === 0) {
    return;
  }

  await driver.execScript(`
    CREATE OR REPLACE FUNCTION prevent_stock_movement_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'IMMUTABLE_LEDGER: stock_movements rows are append-only and cannot be %d', TG_OP;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_stock_movements_immutable ON stock_movements;
    CREATE TRIGGER trg_stock_movements_immutable
    BEFORE UPDATE OR DELETE ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION prevent_stock_movement_mutation();
  `);
}

/**
 * Build a MigrationDriver for a live node-postgres Pool.
 */
export function createPgDriver(pool: pg.Pool): MigrationDriver {
  const wrapClient = (client: pg.Pool | pg.PoolClient): MigrationDriver => ({
    kind: 'pg',
    async query<T = any>(sql: string, params: any[] = []) {
      const res = await client.query(sql, params);
      return {
        rows: (res.rows || []) as T[],
        rowCount: res.rowCount !== undefined && res.rowCount !== null ? res.rowCount : (res.rows ? res.rows.length : 0),
      };
    },
    async execScript(sql: string) {
      await client.query(sql);
    },
    async runInTransaction<T>(fn: (tx: MigrationDriver) => Promise<T>): Promise<T> {
      const txClient = await pool.connect();
      const txDriver = wrapClient(txClient);
      try {
        await txClient.query('BEGIN');
        const result = await fn(txDriver);
        await txClient.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await txClient.query('ROLLBACK');
        } catch (rbErr: any) {
          console.error('[DB Migration Rollback Error]:', rbErr?.message || rbErr);
        }
        throw err;
      } finally {
        txClient.release();
      }
    },
    async onPostMigrationHook() {
      await applyPostgresImmutabilityGuards(wrapClient(pool));
    },
  });

  return wrapClient(pool);
}

/**
 * Build a MigrationDriver for a pg-mem instance.
 * Note: pg-mem raw SQL BEGIN/ROLLBACK are no-ops, so rollback uses memDb.backup()/restore().
 */
export function createPgMemDriver(memDb: ReturnType<typeof newDb>): MigrationDriver {
  const pgAdapter = memDb.adapters.createPg();
  const memPool = new pgAdapter.Pool();

  const driver: MigrationDriver = {
    kind: 'pg-mem',
    async query<T = any>(sql: string, params: any[] = []) {
      const res = await memPool.query(sql, params);
      return {
        rows: (res.rows || []) as T[],
        rowCount: res.rowCount !== undefined && res.rowCount !== null ? res.rowCount : (res.rows ? res.rows.length : 0),
      };
    },
    async execScript(sql: string) {
      memDb.public.none(sql);
    },
    async runInTransaction<T>(fn: (tx: MigrationDriver) => Promise<T>): Promise<T> {
      const snapshot = memDb.backup();
      try {
        return await fn(driver);
      } catch (err) {
        try {
          snapshot.restore();
          attachPgMemImmutabilityGuards(memDb);
        } catch (restoreErr: any) {
          console.warn('[DB pg-mem Migration Rollback Note]:', restoreErr?.message || restoreErr);
        }
        throw err;
      }
    },
    async onPostMigrationHook() {
      attachPgMemImmutabilityGuards(memDb);
    },
  };

  return driver;
}

function extractMigrationId(filename: string): string {
  const match = filename.match(/^(\d+)_/);
  return match ? match[1] : filename;
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function loadSqlEntries(
  dirPath: string,
  migrationType: 'migration' | 'seed'
): SqlFileEntry[] {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return files.map((name) => {
    const filePath = path.join(dirPath, name);
    const sql = fs.readFileSync(filePath, 'utf8');
    return {
      migrationId: extractMigrationId(name),
      name,
      migrationType,
      filePath,
      sql,
      checksum: sha256(sql),
    };
  });
}

export const SCHEMA_MIGRATIONS_DDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  migration_type VARCHAR(20) NOT NULL DEFAULT 'migration' CHECK (migration_type IN ('migration', 'seed')),
  checksum VARCHAR(64) NOT NULL,
  execution_ms INTEGER NOT NULL DEFAULT 0,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (migration_type, name)
);
`;

async function tableExists(driver: MigrationDriver, tableName: string): Promise<boolean> {
  const res = await driver.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );
  return res.rows.some((r) => r.table_name === tableName);
}

async function columnExists(
  driver: MigrationDriver,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const res = await driver.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return res.rows.some((r) => r.column_name === columnName);
}

/**
 * Baseline pre-Phase-03 databases (001-004 applied without schema_migrations) so legacy
 * non-idempotent seed files (001-003) are not re-executed and crashed on existing rows.
 */
async function bootstrapLegacyBaselineIfNeeded(
  driver: MigrationDriver,
  migrations: SqlFileEntry[],
  seeds: SqlFileEntry[]
): Promise<string[]> {
  const existingTracked = await driver.query<{ cnt: string }>(
    `SELECT count(*) as cnt FROM schema_migrations`
  );
  if (parseInt(String(existingTracked.rows[0]?.cnt || '0'), 10) > 0) {
    return [];
  }

  const hasUsersTable = await tableExists(driver, 'users');
  if (!hasUsersTable) {
    return [];
  }

  const bootstrapped: string[] = [];

  const recordBaseline = async (entry: SqlFileEntry | undefined) => {
    if (!entry) return;
    await driver.query(
      `INSERT INTO schema_migrations (migration_id, name, migration_type, checksum, execution_ms)
       VALUES ($1, $2, $3, $4, 0)
       ON CONFLICT (migration_type, name) DO NOTHING`,
      [entry.migrationId, entry.name, entry.migrationType, entry.checksum]
    );
    bootstrapped.push(`${entry.migrationType}:${entry.name}`);
  };

  // Phase 001 detection
  const hasRolesTable = await tableExists(driver, 'roles');
  if (hasRolesTable) {
    await recordBaseline(migrations.find((m) => m.name.startsWith('001_')));
    const rolesCount = await driver.query<{ cnt: string }>(`SELECT count(*) as cnt FROM roles`);
    if (parseInt(String(rolesCount.rows[0]?.cnt || '0'), 10) > 0) {
      await recordBaseline(seeds.find((s) => s.name.startsWith('001_')));
    }
  }

  // Phase 002 detection
  if (await tableExists(driver, 'production_halls')) {
    await recordBaseline(migrations.find((m) => m.name.startsWith('002_')));
    const hallsCount = await driver.query<{ cnt: string }>(`SELECT count(*) as cnt FROM production_halls`);
    if (parseInt(String(hallsCount.rows[0]?.cnt || '0'), 10) > 0) {
      await recordBaseline(seeds.find((s) => s.name.startsWith('002_')));
    }
  }

  // Phase 003 detection
  if (
    (await tableExists(driver, 'departments')) &&
    (await columnExists(driver, 'production_lines', 'department_id'))
  ) {
    await recordBaseline(migrations.find((m) => m.name.startsWith('003_')));
    const deptCount = await driver.query<{ cnt: string }>(`SELECT count(*) as cnt FROM departments`);
    if (parseInt(String(deptCount.rows[0]?.cnt || '0'), 10) > 0) {
      await recordBaseline(seeds.find((s) => s.name.startsWith('003_')));
    }
  }

  // Phase 004 detection
  if (await tableExists(driver, 'roles')) {
    const dmRole = await driver.query<{ cnt: string }>(
      `SELECT count(*) as cnt FROM roles WHERE role_name = 'Department Manager'`
    );
    if (parseInt(String(dmRole.rows[0]?.cnt || '0'), 10) > 0) {
      await recordBaseline(migrations.find((m) => m.name.startsWith('004_')));
      await recordBaseline(seeds.find((s) => s.name.startsWith('004_')));
    }
  }

  // In case 005 already exists on a manually migrated DB
  if (await tableExists(driver, 'warehouses')) {
    await recordBaseline(migrations.find((m) => m.name.startsWith('005_')));
    const whCount = await driver.query<{ cnt: string }>(`SELECT count(*) as cnt FROM warehouses`);
    if (parseInt(String(whCount.rows[0]?.cnt || '0'), 10) > 0) {
      await recordBaseline(seeds.find((s) => s.name.startsWith('005_')));
    }
  }

  return bootstrapped;
}

/**
 * Run all pending migrations and seeds deterministically using schema_migrations tracking.
 * Each migration/seed runs inside an atomic transaction and never swallows errors.
 */
export async function runPendingMigrations(
  driver: MigrationDriver,
  options?: {
    migrationsDir?: string;
    seedsDir?: string;
    migrationEntries?: SqlFileEntry[];
    seedEntries?: SqlFileEntry[];
    includeSeeds?: boolean;
  }
): Promise<MigrationExecutionReport> {
  const migrationsDir = options?.migrationsDir ?? path.resolve(process.cwd(), 'database/migrations');
  const seedsDir = options?.seedsDir ?? path.resolve(process.cwd(), 'database/seeds');
  const includeSeeds = options?.includeSeeds ?? true;

  const migrations = options?.migrationEntries ?? loadSqlEntries(migrationsDir, 'migration');
  const seeds = includeSeeds ? (options?.seedEntries ?? loadSqlEntries(seedsDir, 'seed')) : [];

  if (!(await tableExists(driver, 'schema_migrations'))) {
    await driver.execScript(SCHEMA_MIGRATIONS_DDL);
  }

  const bootstrappedLegacyEntries = await bootstrapLegacyBaselineIfNeeded(driver, migrations, seeds);

  const appliedRes = await driver.query<{ migration_type: string; name: string; checksum: string }>(
    `SELECT migration_type, name, checksum FROM schema_migrations`
  );
  const appliedMap = new Map<string, string>();
  for (const row of appliedRes.rows) {
    appliedMap.set(`${row.migration_type}:${row.name}`, row.checksum);
  }

  const report: MigrationExecutionReport = {
    appliedMigrations: [],
    appliedSeeds: [],
    skippedMigrations: [],
    skippedSeeds: [],
    bootstrappedLegacyEntries,
  };

  for (const entry of migrations) {
    const key = `migration:${entry.name}`;
    if (appliedMap.has(key)) {
      report.skippedMigrations.push(entry.name);
      continue;
    }

    const t0 = Date.now();
    await driver.runInTransaction(async (tx) => {
      await tx.execScript(entry.sql);
      const elapsed = Date.now() - t0;
      await tx.query(
        `INSERT INTO schema_migrations (migration_id, name, migration_type, checksum, execution_ms)
         VALUES ($1, $2, 'migration', $3, $4)`,
        [entry.migrationId, entry.name, entry.checksum, elapsed]
      );
    });
    appliedMap.set(key, entry.checksum);
    report.appliedMigrations.push(entry.name);
  }

  for (const entry of seeds) {
    const key = `seed:${entry.name}`;
    if (appliedMap.has(key)) {
      report.skippedSeeds.push(entry.name);
      continue;
    }

    const t0 = Date.now();
    await driver.runInTransaction(async (tx) => {
      await tx.execScript(entry.sql);
      const elapsed = Date.now() - t0;
      await tx.query(
        `INSERT INTO schema_migrations (migration_id, name, migration_type, checksum, execution_ms)
         VALUES ($1, $2, 'seed', $3, $4)`,
        [entry.migrationId, entry.name, entry.checksum, elapsed]
      );
    });
    appliedMap.set(key, entry.checksum);
    report.appliedSeeds.push(entry.name);
  }

  if (driver.onPostMigrationHook) {
    await driver.onPostMigrationHook();
  }

  return report;
}
