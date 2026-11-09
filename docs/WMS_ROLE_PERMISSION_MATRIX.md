# GFMS v0.3 – Warehouse Management System (WMS)
## Final Role & Permission Matrix (`WMS_ROLE_PERMISSION_MATRIX.md`)

**Version:** Phase 02 Final Consolidation (`DEC-09: Option A – Dedicated Operational Roles`)  
**Mode:** Read-Only Documentation — No RBAC Seeds or Middleware Modified Yet

---

## 1. Existing RBAC Baseline & Extension Strategy

### 1.1 Verified Existing Architecture (`001`–`004` + `auth.middleware.ts`)
- **Model**: `users` ↔ `user_roles` ↔ `roles` ↔ `role_permissions` ↔ `permissions`.
- **Middleware**: `authenticateJWT` loads `roles`, `permissions`, and `managed_department_ids` live from PostgreSQL on every request, then routes enforce `requirePermission(...)`, `requireRole(...)`, `requireDepartmentScope(...)`, and `requireDepartmentTargetScope`.
- **Existing Seeded Roles (4)**:
  1. `System Administrator` (ID `1`)
  2. `Factory Manager` (ID `2`)
  3. `Department User` (ID `3`)
  4. `Department Manager` (ID `4`)

### 1.2 Mandatory RBAC Rules for WMS
1. **Extend, Do Not Replace**: All WMS permissions and roles will be added strictly to `roles`, `permissions`, and `role_permissions`.
2. **Server-Side Enforcement**: All permissions, warehouse scopes, department scopes, line scopes, and maker-checker rules are enforced on backend routes and services—never UI-only hiding.
3. **System Administrator Boundary**: SysAdmin manages security, users, roles, permissions, and global configuration; **operational approval rights (QC release, adjustments, reorders, requisitions) are NOT granted automatically** to SysAdmin unless explicitly needed as an audited emergency/admin override policy.
4. **Maker-Checker Segregation**: No user may approve or finalize their own submitted Stock Adjustment or Write-Off (`submitted_by !== approved_by`).
5. **Independent QC Authority**: Only QC-authorized roles may release `QUARANTINE` / `HOLD` stock to `AVAILABLE` or reject lots.

---

## 2. Role & Responsibility Matrix (All 11 Roles)

