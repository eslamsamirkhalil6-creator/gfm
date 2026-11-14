# GFMS – Phase 05 Completion Report
## API Architecture Review, Cross-Module Integration Contracts & RBAC / Dashboard Correction

**Application:** Garment Factory Management System (GFMS v0.3)  
**Phase:** 05 – API Architecture Review, Integration Contracts & RBAC / Dashboard Correction  
**Status:** Complete – Awaiting User Review Before Phase 06 Assessment  
**Verification Basis:** Inspected directly from `backend/src/*`, `frontend/src/*`, `database/migrations/*`, `database/seeds/*`, and executed test/build/lint runs (`pg-mem v3.0` engine).

---

## 1. Executive Summary

Phase 05 completed both required workstreams without restarting Phases 01–04, without altering migration `005` or its seed, and without building unapproved future business modules:

1. **Workstream A — API Architecture & Cross-Module Integration Contracts**: Audited every registered REST endpoint, middleware, controller, service, database migration, and offline-first LAN requirement; standardized canonical conventions and documented module integration contracts across `docs/GFMS_API_ARCHITECTURE.md`, `docs/GFMS_API_STANDARDS.md`, `docs/GFMS_INTEGRATION_CONTRACTS.md`, and `docs/GFMS_API_SECURITY_REVIEW.md`.
2. **Workstream B — RBAC, Department Manager & Dashboard Correction**: Diagnosed and corrected role/scope/dashboard leakage across backend authentication, authorization middleware, department stats queries, frontend ActiveTab routing, and role-specific views, adding strict separation for **Factory Manager**, **Department Manager**, **System Administrator**, **Department Planner**, and **Department User**.

---

## 2. Actual Architecture Findings & Existing Problems

### 2.1 Backend Topology & Migration Baseline
- Single Express 4 API mounted at `/api` (`backend/src/app.ts`, `backend/src/routes/index.ts`) supporting `Health`, `Auth`, `Users & Roles`, `Audit Logs`, `Diagnostics` (`/api/tests/run`), `Production`, `Departments`, `Department Planning` (`006`), and `WMS` (Phase 04).
- Database engine (`backend/src/config/database.ts`) uses PostgreSQL (`pg`) with automatic `pg-mem v3.0` in-memory fallback when `DATABASE_URL` is unset or unreachable.
- Schema tracker (`backend/src/config/migrations.ts`) manages **41 tables** across **6 migrations** and **6 seeds** (`001`–`006`), tracked with SHA-256 checksums in `schema_migrations`.

### 2.2 Existing API Problems Identified (Preserved Without Breaking Legacy Consumers)
1. **Error Envelope Drift (Legacy Modules)**: `DepartmentController` returns `{ success: false, message }` without `error.code`, and `ProductionController` returns `{ success: false, error: { message } }` without `error.code`, whereas `errorHandler`, `auth.middleware.ts`, `validation.middleware.ts`, `WarehouseController`, and `UserController` use `{ success: false, error: { code, message, details } }`.
2. **Untyped Service Errors & Unchecked `:id` Params**: Several `DepartmentService` errors (`getDepartmentById`, `removeEmployee`, `deleteDepartment`) throw raw `Error` without `statusCode` (producing `500` instead of `404`/`409`), and `UserController`/`ProductionController` do not validate malformed non-numeric `:id` params before SQL queries.
3. **Pagination & Notification Ownership Gaps**:
   - High-volume WMS list endpoints (`listGrns`, `listRequisitions`, `listIssues`, `listTransfers`, `queryBalances`, `queryLots`) currently return full filtered arrays without `limit`/`offset` pagination metadata.
   - `WarehouseMasterService.markNotificationRead` updates `warehouse_notifications` by ID without verifying `recipient_user_id` or role/warehouse ownership.
4. **Legacy Non-Transactional Audit Writes**: `UserService`, most `ProductionService` methods, `DepartmentService.removeEmployee`/`deleteDepartment`, and `WarehouseMasterService.markNotificationRead` execute `AuditService.log` outside `withTransaction` (whereas WMS core inventory flows and `DepartmentService` transfers/assignments run audit writes inside `withTransaction`).
5. **Production Security Hardening Items**: Prototype fallback `JWT_SECRET` in `env.ts`, permissive default `CORS_ORIGIN=*`, and absence of login rate limiting on `POST /api/auth/login`.
6. **Offline-First LAN Gaps**: No `Idempotency-Key` ledger, no `client_tx_uuid` replay guard on document creation endpoints, and no optimistic concurrency `version` / `ETag` checking on mutable master/document `PUT` routes.

