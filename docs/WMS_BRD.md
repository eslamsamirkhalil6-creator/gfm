# GFMS v0.3 – Warehouse Management System (WMS)
## Consolidated Business Requirements Document (`WMS_BRD.md`)

**Version:** Phase 02 Final Consolidated Specification  
**Status:** Ready for Phase 03 Schema & Migration Review (READ-ONLY — No Code Implemented)  
**Baseline System:** GFMS v0.3 (`database/migrations/001`–`004`, `backend/src`, `frontend/src`)

---

## 1. Executive Summary & Scope Boundaries

### 1.1 Verified Existing GFMS Baseline
The existing GFMS v0.3 codebase provides:
- **Foundation & Auth**: PostgreSQL (`pg` live TCP + `pg-mem v3.0` fallback), `bcryptjs`, JWT (`authenticateJWT`), granular `User → Roles → Permissions` RBAC, and append-only `audit_logs` (`AuditService.log`).
- **Production Setup**: `production_halls`, `production_lines` (with `supervisor_id` and `department_id`), `production_stages` (supporting independent `QUALITY` stage gates), `production_workflows`, and `production_settings`.
- **Department Management**: Hierarchical `departments` (`DEP-HR`, `DEP-PROD`, `DEP-INV` `#3`, `DEP-PUR` `#4`, `DEP-QC` `#5`, `DEP-FIN` `#6`, `DEP-SALES` `#7`, `DEP-TRANS` `#8`, `DEP-PLAN` `#9`, `DEP-IT`, plus `DEP-CUT`, `DEP-SEW`, `DEP-PCK`), `department_employees`, `department_manager_history`, and department-scoped `Department Manager` RBAC (`requireDepartmentScope`).

### 1.2 Approved WMS Scope Boundaries
- **Dedicated WMS Module**: Warehouse operations will be implemented as an independent module (`Warehouse` workspace, dedicated backend APIs, and normalized WMS database tables).
- **`DEP-INV` Preservation**: `departments` row `DEP-INV` (`id=3`) remains strictly an organizational department for staffing, roster, and HR hierarchy. Warehouse operations will not be overloaded onto `DepartmentModule` or `MyDepartmentPage`.
- **No Parallel Auth/Authz**: All WMS permissions and roles will extend GFMS's existing `roles`, `permissions`, `role_permissions`, and `authenticateJWT` middleware.
- **No Unapproved Out-of-Scope Rewrites**: Existing Production, Department, User, and Audit modules remain intact and backward-compatible. Purchasing, Planning/MRP, Quality Control AQL Execution, and Finance General Ledger are **not** built in this phase; WMS integrates cleanly via defined boundary contracts.

---

## 2. Mandatory Technical Clarifications (Authoritative Specification)

### 2.1 Immutable Inventory Movement Ledger (Not an Accounting GL)
- The WMS records an **immutable inventory movement history** (`stock_movements`) tied to transaction documents (`stock_transactions`).
- **Unique Reference**: Every posted movement has a unique transaction reference (`tx_number`) and movement sequence ID.
- **Mandatory Fields**: Every movement records item (`material_id`), lot/roll (`lot_id` when tracked), quantity (`> 0`), direction (`IN` / `OUT`), source & destination warehouse/location/stock-status context, `balance_before`, `balance_after`, `unit_cost` snapshot, `actor_id` (`created_by`), `created_at`, and business reference (`document_type`, `document_id`, `department_id`, `production_line_id`, `external_ref`).
- **Atomic Transfers**: Every transfer generates linked `OUT` (source) and `IN` (destination or `IN_TRANSIT`) movements committed atomically within the same transaction.
- **Strict Immutability**: Posted movements **cannot be edited or deleted**. Errors in posted documents must be corrected exclusively through compensating/reversal movements referencing the original transaction.
- **Single-Transaction Consistency**: Updates to `inventory_balances` and inserts to `stock_movements` (plus `audit_logs`) must always execute inside the same `withTransaction` database boundary.
- **Clarification**: This is an **operational perpetual inventory movement ledger**, **not** a complete financial/accounting Double-Entry General Ledger (no chart of accounts, AP/AR subledgers, or GL journal entries).

