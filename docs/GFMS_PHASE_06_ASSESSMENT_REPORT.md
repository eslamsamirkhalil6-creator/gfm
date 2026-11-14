# GFMS System-Wide Assessment Report (Phase 06)

**Project:** Garment Factory Management System (GFMS)  
**Assessment Scope:** Full-Stack Repository Technical, Functional, Security, Integration & Readiness Audit  
**Execution Mode:** Read-Only Architectural & Operational Assessment (No Source, Schema, RBAC, or UI Modifications)  
**Current Repository Baseline:** v0.3 Backend + v0.2 Frontend (`6` SQL migrations, `6` SQL seeds, `41` schema tables, `79` in-memory integration tests)

---

## 1. Executive Summary

The Garment Factory Management System (GFMS) has evolved through multiple phases into a **functionally uneven platform** whose database and backend capabilities significantly outpace its user interface and cross-module operational workflows.

At its foundation, GFMS possesses a strong relational data model (**41 schema tables**, **12 RBAC roles**, **46 seeded permissions**) and a comprehensive, transaction-safe **Warehouse Management System (WMS)** backend (**24 tables**, **55+ REST endpoints**, immutable ledger engine, Weighted Average Cost accounting, bin enforcement, QC quarantine, and 3-tier reorder workflows). Furthermore, recent defect remediation and RBAC clarifications resolved cross-department employee transfer authorization, stripped inappropriate department-manager scopes from `System Administrator`, separated `Department User` from `Department Manager`, and introduced scoped `Department Planner` workflows.

However, **GFMS is not yet an integrated factory platform or production-ready system**. Five decisive systemic gaps block end-to-end garment manufacturing operations:

1. **Zero Warehouse UI (100% Headless Backend):** Despite 24 tables and 55+ REST endpoints in `backend/src/modules/warehouse/`, `frontend/src/` contains **zero pages, components, navigation tabs, or `ApiService` client methods** for Warehouse & Inventory Management. Factory staff cannot receive fabric rolls, perform QC inspections, issue requisitions, or count stock through the browser.
2. **Production Is Configuration-Only (Missing Execution Engine):** The `production` module manages facility topology (`production_halls`, `production_lines`, `production_stages`, `production_workflows`, `production_settings`), not actual manufacturing execution. There are no Styles/BOMs, Production/Work Orders, Cutting lays/bundles, WIP movement tracking, or automated Finished Goods handover into WMS.
3. **Unimplemented Core Factory Domains:** **Purchasing & Suppliers** (`suppliers`, POs), **Quality Control execution** (inline/endline sewing audits, AQL 2.5 sampling, workflow quality gates), **HR & Employee Evaluation**, **Sales/Buyer Orders**, **Finance Ledger**, and **Transportation/Logistics** exist primarily as rows in `departments` (`DEP-PUR`, `DEP-QC`, `DEP-HR`, `DEP-SALES`, `DEP-FIN`, `DEP-TRANS`) or isolated permission stubs rather than working modules.
4. **High/Critical Security, API Standardization & Transaction Hygiene Gaps:** `backend/src/config/env.ts` ships a hardcoded fallback `JWT_SECRET` and wildcard `CORS_ORIGIN`; `/api/auth/login` lacks rate limiting; `WarehouseMasterService.markNotificationRead` contains a cross-user/cross-scope IDOR defect; `DepartmentController`/`DepartmentService` still return legacy `{ success, message }` error envelopes and throw bare `Error` objects without `.statusCode`; and multiple multi-step service writes (`assignManager`, `removeEmployee`, `deleteDepartment`, `reorderWorkflowSteps`, `createUser`, `updateUserRoles`) run outside `withTransaction`.
5. **Verification Environment Gap:** All **79** automated backend tests pass (`runner.ts`), **exclusively against in-memory `pg-mem v3.0`**. Live PostgreSQL triggers (`trg_stock_movements_immutable`), true MVCC row-lock contention (`FOR UPDATE`), and headless browser E2E UI flows are **Not Verified**.

**Overall Verdict:** Strong architectural and WMS backend core, **Incomplete / Non-Integrated** as an operational factory suite, and **Not Ready for Production Deployment** until security hardening, Warehouse UI delivery, and Purchasing/Production execution links are built.

---

## 2. Current System Architecture

### 2.1 Technology Stack & Runtime Topology
- **Backend Runtime:** Node.js + TypeScript + Express (`backend/src/server.ts:1-20`, `backend/src/app.ts:1-29`). Express mounts `helmet`, `cors` (defaulting to `CORS_ORIGIN || '*'`), JSON parsing (`1mb` limit), `/api` router (`backend/src/routes/index.ts`), and global `errorHandler`/`notFoundHandler` (`backend/src/middleware/error.middleware.ts`).
- **Frontend SPA:** React 19 + TypeScript + Vite + Tailwind CSS (`frontend/src/`). Navigation is **state-driven** via `ActiveTab` in `frontend/src/App.tsx` and `frontend/src/components/Navbar.tsx:19` (`dashboard | production | departments | my-department | planning | users | audit | diagnostics | architecture`) rather than URL routing (`react-router`), which limits deep-linking and bookmarkable entity views.
- **Database Dual-Mode Adapter:** `backend/src/config/database.ts:53-97` checks `DATABASE_URL`; if absent or in test mode, it initializes an in-memory **`pg-mem v3.0`** database (`database.ts:62-97`).
- **Transaction Engine Split (`database.ts:129-185`):**
  - **PostgreSQL Mode:** Uses dedicated `PoolClient` with `BEGIN` / `COMMIT` / `ROLLBACK`.
  - **pg-mem Mode:** Serializes transactions through an async `memoryTxQueue` promise chain (`database.ts:129-145`) using `memDb.backup()` / `.restore()` snapshots and re-attaching JS immutability listeners (`onBeforeChange`/`onTruncate`) after rollbacks (`database.ts:174-182`, `migrations.ts:63-86`).