| Role | Exists in GFMS? | Read | Create | Update | Approve | Post / Execute | Reversal / Compensating Tx | Scope Restrictions |
|---|---|---|---|---|---|---|---|---|
| **System Administrator** | **Yes** (ID 1) | All users, roles, permissions, audit logs, system/warehouse configs, read-only WMS overview | Users, roles, permissions, warehouses (setup), system policies | User status/roles, global `warehouse_settings` & approval thresholds | **None automatically** *(Security & config admin only; operational approvals restricted to operational roles)* | Master setup only (not routine stock movements) | **None** *(cannot silently alter ledger; emergency admin override only if policy explicitly allows & audited)* | Global security & config scope; excluded from routine operational approvals & cannot modify/delete `audit_logs` or posted `stock_movements`. |
| **Factory Manager** | **Yes** (ID 2) | All warehouses, stock balances, lots, movement ledger, WAC valuation, all requisitions, adjustments, reorders, alerts | Reorder requests, cycle count directives | Warehouse manager assignments (within policy) | **Final approval** on: Reorder Requests (`DEC-10`), high-value Adjustments & all Write-Offs (`DEC-08`), cross-dept/emergency Requisitions, Transfer discrepancy write-offs | Post final-approved adjustments/reorders | Approve/authorize compensating reversal adjustments above Warehouse Manager threshold | Global operational factory scope; **cannot** manage user security/roles (`users:roles`), delete audit logs, or bypass independent QC quality rejections. |
| **Warehouse Manager** | **No** *(New – DEC-09)* | Assigned/managed warehouses, bins, materials, lots, balances, ledger, requisitions, adjustments, counts, reorders, alerts | Warehouses/locations (within scope), materials/reorder levels, cycle count plans, stock adjustments, reorder requests, transfers | Bins/locations, material reorder levels, draft GRNs/transfers/counts | Requisition pick priority, **small/within-threshold** Stock Adjustments (`DEC-08`), Inter-warehouse transfer dispatches, **submit/initial-approve Reorder Requests (`DEC-10`)** | Post physical stock counts (within threshold), execute GRN/issue/transfer/return if needed, lock/hold stock (`HOLD`) | Initiate & approve within-threshold compensating adjustment/reversal *(if maker ≠ checker)* | Scoped to assigned warehouse(s) (`warehouse_scope`) unless granted global warehouse permission; **cannot** release `QUARANTINE` (QC only) or self-approve own adjustments. |
| **Warehouse Keeper** *(Storekeeper)* | **No** *(New – DEC-09)* | Assigned warehouse stock, locations/bins, lots/rolls, approved requisitions, open transfers, own alerts | Draft GRNs, put-away moves, stock issues (against `APPROVED` reqs), transfer dispatches, transfer receipts, material return receipts, FG receipts, physical count entries, adjustment proposals | Unposted/draft GRNs, transfer drafts, open physical count entries | **None** *(strictly execution; cannot approve adjustments, write-offs, requisitions, reorders, or QC releases)* | **Post operational moves**: GRN receipt (into `QUARANTINE` or `AVAILABLE` per `DEC-05`), Put-Away, Issue against approved Requisition, Internal Bin Move, Transfer Dispatch/Receipt, Return Receipt, FG Receipt | Propose compensating adjustment/return draft (must be approved by Manager before posting) | Strictly scoped to assigned warehouse(s); **cannot** issue non-`AVAILABLE` stock, adjust stock without approval, or edit valuation/cost rules. |
| **QC Manager / QC Inspector** | **No** *(New – DEC-09)* | Quarantine queues, `PENDING`/`HOLD` lots, GRN inspection lines, lot traceability, QC history | QC inspection records, quality hold placements (`HOLD`) | Lot `qc_status` (`PENDING`, `PASSED`, `PARTIALLY_PASSED`, `REJECTED`) & inspection remarks | **Independent Quality Authority**: Approve/Reject QC Release (`QUARANTINE`/`HOLD` → `AVAILABLE` or `DAMAGED`/`SCRAP`) | Execute QC status transitions & split mixed-outcome lots (`stock_movements` status move) | Reverse an erroneous `HOLD` to `AVAILABLE` (logged); rejected/damaged reversals require QC Manager + Audit | Independent quality scope across receiving/quarantine/held stock; **cannot** issue stock to lines, alter physical count quantities, or change WAC unit costs. |
| **Purchasing Manager** | **No** *(New – DEC-09)* | Material catalog, low-stock alerts, Reorder Requests, GRN delivery/PO variance reports | Supplier/PO reference annotations on Reorder Requests & inbound schedules | Vendor, expected cost, lead-time & PO reference fields on Reorder Requests | **Purchasing Review step** on Reorder Requests (`DEC-10`: validates sourcing before Factory Manager approval) | Advance `SUBMITTED` Reorder Requests → `PURCHASING_REVIEWED` & record external `po_reference` post-approval | Cancel/close unfulfilled Reorder Requests before GRN receipt | Procurement boundary only; **cannot** post physical stock receipts/issues, move warehouse stock, approve stock write-offs, or alter QC status. |
| **Production Manager** | **No** *(New – DEC-09)* | Material catalog & available stock summary (read-only), all production requisitions (`DEP-CUT`, `DEP-SEW`, `DEP-PCK`), consumption by dept/line, FG handover status | Production material requisitions, material return requests, FG handover notices | Draft production requisitions | **Approve Material Requisitions (`DEC-06`)** across production departments (reserving eligible `AVAILABLE` stock) | Submit FG handover to FG Warehouse; confirm production receipt | Cancel unissued `APPROVED` requisitions (releasing `qty_reserved`) | Production domain scope (`DEP-PROD` & sub-departments); **cannot** receive supplier GRNs, move warehouse bins, post adjustments, or release QC quarantine. |
| **Department Manager** *(e.g. `DEP-CUT`, `DEP-SEW`, `DEP-PCK`)* | **Yes** (ID 4, Scoped) | Own managed department's requisitions, issued history, returns, read-only available material catalog | Material requisitions & material return requests for **own managed department(s)** | Draft requisitions & return requests for **own department** | **Approve Material Requisitions (`DEC-06`)** for **own managed department(s)** | Confirm departmental handover receipt; submit material returns | Cancel unissued requisition belonging to **own managed department** | **Backend-enforced Department Scope** (`departments.manager_id = req.user.id`); blocked (`403`) from other departments' requests and all warehouse internal stock operations. |
| **Production Line Responsible Person** *(Line Supervisor)* | **Partial** *(via `production_lines.supervisor_id`)* | Assigned production line(s) requisitions, issued rolls/trims, return history, read-only material availability | Draft Material Requisitions & Return Requests for **assigned production line(s)** | Own unsubmitted drafts (`DRAFT`) | **None** *(requires Dept/Production Manager approval per `DEC-06`)* | Acknowledge physical handover receipt at line; submit draft requisition/return | Cancel own `DRAFT` requisition before approval | **Backend-enforced Line Scope** (`production_lines.supervisor_id = req.user.id`); blocked (`403`) from unassigned lines, approvals, warehouse bins, and cost data. |
| **Department User** | **Yes** (ID 3) | Basic dashboard & read-only assigned station view (or read-only dept requisition status if explicitly granted) | **None** *(unless explicitly assigned as Line Responsible Person)* | **None** | **None** | **None** | **None** | Strictly constrained station/department user scope (`dashboard:view` baseline); zero warehouse mutation rights. |
| **Finance Viewer** | **No** *(New – DEC-09)* | Read-only stock balances, movement ledger, WAC inventory valuation reports, GRN cost summaries, write-off/adjustment reports | **None** | **None** *(strictly read-only)* | **None** *(optional advisory audit visibility only; operational approvals stay with Factory Manager per `DEC-08`)* | **None** | **None** | Strictly **read-only** across valuation & ledger views; zero create/update/post/delete capabilities anywhere in WMS. |