### 2.2 Goods Receiving Reconciliation Equation
Every Goods Receipt Note (**GRN**) line must enforce exact physical quantity accountability:

$$\text{Received} = \text{Accepted} + \text{Rejected} + \text{Damaged} + \text{PendingInspection}$$

- **Zero Unexplained Quantities**: System validation rejects posting/updating any GRN line whose breakdown does not equal `Received`.
- **Discrepancies**: Variances vs. `expected_qty` (shortages or over-deliveries) are explicitly recorded on the GRN line.
- **Partial Deliveries**: A PO/delivery reference may receive multiple partial GRNs over time without closing prematurely.
- **Preserved History**: Completed GRN headers, line breakdowns, and receiver identities are immutable once posted.
- **`PendingInspection` Handling & Anti-Double-Processing**:
  - For materials configured with `requires_qc_on_receipt = true`, incoming accepted-for-inspection quantities initially enter as `PendingInspection` (`stock_status = 'QUARANTINE'`, `qc_status = 'PENDING'`).
  - Each GRN/lot inspection action tracks `qty_inspected_passed`, `qty_inspected_rejected`, and `qty_pending_inspection` (derived/enforced atomically inside a transaction lock).
  - **Idempotency / No Double Acceptance or Rejection**: A quantity already transitioned out of `PendingInspection` cannot be accepted or rejected a second time (`requested_inspect_qty <= remaining_pending_qty` strictly enforced under transaction lock).

### 2.3 QC Status vs. Stock Status (Two Independent State Dimensions)
GFMS WMS strictly separates **Quality Status** (inspection outcome on a lot/receipt) from **Stock Status** (physical usability & custody bucket in `inventory_balances`):

| Dimension | Allowed States | Semantics & Governance |
|---|---|---|
| **QC Status** *(Quality Decision)* | `PENDING` · `PASSED` · `PARTIALLY_PASSED` · `REJECTED` | Records the outcome of QC inspection on a lot/GRN line. Controlled exclusively by authorized QC roles (`QC Inspector` / `QC Manager`), or auto-set to `PASSED` (or QC-exempt) when `requires_qc_on_receipt = false`. |
| **Stock Status** *(Inventory Custody Bucket)* | `AVAILABLE` · `QUARANTINE` · `HOLD` · `DAMAGED` · `SCRAP` · `IN_TRANSIT` | Governs what operations can touch the balance. **Only `AVAILABLE` stock may be reserved or issued to production.** |

- **Mixed Inspection Outcomes on a Single Lot**:
  - When a lot of `100 m` in `QUARANTINE` (`qc_status = 'PENDING'`) undergoes partial inspection—e.g., `70 m` passes and `30 m` fails:
    1. `70 m` moves atomically from `QUARANTINE` to `AVAILABLE` (posted as linked `OUT QUARANTINE` + `IN AVAILABLE` movements).
    2. `30 m` moves atomically from `QUARANTINE` to `DAMAGED` or `SCRAP` (or remains blocked from production) and **never** enters `AVAILABLE` automatically.
    3. The lot's `qc_status` updates to `PARTIALLY_PASSED`, recording `passed_qty = 70`, `rejected_qty = 30`, `pending_qty = 0`.
  - If only part of a lot has been inspected (`40 m` passed, `60 m` still awaiting inspection), `40 m` becomes `AVAILABLE`, `60 m` stays `QUARANTINE`, and the lot reflects partial inspection (`PARTIALLY_PASSED` or remaining `pending_qty = 60` until finalized).
- **Quarantine Release Authority**: Only users holding QC release permission (`inventory:qc_release`) may transition stock out of `QUARANTINE`. Warehouse Keepers cannot self-release quarantined material.

### 2.4 FIFO Picking vs. Weighted Average Cost Valuation (Independent Policies)
- **Physical Picking Policy = Advisory FIFO (`DEC-04`)**:
  - Pick lists sort eligible `AVAILABLE` lots/rolls oldest-first (`received_at ASC`, grouped by `shade_code` where applicable).
  - Warehouse Keepers may pick a non-FIFO lot/roll only with an explicit `fifo_override_reason_code` (and remarks), which is persisted on the issue transaction and logged to `audit_logs`.