- **Migration Runner:** Custom tracked SQL migration & seed runner (`backend/src/config/migrations.ts:1-447`) maintaining `schema_migrations` (`migrations.ts:236-243`) and executing numbered files from `database/migrations/` (`001`–`006`) and `database/seeds/` (`001`–`006`).
- **Authentication & Authorization:** Stateless JWT (`jsonwebtoken`, default `8h` expiry, `backend/src/modules/auth/auth.service.ts`) verified by `authenticateJWT` (`backend/src/middleware/auth.middleware.ts`), combined with PostgreSQL RBAC (`roles`, `permissions`, `user_roles`, `role_permissions`) and multi-dimensional scope middleware (`requireDepartmentScope`, `requireDepartmentTargetScope`, `requireWarehouseScope`, `requireRequisitionScope`, `requirePlanningScope`).

### 2.2 Schema & API Footprint
| Layer | Verified Inventory | Location |
|---|---|---|
| Migrations | 6 files (`001`–`006`) | `database/migrations/` |
| Seeds | 6 files (`001`–`006`) | `database/seeds/` |
| Total Tables | **41** (`40` domain/RBAC tables + `schema_migrations`) | `001`–`006` + `migrations.ts:236` |
| Seeded Roles | **12** roles | `001`, `004`, `005`, `006` seeds |
| Seeded Permissions | **46** granular permission keys | `001`–`006` seeds |
| API Modules | `health`, `auth`, `users`, `audit`, `production`, `departments`, `planning`, `warehouse`, `tests` | `backend/src/routes/index.ts`, `warehouse.routes.ts`, `planning.routes.ts` |
| Automated Tests | **79** integration assertions (`pg-mem`) / **0** frontend tests | `backend/src/tests/runner.ts` |

---

## 3. Module-by-Module Assessment

| Module | Status Classification | Summary of Actual State | Key Evidence |
|---|---|---|---|
| **Authentication & Session Management** | **Partially Complete** | JWT login/logout/me and bcrypt (`10` salt rounds) function cleanly, and disabled users are blocked at login and JWT check. Lacks brute-force rate limiting, refresh/revocation store, password complexity policy, self-service password reset, and rejects production startup without strong `JWT_SECRET`. | `backend/src/config/env.ts:16,19`, `backend/src/routes/index.ts:27`, `backend/src/modules/auth/auth.service.ts:21-88` |
| **RBAC, Users & Audit Trail** | **Partially Complete** | 12 roles, 46 permissions, scoped access controls, and append-only `audit_logs` exist with Admin UI (`UsersManagementPage.tsx`, `AuditLogsPage.tsx`). Missing transactional safety in `createUser`/`updateUserRoles`, self-deactivation/last-admin guard, and raw `parseInt` param validation. Operational roles (WMS/QC/Purchasing/Production Mgr/Finance) lack seeded test accounts. | `backend/src/modules/users/user.service.ts:57-242`, `user.controller.ts:40,68`, `database/seeds/005_seed_warehouse_data.sql:6-13` |
| **Department Management & Hierarchy** | **Complete** *(with Legacy Tech Debt)* | Full department hierarchy (`parent_id`), circular cycle detection, manager tenure history (`department_manager_history`), atomic cross-department transfer (`withTransaction` + dual-scope auth), deletion guards, and scoped `MyDepartmentPage.tsx` manager workspace. Legacy controller error envelope inconsistency and non-transactional manager/employee single operations remain. | `backend/src/modules/departments/department.service.ts:21-45,708-1026`, `department.controller.ts:56-269`, `frontend/src/pages/MyDepartmentPage.tsx` |
| **Production Setup & Operations** | **Incomplete** | Setup-only topology (`production_halls`, `production_lines`, `production_stages`, `production_workflows`, `production_workflow_steps`, `production_settings`) with Admin/Factory Manager UI (`ProductionModule.tsx`). **Zero execution entities**: no Styles, BOMs, Work Orders, Cutting lays/bundles, Sewing WIP, daily output, bypass QC signoff runtime enforcement, or Packing-to-WMS handover. | `database/migrations/002_create_production_tables.sql:6-76`, `backend/src/modules/production/production.service.ts:968-986`, `frontend/src/pages/production/ProductionModule.tsx:17-111` |
| **Central Warehouse & Inventory (WMS)** | **Blocked by Dependencies** *(Backend Complete / Frontend 0%)* | Robust 24-table, 55+ endpoint WMS backend: immutable `stock_movements`, `FOR UPDATE` locking, Global WAC valuation, configurable bins vs `DEFAULT`, GRN 0% tolerance, QC quarantine, reservations, advisory FIFO + override, returns cap, 2-step transfers, cycle counts & escalation, 3-tier reorder. **Blocked** by **0% frontend UI**, missing PO master linkage, notification IDOR bug, and over-broad `GLOBAL_WAREHOUSE_ROLES`. | `backend/src/modules/warehouse/warehouse.routes.ts:20-481`, `inventory-engine.service.ts:157-531`, `warehouse-master.service.ts:1144-1159`, `frontend/src/App.tsx:19`, `frontend/src/services/api.ts:1-622` |
| **Production Planning & Control (PPC)** | **Incomplete** *(Minimal Prototype)* | Provides single-table `department_planning_schedules` CRUD scoped to `Department Planner` and read-only `Factory Manager` (`planning.routes.ts`, `PlanningPage.tsx`). Missing buyer order intake, BOM material explosion, MRP availability checks against `inventory_balances`, and real production work-order scheduling. | `database/migrations/006_rbac_role_clarification.sql`, `backend/src/modules/planning/planning.service.ts:53-348`, `frontend/src/pages/PlanningPage.tsx` |
| **Purchasing & Suppliers** | **Incomplete** *(Stub Only)* | Only `DEP-PUR` department row, `Purchasing Manager` role (`inventory:reorder:review`), and free-text `po_reference` strings in `goods_receipts`/`reorder_requests` exist. No `suppliers` table, RFQs, Purchase Orders, pricing contracts, or `LINKED_TO_PO` status transition API. | `database/seeds/003_seed_department_data.sql:29`, `005_seed_warehouse_data.sql:11`, `database/migrations/005_create_warehouse_tables.sql:189,468-471` |
| **Quality Control (QC)** | **Incomplete** *(WMS Quarantine Only)* | Supports warehouse GRN & Finished Goods `qc_inspections` (`QUARANTINE -> AVAILABLE / REJECTED`) on the backend. No shop-floor inline/endline sewing QC, AQL 2.5 sampling plans, defect taxonomy, rework tracking, or runtime enforcement of `production_workflow_steps.quality_gate`. | `backend/src/modules/warehouse/warehouse-inbound.service.ts:565-824`, `database/seeds/002_seed_production_data.sql:58,77-78` |
| **HR & Employee Evaluation** | **Incomplete** *(Stub Only)* | Only `DEP-HR` department row and `department_employees` user-to-department mapping exist. No `HR` role, employee HR master profiles, attendance/shifts, skills matrix, piece-rate wage logic, or periodic performance evaluation module. | `database/seeds/003_seed_department_data.sql:26`, `database/migrations/003_create_department_tables.sql` |
| **Sales/Orders, Finance & Transportation** | **Incomplete** *(Stubs Only)* | `DEP-SALES`, `DEP-FIN`, `DEP-TRANS` exist solely as rows in `departments`, plus `Finance Viewer` read-only WMS valuation permission. Zero schemas, APIs, or UIs for customer orders, export shipments, vehicle dispatch, or factory cost accounting. | `database/seeds/003_seed_department_data.sql:31-33`, `005_seed_warehouse_data.sql:13,125-129` |
| **Dashboard, Diagnostics & Observability** | **Requires Architectural Review** | Functional health check and 79-test diagnostics page (`DiagnosticsPage.tsx`), but `Navbar.tsx` and `DashboardPage.tsx` display **stale v0.1/v0.2 copy** (`v0.2 Production Setup`, `Across 3 prototype roles`, `37/37 Passed`, static `4 Lines Ready` card, `Phase 2` placeholder cards) and omit Planning/Warehouse operational KPIs. | `frontend/src/components/Navbar.tsx:53`, `frontend/src/pages/DashboardPage.tsx:238-245,383,408-473` |

