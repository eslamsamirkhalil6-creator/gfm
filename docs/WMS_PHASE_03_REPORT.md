# GFMS Phase 03 Report – Migration Infrastructure & Warehouse Database Schema

**Project:** Garment Factory Management System (GFMS v0.3)  
**Phase:** 03 – Migration Infrastructure & WMS Database Schema  
**Status:** Database Layer Implemented & Verified (`56/56` Automated Tests Passing on `pg-mem v3.0.14`)  
**Scope Compliance:** Database Layer Only (No WMS REST APIs, backend services, authorization middleware extensions, or frontend UI changes implemented)

---

## 1. Executive Summary

Phase 03 establishes the tracked database migration infrastructure and the complete relational schema for the independent Warehouse Management System (WMS):
- Implemented tracked migration execution (`schema_migrations`) supporting fresh initialization, legacy `001`–`004` baseline upgrading without seed collisions, idempotent re-runs, and strict error propagation/rollback.
- Delivered `005_create_warehouse_tables.sql` (24 WMS tables) and `005_seed_warehouse_data.sql` (7 dedicated operational roles, 19 granular `warehouse:*`/`inventory:*` permissions, baseline policy parameters, 4 warehouses with mandatory `DEFAULT` bins, 5 material categories, and 3 sample SKUs).
- Enforced database-level data integrity across composite warehouse-location FKs, normalized optional-lot balance uniqueness (`lot_key`), generated `qty_available`, receiving/QC quantity reconciliation, `WRITE_OFF` Factory Manager locks, maker-checker `approved_by <> submitted_by`, and database-boundary immutability on `stock_movements`.

---

## 2. Files Created & Modified

| Action | File Path | Purpose |
|---|---|---|
| **Created** | `backend/src/config/migrations.ts` | Shared tracked migration engine (`schema_migrations`), legacy `001`–`004` bootstrapper, PG & `pg-mem` drivers, atomic tx/error handling, `stock_movements` immutability guards |
| **Modified** | `backend/src/config/database.ts` | Replaced ad-hoc SQL loop with `runPendingMigrations`, separated PG TCP fallback from migration errors, re-attached `pg-mem` guard on `withTransaction` rollback |
| **Modified** | `database/migrate.ts` | Unified standalone CLI migration tool with `createPgDriver` + `runPendingMigrations` |
| **Created** | `database/migrations/005_create_warehouse_tables.sql` | 24 WMS relational tables, CHECK/UNIQUE/FK/composite-FK constraints, generated column, and 27 performance indexes |
| **Created** | `database/seeds/005_seed_warehouse_data.sql` | Idempotent seed for 7 WMS roles, 19 permissions, role-permission mappings, `warehouse_settings`, 4 warehouses + bins, 5 categories, 3 sample materials, audit entry |
| **Modified** | `backend/src/tests/runner.ts` | Added 14 dedicated Phase 03 WMS migration & database schema integrity tests (`#43`–`#56`) while preserving all 42 baseline tests (`#1`–`#42`) |
| **Modified** | `docs/DATABASE_SCHEMA.md` | Documented `schema_migrations`, all 24 WMS tables, constraints, indexes, and aligned `002` column notes |
| **Created** | `docs/MIGRATIONS.md` | Documented migration workflow, `schema_migrations`, legacy bootstrap, PG vs `pg-mem` compatibility, and local `psql` validation commands |
| **Created** | `docs/WMS_PHASE_03_REPORT.md` | This Phase 03 completion report |

---

## 3. Database Schema & Business Decision Alignment