- **Inventory Valuation Policy = Weighted Average Cost (`DEC-11`)**:
  - Valuation **never** switches to FIFO cost layers simply because picking uses FIFO order.
  - **Weighted Average Cost (WAC) Recalculation Policy**:
    - **Goods Receipt (GRN Acceptance / QC Release into Valued Stock)**:
      $$\text{New WAC} = \frac{(\text{Current Qty} \times \text{Current WAC}) + (\text{Incoming Qty} \times \text{Receipt Unit Cost})}{\text{Current Qty} + \text{Incoming Qty}}$$
      *(When `Current Qty = 0`, `New WAC = Receipt Unit Cost`. If receipt has `0` cost on non-priced/sample items, explicit handling applies without dividing by zero.)*
    - **Stock Issue to Production**: Valued at **current WAC**. Total value decreases by `issued_qty * current_WAC`; per-unit WAC remains unchanged.
    - **Material Return (Usable Surplus)**: Re-enters stock at the **original issue unit cost** (if linked to an issue movement) or **current WAC** (if unlinked), recalculating WAC smoothly without distorting unit cost. Damaged/scrap returns move to `DAMAGED`/`SCRAP` buckets without inflating `AVAILABLE` value.
    - **Warehouse Transfers (Dispatch / In-Transit / Receive)**: Preserves unit WAC across source → `IN_TRANSIT` → destination (total factory inventory value unchanged; transit discrepancy losses post via adjustment/write-off at current WAC).
    - **Stock Adjustments & Write-Offs**:
      - *Positive Adjustment (`ADJUSTMENT_IN`)*: Valued at current WAC (or verified unit cost if correcting a missed receipt), recalculating WAC if an explicit unit cost differs.
      - *Negative Adjustment / Write-Off (`ADJUSTMENT_OUT` / `WRITE_OFF`)*: Deducted at **current WAC**; per-unit WAC remains unchanged while total inventory value drops.

---

## 3. Functional Business Requirements (Consolidated & Classified)

*(All 12 `DEC-*` choices below are **Approved** in Phase 02; existing system behaviors are marked **Existing System Requirement**.)*

### 3.1 Warehouse Structure (`A`)
- **FR-WH-01 [Existing]**: Preserve `DEP-INV` (`id=3`) in `departments` as the organizational unit for warehouse personnel and manager reporting.
- **FR-WH-02 [Approved – DEC-01]**: Support multiple physical/logical warehouses (`warehouses`) with distinct types: `RAW_MATERIAL`, `FABRIC`, `TRIMS_ACCESSORIES`, `WIP`, `FINISHED_GOODS`, `QUARANTINE`, and `GENERAL`, optionally linked to a responsible `department_id` (`DEP-INV`) and `manager_id` (`users.id`).
- **FR-WH-03 [Approved – DEC-01]**: Each warehouse has a `require_bin_tracking` flag. Every warehouse auto-provisions a `DEFAULT` location on creation; bin-enabled warehouses support hierarchical storage locations (`zone`, `aisle`, `rack`, `bin`, `location_code`) typed as `RECEIVING`, `STORAGE`, `STAGING`, `QC_HOLD`, or `DISPATCH`.
- **FR-WH-04 [Existing Pattern]**: Warehouses and locations support `active`/`inactive` status; permanent deletion is blocked (`HTTP 409`) if referenced by any balance or movement history.