---

## 4. Cross-Module Integration Assessment

```
[Clients/Sales] (Missing)
       |  (No Buyer Order / Style / BOM entity)
       v
[Planning (PPC)] ----X (No MRP stock check) ----> [Warehouse / WMS Backend]
  (Schedule CRUD only)                              ^         |
                                                    |         | (Requisition / Issue / Return)
[Purchasing/Suppliers] (Missing)                    |         v
  (No Suppliers/POs; po_reference is free text) --->|    [Production Lines / Cutting / Sewing / Packing]
                                                    |      (Setup-only; no Work Orders / WIP / FG trigger)
                                                    |<----X (receiveFinishedGoods has no Packing caller)
[Quality Control]
  |-- GRN/FG Quarantine (Backend exists in WMS, no UI)
  '-- Inline Sewing QC & Workflow quality_gate (Missing; production_settings bypass keys unused)

[Departments & HR]
  '-- Cross-module dependency: departments.id & production_lines.department_id & supervisor_id link correctly,
      but no HR/Employee evaluation or Attendance links to line productivity.
```

### 4.1 Working Integration Seams
1. **Departments ↔ Production Lines:** `production_lines.department_id` links sewing, cutting, and packing lines to `DEP-SEW`, `DEP-CUT`, `DEP-PCK` (`003_seed_department_data.sql:45-47`). Department Managers see their department lines on `MyDepartmentPage.tsx`, and `requireRequisitionScope` validates department or line supervisor ownership (`auth.middleware.ts:624-735`).
2. **Departments ↔ Planning:** `department_planning_schedules.department_id` and `production_line_id` validate foreign keys and ensure chosen lines belong to the target department (`planning.service.ts:196-214`).
3. **Production Lines ↔ WMS Outbound:** `material_requisitions` and `stock_issues` reference `department_id` and `production_line_id` (`005_create_warehouse_tables.sql:233-269`), enforcing active line/department integrity at requisition creation (`warehouse-outbound.service.ts`).
4. **Departments ↔ Warehouses:** Seeded warehouses (`WH-RAW`, `WH-TRIM`, `WH-FG`, `WH-QUAR`) link to `DEP-INV` (`id = 3`) (`005_seed_warehouse_data.sql:140-144`).

### 4.2 Broken, Partial, or Missing Integration Seams
1. **Frontend ↔ Warehouse API Total Disconnect:** `frontend/src/services/api.ts` (622 lines) has **zero** methods calling any of the 55+ routes in `warehouse.routes.ts`. The entire WMS backend is unreachable via UI.
2. **Purchasing ↔ WMS Inbound Disconnect:** `goods_receipts.po_reference` (`005:189`) and `reorder_requests.po_reference` (`005:468`) store unvalidated strings. Furthermore, `reorder_requests.status` allows `'LINKED_TO_PO'` (`005:471`), yet **no backend endpoint or service method transitions a reorder request to `LINKED_TO_PO`** (`warehouse-control.service.ts:1222-1457`).
3. **Production Execution ↔ WMS Finished Goods Disconnect:** `WarehouseInboundService.receiveFinishedGoods` exists in the WMS backend, but because `production` lacks Work Orders and Packing Carton confirmation flows, no Packing module invokes FG receipt.
4. **Planning ↔ Inventory/MRP Disconnect:** `PlanningService` (`planning.service.ts`) never queries `inventory_balances` or `materials`; planners cannot verify fabric/trim availability before activating `department_planning_schedules`.
5. **Production Settings ↔ Runtime Behavior Disconnect:** `production_settings` seeds `'allow_stage_bypass' = 'false'` and `'require_qc_signoff_to_bypass' = 'true'` (`002_seed_production_data.sql:77-78`), but no backend code enforces stage transitions or QC signoff because there is no execution state machine.
6. **API Contract & Error Envelope Inconsistency:** `warehouse` and `planning` return standardized `{ success: false, error: { code, message } }`, whereas `DepartmentController` (`department.controller.ts:56,71,86,113,138,159,189,214,249,269`) returns `{ success: false, message }` and `DepartmentService` (`186,678,717,724,960,986,993`) throws bare `new Error(...)` without `.statusCode`, turning client 404/409/400 business errors into HTTP 500 responses.