---

## 3. Root Cause of the Department Manager & Dashboard Issue

Inspection of `auth.service.ts`, `auth.middleware.ts`, `department.controller.ts`, `department.service.ts`, `database/seeds/001..004`, and `frontend/src/*` identified four interacting root causes:

1. **Manager Scope Derived Blindly from `departments.manager_id`**:
   `AuthService.login` and `authenticateJWT` populated `managed_department_ids` solely via `SELECT id FROM departments WHERE manager_id = $1`. Because `003_seed_department_data.sql` assigns `manager` (`Factory Manager`) to `DEP-PROD`/`DEP-SEW` and `admin` (`System Administrator`) to `DEP-IT`, both roles received `managed_department_ids` and gained `My Department` workspace ownership—allowing them to impersonate Department Managers, and allowing any plain `Department User` referenced on `departments.manager_id` to receive manager scope.
2. **Role-Name Bypass in Department Scope Middleware**:
   `requireDepartmentScope`, `requireDepartmentListAccess`, and `requireDepartmentTargetScope` treated `roles.includes('Department Manager')` as sufficient even when `departments:scoped:manage` was absent, and `departments:scoped:view` was not cleanly enforced as read-only vs `departments:scoped:manage`.
3. **Unscoped Department Metrics & Missing Planning Role Separation**:
   - `GET /api/departments/stats` returned factory-wide totals and all departments' employee distributions even to scoped `Department Manager` callers.
   - `004_seed_department_manager_role.sql` granted `departments:scoped:view` and `departments:scoped:manage` to `System Administrator`.
   - `@deptuser` held both `Department Manager` and `Department User`, conflating generic staff membership with manager privileges.
   - No `Department Planner` role, planning permissions (`planning:view`, `planning:manage`), or scoped planning endpoints existed.
4. **Permissive Frontend Guards**:
   `Navbar.tsx`, `App.tsx`, and `DashboardPage.tsx` gated `My Department` purely on `managed_department_ids.length > 0`, while `MyDepartmentPage.tsx` rendered edit/staff-management controls and fetched `assignable-users` without verifying `departments:scoped:manage`.

---

## 4. Exact Files Changed

### Database Migrations & Seeds *(New in Phase 05 / RBAC Correction)*
- `database/migrations/006_rbac_role_clarification.sql` *(added `idx_dept_employees_user_dept` and `department_planning_schedules` table)*
- `database/seeds/006_seed_rbac_role_clarification.sql` *(provisioned `Department Planner`, `planning:view`/`planning:manage`, cleaned `System Administrator` & `@deptuser` role overlaps, seeded `planner` in `DEP-PLAN` and `deptstaff` in `DEP-CUT`, seeded sample `PLN-PPC-2026-01`)*

### Backend
- `backend/src/modules/auth/auth.types.ts` *(added `planning_department_ids: number[]`)*
- `backend/src/modules/auth/auth.service.ts` *(restricted `managed_department_ids` strictly to authorized `Department Manager` accounts excluding `Factory Manager` & `System Administrator`; derived `planning_department_ids`)*
- `backend/src/middleware/auth.middleware.ts` *(synced `authenticateJWT` scope derivation; removed role-name bypasses in `requireDepartmentScope`, `requireDepartmentListAccess`, `requireDepartmentTargetScope`; added `requirePlanningScope`)*
- `backend/src/modules/departments/department.controller.ts` & `backend/src/modules/departments/department.service.ts` *(scoped `getDepartmentStats` by `d.manager_id + 0 = $1` for non-global managers)*
- `backend/src/modules/planning/planning.service.ts`, `planning.controller.ts`, `planning.routes.ts` & `backend/src/routes/index.ts` *(added and mounted `/api/planning/dashboard`, `/api/planning/departments/:id`, `/api/planning/schedules`, `/api/planning/schedules/:id/status`)*
- `backend/src/tests/runner.ts` *(updated migration checks `#43`–`#45` for `006_` / `41` tables and added RBAC role clarification tests `#75`–`#79`)*