### 3.2 Material & Item Management (`B`)
- **FR-MAT-01 [Approved]**: Maintain `material_categories` (`FABRIC`, `TRIM_ACCESSORY`, `PACKAGING`, `FINISHED_GOOD`, `CONSUMABLE`) and `materials` identified by unique `sku` and `name`.
- **FR-MAT-02 [Approved – DEC-02]**: Define base `uom` per material (`meter`, `yard`, `kg`, `pcs`, `roll`, `cone`, `carton`, `set`) and support variable actual measured quantities per physical fabric roll rather than fixed pack sizes.
- **FR-MAT-03 [Approved – DEC-03]**: Store searchable core fields (`sku`, `name`, `category_id`, `base_uom`, `color`, `size`, `reorder_level`, `min_stock_level`, `is_lot_tracked`, `is_roll_tracked`, `requires_qc_on_receipt`, `wac_cost`) as relational columns, and extended garment attributes (`gsm`, `width`, `composition`, `shrinkage_pct`, `style_code`, `fabric_finish`) in `attributes_json`.
- **FR-MAT-04 [Approved]**: Deactivate unused materials (`status = 'inactive'`) without breaking historical stock records; prohibit hard delete once movements exist.

### 3.3 Lot, Batch & Roll Tracking (`C`)
- **FR-LOT-01 [Approved – DEC-02]**: Track fabric rolls and material dye-lots (`inventory_lots`) with `lot_number`, optional `roll_number`, `shade_code` / `shade_band`, `supplier_batch_ref`, `received_at`, `initial_qty`, and independent `qc_status` (`PENDING`, `PASSED`, `PARTIALLY_PASSED`, `REJECTED`).
- **FR-LOT-02 [Approved]**: Lot/roll tracking is governed per SKU (`is_lot_tracked`, `is_roll_tracked`) so fabrics enforce roll & dye-lot IDs while standard consumables remain lightweight.
- **FR-LOT-03 [Approved – DEC-04]**: Stock issuing presents lots sorted by FIFO (`received_at ASC`) with shade-group visibility; skipping an older lot requires a valid `fifo_override_reason` logged in `audit_logs`.
- **FR-LOT-04 [Approved]**: Maintain full end-to-end traceability from GRN receipt → `inventory_lots` → `inventory_balances` → `stock_movements` → production `department_id` / `production_line_id`.

### 3.4 Goods Receiving (`D`)
- **FR-RCV-01 [Approved]**: Record Goods Receipt Notes (`GRN`) referencing either an external supplier delivery note / PO reference (`po_reference`, `supplier_name`, `delivery_note_no`) or a future Purchasing PO ID (`nullable`).
- **FR-RCV-02 [Approved]**: Enforce exact line-level reconciliation (`Received = Accepted + Rejected + Damaged + PendingInspection`), partial deliveries across multiple GRNs, and immutable GRN history.
- **FR-RCV-03 [Approved – DEC-05]**: Route accepted receipt quantities to `QUARANTINE` (`PendingInspection`) when `requires_qc_on_receipt = true`, or directly to `AVAILABLE` when `false`. Put-away assigns target storage `location_id`.

### 3.5 Inventory & Stock Control (`E`)
- **FR-INV-01 [Approved]**: Track real-time balances (`inventory_balances`) across `(warehouse_id, location_id, material_id, lot_id/lot_key, stock_status)` with `qty_on_hand`, `qty_reserved`, and derived `qty_available = qty_on_hand - qty_reserved`.
- **FR-INV-02 [Approved]**: Enforce `qty_on_hand >= 0`, `qty_reserved >= 0`, and `qty_reserved <= qty_on_hand` in both service transaction logic and database `CHECK` constraints—**negative inventory is strictly prohibited**.
- **FR-INV-03 [Approved]**: Persist every stock change as an immutable `stock_movements` record committed inside the same `withTransaction` block as `inventory_balances`.

### 3.6 Material Requests, Issuing & Returns (`F`)
- **FR-ISS-01 [Approved – DEC-06]**: Authorized production/department personnel submit `material_requisitions` specifying `department_id` (`DEP-CUT`, `DEP-SEW`, `DEP-PCK`, etc.), optional `production_line_id`, and requested SKU quantities.
- **FR-ISS-02 [Approved – DEC-06]**: Requisitions require Manager approval (`APPROVED`) before stock is reserved (`qty_reserved`) and released to the Warehouse pick queue; support partial and complete issuing (`PARTIALLY_ISSUED`, `FULFILLED`).
- **FR-ISS-03 [Approved]**: Support **Material Returns** (`USABLE_SURPLUS`), **Production Waste/Scrap** (`WASTE_SCRAP`), and **Damaged Returns** (`DAMAGED`) back from departments/lines, preserving lot traceability and routing damaged/waste quantities away from `AVAILABLE` stock.

