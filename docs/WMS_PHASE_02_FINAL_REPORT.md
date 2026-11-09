# GFMS v0.3 – Warehouse Management System (WMS)
## Phase 02 Final Consolidation & Validation Report (`WMS_PHASE_02_FINAL_REPORT.md`)

**Date:** 2026-11-09  
**Phase:** 02 – Final BRD Consolidation  
**Status:** Completed (READ-ONLY Documentation) — **STOPPED BEFORE PHASE 03**

---

## 1. Documents Created

The following six consolidated Phase 02 deliverables were created in `/docs/` without modifying any unrelated existing documentation, source code, migrations, seeds, routes, or database state:

1. `docs/WMS_BRD.md` — Consolidated Warehouse Business Requirements Document
2. `docs/WMS_ROLE_PERMISSION_MATRIX.md` — Final Role & Permission Matrix (11 roles + gap flags)
3. `docs/WMS_WORKFLOWS.md` — Complete Step-by-Step Specifications for all 10 WMS Workflows
4. `docs/WMS_DECISION_REGISTER.md` — All 12 Approved Decisions (`DEC-01`–`DEC-12`), Scope & Rationale
5. `docs/WMS_INTEGRATION_BOUNDARIES.md` — Existing vs. Future Integration Contracts across 8 Domains
6. `docs/WMS_PHASE_02_FINAL_REPORT.md` — Final Validation & Phase 03 Readiness Assessment

---

## 2. Approved Decisions Coverage (`DEC-01` – `DEC-12`)

All 12 System Administrator decisions were incorporated verbatim with zero alterations:
- **DEC-01**: `B` – Configurable per warehouse, with automatic default bin (`DEFAULT` location ensures uniform non-null keys).
- **DEC-02**: `A` – Actual measured quantity per fabric roll.
- **DEC-03**: `A` – Hybrid standard relational columns + JSON attributes (`attributes_json`).
- **DEC-04**: `B` – Advisory FIFO picking with mandatory reason-code override & audit logging.
- **DEC-05**: `B` – QC Quarantine configurable by material/category (`requires_qc_on_receipt`).
- **DEC-06**: `A` – Manager approval required before stock reservation and issuing.
- **DEC-07**: `A` – Two-step Inter-Warehouse Transfer (`Dispatch → In-Transit → Receive/Discrepancy`).
- **DEC-08**: `A` – Threshold-based Stock Adjustment approval (Warehouse Manager vs. Factory Manager) with maker-checker segregation.
- **DEC-09**: `A` – Dedicated operational roles added to GFMS RBAC.
- **DEC-10**: `A` – 3-tier Reorder Approval (`Warehouse Manager → Purchasing Manager → Factory Manager`).
- **DEC-11**: `A` – Weighted Average Cost (WAC) inventory valuation.
- **DEC-12**: `A` – In-app notifications only.

---

## 3. Technical Clarifications Resolved

1. **Immutable Inventory Movement Ledger (§2.1 of `WMS_BRD.md`)**: Defined as an immutable operational inventory movement ledger (`stock_movements`) with unique references, `balance_before`/`balance_after`, atomic linked `OUT`/`IN` transfer pairs committed with `inventory_balances` in the same `withTransaction` call, no edits/deletes on posted movements, and compensating/reversal documents—explicitly distinguished from a financial accounting GL.
2. **Goods Receiving Reconciliation (§2.2 of `WMS_BRD.md`)**: Hard-enforced formula `Received = Accepted + Rejected + Damaged + PendingInspection` with partial delivery support, explicit discrepancy tracking, `QUARANTINE` custody for `PendingInspection`, and atomic anti-double-acceptance/rejection checks (`qty <= remaining_pending_qty`).
3. **QC Status vs. Stock Status (§2.3 of `WMS_BRD.md`)**: Strictly separated `QC Status` (`PENDING`, `PASSED`, `PARTIALLY_PASSED`, `REJECTED`) from `Stock Status` (`AVAILABLE`, `QUARANTINE`, `HOLD`, `DAMAGED`, `SCRAP`, `IN_TRANSIT`), defining quantity-level balance splitting on mixed-outcome lots and enforcing QC-only release from `QUARANTINE`.
4. **FIFO vs. Inventory Valuation (§2.4 of `WMS_BRD.md`)**: Kept independent—FIFO governs physical picking suggestions/overrides, while Weighted Average Cost governs valuation across receipts, issues, returns, transfers, and adjustments without introducing FIFO cost layers.

