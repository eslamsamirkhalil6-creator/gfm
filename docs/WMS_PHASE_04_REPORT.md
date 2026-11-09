# GFMS Phase 04 Report – Backend WMS Services & REST API Implementation

**Project:** Garment Factory Management System (GFMS v0.3)  
**Phase:** 04 – Backend WMS Services, Transaction Engine & REST APIs  
**Status:** Backend Implementation Complete & Verified (`74/74` Automated Tests Passing on `pg-mem v3.0.14`)  
**Execution Mode:** Backend Implementation Only (Zero frontend UI changes; `005` schema & seeds preserved unmodified)

---

## 1. Executive Summary

Phase 04 delivers the full backend application layer for the independent Warehouse Management System (WMS) on top of the Phase 03 database foundation:
- Extended JWT authentication and RBAC authorization context (`managed_warehouse_ids`, `supervised_line_ids`) with warehouse-scoped and production-line-scoped middleware guards, strict valuation isolation, and System Administrator operational segregation.
- Built a unified transactional `InventoryEngineService` managing atomic balance locking (`SELECT ... FOR UPDATE`), immutable `stock_movements` ledger entries, reservation/release accounting, Global Weighted Average Cost (`PARAM-02`), and full balance-vs-ledger reconciliation.
- Implemented all approved WMS operational workflows (§5.1–§5.14): warehouses/bins/staff/settings, material catalog (`DEC-03` hybrid `attributes_json`), goods receiving (`GRN`, `PARAM-03` tolerance, `DEC-05` QC quarantine), QC inspection & release, material requisitions & stock reservation (`DEC-06`), stock issuing with advisory FIFO & override audit (`DEC-04`), material returns with cumulative issue traceability, internal bin moves & 2-step inter-warehouse transfers (`DEC-07`), physical stock counts, stock adjustments with `PARAM-01` thresholds / maker-checker / `DEC-08` `WRITE_OFF` escalation, 3-tier reorder approvals (`DEC-10`), finished goods receiving, and in-app notifications (`DEC-12`).
- Preserved all 56 prior tests (`#1`–`#56`) and added 18 end-to-end HTTP integration tests (`#57`–`#74`) covering RBAC, scopes, atomic transactions, costing math, workflows, notifications, audit logs, and ledger reconciliation.

---

## 2. Files Created & Modified

| Action | File Path | Purpose |
|---|---|---|
| **Modified** | `backend/src/modules/auth/auth.types.ts` | Extended `AuthenticatedUser` and `UserWithRoles` with `managed_warehouse_ids` and `supervised_line_ids` |
| **Modified** | `backend/src/modules/auth/auth.service.ts` | Dynamically hydrates active warehouse staff assignments (`warehouse_staff` effective window) and supervised `production_lines` at login and JWT verification |
| **Modified** | `backend/src/middleware/auth.middleware.ts` | Added `requireAnyPermission`, `GLOBAL_WAREHOUSE_ROLES`, `hasGlobalWarehouseAccess`, `requireWarehouseScope`, and `requireProductionLineScope` |
| **Created** | `backend/src/modules/warehouse/warehouse.types.ts` | Domain entities, status enums, actor context, and typed request/response contracts |
| **Created** | `backend/src/modules/warehouse/warehouse.errors.ts` | Shared HTTP error factories (`400`/`403`/`404`/`409`) and input parsing/enum validators |
| **Created** | `backend/src/modules/warehouse/inventory-engine.service.ts` | Transactional ledger engine: row locking (`FOR UPDATE`), balance upsert, reservation/release, Global WAC recalculation, bin validation, lot/roll handling, `LOW_STOCK` checks, and reconciliation |
| **Created** | `backend/src/modules/warehouse/warehouse-master.service.ts` | Warehouses, bins (`DEFAULT` lock), staff assignments (`PARAM-04`), policy settings (`PARAM-01`/`PARAM-03`), categories/materials (`DEC-03`), balances/lots/movements/valuation/reconciliation |
| **Created** | `backend/src/modules/warehouse/warehouse-inbound.service.ts` | GRN creation/line additions/posting (`DEC-05` quarantine vs direct stock, `PARAM-03` tolerance) and QC inspections (`qc_inspections`) |
| **Created** | `backend/src/modules/warehouse/warehouse-outbound.service.ts` | Material requisitions, `DEC-06` reservation on approve / release on cancel, stock issuing (`DEC-04` advisory FIFO + override tracking), material returns with cumulative issue cap |
| **Created** | `backend/src/modules/warehouse/warehouse-control.service.ts` | Internal bin moves, 2-step inter-warehouse transfers (`IN_TRANSIT`), physical stock counts, stock adjustments (`PARAM-01`, `DEC-08`), 3-tier reorder approvals (`DEC-10`), finished goods receiving, and in-app notifications (`DEC-12`) |
| **Created** | `backend/src/modules/warehouse/warehouse.controller.ts` | Thin Express request handlers delegating to WMS services with authenticated `WarehouseActor` context |
| **Created** | `backend/src/modules/warehouse/warehouse.routes.ts` | Express router mounting all §5.1–§5.14 endpoints under `/api` with RBAC, scope guards, and `validateBody` checks |
| **Modified** | `backend/src/routes/index.ts` | Mounted `wmsRouter` on `apiRouter` |
| **Created** | `docs/WMS_API_SPECIFICATION.md` | Complete REST API contract for all WMS endpoints, payloads, RBAC rules, and error codes |
| **Modified** | `docs/API_SPECIFICATION.md` | Linked WMS API Specification section cleanly from the core API spec |
| **Modified** | `backend/src/tests/runner.ts` | Added 18 Phase 04 WMS integration tests (`#57`–`#74`) while preserving all 56 baseline tests (`#1`–`#56`) |
| **Created** | `docs/WMS_PHASE_04_REPORT.md` | This Phase 04 completion report |