---

## 3. Proposed Permission Keys (Mapping to Existing `permissions` Table)

> **Status**: Proposed for Phase 03/04 seeding (not yet created in DB).

| Permission Key | Description | Primary Assigned Roles |
|---|---|---|
| `warehouse:view` | View warehouses, locations, stock balances, lots, and movement ledger | Admin (view), Factory Mgr, Warehouse Mgr, Warehouse Keeper, QC, Production Mgr, Finance Viewer |
| `warehouse:manage` | Create/edit warehouses, storage locations/bins, and warehouse settings | Admin (setup), Warehouse Mgr (scoped) |
| `warehouse:materials:manage` | Create/edit material categories, SKUs, UOMs, attributes, and reorder levels | Admin, Warehouse Mgr |
| `inventory:receive` | Create and post Goods Receipts (GRNs), put-away, and Finished Goods receipts | Warehouse Keeper, Warehouse Mgr |
| `inventory:qc_inspect` | Perform QC inspection and transition `QUARANTINE`/`HOLD` → `AVAILABLE` or `DAMAGED`/`SCRAP` | QC Manager, QC Inspector |
| `inventory:requisition:create` | Create and submit material requisitions and material return requests | Dept Mgr (scoped), Production Mgr, Line Responsible (scoped) |
| `inventory:requisition:approve` | Approve/reject material requisitions (`DEC-06`) triggering stock reservation | Production Mgr (production scope), Dept Mgr (dept scope), Factory Mgr |
| `inventory:issue` | Pick and issue `AVAILABLE` stock against approved requisitions (incl. audited FIFO override) | Warehouse Keeper, Warehouse Mgr |
| `inventory:return` | Receive & post returned surplus/damaged/waste materials from production | Warehouse Keeper, Warehouse Mgr |
| `inventory:transfer` | Execute internal bin moves and inter-warehouse dispatch/receive (`DEC-07`) | Warehouse Keeper, Warehouse Mgr |
| `inventory:count` | Create cycle count sheets and enter physical stock counts | Warehouse Mgr (create), Warehouse Keeper (count) |
| `inventory:adjust:propose` | Propose reason-coded stock adjustments / write-offs (`DEC-08`) | Warehouse Keeper, Warehouse Mgr |
| `inventory:adjust:approve` | Approve stock adjustments within policy threshold (`DEC-08`) | Warehouse Mgr (within threshold, non-maker), Factory Mgr |
| `inventory:adjust:approve_high` | Approve high-value adjustments, write-offs, and reversals above threshold (`DEC-08`) | Factory Manager |
| `inventory:reorder:create` | Create and submit Reorder Requests (`DEC-10`) | Warehouse Keeper (draft), Warehouse Mgr (submit) |
| `inventory:reorder:review` | Purchasing review of Reorder Requests & PO reference linkage (`DEC-10`) | Purchasing Manager |
| `inventory:reorder:approve` | Final approval of Reorder Requests (`DEC-10`) | Factory Manager |
| `warehouse:reports:valuation` | View WAC inventory valuation and financial stock summaries | Factory Mgr, Warehouse Mgr, Finance Viewer, Admin |
| `warehouse:settings:manage` | Configure global WMS thresholds (adjustment limit, tolerances) | System Administrator |