| Phase 02 Decision / Parameter | Database Schema Implementation |
|---|---|
| **DEC-01** Configurable Bin Tracking | `warehouses.require_bin_tracking` (`TRUE` for `WH-RAW`/`WH-TRIM`; `FALSE` for `WH-FG`/`WH-QUAR`); `DEFAULT` location auto-seeded for all 4 warehouses (`warehouse_locations.is_default = TRUE`) |
| **DEC-02** Roll/Lot Measured Quantities | `inventory_lots` (`initial_qty`, `remaining_qty`, `shade_code`, `UNIQUE(material_id, lot_number, roll_number)` with `DEFAULT ''`) |
| **DEC-03** Hybrid Attributes | Core indexed columns (`sku`, `color`, `size`, `base_uom`) + `materials.attributes_json TEXT DEFAULT '{}'` |
| **DEC-04** Advisory FIFO + Override | `stock_issue_items(fifo_overridden, fifo_override_reason)` with `CHECK (fifo_overridden = FALSE OR (fifo_override_reason IS NOT NULL AND fifo_override_reason <> ''))` |
| **DEC-05** QC Quarantine Configurability | `material_categories.requires_qc_default`, `materials.requires_qc_on_receipt`, `goods_receipt_items.pending_inspection_qty`, and multi-outcome `qc_inspections` |
| **DEC-06** Requisition Approval First | `material_requisitions` status lifecycle (`DRAFT -> SUBMITTED -> APPROVED -> PARTIALLY_ISSUED -> FULFILLED`), `material_requisition_items(requested_qty, reserved_qty, issued_qty)` |
| **DEC-07** Two-Step Inter-Warehouse Transfers | `warehouse_transfers` (`INTERNAL_BIN` \| `INTER_WAREHOUSE`; `DISPATCHED / IN_TRANSIT -> RECEIVED / RECEIVED_WITH_DISCREPANCY`), `warehouse_transfer_items` reconciliation CHECK |
| **DEC-08 & PARAM-01** Adjustment Threshold & Write-Offs | `warehouse_settings('adjustment_approval_threshold' = 'UNCONFIGURED')`; `stock_adjustments.requires_factory_manager DEFAULT TRUE`, unconditional `CHECK (reason_code <> 'WRITE_OFF' OR requires_factory_manager = TRUE)`, `CHECK (approved_by IS NULL OR approved_by <> submitted_by)` |
| **DEC-09** RBAC Extension | 7 dedicated roles & 19 permissions seeded in `roles`, `permissions`, `role_permissions`; SysAdmin restricted to setup/settings (`NO` operational approve/post permissions) |
| **DEC-10** Reorder Approval Flow | `reorder_requests` supporting `OPEN -> SUBMITTED -> PURCHASING_REVIEWED -> APPROVED -> LINKED_TO_PO -> CLOSED` |
| **DEC-11 & PARAM-02** Global WAC per Material | `materials(weighted_avg_cost, total_valued_qty, total_inventory_value, last_cost_updated_at)` with `>= 0` CHECKs; zero per-warehouse WAC columns; calculation deferred to Phase 04 service layer (no DB trigger math) |
| **DEC-12** In-App Notifications | `warehouse_notifications(recipient_user_id, target_role_name, warehouse_id, notification_type, severity, is_read)` |
| **PARAM-03** Over-Delivery Tolerance | `warehouse_settings('grn_over_delivery_tolerance_pct' = '0')` |
| **PARAM-04** Multi-Warehouse Staff Mapping | `warehouse_staff(warehouse_id, user_id, staff_role, is_primary, effective_from, effective_to, UNIQUE(warehouse_id, user_id))` |

---

## 4. Verification & Test Execution Results

### 4.1 Baseline vs Final Test Counts
- **Pre-Phase-03 Baseline**: `42 / 42` tests passed (`4827ms`)
- **Post-Phase-03 Final Suite**: **`56 / 56` tests passed** (`6816ms`)
  - Regression (`#1`–`#42`): `42 / 42 PASSED`
  - Phase 03 WMS Database & Migration Suite (`#43`–`#56`): `14 / 14 PASSED`

