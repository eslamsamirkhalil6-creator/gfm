# GFMS v0.3 – Warehouse Management System (WMS)
## Final Role & Permission Matrix (`WMS_ROLE_PERMISSION_MATRIX.md`)

**Version:** Phase 07 Implemented & Hardened (`DEC-09: Option A – Dedicated Operational Roles`)  
**Seed Sources:** `005_seed_warehouse_data.sql`, `006_seed_rbac_role_clarification.sql`, `007_seed_phase07_rbac_hardening.sql`

---

## 1. Existing RBAC Baseline & Extension Strategy

### 1.1 Verified Architecture (`001`–`007` + `auth.middleware.ts`)
- **Model**: `users` ↔ `user_roles` ↔ `roles` ↔ `role_permissions` ↔ `permissions`.
- **Middleware**: `authenticateJWT` loads `roles`, `permissions`, `managed_department_ids`, `managed_warehouse_ids`, and `supervised_line_ids` live from PostgreSQL on every request, then routes enforce `requirePermission(...)`, `requireAnyPermission(...)`, `requireRole(...)`, `requireDepartmentScope(...)`, `requireWarehouseScope(...)`, and `requireProductionLineScope`.
- **Total Seeded Roles (12)**:
  1. `System Administrator` (ID `1`)
  2. `Factory Manager` (ID `2`)
  3. `Department User` (ID `3`)
  4. `Department Manager` (ID `4`)
  5. `Warehouse Manager` (`005`)
  6. `Warehouse Keeper` (`005`)
  7. `QC Manager` (`005`)
  8. `QC Inspector` (`005`)
  9. `Purchasing Manager` (`005`)
  10. `Production Manager` (`005`)
  11. `Finance Viewer` (`005`)
  12. `Department Planner` (`006`)

### 1.2 Mandatory RBAC Rules for WMS
1. **Extend, Do Not Replace**: All WMS permissions and roles live in `roles`, `permissions`, and `role_permissions`.
2. **Server-Side Enforcement**: All permissions, warehouse scopes, department scopes, line scopes, and maker-checker rules are enforced on backend routes and services—never UI-only hiding.
3. **System Administrator Boundary**: SysAdmin manages security, users, roles, permissions, warehouse master setup (`warehouse:create`, `warehouse:manage`), and global configuration; **routine operational approvals and stock movements (`inventory:receive`, `inventory:qc_inspect`, `inventory:issue`, `inventory:requisition:approve`, `inventory:adjust:approve*`, `inventory:reorder:approve`) are NOT granted** to SysAdmin.
4. **Maker-Checker Segregation**: No user may approve or finalize their own submitted Stock Adjustment or Write-Off (`submitted_by !== approved_by`, enforced in both service logic and SQL `CHECK`).
5. **Independent QC Authority & Hierarchy**: Only QC-authorized roles may release `QUARANTINE`/`HOLD` stock via `inventory:qc_inspect`; senior status overrides (`POST /api/warehouse/qc/override`) require `inventory:qc_override`, held exclusively by `QC Manager`.
6. **Global vs Scoped Warehouse Access (`hasGlobalWarehouseAccess`)**: Determined by permission and role boundary (`System Administrator`, `Factory Manager`, `Production Manager`, `Purchasing Manager`, `Finance Viewer`, `QC Manager`) rather than exposing unassigned warehouses to operational warehouse/QC line inspectors. `Warehouse Manager`, `Warehouse Keeper`, and `QC Inspector` are scoped strictly via active `warehouse_staff` / `warehouses.manager_id` records (`managed_warehouse_ids`).

---

## 2. Role & Responsibility Matrix (WMS & Core Operational Roles)