---

## 5. RBAC & User Role Assessment

GFMS currently seeds **12 roles** and **46 permissions**, plus dynamic line-supervisor checks. Several role definitions, scope helpers, and permission assignments deviate from intended garment factory segregation of duties:

| Role | Seeded / Current Scope | Assessment & Discrepancies |
|---|---|---|
| **System Administrator** (`admin`) | User/Role/Audit CRUD, Production setup+settings, Department admin+hierarchy, WMS view/manage/materials/valuation/settings. Stripped of `departments:scoped:*` and `planning:*` in `006`. | **Good separation** on departments/planning/operational WMS approvals. However, relies on global bypass flags in middleware if custom roles are combined; cannot inspect `planning` UI (intentional). |
| **Factory Manager** (`manager`) | `dashboard:view`, `dashboard:factory`, `users:read`, Production config (excl. settings:manage), Dept view/edit/managers/employees/reports, `planning:view` (read-only), WMS view/manage/materials/req:approve/adjust:approve+high/reorder:create+approve/valuation. | **Appropriate oversight**. Has both operational dept/line management and approval authority without impersonating `Department Manager` or `Department Planner`. |
| **Department Manager** (`deptuser` -> `DEP-CUT`) | `dashboard:view`, `departments:scoped:view/manage`, `warehouse:view`, `inventory:requisition:create/approve`. | **Gap 1:** `Department Manager` lacks `planning:view`, preventing managers from viewing planning schedules for their own department (`006_seed_rbac_role_clarification.sql` only mapped `planning:view` to `Department Planner` and `Factory Manager`). **Gap 2:** `DEP-PCK` has `manager_id = NULL` (`003_seed:42`). |
| **Department Planner** (`planner` -> `DEP-PLAN`) | `dashboard:view`, `planning:view`, `planning:manage`. | Cleanly separated from `Department Manager` in `006`. Missing read-only `warehouse:view` / material stock check capability needed for real MRP planning. |
| **Department User** (`deptstaff` -> `DEP-CUT`) | `dashboard:view` only. | **Correctly fixed** in `006`: membership in `department_employees` grants zero dashboard management or department API access. |
| **Production Manager** *(no seeded login user)* | `dashboard:view`, `warehouse:view`, `inventory:requisition:create/approve` (`005_seed_warehouse_data.sql:110-114`). | **Defect:** Has **ZERO `production:*` permissions** (`production:view`, `production:lines:manage`, etc. missing!), making the Production UI tab invisible to `Production Manager`. Furthermore, `@manager` (Sarah Jenkins) holds `Factory Manager` rather than `Production Manager`. |
| **Warehouse Manager** *(no seeded login user)* | WMS management, execution, within-threshold adjustments, reorder creation, valuation (`005:63-77`). | Properly scoped by `warehouse_staff`/`warehouses.manager_id` (`requireWarehouseScope`), **but zero sample user seeded** and **zero UI built**. |
| **Warehouse Keeper** *(no seeded login user)* | WMS execution (`receive`, `issue`, `return`, `transfer`, `count`, `adjust:propose`, `reorder:create`), no approvals (`005:80-90`). | Strong maker/checker split on backend; **no seeded user / no UI**. |
| **QC Manager & QC Inspector** *(no seeded login users)* | Both have identical permissions: `dashboard:view`, `warehouse:view`, `inventory:qc_inspect` (`005:93-100`). | **Defect 1:** `QC Manager` has zero extra permissions over `QC Inspector` (no override, AQL approval, or production QC gate permission). **Defect 2:** Both appear in `GLOBAL_WAREHOUSE_ROLES` (`auth.middleware.ts:512-513`), bypassing `warehouse_staff` scoping even though `warehouse_staff.staff_role` explicitly defines `'QC_INSPECTOR'` (`005_create_warehouse_tables.sql:55`). |
| **Purchasing Manager** *(no seeded login user)* | `dashboard:view`, `warehouse:view`, `inventory:reorder:review` (`005:103-107`). | Can only review WMS reorder requests; no supplier/PO permissions exist because Purchasing module is unbuilt. Also included in `GLOBAL_WAREHOUSE_ROLES`. |
| **Finance Viewer** *(no seeded login user)* | `dashboard:view`, `warehouse:view`, `warehouse:reports:valuation` (`005:125-129`). | Correctly read-only for valuation, but bypasses `warehouse_staff` (`VIEWER`) scope via `GLOBAL_WAREHOUSE_ROLES` (`auth.middleware.ts:511`). |
| **HR / HR Manager** | **Role Does Not Exist.** | Missing entirely from `roles` and `permissions`. |
| **Production Line Supervisor** | Dynamic check via `production_lines.supervisor_id` inside `requireRequisitionScope` (`auth.middleware.ts:699-717`). | Only evaluated on WMS requisitions; no dedicated role or UI view for supervisors on shop-floor lines. |

