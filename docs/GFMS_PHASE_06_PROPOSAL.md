# GFMS Next Phase Strategic Proposal (Phase 07 Proposal)

**Project:** Garment Factory Management System (GFMS)  
**Document Type:** Strategic Phase Proposal (Output of Phase 06 System-Wide Assessment)  
**Status:** Proposed – Pending User Approval  

---

## 1. Proposed Phase Name
**Phase 07 – Platform Security/API Hardening & Warehouse Operations Console**

---

## 2. Main Objective
Bring existing GFMS capabilities to **operational UAT readiness** by simultaneously:
1. Closing all **Critical & High security, RBAC, transaction-boundary, and API-contract defects** across the existing Foundation, Users, Departments, Production, and Warehouse modules; and
2. Delivering the complete **React Warehouse Management System (WMS) Frontend Console** wired to the existing 55+ Phase 04 WMS REST endpoints, alongside refreshed v0.3 dashboard metrics and operational test accounts.

---

## 3. Why This Phase Should Be Next (Strategic Options Evaluation)

Following the Phase 06 Assessment, three candidate next directions were evaluated:

| Strategic Option | Description | Pros | Cons / Risks | Verdict |
|---|---|---|---|---|
| **Option 1: Complete & Repair Existing Modules Only (UI-First)** | Build the Warehouse UI and fix stale dashboard text without refactoring backend security, RBAC scope helpers, or legacy error contracts. | Fastest visible UI demo for warehouse operations; showcases Phase 04 backend immediately. | Exposes an unhardened `JWT_SECRET` fallback, unprotected `/auth/login`, notification IDOR (`CF-03`), over-broad `GLOBAL_WAREHOUSE_ROLES`, and inconsistent 500 error responses on a newly interactive UI. | **Insufficient Alone** |
| **Option 2: Resolve Architectural, Security & Integration Dependencies Only** | Harden auth/env/transactions, fix RBAC permissions (`Production Manager`, `QC Manager`, `Department Manager`), standardize `DepartmentController`, and run live PostgreSQL verification — zero UI work. | Cleanest technical foundation for Phases 08+; verifies live PG triggers and concurrency. | Leaves the massive 24-table WMS 100% unusable in the browser (`0` WMS UI screens); stakeholders still cannot test receiving, QC, picking, or cycle counts in UAT. | **Insufficient Business Value Alone** |
| **Option 3: Introduce New Modules First (Purchasing, Production Execution, or HR)** | Start building Suppliers/POs or Cutting/Sewing Work Orders or HR evaluations immediately. | Expands domain feature breadth on paper. | Builds new modules atop unverified live PG assumptions, flawed RBAC role-name bypasses, legacy error envelopes, and an invisible Warehouse module that cannot even be clicked in the UI. Compounded technical debt & disconnected silos. | **Rejected (High Rework Risk)** |
| **Recommended Hybrid (Phase 07): Option 1 + Option 2** | **Platform Hardening + Warehouse Operations Console** | Eliminates all Critical/High platform defects before new modules are added **AND** unlocks full factory UAT on the already-built WMS backend via real UI screens. | Requires disciplined scope control so Purchasing PO master tables and Production Work Orders stay deferred to Phases 08 & 09. | **RECOMMENDED** |

**Strategic Rationale:** Option 1 + Option 2 delivers immediate operational value (a live, testable Warehouse & Inventory console + corrected RBAC roles) while establishing a secure, standardized, transaction-safe, live-PostgreSQL-verified platform so Phases 08–11 can plug in Purchasing, Production Execution, QC, and HR cleanly without rework.

---

## 4. Problems It Will Address (Traceable to Phase 06 Findings)

