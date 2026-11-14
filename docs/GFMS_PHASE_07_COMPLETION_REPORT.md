# GFMS – Phase 07 Completion & Testing Report
## Platform Security Hardening & Complete Warehouse and Inventory Operations

**Version:** GFMS v0.3  
**Phase:** 07 – Backend Hardening, RBAC Alignment & Warehouse/Inventory Frontend Console  
**Status:** Implemented & Verified (In-Memory `pg-mem v3.0.14` + TypeScript/Vite Build + Live Port 3000 HTTP Smoke Tests)  
**PostgreSQL 14+ Verification:** **NOT VERIFIED** *(No local PostgreSQL server or `DATABASE_URL` configured in this container)*

---

## 1. Implementation Summary

Phase 07 resolved the security, authorization, transaction, and API contract findings identified in `docs/GFMS_PHASE_06_ASSESSMENT_REPORT.md` and delivered the complete React operations console for Warehouse and Inventory Management connected to the existing WMS REST APIs.

### Modified & Created Files
- **Backend Security, RBAC & API Hardening:**
  - `backend/src/config/env.ts` – Enforced fail-fast startup guards requiring explicit `JWT_SECRET` and `CORS_ORIGIN` in production (`NODE_ENV=production`).
  - `backend/src/app.ts` – Hardened CORS origin enforcement (`403 CORS_FORBIDDEN`), security headers, and mounted login rate limiting.
  - `backend/src/middleware/rate-limit.middleware.ts` – Per-IP + username sliding-window throttling (`429 RATE_LIMIT_EXCEEDED`, `resetLoginRateLimitForTests` helper).
  - `backend/src/middleware/auth.middleware.ts` – Permission-based `hasGlobalWarehouseAccess` & `canCreateOrManageAllWarehouses` helpers (removing `QC Inspector` from global warehouse bypass).
  - `backend/src/middleware/error.middleware.ts` – Standardized `{ success: false, error: { code, message } }` JSON envelope via `AppError`.
  - `backend/src/modules/users/user.service.ts` – Added `400 SELF_DEACTIVATION_FORBIDDEN` and `409 LAST_ADMIN_PROTECTION` guards inside `withTransaction`.
  - `backend/src/modules/production/production.service.ts` & `backend/src/modules/departments/department.service.ts` – Wrapped multi-step mutations (`reorderWorkflowSteps`, department manager tenure transitions) in `withTransaction` and standardized `parsePositiveIntId` route parameter validation.
  - `backend/src/modules/warehouse/warehouse-master.service.ts`, `warehouse-inbound.service.ts`, `warehouse-control.service.ts`, `warehouse-outbound.service.ts`, `warehouse.controller.ts`, `warehouse.routes.ts` – Fixed notification IDOR (`PUT /api/warehouse/notifications/:id/read`), split `warehouse:create` from `warehouse:manage`, implemented senior `POST /api/warehouse/qc/override` (`inventory:qc_override`), enforced scoped `QC Inspector` warehouse boundaries, and added backward-compatible `?limit=&offset=` pagination metadata (`pagination: { total, limit, offset }`).
  - `database/seeds/007_seed_phase07_rbac_hardening.sql` – Seeded `warehouse:create`, `inventory:qc_override`, `Production Manager -> production:view`, `Department Manager -> planning:view`, 7 standalone operational UAT accounts (`whmanager`, `whkeeper`, `qcmanager`, `qcinspector`, `purchasing`, `prodmanager`, `finance`), and `warehouse_staff` assignments (`0` schema DDL changes).