### 3.7 Warehouse Transfers (`G`)
- **FR-TRF-01 [Approved]**: Internal bin-to-bin transfers within the same warehouse execute atomically in a single step (`OUT` source bin + `IN` destination bin).
- **FR-TRF-02 [Approved – DEC-07]**: Inter-warehouse transfers follow a 2-step custody lifecycle:
  1. **Dispatch**: Deducts `AVAILABLE` stock at source warehouse and adds to `IN_TRANSIT` (`OUT` source + `IN` in-transit).
  2. **Receive**: Confirms arrival at destination warehouse (`OUT` in-transit + `IN` destination `AVAILABLE`), or explicitly records arrival shortages/transit damage (`DISCREPANCY` / `DAMAGED` / escalation to adjustment/claim).

### 3.8 Stock Adjustments & Physical Counting (`H`)
- **FR-ADJ-01 [Approved]**: Support Cycle Counts and Full Physical Counts capturing frozen `system_qty` snapshot vs. physical `counted_qty` per bin/lot, computing variances without altering stock until approved.
- **FR-ADJ-02 [Approved – DEC-08]**: Support reason-coded Adjustments (`CYCLE_COUNT_GAIN`, `CYCLE_COUNT_LOSS`, `DAMAGED`, `SHRINKAGE`, `DATA_CORRECTION`, `WRITE_OFF`) with **mandatory maker-checker segregation** and threshold-based approval (Warehouse Manager up to policy threshold; Factory Manager above threshold and for write-offs).

### 3.9 Quality Control Integration (`I`)
- **FR-QC-01 [Existing + Approved – DEC-05]**: Preserve QC's independent compliance authority (`DEP-QC`, `STG-QC`). Only authorized QC roles may inspect `PENDING` lots and release `QUARANTINE`/`HOLD` balances to `AVAILABLE` or reject them to `DAMAGED`/`SCRAP`.

### 3.10 Purchasing & Finished Goods Integration (`J`)
- **FR-PUR-01 [Approved – DEC-10]**: Automatically or manually generate `reorder_requests` when `available_qty <= reorder_level`, routing through `Warehouse Manager → Purchasing Manager → Factory Manager`.
- **FR-FG-01 [Approved]**: Support **Finished Goods Receiving** from `DEP-PCK` / `production_lines` into `FINISHED_GOODS` warehouses upon packing completion and final QC sign-off.

### 3.11 Reporting & Notifications (`K`)
- **FR-RPT-01 [Approved – DEC-11, DEC-12]**: Provide Stock On-Hand/Available, WAC Inventory Valuation, Movement Ledger, Low-Stock/Reorder, Lot Aging, Production Consumption, and Warehouse Performance/Queue reports alongside in-app notification feeds for operational alerts and pending approvals.

---

## 4. Database Portability & Concurrency Constraints (PostgreSQL & `pg-mem`)

Because GFMS v0.3 runs against both live **PostgreSQL 14+** and **`pg-mem v3.0`**:
1. **Nullable `lot_id` Uniqueness**: PostgreSQL treats `NULL != NULL` in standard `UNIQUE` indices. Rather than relying on PG 15+ `UNIQUE NULLS NOT DISTINCT` (unsupported in older PG / `pg-mem`), Phase 03 must use a deterministic surrogate key (e.g., `lot_key VARCHAR` / `lot_id INTEGER DEFAULT 0` or normalized sentinel) so non-lot-tracked items never produce duplicate balance rows.
2. **Transaction & Locking Parity**: All stock mutations must execute via `withTransaction` (`backend/src/config/database.ts`), using `SELECT ... FOR UPDATE` on live PostgreSQL (evaluated carefully for `pg-mem` compatibility during Phase 03) and serialized transaction queuing (`memoryTxQueue`) on `pg-mem`.
3. **Migration Tracking**: Phase 03 must introduce a `schema_migrations` table in `initDatabase()` so `005_*`+ WMS migrations run deterministically without breaking existing `001`–`004` installations.