### Critical RBAC Middleware Structural Observation
`GLOBAL_WAREHOUSE_ROLES` (`backend/src/middleware/auth.middleware.ts:506-514`) grants warehouse-scope bypass to 7 roles (`System Administrator`, `Factory Manager`, `Production Manager`, `Purchasing Manager`, `Finance Viewer`, `QC Manager`, `QC Inspector`). In addition to ignoring per-warehouse `warehouse_staff` assignments for `QC_INSPECTOR`/`VIEWER`, any future role assignment combining one of those roles with a scoped permission would unexpectedly bypass `requireWarehouseScope`. Authorization should check explicit global-read/global-manage **permissions** rather than broad role-name whitelists.

---

## 6. Business Workflow Assessment

| Factory Workflow | End-to-End Readiness | Verified Operational Capabilities | Missing Operational Links |
|---|---|---|---|
| **Employee Management** | **45% (Org Assignment Only)** | Assign/remove users to departments, multi-dept secondary assignments, atomic scoped cross-dept transfers, primary manager tenure history (`departments` module). | HR onboarding profiles, shifts, wages, skills matrix, emergency contacts, termination/offboarding workflow. |
| **Employee Evaluation** | **0% (Not Implemented)** | None. | Piece-rate/SMV efficiency capture, defect attribution, supervisor KPI reviews, scoring cycles. |
| **Cutting** | **10% (Topology Only)** | `DEP-CUT` department, `LINE-CUT-01` line, `STG-CUT` stage, `@deptuser` Dept Manager account, raw material requisition API in WMS backend. | Marker/lay planning, fabric roll issue scanning, bundle ticket generation, cut-panel QC, cut-to-sewing handover. |
| **Production Operations** | **15% (Topology Only)** | Halls, lines, stages, workflows, workflow step ordering, settings keys (`production` module). | Style master, BOM, Work Orders, batch/bundle tracking across workflow steps, hourly/daily line output logs, downtime tracking. |
| **Packing** | **10% (Topology Only)** | `DEP-PCK` (currently **has no manager assigned**), `LINE-FIN-01`, `STG-PCK`, and backend `receiveFinishedGoods` WMS hook. | Carton assortment/packing lists, metal detection/barcode verification, automated FG carton transfer to `WH-FG`. |
| **Central Warehouse (WMS)** | **55% (Backend 95% / Frontend 0%)** | Full backend API & ledger engine: GRN, QC quarantine, bins/DEFAULT, reservations, FIFO + override, returns cap, 2-step transfers, counts, thresholded adjustments, 3-tier reorder, WAC valuation. | **Complete Frontend UI**, PO master linkage, pagination/idempotency on endpoints, notification ownership fix. |
| **Production Planning** | **20% (Basic CRUD)** | Create/view/update status of `department_planning_schedules` bound to dept & line (`PlanningPage.tsx`). | Buyer order demand intake, BOM material explosion, real-time WMS stock reservation/MRP check, capacity load vs work orders. |
| **Purchasing** | **5% (Reorder Review Only)** | `Purchasing Manager` can review WMS `reorder_requests` via backend API (`INV_REORDER_REVIEW`). | Purchase Requisition conversion, RFQ/quotes, Purchase Order creation/approval, `LINKED_TO_PO` transition API. |
| **Suppliers** | **0% (Not Implemented)** | Free-text `supplier_name` on `goods_receipts` (`005:188`) and `preferred_supplier` on `materials` (`005:86`). | Supplier directory, vendor ratings, payment/lead-time terms, price history. |
| **Transportation** | **0% (Not Implemented)** | Only `DEP-TRANS` row in `departments` (`003_seed:33`). | Vehicle dispatch, gate passes, inter-facility transit manifests, export container/bill-of-lading tracking. |
| **Quality Control** | **25% (WMS Quarantine API Only)** | Backend GRN & FG quarantine inspection (`PASS`/`PARTIAL`/`FAIL`) moving stock out of `QUARANTINE` to `AVAILABLE`/`REJECTED`. | Frontend QC UI, inline/endline sewing inspection, AQL 2.5 calculator, defect codes, workflow `quality_gate` blocking. |
| **Approvals** | **50% (Split Backend Patterns)** | Requisition approval, adjustment threshold/write-off escalation, and 3-tier reorder approval exist cleanly in WMS backend. | No UI approval inbox/queue for Factory Manager, Dept Manager, Purchasing Manager, or QC Manager; no Purchasing/HR/Stage-bypass approvals. |
| **Notifications & Alerts** | **20% (WMS DB Table Only)** | `warehouse_notifications` table (`005:483-502`) triggered on low-stock reorder events and read/list API in `WarehouseMasterService`. | **Critical IDOR bug** on `markNotificationRead`; no frontend notification bell/toast/drawer; no alerts for planning, QC, transfers, or approvals. |

---

## 7. Database & Data Integrity Assessment

### 7.1 Schema Strengths
- **41 Normalized Tables** across `001`–`006` with explicit `CHECK` constraints, `UNIQUE` indexes (e.g., partial unique index enforcing one `DEFAULT` bin per warehouse in `005:38`), `FOREIGN KEY` constraints (`ON DELETE RESTRICT` on ledger-critical dimensions, `ON DELETE CASCADE` on child lines), and `NUMERIC(14,4)` / `NUMERIC(14,6)` fixed-precision decimal columns for quantities and WAC costs.
- **Immutable Event Ledgers:** `audit_logs` (`001`) and `stock_movements` (`005`) prevent mutation/deletion via dual enforcement: PostgreSQL PL/pgSQL `BEFORE UPDATE OR DELETE` trigger (`migrations.ts:92-116`) and pg-mem hooks (`migrations.ts:63-86`).
- **Row-Level Concurrency Design in WMS:** `InventoryEngineService` (`inventory-engine.service.ts:157-304`) executes balance deductions, ledger inserts, and WAC recalculations inside `withTransaction` using deterministic `SELECT ... FOR UPDATE` ordering to prevent deadlocks and negative stock races.