- **Frontend WMS Console & Shell Integration:**
  - `frontend/src/types/index.ts` – Typed WMS DTOs (`Warehouse`, `WarehouseLocation`, `WarehouseStaffMember`, `MaterialCategory`, `MaterialItem`, `InventoryBalance`, `InventoryLot`, `StockMovement`, `InventorySummary`, `InventoryValuationReport`, `GoodsReceipt`, `QcPendingLine`, `QcInspectionRecord`, `MaterialRequisition`, `StockIssue`, `MaterialReturn`, `WarehouseTransfer`, `StockCount`, `StockAdjustment`, `ReorderRequest`, `WarehouseNotification`).
  - `frontend/src/services/api.ts` – Complete typed WMS client methods wired to `/api/warehouses/*`, `/api/warehouse/*`, and `/api/inventory/*`.
  - `frontend/src/pages/warehouse/wmsUi.tsx` – Shared WMS status badges, metric cards, pagination bar, and alert banners.
  - `frontend/src/pages/warehouse/WarehouseModule.tsx` – Main WMS shell with RBAC-gated sub-navigation (`Directory & Topology`, `Inventory & Catalog`, `Receiving & QC`, `Requisitions & Transfers`, `Control & Valuation`, `Policy & Alerts`), global warehouse filter, and live KPI banner.
  - `frontend/src/pages/warehouse/WarehouseDirectoryTab.tsx` – Warehouse CRUD (`warehouse:create`/`manage`), bin/location management (`DEFAULT` lock respected), and scoped staff assignments (`warehouse_staff`).
  - `frontend/src/pages/warehouse/InventoryCatalogTab.tsx` – Real-time stock balances, lot/roll inspection, immutable movement ledger, low-stock highlights, material category/SKU catalog, hybrid `attributes_json` editor, and reorder/QC config.
  - `frontend/src/pages/warehouse/InboundQcTab.tsx` – GRN creation/line entry/posting (reconciliation equation, over-delivery tolerance, `DEC-05` quarantine), Finished Goods handover receipt, QC pending inspection queue, QC history, and QC Manager senior override (`QCO-*`).
  - `frontend/src/pages/warehouse/OutboundTransfersTab.tsx` – Material requisitions (`DRAFT → SUBMITTED → APPROVED` with stock reservation), stock issuing with `DEC-04` advisory FIFO override reason, material returns (`USABLE_SURPLUS`/`DAMAGED`/`WASTE_SCRAP`), internal bin moves, and 2-step inter-warehouse transfers (`IN_TRANSIT` & discrepancy receipt).
  - `frontend/src/pages/warehouse/ControlReportsTab.tsx` – Physical stock counts (`CYCLE`/`FULL`), threshold-governed adjustments & write-offs (`DEC-08` maker-checker & Factory Manager escalation), 3-tier reorder workflow (`DEC-10`), Global WAC valuation, and ledger reconciliation (`Balances == Movements`).
  - `frontend/src/pages/warehouse/WarehouseSettingsAlertsTab.tsx` – Global `warehouse_settings` editor (`warehouse:settings:manage`), delayed-transfer scanner, and scoped in-app notification inbox with mark-read.
  - `frontend/src/components/Navbar.tsx`, `frontend/src/App.tsx`, `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/LoginPage.tsx` – Added RBAC-gated `Warehouse & Inventory` tab, mobile nav bar, live GFMS v0.3 dashboard operational cards, and login presets for all 12 operational/core roles.
- **Tests & Documentation:**
  - `backend/src/tests/runner.ts` – Added Phase 07 tests `#80–#89` (89 total integration tests).
  - Updated `docs/WMS_ROLE_PERMISSION_MATRIX.md`, `docs/WMS_API_SPECIFICATION.md`, `docs/API_SPECIFICATION.md`, `docs/DATABASE_SCHEMA.md`, `docs/MIGRATIONS.md`.

---

## 2. Security & RBAC Report (`CF-02`, `CF-03`, `CF-06`, `CF-07`)

| Finding | Remediation Implemented | Verification |
|---|---|---|
| **CF-02: Secret, CORS & Auth Hardening** | Production startup aborts if `JWT_SECRET` or `CORS_ORIGIN` is missing/unsafe; strict CORS whitelist returns `403 CORS_FORBIDDEN`; `POST /api/auth/login` enforces sliding-window rate limiting (`429 RATE_LIMIT_EXCEEDED`); security headers enforced; admin self-deactivation (`400`) & last-active-admin removal (`409`) blocked. | Verified in Tests `#80`, `#81`, `#83`. |
| **CF-03: Notification IDOR** | `PUT /api/warehouse/notifications/:id/read` executes inside `withTransaction` validating `recipient_user_id`, `target_role_name`, and `warehouse_id` against `managed_warehouse_ids`, rejecting unauthorized callers with `403 FORBIDDEN` and recording `WMS_NOTIFICATION_READ` in `audit_logs`. | Verified in Test `#84`. |
| **CF-06: RBAC & Scope Corrections** | Split `warehouse:create` (Admin + Factory Manager only) from `warehouse:manage`; removed `QC Inspector` from `hasGlobalWarehouseAccess` (now bounded via `warehouse_staff`); added `inventory:qc_override` exclusively to `QC Manager`; granted `Production Manager -> production:view` and `Department Manager -> planning:view` (scoped read-only); seeded 7 standalone operational UAT accounts. | Verified in Tests `#85`, `#86`, `#87`, `#88` + live `/api/*` HTTP checks. |
| **CF-07: API & Transaction Consistency** | Wrapped multi-step mutations in `withTransaction` (`ProductionService.reorderWorkflowSteps`, `UserService`, `DepartmentService`, `WarehouseMasterService`); standardized route ID parsing (`400`) and `AppError` envelopes across all modules; added backward-compatible `?limit=&offset=` pagination metadata across WMS lists. | Verified in Tests `#82`, `#89` + existing `#1–#79`. |