| Finding ID | Problem Addressed |
|---|---|
| **CF-01** | Warehouse Management has 24 tables and 55+ endpoints with **zero** frontend UI or `ApiService` integration. |
| **CF-02** | Hardcoded fallback `JWT_SECRET` in `env.ts:16`, wildcard `CORS_ORIGIN`, and missing `/api/auth/login` rate limiting. |
| **CF-03** | Authorization IDOR in `WarehouseMasterService.markNotificationRead` (`warehouse-master.service.ts:1144-1159`) and non-transactional audit write. |
| **CF-04** | Live PostgreSQL 14+ triggers (`trg_stock_movements_immutable`), migrations, and `FOR UPDATE` concurrency remain **Not Verified**. |
| **CF-06** | `Production Manager` lacks `production:view`; `QC Manager` equals `QC Inspector`; `GLOBAL_WAREHOUSE_ROLES` bypasses `warehouse_staff` scoping; `Department Manager` lacks `planning:view`; WMS/QC/Purchasing/Finance roles have no seeded demo/UAT accounts. |
| **CF-07** | Non-transactional multi-step DML in `ProductionService.reorderWorkflowSteps`, `DepartmentService`, and `UserService`; legacy `{ success, message }` & raw `Error` 500s in `Departments`; unvalidated `parseInt` params. |
| **CF-08** | Stale `v0.2 Production Setup`, `37/37 Passed`, `Across 3 prototype roles`, and `v0.1` / `Phase 2` placeholders on `Navbar.tsx` and `DashboardPage.tsx`. |

---

## 5. Modules Involved
- **Core Config & Security:** `backend/src/config/env.ts`, `database.ts`, `app.ts`, `routes/index.ts`, `auth.middleware.ts`, `auth.service.ts`.
- **Users & RBAC:** `backend/src/modules/users/`, `database/seeds/` (additive/idempotent RBAC & sample UAT user seed `007`).
- **Departments & Production (Stabilization Only):** `department.controller.ts`, `department.service.ts`, `production.controller.ts`, `production.service.ts` (transaction boundaries, `AppError` standardization, `parsePositiveIntId` validation — **no new production execution engine**).
- **Warehouse Backend (Hardening & Pagination):** `warehouse-master.service.ts`, `warehouse.controller.ts`, `warehouse.routes.ts` (notification IDOR fix, permission-based global scope, list pagination/idempotency).
- **Frontend SPA (`frontend/src/`):** `api.ts`, `types/index.ts`, `Navbar.tsx`, `DashboardPage.tsx`, `LoginPage.tsx`, new `frontend/src/pages/warehouse/` workspace, and notification bell/drawer.

---

## 6. Dependencies
1. **Must Happen First (Internal Task Order):** Security hardening, RBAC permission fixes, notification IDOR repair, and `ApiService` contract standardization (`DepartmentController` error shape + paginated WMS responses) MUST land before finalizing frontend WMS screens so the UI builds against final API contracts.
2. **External / Environment Dependency:** Access to a real **PostgreSQL 14+** instance (local container or staging DB via `DATABASE_URL`) is required to verify migration runner execution, `trg_stock_movements_immutable` trigger enforcement, and concurrent `FOR UPDATE` lock tests.
3. **Explicitly Out-of-Scope Dependencies Deferred:** Real `suppliers`/`purchase_orders` tables (`Phase 08`), garment `styles`/`BOMs`/`work_orders` (`Phase 09`), inline sewing `qc_audits` (`Phase 10`), and `HR`/evaluations (`Phase 11`) are NOT blocking WMS UI completion because `po_reference` and `production_line_id` already operate cleanly in Phase 04.

---

## 7. Expected Deliverables
1. **Hardened Backend Core & Standardized REST API:** Strict `env.ts` production secret/CORS guards, login rate limiter, transactional `User`/`Department`/`Production` mutations, unified `{ success: false, error: { code, message } }` envelopes across all modules, and fixed `markNotificationRead` ownership checks.
2. **Corrected RBAC & Scope Matrix (Migration/Seed `007`):** Fixed `Production Manager`, `QC Manager`, `Department Manager` (`planning:view`), permission-based `requireWarehouseScope` (replacing `GLOBAL_WAREHOUSE_ROLES` name-bypass), and seeded UAT credentials for `whmanager`, `whkeeper`, `qcinspector`, `purchasing`, `prodmanager`, and `finance`.
3. **Warehouse Operations Console (`WarehouseModule`):** Full React UI supporting:
   - Warehouse & Bin Directory + Staff Assignment + Low-Stock Alerts Drawer
   - Material Catalog, Categories & Reorder Threshold Management
   - Inbound Receiving (GRN Creation, Roll/Lot Measurement, Put-Away) & QC Quarantine Release/Rejection Queue
   - Outbound Material Requisitions (Create/Approve/Issue with Advisory FIFO + Audited Override, Material Returns)
   - Inventory Control (Internal Bin Moves, 2-Step Inter-Warehouse Transfers, Cycle Counts, Reason-Coded Adjustments & Escalations, 3-Tier Reorder Workflow, WAC Valuation & Immutable Movement Ledger Explorer)