---

## 4. Verification Flags Against Existing GFMS Permission Architecture

The following **5 implementation gaps** exist between the current `001`–`004` middleware/schema and the finalized Role Matrix above and **must be built in Phase 03/04** (without breaking existing `auth.middleware.ts`):

1. **Missing Warehouse & Line Scope Arrays on `req.user`**:
   - *Current Code (`auth.middleware.ts:107-123`)*: `authenticateJWT` only queries `departments WHERE manager_id = $1` to populate `managed_department_ids`.
   - *Required Extension*: Phase 04 must also load `managed_warehouse_ids` (for Warehouse Manager / Keeper scope) and `supervised_line_ids` (`SELECT id FROM production_lines WHERE supervisor_id = $1`) so backend middleware can enforce Warehouse Scope and Production Line Responsible Person Scope (`Rule 8 & Rule 9`).
2. **Unseeded Operational Roles (`DEC-09`)**:
   - *Current DB (`001` & `004`)*: Only 4 roles exist (`System Administrator`, `Factory Manager`, `Department User`, `Department Manager`).
   - *Required Extension*: Seed the new operational roles (`Warehouse Manager`, `Warehouse Keeper`, `QC Manager`, `QC Inspector`, `Purchasing Manager`, `Production Manager`, `Finance Viewer`) cleanly in Phase 03/04 without altering existing user accounts.
3. **Production Line Responsible Person Role Mapping**:
   - *Current Schema (`002`)*: `production_lines.supervisor_id` links directly to `users.id` (used by `manager` and `deptuser`), without a separate `"Production Line Supervisor"` role.
   - *Flagged Clarification*: Either create a dedicated role or authorize `Department User` / `Department Manager` accounts that appear in `production_lines.supervisor_id = req.user.id` via a new `requireProductionLineScope` middleware.
4. **Threshold Policy Engine for `DEC-08`**:
   - *Current System*: `production_settings` stores flat key-value settings; no numeric approval-threshold evaluator exists yet.
   - *Required Extension*: Add `warehouse_settings` (e.g., `adjustment_manager_max_value` / `adjustment_manager_max_qty`) and service-level enforcement checking `submitted_by !== req.user.id` plus threshold routing.
5. **QC Inspector vs. QC Manager Split**:
   - *Flagged Note*: In small factories, `QC Manager` and `QC Inspector` may share `inventory:qc_inspect`, or `QC Manager` may hold an extra reversal/override permission (`inventory:qc_override`). Both fit cleanly into existing `role_permissions` without changing auth architecture.