### 7.2 Integrity Risks & Gaps
1. **Non-Transactional Multi-Step Writes Outside WMS:**
   - `DepartmentService`: `assignManager` (`708-769`), `removeEmployee` (`948-973`), `deleteDepartment` (`979-1024`), `updateDepartment` (`655`), and `toggleDepartmentStatus` (`692`) perform primary DML + history/employee/audit writes in separate auto-committed statements instead of `withTransaction`.
   - `ProductionService.reorderWorkflowSteps` (`968-986`): executes `DELETE FROM production_workflow_steps WHERE workflow_id = $1` followed by sequential `INSERT`s **without a transaction**; a mid-loop error destroys all steps of the workflow.
   - `UserService.createUser` (`57-120`) and `updateUserRoles` (`175-242`): execute user insert / `DELETE FROM user_roles` + `INSERT` loop + audit writes outside `withTransaction`.
2. **pg-mem vs. Live PostgreSQL Parity Risk:**
   - Because automated tests run solely on `pg-mem`, PostgreSQL-specific behaviors — PL/pgSQL trigger compilation/execution (`trg_stock_movements_immutable`), true concurrent transaction lock contention (`FOR UPDATE`), `NUMERIC(14,4)` rounding/casting edge cases, and `ON CONFLICT` plan behavior — remain **Not Verified** on live PostgreSQL 14+.
   - Compatibility workarounds such as `l.department_id + 0 IN (...)` (`planning.service.ts:102-103`) exist specifically to appease `pg-mem`'s SQL AST quirks.
3. **Missing Optimistic Concurrency & Idempotency:** Document tables (`goods_receipts`, `material_requisitions`, `warehouse_transfers`, `stock_counts`, `stock_adjustments`, `reorder_requests`, `department_planning_schedules`) lack a `version` column or `Idempotency-Key` guard for double-submit protection on POST/PUT transitions.
4. **Unbounded Query Sets & Missing Pagination:** Most WMS list endpoints (`listGrns`, `listRequisitions`, `listTransfers`, `queryBalances`, `listWarehouseNotifications`) and `PlanningService` return unpaginated arrays (`warehouse.controller.ts`), risking memory/UI degradation under real factory transaction volumes.

---

## 8. Testing & Quality Assessment