---

## 3. Warehouse & Inventory Frontend Documentation

### Warehouse Management Operations (`WarehouseDirectoryTab`, `WarehouseSettingsAlertsTab`)
- **Directory & Topology:** Lists warehouses scoped by RBAC (`4` for global roles, `2` for `whmanager`, `1` for `whkeeper`/`qcinspector`), supports warehouse creation/status toggle (`warehouse:create`), metadata/bin-tracking edits (`warehouse:manage`), bin creation (`STORAGE`, `RECEIVING`, `STAGING`, `QC_HOLD`, `DISPATCH`, `DAMAGED`), `DEFAULT` bin protection, and `warehouse_staff` assignment/removal.
- **Policy & Alerts:** Displays `warehouse_settings` (`adjustment_approval_threshold`, `write_off_requires_factory_manager`, `grn_over_delivery_tolerance_pct`, `fifo_override_requires_reason`, `max_hours_in_transit`), provides delayed-transfer alert scanning, and renders role/warehouse-scoped notifications with mark-read controls.

### Inventory Management Operations (`InventoryCatalogTab`, `InboundQcTab`, `OutboundTransfersTab`, `ControlReportsTab`)
- **Inventory & Catalog:** Real-time stock balance inquiry (by warehouse, bin, SKU, stock status: `AVAILABLE`, `QUARANTINE`, `HOLD`, `DAMAGED`, `SCRAP`, `IN_TRANSIT`), lot & fabric roll register, immutable `stock_movements` ledger viewer, material category & SKU forms with `attributes_json` editor, reorder levels, and QC configuration flags.
- **Receiving & QC:** Draft GRN creation, line item input with live reconciliation equation check (`received = accepted + rejected + damaged + pending`), atomic GRN posting, Finished Goods handover receiving, pending QC inspection queue (`passed` / `rejected` / `damaged` splits), QC history, and QC Manager senior override (`POST /api/warehouse/qc/override`).
- **Requisitions, Issuing, Returns & Transfers:** Production/department material requisitions (`DRAFT → SUBMITTED → APPROVED/REJECTED/CANCELLED`), stock issue execution with `DEC-04` advisory FIFO override reason capture, material returns (`USABLE_SURPLUS`, `DAMAGED`, `WASTE_SCRAP`), internal bin moves, and 2-step inter-warehouse dispatch & discrepancy receipt.
- **Control & Valuation:** Physical cycle/full count sheets (`IN_PROGRESS → SUBMITTED_FOR_REVIEW → APPROVED_AND_POSTED`), reason-coded stock adjustments & write-offs with maker-checker & Factory Manager threshold escalation (`DEC-08`), 3-stage reorder workflow (`DEC-10`: Warehouse Manager → Purchasing Manager → Factory Manager), Global WAC valuation report (masked for unauthorized roles), and ledger reconciliation check.

---

## 4. Integration & Backend Capability Boundaries

- All frontend screens bind directly to real backend REST endpoints via `frontend/src/services/api.ts`; no mock/simulated stock balances or client-side ledger mutations exist.
- **Documented Future-Phase Boundaries (Not Implemented by Design):**
  - **Purchasing PO Master / Supplier Invoices:** Outside Phase 07 scope (`po_reference` strings on GRNs & Reorder Requests bridge inbound references until Phase 08 Purchasing).
  - **Production Execution / Cutting & Sewing Consumption Orders:** Outside Phase 07 scope (Material Requisitions & FG Handover bridge production staging until Phase 08+ Execution).

---

## 5. Testing Report