### Frontend
- `frontend/src/types/index.ts` & `frontend/src/services/api.ts` *(added `planning_department_ids` and Planning API client methods)*
- `frontend/src/pages/PlanningPage.tsx` *(created scoped Planning dashboard respecting `GLOBAL` read-only vs `DEPARTMENT_SCOPED` and `planning:manage` gating)*
- `frontend/src/components/Navbar.tsx`, `frontend/src/App.tsx`, `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/MyDepartmentPage.tsx`, `frontend/src/pages/LoginPage.tsx` *(strict role/permission UI guards, view-only protection on `MyDepartmentPage`, generic `Department User` clarification, and quick-login coverage for all 5 clarified roles)*

### Phase 05 Documentation Deliverables
- `docs/GFMS_API_ARCHITECTURE.md`
- `docs/GFMS_API_STANDARDS.md`
- `docs/GFMS_INTEGRATION_CONTRACTS.md`
- `docs/GFMS_API_SECURITY_REVIEW.md`
- `docs/GFMS_PHASE_05_REPORT.md` *(this report)*

*(Migration `005_create_warehouse_tables.sql` and seed `005_seed_warehouse_data.sql` were NOT modified.)*

---

## 5. Role and Permission Changes

| Role | Added Permissions | Removed Permissions / Roles | Enforced Scope Behavior |
|---|---|---|---|
| **Department Planner** *(new)* | `dashboard:view`, `planning:view`, `planning:manage` | — | Scoped via `planning_department_ids` (`DEP-PLAN` #9). Denied `403` on out-of-scope planning, `/api/departments*`, `/api/users`, `/api/audit-logs`, `/api/warehouses*`. |
| **Factory Manager** | `planning:view` *(read-only)* | — | Broad factory department dashboards (`departments:view`, `departments:reports`, etc.) + global read-only planning (`403` on schedule mutations). `managed_department_ids = []`. |
| **System Administrator** | — | `departments:scoped:view`, `departments:scoped:manage` | Retains user/role/audit/system config authority; `managed_department_ids = []`; denied `403` on `/api/planning/*` and WMS operational approvals. |
| **Department Manager** | Unchanged (`dashboard:view`, `departments:scoped:view`, `departments:scoped:manage`) | Removed redundant `Department User` role from `@deptuser` | Scoped strictly to departments where `departments.manager_id === user.id`. `/departments/stats` filtered to managed dept (`total=1` for `@deptuser`); `departments:scoped:view` alone blocks mutations (`403`). |
| **Department User** | Unchanged (`dashboard:view` only) | — | Generic employee account (`deptstaff`). Department membership (`department_employees`) or stray `departments.manager_id` without `Department Manager` role/perms still receives `managed_department_ids = []` and `403` on all dept/planning/admin endpoints. |

---

## 6. API Standards & Integration Contracts Established

- **API Architecture & Conventions (`GFMS_API_ARCHITECTURE.md`, `GFMS_API_STANDARDS.md`)**:
  - Standardized `/api` resource naming, workflow command sub-paths (`/submit`, `/approve`, `/reject`, `/cancel`, `/post`), typed `HttpError` codes (`400`/`401`/`403`/`404`/`409`), centralized parameter validation (`parsePositiveInt`, `parsePositiveNumber`, `parseEnumValue`), pagination (`limit`/`offset` + `pagination` envelope), transaction locking order (`ORDER BY id ASC`), and atomic `AuditService.log(..., txQuery)`.
  - Documented offline-first LAN readiness requirements (`Idempotency-Key` ledger, `client_tx_uuid`, optimistic concurrency `version`/`ETag`, `client_occurred_at` vs `server_created_at`, retry-safe vs stock-reconciled conflict rules).
- **Cross-Module Integration Contracts (`GFMS_INTEGRATION_CONTRACTS.md`)**:
  - Defined strict API, service ownership, permissions, dependencies, and validation rules without implementing future modules for **HR (`DEP-HR`)**, **Planning (`DEP-PLAN`)**, **Purchasing & Suppliers (`DEP-PUR`)**, **Quality Control (`DEP-QC`)**, **Transportation (`DEP-TRANS`)**, and **Cross-Module Reports & Notifications**.
  - Explicitly documented Production–Warehouse handover/requisition contracts, QC quarantine release gates, and Purchasing PO-to-GRN cumulative over-delivery contracts.

---

## 7. Security Findings Summary

- **Verified Controls**:
  - Live PostgreSQL validation on every request (`authenticateJWT`) ensures user deactivation, role edits, warehouse assignment revocation, and manager reassignments revoke access immediately.
  - WMS valuation (`weighted_avg_cost`, `total_global_valuation`) remains stripped unless `warehouse:reports:valuation` is held (`#57`).
  - Warehouse scope (`requireWarehouseScope`), production line scope (`requireProductionLineScope`), cross-department transfer dual-scope (`requireDepartmentTargetScope`), maker-checker self-approval blocks (`#69`, `#70`), `WRITE_OFF` Factory Manager escalation (`#70`), and `System Administrator` operational segregation (`#57`, `#76`) all pass verification.
- **Residual Risks Documented for Remediation**:
  - `HIGH`: `JWT_SECRET` prototype fallback in `backend/src/config/env.ts` must fail fast in `NODE_ENV=production`.
  - `MEDIUM`: `PUT /api/warehouse/notifications/:id/read` lacks notification ownership/role scope validation; `POST /api/auth/login` lacks rate limiting; `CORS_ORIGIN` defaults to `'*'`.
  - `LOW–MEDIUM`: Legacy `UserController` / `ProductionController` missing `isNaN` checks on `:id`, raw `Error` throws in `DepartmentService`, and non-transactional audit writes in legacy `UserService` / `ProductionService`.

---

## 8. Tests Executed and Honest Results

| Check / Command | Scope | Result | Environment / Caveat |
|---|---|---|---|
| `npm test` (`tsx backend/src/tests/runner.ts`) | Foundation, Auth, RBAC, Production, Departments, Migrations `001`–`006` (`#43`–`#45`), WMS Phase 04 (`#57`–`#74`), Role Clarification (`#75`–`#79`) | **79 / 79 PASSED** (`12649ms`, 0 failures) | Executed against ephemeral Express HTTP server backed by **`pg-mem v3.0`** in-memory PostgreSQL engine. |
| `compile_applet` (`npm run build`) | Vite React frontend bundle compilation | **Build succeeded** | Production client bundle compiled cleanly. |
| `lint_applet` (`tsc --noEmit`) | Workspace TypeScript static type check | **Passed (0 errors)** | Zero compiler/type diagnostics. |

**Important Testing Caveat**: Automated verification ran exclusively on `pg-mem v3.0`. Real live PostgreSQL MVCC row-level lock contention (`SELECT ... FOR UPDATE` under multi-client LAN load) and manual browser UI walkthroughs have NOT yet been executed against an external PostgreSQL 14+ server.

---

## 9. Remaining Issues & Recommendations for Phase 06

### Unresolved / Deferred Technical Debt
1. Harden `env.ts` (`JWT_SECRET` required in production), add login rate limiting, restrict `CORS_ORIGIN`, and add recipient/warehouse ownership verification to `PUT /api/warehouse/notifications/:id/read`.
2. Standardize `:id` validation (`parsePositiveInt`), error envelopes, and `HttpError` codes across legacy `DepartmentController`/`DepartmentService`, `ProductionController`, and `UserController`/`UserService`.
3. Add `limit`/`offset` pagination to WMS list endpoints and introduce `Idempotency-Key` / `version` concurrency middleware before deploying multi-tablet offline queues on the factory LAN.
4. Execute `npm test` and UI verification against a live PostgreSQL 14+ instance (`DATABASE_URL` configured) to validate native constraints, triggers (`IMMUTABLE_LEDGER`), and concurrent `FOR UPDATE` locking.

### Recommended Next Implementation Phase
- **Phase 06 Assessment & Implementation Planning**: Conduct a structured gap assessment across the codebase (Production execution & Frontend WMS UI wiring vs Purchasing/QC/HR/Planning modules) so the next implementation phase prioritizes high-value, non-overlapping factory workflows cleanly built atop the verified Phase 04 WMS and Phase 05 API/RBAC foundation.

---

*Phase 05 is complete. Stopping here pending explicit user review and approval before starting Phase 06.*