**Untouched / Preserved**:
- Zero files under `frontend/` or `index.html` were modified.
- `database/migrations/005_create_warehouse_tables.sql` and `database/seeds/005_seed_warehouse_data.sql` were preserved unmodified.

---

## 3. Security, RBAC & Scope Enforcement

1. **Dynamic Context Hydration (`auth.service.ts`)**:
   - At login (`login`) and JWT validation (`authenticateJWT`), active `warehouse_staff` rows within `[effective_from, effective_to]` populate `user.managed_warehouse_ids`, and supervised `production_lines` populate `user.supervised_line_ids`.
   - Operational scope revocation (e.g., `DELETE /warehouses/:id/staff/:userId`) takes effect immediately on subsequent requests without waiting for JWT expiry.
2. **Warehouse & Line Scope Guards (`auth.middleware.ts`)**:
   - `GLOBAL_WAREHOUSE_ROLES` = `System Administrator`, `Factory Manager`, `Production Manager`, `QC Inspector`, `Finance Viewer`, `Purchasing Manager` (limited per role's explicit permissions).
   - Warehouse staff (`Warehouse Manager`, `Warehouse Keeper`, etc.) must pass `requireWarehouseScope`: requests targeting unassigned warehouses (or unscoped list queries with `optional: true`) are denied `403` or filtered server-side to `managed_warehouse_ids`.
   - Line Supervisors / `Department User` with `inventory:requisition:create` are scoped to departments containing their supervised `production_lines` and must specify a valid supervised line when submitting requisitions.
   - Department Managers (`DEPARTMENT_MANAGER`) retain their `managed_department_ids` boundary on requisitions and returns.
3. **Operational & Valuation Segregation**:
   - **System Administrator**: Restricted to warehouse/bin/staff/catalog setup, settings updates, and valuation read endpoints; denied (`403`) on all operational approvals (`QC`, requisitions, adjustments, reorders) and stock mutations.
   - **Finance Viewer**: Read-only access across balances, movements, summary, valuation, and ledger reconciliation; denied (`403`) on all write endpoints.
   - **Valuation Masking**: General inventory balance and summary queries strip cost/valuation totals (`unit_cost`, `total_value`, `total_global_valuation`) whenever the caller lacks `warehouse:reports:valuation`.
4. **Maker-Checker & Escalation Controls**:
   - Adjustment creators (`submitted_by`) cannot approve their own adjustments (`approved_by <> submitted_by` enforced in both service layer and DB `CHECK`).
   - Stock count submitters (`counted_by` / `submitted_by`) cannot approve their own variance counts.
   - Requisitions require approver permissions (`inventory:requisition:approve`) rather than requestor self-approval.

---

## 4. Transactional Ledger, Global WAC & Decision Compliance

| Decision / Parameter | Phase 04 Backend Implementation |
|---|---|
| **DEC-01** Storage Bins | Auto-creates locked `DEFAULT` bin on warehouse creation; blocks disabling/deleting `DEFAULT` bin (`409`); auto-resolves `DEFAULT` bin for `require_bin_tracking = FALSE` warehouses (`WH-FG`, `WH-QUAR`), and requires explicit active bin belonging to target warehouse when `require_bin_tracking = TRUE`. |
| **DEC-02** Roll/Lot Measured Qty | `inventory_lots` tracks each lot/roll's actual `initial_qty`, `remaining_qty`, `shade_code`, `received_at`, and enforces lot/roll requirement on tracked materials during GRN and Stock Issue. |
| **DEC-03** Hybrid Attributes | Validated core material columns + JSON object serialization in `materials.attributes_json` via catalog & `/attributes` endpoints. |
| **DEC-04** Advisory FIFO | Checks positive `AVAILABLE` lots in the same warehouse; allows manual lot override only when `fifo_override_reason` is non-empty (`400 FIFO_OVERRIDE_REASON_REQUIRED` otherwise) and records both flag and reason on `stock_issue_items`. |
| **DEC-05** QC Quarantine | Resolves `requires_qc = material.requires_qc_on_receipt ?? category.requires_qc_default`; QC-required receipts enter `QUARANTINE` + `pending_inspection_qty` until released (`AVAILABLE`) or segregated (`DAMAGED`/`SCRAP`) by QC Inspector. |
| **DEC-06** Requisition Reservation | Approving an `APPROVED` requisition atomically reserves `AVAILABLE` stock (`qty_reserved += qty`); cancelling releases unissued reservations (`qty_reserved -= remaining`); pre-approval issuing blocked (`409`). |
| **DEC-07** Inter-Warehouse Transfers | Single-step `INTERNAL_BIN` moves (`AVAILABLE -> AVAILABLE`, WAC unchanged); 2-step `INTER_WAREHOUSE` custody (`TRANSFER_OUT` -> `IN_TRANSIT` -> `RECEIVED` / `RECEIVED_WITH_DISCREPANCY` splitting `AVAILABLE` & `DAMAGED` + `TRANSFER_DISCREPANCY` alert). |
| **DEC-08 & PARAM-01** Adjustments | `PARAM-01 = 'UNCONFIGURED'` routes every adjustment to `Factory Manager`; numeric thresholds route `abs(qty * wac) <= threshold` to `Warehouse Manager` and `> threshold` to `Factory Manager`; `WRITE_OFF` unconditionally requires `Factory Manager` regardless of value. |
| **DEC-10** Reorder Flow | Strict stage progression `OPEN -> SUBMITTED -> PURCHASING_REVIEWED -> APPROVED` across `Warehouse Manager` -> `Purchasing Manager` -> `Factory Manager` with `409` stage-skip protection. |
| **DEC-11 & PARAM-02** Global WAC | Recalculated solely on `materials` during direct GRN post (no QC) and QC `AVAILABLE` pass: `new_total_value = old_value + (qty * unit_cost)`, `new_total_qty = old_qty + qty`, `new_wac = new_total_value / new_total_qty`. Requisitions, issues, returns (valued at current Global WAC), and transfers preserve `weighted_avg_cost`. |
| **DEC-12** Notifications | Persistent `warehouse_notifications` emitted on `LOW_STOCK`, `QC_PENDING`, `APPROVAL_REQUIRED`, `RECEIPT_DISCREPANCY`, and overdue `TRANSFER_DELAYED` scans. |
| **PARAM-03** GRN Tolerance | Validates `received_qty <= expected_qty * (1 + pct / 100)` when `expected_qty` is provided on GRN line items; rejects over-tolerance lines (`400`) and logs `RECEIPT_DISCREPANCY` alerts for under-delivery or damaged lines. |
| **Audit Coverage** | All mutations log structured events (`WMS_*`) via `AuditService.log` inside or alongside service flows. |

---

## 5. REST API Surface & Deferred Module Boundaries

- **Mounted Endpoints (`/api/warehouses/*`, `/api/warehouse/*`, `/api/inventory/*`)**: Documented in full in `docs/WMS_API_SPECIFICATION.md` across 14 subsections (§5.1–§5.14).
- **External Module Boundaries Preserved**:
  - **Purchasing PO Master**: Deferred to the Purchasing module; GRNs store optional string `po_reference` and enforce line-level `expected_qty` tolerance (`PARAM-03`), while cumulative multi-GRN cap against an external PO entity awaits Purchasing PO line tables.
  - **Planning/MRP & Finance GL**: Decoupled cleanly; WMS exposes read-only `/inventory/valuation` and `/inventory/reconcile` endpoints without generating accounting journal entries.
  - **No Frontend Work**: No React pages or components were created or changed.

---

## 6. Verification & Honest Testing Results

### 6.1 Typecheck & Automated Integration Suite
- **`npm run lint` (`tsc --noEmit`)**: Passed with **0 errors**.
- **`npm test` (`tsx backend/src/tests/runner.ts`)**: **`74 / 74` tests passed (`12202ms`)**:
  - Regression (`#1`–`#56`): **`56 / 56 PASSED`** (Core Auth/RBAC, Department-Scoped RBAC, Atomic Employee Transfer, Migrations, and Phase 03 Schema Constraints).
  - Phase 04 WMS API & Service Suite (`#57`–`#74`): **`18 / 18 PASSED`**:
    - `#57` Auth (401), Role Segregation, Finance Read-Only, Valuation Masking & SysAdmin Operational Isolation
    - `#58` Warehouse Scope Isolation & Unassigned Denial (403)
    - `#59` Department & Production Line Scope Enforcement on Requisitions (403/400)
    - `#60` Warehouse Setup, `DEFAULT` Bin Lock & Live Staff Scope Grant/Revocation
    - `#61` Material Catalog, Hybrid `attributes_json` & Config Endpoints
    - `#62` GRN Reconciliation, `PARAM-03` Tolerance, `DEC-05` Quarantine & Anti-Double-Post (`409`)
    - `#63` Partial Deliveries & Exact Global WAC Progression (`2.00 -> 2.60 -> 3.20`)
    - `#64` QC Inspection Partial Release, `DAMAGED` Segregation & Over-Inspect Guard (`409`)
    - `#65` Requisition Lifecycle, Atomic Reservation on Approve & Release on Cancel
    - `#66` Stock Issuing, Advisory FIFO Block (`400`), Audited Override (`DEC-04`), Over-Issue Guard (`409`) & `LOW_STOCK` Alert
    - `#67` Material Returns Condition Routing (`AVAILABLE`/`DAMAGED`/`SCRAP`) & Cumulative Issue Return Cap (`409`)
    - `#68` Internal Bin Move, 2-Step Inter-Warehouse Transfer (`IN_TRANSIT`), Scope & Role Guards, Transit Damage & WAC Preservation
    - `#69` Physical Stock Count Snapshot, Variance Entry & Maker-Checker Approval Posting
    - `#70` Adjustment Policy: `PARAM-01 UNCONFIGURED`, Numeric Threshold Routing, Maker-Checker Self-Approval Block & `DEC-08` `WRITE_OFF` FM Escalation
    - `#71` Reorder Request 3-Tier Approval Sequence (`WM -> Purchasing -> FM`, `DEC-10`)
    - `#72` Finished Goods Receiving Validation (`400`/`403`), `WH-FG DEFAULT` Bin Handover & QC Quarantine Release
    - `#73` In-App Operational Notifications (`LOW_STOCK`, `QC_PENDING`, `APPROVAL_REQUIRED`, `RECEIPT_DISCREPANCY`, `TRANSFER_DELAYED`) & Mark-Read Persistence
    - `#74` End-to-End Ledger Reconciliation (`inventory_balances == stock_movements`, `0` discrepancies) & `WMS_*` Audit Event Coverage (`33` distinct audit action types recorded across test workflows)

### 6.2 Runtime & Concurrency Honesty Note
- The automated test suite executed against the workspace's **`pg-mem v3.0.14`** PostgreSQL emulator (`DATABASE_URL` live PostgreSQL instance was not running locally).
- `InventoryEngineService` and workflow services issue explicit `SELECT ... FOR UPDATE` locks inside database transactions (`withTransaction`) for balance updates, GRN double-post checks, requisition approvals, and stock count approvals. While `pg-mem` validates SQL syntax and sequential transaction isolation cleanly, **true concurrent multi-session MVCC row lock blocking under competing database connections requires live PostgreSQL validation** before production cutover.

---

## 7. Next Phase Readiness

Phase 04 backend services, transaction ledger engine, authorization/scope enforcement, REST API specification, and automated integration tests are complete and verified. Ready to proceed to **Phase 05 (Warehouse Frontend Workspace & Operational UI)** upon explicit user confirmation.