| Role | Seeded UAT Account | Read | Create | Update | Approve | Post / Execute | Reversal / Override | Scope Restrictions |
|---|---|---|---|---|---|---|---|---|
| **System Administrator** | `admin` / `Admin@123` | All users, roles, permissions, audit logs, system/warehouse configs, read-only WMS overview & valuation | Users, roles, permissions, **warehouses (`warehouse:create`)**, locations, materials, system policies | User status/roles, global `warehouse_settings`, warehouses/materials | **None operationally** *(Security & config admin only)* | Master setup only (not routine stock movements) | **None** | Global security & config scope; excluded from routine stock receiving/issuing/approvals and blocked from self-deactivation or removing last active admin. |
| **Factory Manager** | `manager` / `Manager@123` | All warehouses, stock balances, lots, movement ledger, WAC valuation, all requisitions, adjustments, reorders, alerts, planning (`planning:view`) | **Warehouses (`warehouse:create`)**, reorder requests, cycle count directives | Warehouse updates & status (`warehouse:create`), manager assignments | **Final approval** on: Reorder Requests (`DEC-10`), high-value Adjustments & all Write-Offs (`DEC-08`), cross-dept/emergency Requisitions, Transfer discrepancies | Post final-approved adjustments/reorders | Approve compensating reversal adjustments above Warehouse Manager threshold | Global operational factory scope; **cannot** manage user security/roles (`users:roles`), mutate planning schedules, or bypass independent QC quality rejections. |
| **Warehouse Manager** | `whmanager` / `Warehouse@123` *(WH-RAW, WH-TRIM)* | Assigned warehouses, bins, materials, lots, balances, ledger, requisitions, adjustments, counts, reorders, alerts, valuation | Bins/locations, materials/reorder levels, cycle count sheets, stock adjustments, reorder requests, transfers | Bins/locations, material metadata/reorder levels, draft GRNs/transfers/counts *(cannot create/deactivate global warehouses)* | **Within-threshold** non-write-off Stock Adjustments (`DEC-08`), Inter-warehouse transfer dispatches, **submit Reorder Requests (`DEC-10`)** | Post physical stock counts (within threshold), execute GRN/issue/transfer/return | Initiate & approve within-threshold compensating adjustment *(if maker ≠ checker)* | Strictly scoped to `managed_warehouse_ids` (`warehouse_staff`); blocked (`403`) from unassigned warehouses (`WH-FG`, `WH-WIP`), warehouse creation/status toggle, and self-approving own adjustments. |
| **Warehouse Keeper** | `whkeeper` / `Keeper@123` *(WH-RAW)* | Assigned warehouse stock, locations/bins, lots/rolls, approved requisitions, open transfers, scoped alerts *(valuation masked)* | Draft GRNs, put-away moves, stock issues (against `APPROVED` reqs), transfer dispatches, transfer receipts, material return receipts, FG receipts, physical count entries, adjustment proposals, reorder drafts | Unposted/draft GRNs, transfer drafts, open physical count entries | **None** *(strictly execution)* | **Post operational moves**: GRN receipt, Issue against approved Requisition, Internal Bin Move, Transfer Dispatch/Receipt, Return Receipt, FG Receipt | Propose adjustment draft (must be approved by Manager) | Strictly scoped to `managed_warehouse_ids` (`WH-RAW`); blocked (`403`) from unassigned warehouses, valuation endpoints, and any approvals. |
| **QC Manager** | `qcmanager` / `QcMgr@123` | Quarantine queues, `PENDING`/`HOLD` lots, GRN inspection lines, lot traceability, QC history | QC inspection records, senior QC override records | Lot `qc_status` & inspection remarks | **Independent Quality Authority** + **Senior QC Override (`inventory:qc_override`)** | Execute QC release (`QUARANTINE`/`HOLD` → `AVAILABLE` or `DAMAGED`/`SCRAP`) & audited senior overrides (`QCO-*`) | **`inventory:qc_override`**: Override `QUARANTINE`/`HOLD`/`DAMAGED` stock state with mandatory reason & audit trail | Global quality authority across warehouses; **cannot** issue stock to lines, alter physical count quantities, or view/modify financial valuation. |
| **QC Inspector** | `qcinspector` / `Qc@123` *(WH-RAW)* | Assigned warehouse quarantine queues, `PENDING`/`HOLD` lots, GRN inspection lines, QC history | QC inspection records (`inventory:qc_inspect`) | Lot `qc_status` & inspection remarks within scope | **Standard QC Inspection Release** *(within assigned warehouse(s))* | Execute GRN QC inspection (`QUARANTINE` → `AVAILABLE` / `DAMAGED` / `SCRAP`) | **None** *(blocked `403` from `/warehouse/qc/override`)* | Strictly scoped to `managed_warehouse_ids` (`WH-RAW`); blocked (`403`) from inspecting `WH-TRIM` or executing QC senior overrides. |
| **Purchasing Manager** | `purchasing` / `Purch@123` | Material catalog, low-stock alerts, Reorder Requests, GRN delivery/PO variance reports | PO reference annotations on Reorder Requests | Vendor, expected cost & PO reference fields on Reorder Requests | **Purchasing Review step** (`inventory:reorder:review`) on Reorder Requests (`DEC-10`) | Advance `SUBMITTED` Reorder Requests → `PURCHASING_REVIEWED` | Reject/return unviable Reorder Requests | Procurement boundary only; **cannot** post physical stock receipts/issues, move warehouse stock, approve stock write-offs, or alter QC status. |
| **Production Manager** | `prodmanager` / `ProdMgr@123` | Production halls/lines/workflows (`production:view`), material catalog & available stock summary, production requisitions | Production material requisitions | Draft production requisitions | **Approve Material Requisitions (`DEC-06`)** | Cancel unissued `APPROVED` requisitions | None | Read-only Production visibility (`production:view` without setup edit) + WMS requisition oversight; **cannot** receive supplier GRNs, move warehouse bins, post adjustments, or release QC quarantine. |
| **Department Manager** | `deptuser` / `Dept@123` *(DEP-CUT)* | Own managed department dashboard (`departments:scoped:view`), scoped planning view (`planning:view`), own dept requisitions, available catalog | Material requisitions for **own managed department(s)** | Own dept requisition drafts | **Approve Material Requisitions (`DEC-06`)** for **own managed department(s)** | Cancel unissued requisition belonging to **own managed department** | None | **Backend-enforced Department Scope** (`managed_department_ids`); `planning:view` is read-only and strictly scoped to managed departments (`DEP-CUT=200`, `DEP-PLAN=403`, schedule mutations `403`). |
| **Department Planner** | *(created per test/policy)* | Scoped department planning (`planning:view`) & scoped dept view (`departments:scoped:view`) | Planning schedules in **own managed department(s)** (`planning:manage`) | Planning schedules in **own managed department(s)** | None | Delete/manage planning schedules in **own department** | None | Strictly scoped to `DEP-PLAN` / managed planning department; zero WMS/Production/User access. |
| **Department User** | *(unprivileged floor account)* | Basic dashboard only (`dashboard:view`) | Line requisitions **only if explicitly assigned** as `production_lines.supervisor_id` | Own unsubmitted drafts (if line supervisor) | **None** | **None** | **None** | Zero automatic department dashboard or warehouse privileges even with department membership (`Test #79`). |
| **Finance Viewer** | `finance` / `Finance@123` | Read-only stock balances, movement ledger, WAC inventory valuation reports, reconciliation (`warehouse:reports:valuation`) | **None** | **None** *(strictly read-only)* | **None** | **None** | **None** | Strictly **read-only** across valuation & ledger views; zero create/update/post/delete capabilities anywhere in WMS. |