| Dimension | Current State | Verification Level | Evidence |
|---|---|---|---|
| **Backend Automated Tests** | **79/79 passing** across 8 categories (Foundation #1–8, Production #9–15, Departments #16–23, Scoped RBAC #24–37, Defect Remediation #38–42, WMS Schema #43–56, WMS APIs/Engine #57–74, RBAC Role Clarification #75–79). | Verified in `pg-mem` | `backend/src/tests/runner.ts` (`4,551` lines) |
| **Live PostgreSQL Verification** | DDL, triggers (`trg_stock_movements_immutable`), real PG pool locks, `FOR UPDATE` race conditions under parallel HTTP load. | **Not Verified** | No CI or test script runs against live PG instance |
| **Frontend Automated Tests** | Zero unit, component, or E2E browser tests (`*.test.*`, `*.spec.*`, Vitest, Jest, Playwright absent). | **Not Verified** | `frontend/` directory inspection |
| **Static TypeScript Check** | Backend and frontend `tsc --noEmit` compile cleanly (`lint_applet`). | Verified | `package.json` scripts |
| **Test Runner Isolation Caveat** | Tests live in one monolithic 4,551-line sequential script sharing a single `pg-mem` lifecycle rather than isolated unit/integration test suites (`Vitest`/`Jest`). | Verified | `backend/src/tests/runner.ts:1-4551` |

---

## 9. Technical Debt & Risk Assessment

| Severity | Count | Summary |
|---|---|---|
| **Critical** | **4** | (1) Zero Frontend UI for 24-table WMS backend; (2) Hardcoded fallback `JWT_SECRET` & wildcard CORS; (3) Cross-user/cross-scope IDOR on `markNotificationRead`; (4) Live PostgreSQL triggers & concurrency completely **Not Verified**. |
| **High** | **6** | (1) `Production` module has no Work Orders/Execution engine; (2) Missing login rate limiting & lockout; (3) Non-transactional `DELETE+INSERT` in `reorderWorkflowSteps` & `updateUserRoles` + non-transactional `DepartmentService`/`UserService` ops; (4) `GLOBAL_WAREHOUSE_ROLES` over-broad scope bypass + `QC Manager` identical to `QC Inspector` + `Production Manager` missing `production:view`; (5) `DepartmentController`/`Service` legacy error envelope & raw `Error` HTTP 500 mapping; (6) Purchasing/PO missing (`LINKED_TO_PO` dead status). |
| **Medium** | **5** | (1) Stale v0.1/v0.2 labels & hardcoded `37/37` test count in UI (`Navbar.tsx`, `DashboardPage.tsx`); (2) Unvalidated raw `parseInt(req.params.id, 10)` in `UserController`/`ProductionController`; (3) Unpaginated WMS/Planning list endpoints; (4) Missing optimistic locking / `Idempotency-Key`; (5) Zero frontend automated tests & monolithic 4,551-line `runner.ts`. |
| **Low** | **3** | (1) `pg-mem` SQL workarounds (`+ 0` in `planning.service.ts:102-103`); (2) `DEP-PCK` seeded with `manager_id = NULL`; (3) State-driven `ActiveTab` navigation limits deep-linking to specific receipts/requisitions/orders. |

---

## 10. Critical Findings (Evidence-Backed Ledger)

### CF-01: Complete Absence of Warehouse Management Frontend UI
- **Description:** The entire Phase 04 WMS backend (`24` tables, `55+` routes) has zero UI implementation and zero client API integration.
- **Repository Evidence:** `frontend/src/App.tsx:1-135`, `frontend/src/components/Navbar.tsx:19` (`ActiveTab` union omits `warehouse`/`inventory`), `frontend/src/services/api.ts:1-622` (no `/warehouses` or `/inventory` calls), `frontend/src/pages/` directory contains no `warehouse/` folder.
- **Affected Module:** Central Warehouse / WMS + Frontend SPA.
- **Business Impact:** Warehouse Managers, Keepers, QC Inspectors, Purchasing Managers, and Finance Viewers have no operational workspace to run receiving, QC quarantine, picking, stock counts, or valuation reports.
- **Technical Impact:** 55+ backend routes remain exercised only by `pg-mem` automated scripts; no UI validation or usability feedback exists.
- **Severity:** **Critical**
- **Recommended Action:** Build the WMS React workspace (`WarehouseModule`) wired to `/api/warehouses*` and `/api/inventory*` and add seeded sample users for WMS/QC/Purchasing/Finance testing.

### CF-02: Insecure Default `JWT_SECRET`, Wildcard CORS, and Missing Auth Rate Limiting
- **Description:** Production startup does not enforce a strong `JWT_SECRET`, CORS allows `'*'`, and `POST /api/auth/login` has no brute-force throttling or failed-attempt lockout.
- **Repository Evidence:** `backend/src/config/env.ts:16` (`JWT_SECRET: process.env.JWT_SECRET || 'gfms-super-secret-jwt-key-2026-production-prototype'`), `env.ts:19` (`CORS_ORIGIN: process.env.CORS_ORIGIN || '*'`), `backend/src/routes/index.ts:27` (`apiRouter.post('/auth/login', ...)`).
- **Affected Module:** Core Platform Security / Auth.
- **Business Impact:** Predictable token forgery risk in misconfigured deployments; credential-stuffing vulnerability on factory accounts.
- **Technical Impact:** Any deployment omitting `JWT_SECRET` signs valid admin JWTs with a publicly committed repository string.
- **Severity:** **Critical**
- **Recommended Action:** Fail startup when `NODE_ENV === 'production'` and `JWT_SECRET` is unset/default; enforce explicit `CORS_ORIGIN`; add `express-rate-limit` on `/api/auth/login`.

### CF-03: Authorization Bypass (IDOR) & Non-Transactional Audit in Warehouse Notifications
- **Description:** `WarehouseMasterService.markNotificationRead` marks any notification ID as read without verifying `recipient_user_id`, `target_role_name`, or `warehouse_id` ownership, and logs audit outside a transaction.
- **Repository Evidence:** `backend/src/modules/warehouse/warehouse-master.service.ts:1144-1159` (`UPDATE warehouse_notifications SET is_read = TRUE ... WHERE id = $1` with zero recipient/scope predicate), `warehouse.routes.ts:466-470`.
- **Affected Module:** WMS Notifications.
- **Business Impact:** Any user with `warehouse:view` can silently dismiss alerts intended for Factory Managers, Purchasing Managers, or other warehouses.
- **Technical Impact:** Cross-tenant/cross-role state tampering.
- **Severity:** **Critical**
- **Recommended Action:** Enforce ownership/role/warehouse scope filtering inside `markNotificationRead` matching `listWarehouseNotifications`, wrap update + audit in `withTransaction`, and return 403/404 on mismatch.

### CF-04: Live PostgreSQL Triggers, Row Locking & Concurrency Not Verified
- **Description:** All 79 tests execute solely against `pg-mem v3.0`. Real PostgreSQL 14+ triggers (`trg_stock_movements_immutable`), real MVCC `SELECT ... FOR UPDATE` contention, and pool error recovery have not been executed.
- **Repository Evidence:** `backend/src/config/database.ts:53-97,129-185`, `backend/src/config/migrations.ts:63-116`, `backend/src/tests/runner.ts:6-50`.
- **Affected Module:** Database & Persistence Layer (System-Wide).
- **Business Impact:** Risk of runtime SQL syntax mismatches, trigger failures, or deadlock/race bugs surfacing only at factory go-live.
- **Technical Impact:** **Not Verified** behavior on target production database engine.
- **Severity:** **Critical**
- **Recommended Action:** Execute full migration, trigger immutability, and parallel concurrency load tests against a real PostgreSQL 14+ instance before any production release.

### CF-05: Missing Production Execution, Purchasing/PO, and Quality Control Modules
- **Description:** `production` manages facility configuration only (`production_halls`, `lines`, `stages`, `workflows`); `purchasing` has no `suppliers` or `purchase_orders` (`LINKED_TO_PO` has no endpoint); `QC` has no inline/endline sewing QA; `planning` has no BOM/MRP check.
- **Repository Evidence:** `database/migrations/002_create_production_tables.sql:6-76`, `005_create_warehouse_tables.sql:189,468-471`, `006_rbac_role_clarification.sql:9-27`, `frontend/src/pages/production/ProductionModule.tsx:17-111`.
- **Affected Module:** Production, Planning, Purchasing, QC, WMS Cross-Module Links.
- **Business Impact:** Factory cannot execute an actual garment order from Customer PO -> MRP -> Procurement PO -> Cutting -> Sewing -> Inline QC -> Packing -> Export.
- **Technical Impact:** Disconnected islands instead of an integrated ERP/MES workflow.
- **Severity:** **High**
- **Recommended Action:** Sequence Purchasing (`Phase 08`) and Production Execution + MRP/QC (`Phases 09–10`) immediately after hardening & WMS UI completion (`Phase 07`).

### CF-06: RBAC Scope & Role Permission Misalignments
- **Description:** (a) `Production Manager` lacks `production:view` and all `production:*` permissions; (b) `QC Manager` has zero additional permissions over `QC Inspector`; (c) `GLOBAL_WAREHOUSE_ROLES` bypasses `warehouse_staff` scoping for `QC Inspector`, `Finance Viewer`, and `Purchasing Manager`; (d) `Department Manager` lacks `planning:view`; (e) No `HR` role exists.
- **Repository Evidence:** `database/seeds/005_seed_warehouse_data.sql:92-115`, `006_seed_rbac_role_clarification.sql:16-26`, `backend/src/middleware/auth.middleware.ts:506-518`.
- **Affected Module:** RBAC / Authorization Layer.
- **Business Impact:** `Production Manager` cannot open the Production screen; `QC Inspector` can view/inspect warehouses they are not staffed to; Department Managers cannot view departmental planning.
- **Technical Impact:** Role-name allowlists bypass fine-grained warehouse assignments.
- **Severity:** **High**
- **Recommended Action:** Replace `GLOBAL_WAREHOUSE_ROLES` role-name bypasses with explicit global permissions, align `Production Manager`, `QC Manager`, and `Department Manager` permission mappings, and seed sample accounts for operational roles.

### CF-07: Non-Transactional Multi-Step Service Operations & Legacy API Error Contracts
- **Description:** `ProductionService.reorderWorkflowSteps` executes `DELETE` + `INSERT` loop without `withTransaction`; `DepartmentService` (`assignManager`, `removeEmployee`, `deleteDepartment`, `updateDepartment`, `toggleDepartmentStatus`) and `UserService` (`createUser`, `updateUserRoles`) mutate without `withTransaction`; `DepartmentController`/`Service` omit `.statusCode` and use non-standard `{ success, message }` errors.
- **Repository Evidence:** `backend/src/modules/production/production.service.ts:968-986`, `backend/src/modules/departments/department.service.ts:186,655-1024`, `department.controller.ts:56-269`, `backend/src/modules/users/user.service.ts:57-242`.
- **Affected Module:** Production, Departments, Users.
- **Business Impact:** Partial workflow deletion on step reorder error; orphan audit/state mismatches; HTTP 500 returned to frontend instead of actionable 400/404/409 validation messages.
- **Technical Impact:** Violates GFMS API Standards (`docs/GFMS_API_STANDARDS.md`) and ACID atomicity.
- **Severity:** **High**
- **Recommended Action:** Wrap all multi-step mutations in `withTransaction`, add `parsePositiveIntId` helpers, and migrate `DepartmentController`/`DepartmentService` to `AppError` / `{ success: false, error: { code, message } }`.

### CF-08: Stale UI Metadata & Hardcoded Metrics on Dashboard/Navbar
- **Description:** Navigation header still claims `v0.2 Production Setup`, and `DashboardPage` still displays hardcoded `37/37 Passed`, `Across 3 prototype roles`, `4 Lines Ready`, and `v0.1` / `Phase 2` cards.
- **Repository Evidence:** `frontend/src/components/Navbar.tsx:53`, `frontend/src/pages/DashboardPage.tsx:238-245,383,408-473`.
- **Affected Module:** Frontend Dashboard & Shell.
- **Business Impact:** Misleads operators and stakeholders regarding system version, active roles (actually 12), and verified test coverage (actually 79).
- **Technical Impact:** Static UI text drifting out of sync with live backend health/RBAC state.
- **Severity:** **Medium**
- **Recommended Action:** Replace hardcoded dashboard numbers with dynamic `/api/health` / role / module status cards reflecting actual v0.3+ capabilities.

---

## 11. Unresolved Dependencies

1. **WMS Operational Usability Dependency:** Cannot verify or pilot warehouse workflows in the factory until the WMS Frontend UI and sample operational role credentials exist.
2. **Procurement-to-Receiving Closure:** WMS `goods_receipts.po_reference` and `reorder_requests` (`LINKED_TO_PO`) cannot enforce PO quantity matching, supplier price variance, or partial-delivery tracking until a **Suppliers & Purchase Orders** module exists.
3. **Production-to-Warehouse & Production-to-Planning Loop:** MRP in `planning`, material consumption limits in `warehouse` issues, inline audits in `qc`, and finished goods handovers from `packing` all depend on a shared **Style / BOM / Production Work Order** core schema that does not yet exist.
4. **Live PostgreSQL CI/Staging Environment:** True database trigger integrity (`trg_stock_movements_immutable`), real `FOR UPDATE` locking throughput, and schema migration upgrades cannot be signed off until validated on a live PostgreSQL 14+ server.
5. **Security & Contract Baseline:** Adding new ERP modules (Purchasing, Production Execution, HR) on top of inconsistent error envelopes (`Departments`), unprotected `/auth/login`, fallback `JWT_SECRET`, and role-name global bypasses (`GLOBAL_WAREHOUSE_ROLES`) will multiply security and integration rework.

---

## 12. Overall System Readiness Assessment

| Environment Target | Readiness Status | Justification |
|---|---|---|
| **Local Development / Technical Prototype** | **Ready** | Runs smoothly out-of-the-box via `pg-mem`, clean TypeScript builds, and 79 passing in-memory backend tests. |
| **Factory UAT / Internal Pilot** | **Not Ready** | Warehouse staff have zero UI; Purchasing, Cutting/Sewing/Packing execution, Inline QC, and HR do not exist; operational roles lack seeded accounts. |
| **Staging (Live PostgreSQL)** | **Conditionally Blocked** | Requires live PG 14+ verification of triggers/migrations/locking and removal of hardcoded `JWT_SECRET` fallback. |
| **Production Factory Deployment** | **Not Ready** | Blocked by missing WMS UI (CF-01), security hardening gaps (CF-02, CF-03), unverified live DB runtime (CF-04), missing core manufacturing workflows (CF-05), and zero frontend/E2E test coverage. |