### A. Automated Backend Integration Test Suite (`npm test` on `pg-mem v3.0.14`)
- **Command:** `npm test` (`DATABASE_URL` unset → `pg-mem v3.0.14`)
- **Result:** **89 / 89 tests PASSED** (`0` failed, `0` skipped) in `15.50s`
  - **Core Auth, Users, Audit, Production & Departments (`#1–#55`):** All passed (0 regressions).
  - **WMS End-to-End Business Logic (`#56–#74`):** All passed (`stock_movements` immutability, RBAC/valuation isolation, warehouse/dept/line scopes, GRN/WAC/QC/Requisition/FIFO Issue/Returns/Transfers/Stock Counts/Adjustments/Reorders/FG Handover/Notifications/Ledger Reconciliation).
  - **RBAC Role Clarification & Planning (`#75–#79`):** All passed.
  - **Phase 07 Security, RBAC, Transaction & Pagination Tests (`#80–#89`):**
    - `#80` Login Rate Limiter Enforcement (HTTP 429 & Reset) — **PASSED**
    - `#81` CORS Strict Origin Policy & Security Headers — **PASSED**
    - `#82` Positive Int Route Validation & Transaction Rollback (Production) — **PASSED**
    - `#83` Admin Self-Deactivation & Last-Admin Protection — **PASSED**
    - `#84` Notification IDOR Prevention (`PUT /warehouse/notifications/:id/read`) — **PASSED**
    - `#85` Warehouse Create/Status Authority & Scope Enforcement — **PASSED**
    - `#86` QC Inspector Warehouse Scope vs QC Manager Senior Override — **PASSED**
    - `#87` Production Manager & Department Manager Corrected RBAC Scopes — **PASSED**
    - `#88` Phase 07 Operational UAT Accounts & Warehouse Staff Assignments — **PASSED**
    - `#89` WMS List Pagination Metadata & Backward-Compatible Shapes — **PASSED**

### B. Frontend Typecheck & Production Build
- `tsc --noEmit` (`npm run lint`): **PASSED (0 errors)**
- `vite build` (`npm run build`): **PASSED**

### C. Live Server HTTP & RBAC Smoke Check (`http://localhost:3000`)
- Verified `GET /` returns `200` with application root.
- Authenticated all 10 live accounts (`admin`, `manager`, `whmanager`, `whkeeper`, `qcmanager`, `qcinspector`, `purchasing`, `prodmanager`, `deptuser`, `finance`) against `/api/auth/login`, `/api/warehouses`, `/api/inventory/balances`, `/api/warehouse/notifications`, and `/api/inventory/valuation`, confirming warehouse count scoping (`4 / 4 / 2 / 1 / 4 / 1 / 4 / 4 / 0 / 4`) and valuation masking (`200` for Admin/FM/WM/Finance, `403` for Keeper/QC/Purchasing/ProdMgr/DeptMgr).

### D. Environment-Blocked Checks (**NOT VERIFIED**)
1. **Live PostgreSQL 14+ Execution (`NOT VERIFIED`):** Container lacks `postgresql`/`psql` and `DATABASE_URL` is unset. Live MVCC `SELECT ... FOR UPDATE` concurrency locking, `trg_stock_movements_immutable` PL/pgSQL trigger behavior, and real PG constraint error paths must be verified on a local/staging PostgreSQL 14+ instance before production cutover using:
   ```bash
   npm run db:migrate
   npm test
   ```
2. **Headless Browser UI Click-Through (`NOT EXECUTED`):** Chromium/Playwright binaries are not installed in this container (`which chromium` / `playwright` absent). Frontend rendering and compilation were verified via `tsc --noEmit`, `vite build`, and live port 3000 HTTP checks; interactive browser UAT in Chrome/Edge should be executed locally across the LoginPage quick-fill UAT presets.

---

## 6. Remaining Issues & Phase 08 Recommendations

1. **PostgreSQL 14+ Staging Verification:** Execute `npm run db:migrate` and `npm test` against a live PostgreSQL 14+ database to verify all `13` tracked migration/seed scripts (`001`–`006` migrations, `001`–`007` seeds), `41` relational tables, trigger immutability, and concurrent `FOR UPDATE` stock reservation/issuing load.
2. **Distributed Rate-Limit Store (Future Prod Scaling):** `rate-limit.middleware.ts` currently uses an in-memory map suitable for single-instance deployment; replace with Redis/PostgreSQL backing if horizontally scaling behind multiple Node instances.
3. **Phase 08 Recommendations:**
   - **Phase 08A – Purchasing & Supplier Order Management:** Introduce `purchase_orders` and `purchase_order_items`, linking `reorder_requests` (`LINKED_TO_PO`) directly to `goods_receipts` so `expected_qty` and partial PO receipt tracking pull from authoritative PO lines.
   - **Phase 08B – Production Execution & Work Orders:** Introduce garment Style/BOM & Cut/Sew Production Orders that link directly to `material_requisitions`, line consumption, and `finished_goods/receive` handovers.