---

## 3. Implemented Permission Keys (`permissions` Table across `005` & `007`)

| Permission Key | Description | Assigned Roles (`005` + `007`) |
|---|---|---|
| `warehouse:view` | View warehouses, locations, stock balances, lots, and movement ledger | Admin, Factory Mgr, Warehouse Mgr, Warehouse Keeper, QC Mgr, QC Inspector, Purchasing Mgr, Production Mgr, Finance Viewer |
| `warehouse:create` | *(Phase 07)* Create and activate/deactivate physical warehouse master records | System Administrator, Factory Manager |
| `warehouse:manage` | Edit assigned warehouse details, bins/locations, and warehouse staff assignments | System Administrator, Factory Manager, Warehouse Manager *(scoped)* |
| `warehouse:materials:manage` | Create/edit material categories, SKUs, UOMs, attributes, QC flags, and reorder levels | System Administrator, Factory Manager, Warehouse Manager |
| `inventory:receive` | Create and post Goods Receipts (GRNs), put-away, and Finished Goods receipts | Warehouse Keeper, Warehouse Manager |
| `inventory:qc_inspect` | Perform QC inspection and transition `QUARANTINE`/`HOLD` → `AVAILABLE` or `DAMAGED`/`SCRAP` | QC Manager, QC Inspector *(scoped)* |
| `inventory:qc_override` | *(Phase 07)* Senior QC override (`POST /api/warehouse/qc/override`) with mandatory audit reason | QC Manager |
| `inventory:requisition:create` | Create and submit material requisitions | Dept Mgr (scoped), Production Mgr, Factory Mgr, Line Supervisors (via line scope) |
| `inventory:requisition:approve` | Approve/reject material requisitions (`DEC-06`) triggering stock reservation | Production Mgr, Dept Mgr (dept scope), Factory Mgr |
| `inventory:issue` | Pick and issue `AVAILABLE` stock against approved requisitions (incl. audited FIFO override) | Warehouse Keeper, Warehouse Manager |
| `inventory:return` | Receive & post returned surplus/damaged/waste materials from production | Warehouse Keeper, Warehouse Manager |
| `inventory:transfer` | Execute internal bin moves and inter-warehouse dispatch/receive (`DEC-07`) | Warehouse Keeper, Warehouse Manager |
| `inventory:count` | Create cycle count sheets and enter physical stock counts | Warehouse Manager, Warehouse Keeper |
| `inventory:adjust:propose` | Propose reason-coded stock adjustments / write-offs (`DEC-08`) | Warehouse Keeper, Warehouse Manager |
| `inventory:adjust:approve` | Approve stock adjustments within policy threshold (`DEC-08`, non-maker) | Warehouse Manager (within threshold), Factory Manager |
| `inventory:adjust:approve_high` | Approve high-value adjustments, write-offs, and unconfigured adjustments (`DEC-08`) | Factory Manager |
| `inventory:reorder:create` | Create and submit Reorder Requests (`DEC-10`) | Warehouse Keeper (draft), Warehouse Manager (submit) |
| `inventory:reorder:review` | Purchasing review of Reorder Requests & PO reference linkage (`DEC-10`) | Purchasing Manager |
| `inventory:reorder:approve` | Final approval of Reorder Requests (`DEC-10`) | Factory Manager |
| `warehouse:reports:valuation` | View WAC inventory valuation, ledger reconciliation, and financial summaries | System Administrator, Factory Manager, Warehouse Manager, Finance Viewer |
| `warehouse:settings:manage` | Configure global WMS policy thresholds (adjustment limit, tolerances, FIFO, transit limit) | System Administrator |

---

## 4. Phase 07 Resolution Status of Phase 02/06 Flags

All 5 implementation flags and Phase 06 RBAC/security findings (`CF-02`, `CF-03`, `CF-06`) are now implemented and verified in backend routes, services, and `runner.ts` (`#57–#89`):
1. `managed_warehouse_ids` & `supervised_line_ids` loaded live on every `authenticateJWT` call (`auth.middleware.ts`).
2. All 7 operational WMS roles + 7 standalone UAT user accounts (`005` + `007`) seeded with non-default operational separation.
3. Production Line Responsible Person scope enforced via `requireProductionLineScope` (`production_lines.supervisor_id`).
4. Numeric adjustment approval threshold evaluator (`adjustment_approval_threshold`, `UNCONFIGURED` default, `WRITE_OFF` Factory Manager lock) enforced via `WarehouseControlService` + DB `CHECK`.
5. `QC Manager` vs `QC Inspector` separated via `inventory:qc_override` + warehouse-scoped `QC Inspector` assignments (`warehouse_staff`).