---

## 4. Business Rules Validation Checklist

| Rule | Status in Spec | Enforcement Layer |
|---|---|---|
| Negative inventory prohibited (`qty_on_hand >= 0`) | **Validated** | DB `CHECK` constraint + transactional row-lock validation |
| Reserved qty cannot exceed eligible `AVAILABLE` stock | **Validated** | DB `CHECK (qty_reserved >= 0 AND qty_reserved <= qty_on_hand)` + requisition approval lock |
| Only `AVAILABLE` stock can be issued | **Validated** | Service guard rejecting `QUARANTINE`/`HOLD`/`DAMAGED`/`SCRAP`/`IN_TRANSIT` |
| Posted movements are immutable | **Validated** | No `PUT`/`DELETE` routes or service mutations on `POSTED` documents/movements |
| Corrections use compensating movements | **Validated** | Workflow 5 & Workflow 8 reversal/compensating adjustment flows |
| Transfers reconcile source, in-transit, and destination | **Validated** | Linked `OUT`/`IN` atomic pairs + `RECEIVED_WITH_DISCREPANCY` resolution |
| Receiving quantities fully accounted for | **Validated** | Exact `Received = Accepted + Rejected + Damaged + PendingInspection` check |
| Every adjustment has a reason code | **Validated** | Mandatory `reason_code` enum + remarks |
| Maker-checker rules enforced | **Validated** | `submitted_by !== approved_by` checked server-side on adjustments/write-offs |
| Server-side permissions & department/line/warehouse scope | **Validated** | `requirePermission`, `requireDepartmentScope`, proposed `requireWarehouseScope` & `requireProductionLineScope` |
| Atomic DB transactions | **Validated** | `withTransaction` in `backend/src/config/database.ts` |
| PostgreSQL vs. `pg-mem` parity evaluated | **Validated** | Sentinel/non-null `lot_key` for unique keys, standard SQL avoiding `pg-mem` `LEFT JOIN` FK lookup bug, `FOR UPDATE` parity testing in Phase 03 |

---

## 5. Role Matrix Validation & Existing Architecture Flags

All 11 roles (`System Administrator`, `Factory Manager`, `Warehouse Manager`, `Warehouse Keeper`, `QC Manager / QC Inspector`, `Purchasing Manager`, `Production Manager`, `Department Manager`, `Department User`, `Production Line Responsible Person`, `Finance Viewer`) are specified across Read, Create, Update, Approval, Posting, Reversal, and Scope Restrictions.

**Verified Baseline vs. Phase 03/04 Required RBAC Extensions (Flagged Honestly):**
- **Existing (`001`–`004`)**: Only 4 roles exist (`System Administrator`, `Factory Manager`, `Department User`, `Department Manager`); `authenticateJWT` currently loads `managed_department_ids` only.
- **Required Phase 03/04 Extensions**:
  1. Seed the 6–7 dedicated operational roles (`DEC-09`) and ~19 granular `warehouse:*` / `inventory:*` permissions into existing `roles` / `permissions` / `role_permissions` tables.
  2. Extend `AuthenticatedUser` in `authenticateJWT` to load `managed_warehouse_ids` (from warehouse assignment/manager tables) and `supervised_line_ids` (from `production_lines.supervisor_id = user.id`).
  3. Add server-side `requireWarehouseScope` and `requireProductionLineScope` middlewares mirroring `requireDepartmentScope`.
  4. Verify whether `QC Manager` and `QC Inspector` should be two distinct seeded roles or one combined role (`QC Inspector` + `QC Manager` override) during Phase 03 seed design.