4. **Updated Shell & Dashboard (`DashboardPage.tsx`, `Navbar.tsx`, `LoginPage.tsx`):** Dynamic version metadata (`v0.3+`), live role/test metrics, and operational quick-action shortcuts.
5. **Expanded Verification Suite:** Live PostgreSQL verification script/runbook, concurrency test cases, unit/component tests for frontend, and updated backend integration tests (`80+` cases).

---

## 8. Implementation Tasks (Mandatory vs. Optional)

### Mandatory Tasks
1. **Security & Environment Hardening (`Core`):**
   - Enforce startup failure if `NODE_ENV === 'production'` and `JWT_SECRET` is missing/default or `CORS_ORIGIN === '*'`.
   - Add IP/account rate limiting on `POST /api/auth/login` and block self-deactivation / last-active-admin removal in `UserService`.
2. **RBAC & Notification Scope Fixes (`Auth / Middleware / WMS / Seed 007`):**
   - Fix `WarehouseMasterService.markNotificationRead` to enforce recipient user / target role / warehouse scope inside `withTransaction`.
   - Replace `GLOBAL_WAREHOUSE_ROLES` array bypasses in `auth.middleware.ts` with granular global permission checks (respecting `warehouse_staff` scoping for `QC_INSPECTOR` & `VIEWER`).
   - Grant `Production Manager` `production:view` (and operational line/stats read scope), grant `Department Manager` `planning:view`, differentiate `QC Manager` override/approval rights from `QC Inspector`, and seed UAT accounts for WMS/QC/Purchasing/Finance/Production roles.
3. **API Standardization & ACID Transaction Remediation (`Departments / Production / Users / WMS`):**
   - Wrap `ProductionService.reorderWorkflowSteps`, `DepartmentService` mutations (`assignManager`, `removeEmployee`, `deleteDepartment`, `updateDepartment`, `toggleDepartmentStatus`), and `UserService` (`createUser`, `updateUserRoles`) in `withTransaction`.
   - Standardize `DepartmentController` & `DepartmentService` to `AppError` and `{ success: false, error: { code, message } }`.
   - Add `parsePositiveIntId` route/controller validation across `Users`, `Production`, and `Departments`, plus `limit`/`offset` pagination metadata on high-volume WMS list endpoints.
4. **Complete WMS Frontend Workspace & UI Refresh (`Frontend`):**
   - Extend `frontend/src/types/index.ts` and `frontend/src/services/api.ts` for all WMS endpoints and notifications.
   - Implement `Warehouse` navigation tab + sub-views (Overview & Alerts, Catalog, Inbound GRN & QC, Outbound Requisitions & Issues/Returns, Transfers, Counts & Adjustments, Reorders, Valuation & Movement Ledger) strictly gated by backend permissions.
   - Replace stale `v0.1`/`v0.2` and `37/37` dashboard placeholders with live backend metrics.
5. **Live PostgreSQL & Automated Verification:**
   - Run full migration (`001`–`007`), immutability trigger (`trg_stock_movements_immutable`), and parallel `FOR UPDATE` concurrency checks against a real PostgreSQL 14+ database.

### Optional Tasks (Include Only If Capacity Permits Without Scope Creep)
- Add `Idempotency-Key` header deduplication on critical stock-posting endpoints (`POST /grns`, `/issues`, `/adjustments`, `/transfers`).
- Introduce Vitest + React Testing Library smoke tests for critical permission-gating and WMS form validation in `frontend/`.
- Refactor monolithic `backend/src/tests/runner.ts` into modular test files while preserving `npm test` compatibility.
- Add URL query-param synchronization (`?tab=warehouse&view=grns`) in `App.tsx` so browser back/forward and bookmarking work without rewriting full routing.