### 4.2 Phase 03 Test Coverage Summary (`#43`–`#56`)
- **#43** Fresh database initialization via tracked migrations (`40` total tables: `15` legacy + `schema_migrations` + `24` WMS; `10` tracked migration/seed rows with SHA-256 checksums; `7` WMS roles; `19` permissions; `4` warehouses + `DEFAULT` bins; `PARAM-01`/`PARAM-03` defaults).
- **#44** Legacy `001`–`004` upgrade to `005` via `bootstrapLegacyBaselineIfNeeded` (cleanly baselines 8 legacy entries and applies only `005`).
- **#45** Migration idempotency (second run skips all 5 migrations & 5 seeds; applies 0).
- **#46** Migration failure propagation & rollback (failing `CHECK` surfaces loudly, records 0 entries in `schema_migrations`, rolls back pre-failure DML).
- **#47** Foreign keys, composite `(warehouse_id, location_id)` cross-warehouse rejection, and `ON DELETE RESTRICT`.
- **#48** Unique `materials.sku` and `inventory_lots(material_id, lot_number, roll_number)` uniqueness.
- **#49** Optional-lot `inventory_balances` uniqueness via `lot_key` normalization & `CHECK` invariants.
- **#50** Negative & zero quantity prevention across balances, lots, and movements.
- **#51** `qty_reserved <= qty_on_hand` enforcement and dynamic recalculation of `STORED` generated `qty_available`.
- **#52** GRN line quantity reconciliation (`received = accepted + rejected + damaged + pending`) and multi-outcome `qc_inspections` reconciliation.
- **#53** Multi-warehouse `warehouse_staff` mapping, `UNIQUE(warehouse_id, user_id)`, invalid role rejection, and `effective_to >= effective_from`.
- **#54** Global WAC schema integrity exclusively on `materials` + `attributes_json` + negative cost prevention.
- **#55** Operational DB CHECKs: FIFO override reason enforcement, `issued_qty <= requested_qty`, transfer discrepancy sum `<= dispatched_qty`, unconditional `WRITE_OFF` Factory Manager lock, and DB-level maker-checker `approved_by <> submitted_by`.
- **#56** Linked movement references, `IMMUTABLE_LEDGER` blocking `UPDATE`/`DELETE` on `stock_movements`, and `SELECT ... FOR UPDATE` execution on `inventory_balances`.

---

## 5. Engine Findings, Limitations & Live PostgreSQL Validation Path

1. **Test Execution Engine**: Live PostgreSQL on `127.0.0.1:5432` was not running in this environment, so `npm test` executed against the configured **`pg-mem v3.0.14`** PostgreSQL engine.
2. **Engine Compatibility Fixes Discovered & Resolved During Testing**:
   - Replaced comma-joins (`FROM roles r, permissions p`) in `005_seed_warehouse_data.sql` with explicit scalar subqueries to prevent a `pg-mem` column-binding planner bug.
   - Replaced `TRIM`/`LENGTH` in `005` `CHECK` constraints with `<> ''` for `pg-mem` compatibility.
   - Guarded `CREATE TABLE IF NOT EXISTS schema_migrations` with `tableExists(...)` and simplified `information_schema` filters in `migrations.ts` to avoid `pg-mem` idempotent DDL / multi-predicate catalog bugs.
3. **Live PostgreSQL Features Not Executable Inside `pg-mem`**:
   - **PL/pgSQL Immutability Trigger (`trg_stock_movements_immutable`)**: Verified syntactically; installed conditionally when `driver.kind === 'pg'`. On `pg-mem`, parity is enforced via `attachPgMemImmutabilityGuards`.
   - **Real Multi-Session MVCC Row Locking (`SELECT ... FOR UPDATE`)**: Verified to parse/return cleanly in `pg-mem`, but true concurrent transaction blocking requires live PostgreSQL (Section 6 of `docs/MIGRATIONS.md`).
   - **Multi-Statement Partial DDL Rollback**: Native in PostgreSQL transactional DDL; `pg-mem` throws a catalog-restore notice if DDL precedes an error in the same script (caught cleanly so original errors always surface).

---

## 6. Explicit Phase Boundary Confirmation

- **Implemented**: Migration runner, `005` schema (24 WMS tables), `005` RBAC & baseline seed, database integrity tests (`#43`–`#56`), and Phase 03 documentation (`DATABASE_SCHEMA.md`, `MIGRATIONS.md`, `WMS_PHASE_03_REPORT.md`).
- **Not Implemented (Per Phase 03 Gate)**: Zero WMS backend services, zero REST routes/controllers, zero auth middleware changes, zero frontend components, and zero dashboard modifications.

**Ready for Phase 04 review upon explicit System Administrator approval.**
