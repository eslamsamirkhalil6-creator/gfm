# GFMS Database Migration & Engine Compatibility Guide

## 1. Architecture Overview

GFMS uses a single unified, tracked SQL migration pipeline implemented in `backend/src/config/migrations.ts` and shared across both:
1. **Application Startup (`backend/src/config/database.ts` -> `initDatabase()`)**
2. **Standalone CLI Migration Runner (`database/migrate.ts` / `npm run db:migrate`)**

All migrations and seed scripts are executed deterministically in numeric filename order from:
- `database/migrations/*.sql`
- `database/seeds/*.sql`

---

## 2. Tracking Table (`schema_migrations`)

`migrations.ts` guarantees creation of `schema_migrations` before running any pending scripts:

| Column | Type | Purpose |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | Surrogate primary key |
| `migration_id` | `VARCHAR(50)` | Numeric file prefix (`001`..`005`) |
| `name` | `VARCHAR(255)` | Exact SQL file name |
| `migration_type` | `VARCHAR(20)` | `'migration'` or `'seed'` |
| `checksum` | `VARCHAR(64)` | SHA-256 hash of file contents |
| `execution_ms` | `INTEGER` | Execution latency (`0` for bootstrapped legacy baseline) |
| `applied_at` | `TIMESTAMPTZ` | UTC timestamp when recorded |

Uniqueness is enforced via `UNIQUE (migration_type, name)`.

---

## 3. Execution Order & Legacy `001`–`004` Upgrade Behavior

1. **Ensure `schema_migrations` exists** (guarded by `tableExists` lookup before issuing DDL).
2. **Legacy Baseline Bootstrap (`bootstrapLegacyBaselineIfNeeded`)**:
   - Pre-Phase-03 databases (`001`–`004`) already have schema tables (`users`, `roles`, `production_halls`, `departments`, `Department Manager` role) and seeded records without a `schema_migrations` table.
   - Because legacy seeds `001`–`003` are not all `ON CONFLICT DO NOTHING`, re-running them blindly would fail on existing rows.
   - When `schema_migrations` is empty AND `users` exists, the bootstrapper verifies both table presence and seeded rows per phase (`001`..`004`) and records them into `schema_migrations` with `execution_ms = 0`.
3. **Execute Pending Migrations**: Each unrecorded `database/migrations/*.sql` runs inside `driver.runInTransaction(...)` and inserts its `schema_migrations` row in the same transaction.
4. **Execute Pending Seeds**: Each unrecorded `database/seeds/*.sql` runs inside `driver.runInTransaction(...)` and inserts its `schema_migrations` row in the same transaction.
5. **Post-Migration Immutability Guards (`onPostMigrationHook`)**:
   - **Live PostgreSQL (`pg`)**: Installs PL/pgSQL trigger function `prevent_stock_movement_mutation()` and trigger `trg_stock_movements_immutable` (`BEFORE UPDATE OR DELETE ON stock_movements FOR EACH ROW`).
   - **In-Memory (`pg-mem`)**: Attaches `attachPgMemImmutabilityGuards(memDb)` listeners (`onBeforeChange('all')` + `onTruncate`) on `stock_movements`.

---

## 4. Failure Handling & Error Propagation

- **No Silent Fallback on Migration Errors**: If `DATABASE_URL` accepts TCP connections (`SELECT 1`), `initDatabase()` uses the live PostgreSQL pool exclusively. Any migration or seed error throws and aborts initialization rather than silently falling back to `pg-mem`.
- **PostgreSQL Transactional Rollback**: Every migration/seed executes inside `BEGIN` ... `COMMIT`, rolling back partial DDL and DML atomically on any failure without writing to `schema_migrations`.
- **`pg-mem` Transaction Rollback Caveat**: `pg-mem` snapshots state via `memDb.backup()` / `snapshot.restore()`. If a statement throws *before* schema DDL changes, state rolls back cleanly. If DDL mutated the `pg-mem` catalog prior to an error in the same script, `pg-mem` `restore()` throws a catalog-change notice; `migrations.ts` catches that secondary `restore()` notice so the **original SQL error always propagates loudly** and `schema_migrations` never records the failed file.

---

## 5. PostgreSQL vs `pg-mem` Portability & Compatibility Notes

All SQL files (`005_create_warehouse_tables.sql`, `005_seed_warehouse_data.sql`) are written to execute identically on **PostgreSQL 14+** and **`pg-mem v3.0.14`**, respecting verified engine constraints:

| Feature / Construct | PostgreSQL 14+ | `pg-mem v3.0.14` | GFMS Approach |
|---|---|---|---|
| Triggers / `PL/pgSQL` (`CREATE TRIGGER`, `DO $$`) | Supported | Not supported | Kept `005` DDL trigger-free; triggers/hooks installed via `onPostMigrationHook` per driver |
| Multi-table comma joins (`FROM a, b`) | Supported | Planner bug assigns wrong column bindings in `INSERT...SELECT` | Replaced with explicit scalar subqueries (`VALUES ((SELECT ...), (SELECT ...))`) |
| `TRIM(varchar)` / `LENGTH(varchar)` in `CHECK` | Supported | Built-in functions missing | Used standard SQL `col <> ''` |
| `CREATE TABLE IF NOT EXISTS` on existing table | No-op | Throws AST unread-constraint panic if table exists | Checked `tableExists(driver, 'schema_migrations')` prior to executing `DDL` |
| `information_schema.columns` multiple `AND` filters | Supported | Throws `Cannot read properties of undefined` after `ALTER TABLE` | Filtered `table_name = $1` in SQL and column names in JS |
| Composite FKs (`FOREIGN KEY (warehouse_id, location_id)`) | Enforced | Parsed & Enforced | Used on all location-bearing tables (`inventory_balances`, `goods_receipt_items`, etc.) |
| `GENERATED ALWAYS AS (...) STORED` | Enforced | Parsed & dynamically recalculated | Used for `inventory_balances.qty_available` |
| Normalized `lot_key` vs Partial Unique Index (`WHERE lot_id IS NULL`) | Partial index supported | Partial unique indexes limited | Normalized `lot_key` (`'NONE'` or lot ID string) + `CHECK` + `UNIQUE` |
| `SELECT ... FOR UPDATE` | Real MVCC row locks | Parses & returns rows (single-process queue via `memoryTxQueue`) | Ready for Phase 04 services; concurrency row locking must be validated against live PostgreSQL |

---

## 6. Local PostgreSQL Execution & Validation Commands

When PostgreSQL is running locally (see also `docs/WINDOWS_LOCAL_SETUP.md`):

```bash
# 1. Run all pending migrations and seeds cleanly via Node/TS runner
npm run db:migrate

# 2. Verify tracked migrations in psql
psql -U postgres -d gfms_db -c "SELECT id, migration_id, migration_type, name, applied_at FROM schema_migrations ORDER BY id;"

# 3. Verify WMS tables and stock_movements trigger in psql
psql -U postgres -d gfms_db -c "\dt"
psql -U postgres -d gfms_db -c "SELECT tgname FROM pg_trigger WHERE tgrelid = 'stock_movements'::regclass;"

# 4. Run full automated test suite (runs against DATABASE_URL if reachable, otherwise pg-mem)
npm test
```