---

## 9. Testing Strategy
1. **Backend Integration Tests (`runner.ts` + Live PG Run):**
   - Add assertions covering notification IDOR rejection (`403`/`404`), `DepartmentController` standardized error payloads, login rate limiting (`429`), transactional rollback verification on `reorderWorkflowSteps` and `assignManager` failures, paginated WMS responses, and updated `Production Manager` / `Department Manager` / `QC Inspector` scopes.
   - Execute the complete test suite against **BOTH** `pg-mem` and a **live PostgreSQL 14+ instance** (`DATABASE_URL` set) including concurrent HTTP `Promise.all` tests verifying `SELECT ... FOR UPDATE` prevents negative stock.
2. **Frontend Verification:**
   - Verify TypeScript compilation (`tsc --noEmit`) and production Vite build (`npm run build`).
   - Perform role-based browser E2E verification across all seeded roles (`admin`, `manager`, `deptuser`, `planner`, `deptstaff`, plus new `whmanager`, `whkeeper`, `qcinspector`, `purchasing`, `finance`) ensuring every WMS screen renders real DB data with zero console/network errors.

---

## 10. Acceptance Criteria
- Zero Critical or High security/RBAC findings remain from Phase 06 (`CF-01` through `CF-08` remediated or documented as verified deferred scope).
- All non-2xx API responses across `/api/departments`, `/api/production`, `/api/users`, `/api/planning`, and `/api/warehouses` return `{ success: false, error: { code, message } }`.
- Every Phase 04 WMS workflow (Catalog, Warehouse/Bins, GRN, QC Quarantine, Requisition + Issue + FIFO override, Returns, Transfers, Cycle Count, Adjustments, 3-Tier Reorder, Valuation, Notifications) is executable end-to-end via React UI by its respective authorized role.
- Full migration + test suite + `trg_stock_movements_immutable` trigger verification passes **on a live PostgreSQL 14+ database**, not solely `pg-mem`.

---

## 11. Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **WMS Frontend Scope Bloat (55+ endpoints -> massive UI)** | High | Medium | Structure `WarehouseModule` cleanly around 6 cohesive operational sub-tabs matching existing `ProductionModule`/`DepartmentModule` patterns; keep forms lean and API-faithful. |
| **Live PostgreSQL Syntax Differences Masked by pg-mem (`+ 0` hacks, casting, `SERIAL` resets)** | Medium | High | Run live PG migration & test CI early in Phase 07, not at the end; fix SQL discrepancies before starting UI integration. |
| **Changing `DepartmentController` Error Shape Breaks Existing Frontend Helpers** | Medium | Medium | Audit `api.ts` error extraction (`error?.message || message`) first so frontend gracefully parses standardized `{ error: { code, message } }` payloads across all modules. |
| **Seeded Operational Test Users Polluting Production Deployments** | Low | High | Guard demo/UAT credential seeding in `007` behind `NODE_ENV !== 'production'` or flag seed cleanly in docs (`MIGRATIONS.md`). |

---

## 12. Definition of Done (Phase 07)
Phase 07 is complete ONLY when:
1. All **Mandatory Tasks** in Section 8 are implemented and verified.
2. `npm run lint` / `tsc --noEmit` and `npm run build` succeed with zero errors.
3. Automated backend tests (`pg-mem`) AND **live PostgreSQL 14+** trigger/migration/concurrency checks achieve 100% pass rate (`0` failures).
4. Live browser walkthrough confirms every role sees strictly its permitted navigation tabs and completes end-to-end Warehouse & Department/Planning UI workflows without raw HTTP 500s or console errors.
5. `docs/API_SPECIFICATION.md`, `docs/WMS_ROLE_PERMISSION_MATRIX.md`, and `docs/DATABASE_SCHEMA.md` are updated to reflect Phase 07 changes, and a Phase 07 Completion Report is archived.