---

## 6. Workflow Validation Summary

All **10 workflows** (`Goods Receiving & Put-Away`, `QC Inspection & Release`, `Material Requisition`, `Stock Issuing to Production`, `Material Return / Waste / Damage`, `Warehouse Transfer`, `Physical Stock Count`, `Stock Adjustment / Write-Off`, `Reorder Request`, `Finished Goods Receiving`) were validated for internal consistency:
- Approval gates match `DEC-06`, `DEC-07`, `DEC-08`, and `DEC-10`.
- Status transitions never create phantom or double-processed stock.
- `AuditService.log` and `stock_movements` align cleanly on every state transition.

---

## 7. Remaining Configurable Parameters (Unresolved Operational Values)

None of the 12 core architectural decisions (`DEC-01`–`DEC-12`) remain unresolved. Only **4 operational numeric/mapping parameters** (`PARAM-01`–`PARAM-04` in `WMS_DECISION_REGISTER.md`) should be confirmed as configurable defaults in Phase 03 DDL/seeds rather than guessed:
1. **`PARAM-01` (`DEC-08` Threshold Value)**: Exact monetary/quantity cutoff separating Warehouse Manager vs. Factory Manager approval for adjustments (proposed as configurable `warehouse_settings` row, e.g., `adjustment_manager_max_value` + routing all `WRITE_OFF` unconditionally to Factory Manager).
2. **`PARAM-02` (`DEC-11` WAC Scope)**: Whether Weighted Average Cost is calculated **per material globally** (`materials.wac_cost`) or **per warehouse per material** (`warehouse_material_costs`). *(Affects `005` DDL tables/columns.)*
3. **`PARAM-03` (GRN Over-Receipt Tolerance)**: Whether `received_qty > expected_qty` is allowed within a % tolerance (`warehouse_settings`).
4. **`PARAM-04` (Warehouse User Assignment Table)**: Confirm mapping Warehouse Managers/Keepers via `warehouses.manager_id` + `warehouse_staff` table (parallel to `departments` + `department_employees`).

---

## 8. Architecture Compatibility Assessment

- **Compatible (`100%`)**: Cleanly extends GFMS v0.3 PostgreSQL relational DDL, `withTransaction`, `AuditService.log`, `authenticateJWT`, and existing React/Tailwind sub-tab module architecture.
- **Zero Regression Risk**: Keeps `DEP-INV`, `DepartmentModule`, `MyDepartmentPage`, `ProductionModule`, and all 42 existing automated tests untouched.
- **`pg-mem` Considerations Addressed**:
  - `schema_migrations` tracking table must be introduced in `database.ts` before applying `005_*` WMS migrations.
  - Unique constraints on `inventory_balances` must avoid PG15-only `NULLS NOT DISTINCT` and instead use a normalized non-null `lot_key` (or sentinel) compatible with both PostgreSQL 14+ and `pg-mem v3.0`.
  - Queries must avoid `LEFT JOIN` patterns on indexed FKs that trigger `pg-mem`'s `NotSupported: lookups on joins` bug, and Phase 03 must verify `SELECT ... FOR UPDATE` syntax parsing in `pg-mem`.

---

## 9. Phase 03 Readiness Recommendation

**Recommendation: READY FOR PHASE 03 (`Migration Infrastructure & Warehouse Database Schema Design`)**, subject to:
1. Explicit System Administrator sign-off on this consolidated Phase 02 documentation package; and
2. Confirming **`PARAM-02`** (Global SKU WAC vs. Per-Warehouse WAC) and **`PARAM-04`** (Warehouse Keeper/Manager assignment mapping) at the start of Phase 03 DDL design, as those two parameters directly shape `005_*` table definitions.

---
**STOPPING AT PHASE 02 FINALIZATION GATE.**  
No migrations, database tables, API endpoints, services, UI components, or permissions have been implemented. Awaiting explicit System Administrator approval to begin **Phase 03 – Migration Infrastructure & Warehouse Database Schema Design**.
