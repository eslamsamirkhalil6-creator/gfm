# GFMS – API Architecture Review & Compatibility Assessment

**Application:** Garment Factory Management System (GFMS v0.3)  
**Phase:** 05 – API Architecture Review & Cross-Module Integration Contracts  
**Source of Truth:** Inspected directly from `backend/src/*`, `database/migrations/*`, and `database/seeds/*`.

---

## 1. Existing Backend Architecture Overview

GFMS runs a single Express 4 REST API mounted under `/api` (`backend/src/app.ts`, `backend/src/routes/index.ts`), backed by PostgreSQL (`pg`) with an automatic `pg-mem v3.0.14` in-memory fallback when `DATABASE_URL` is absent or unreachable (`backend/src/config/database.ts`).

### 1.1 Registered Modules & Mount Topology

| Module | Source Directory / Files | Mount Prefix | Primary Auth / Scope Guards |
|---|---|---|---|
| **Health** | `modules/health/health.controller.ts` | `/api/health` | Public |
| **Authentication** | `modules/auth/*` | `/api/auth/*` | Public (`login`, `logout`) + `authenticateJWT` (`me`) |
| **Users & Roles** | `modules/users/*` | `/api/users/*`, `/api/roles` | `authenticateJWT` + `requirePermission('users:*' / 'roles:read')` |
| **Audit Trail** | `modules/audit/*` | `/api/audit-logs` | `authenticateJWT` + `requirePermission('audit:read')` |
| **Diagnostics** | `tests/runner.ts` | `/api/tests/run` | `authenticateJWT` + `requireRole('System Administrator')` |
| **Production** | `modules/production/*` | `/api/production/*` | `authenticateJWT` + `requirePermission('production:*')` |
| **Departments** | `modules/departments/*` | `/api/departments/*` | `authenticateJWT` + `requireDepartmentListAccess` / `requireDepartmentScope` / `requireDepartmentTargetScope` / `requirePermission` |
| **WMS (Phase 04)** | `modules/warehouse/*` | `/api/warehouses/*`, `/api/warehouse/*`, `/api/inventory/*` | `authenticateJWT` (`wmsRouter.use(authenticateJWT)`) + `requirePermission` / `requireAnyPermission` + `requireWarehouseScope` / `requireProductionLineScope` |

---

## 2. Module-by-Module Evaluation

### 2.1 REST Naming Conventions & Resource Hierarchy
- **Verified**: Nested resource patterns cleanly express ownership across newer modules (`/departments/:id/employees`, `/warehouses/:id/locations`, `/warehouses/:id/staff`, `/warehouse/requisitions/:id/items`). Action transitions follow explicit verb sub-paths (`/post`, `/submit`, `/approve`, `/reject`, `/cancel`, `/review`, `/receive`, `/inspect`, `/dispatch`, `/status`).
- **Minor Naming Inconsistencies**:
  - WMS splits prefixes between plural `/api/warehouses/:id/...` (warehouse instances), singular `/api/warehouse/...` (catalog, GRN, QC, requisitions, issues, returns, transfers, counts, adjustments, reorders, FG, notifications, settings), and `/api/inventory/...` (ledger & inquiry views). All routes are cleanly mounted without collision, and breaking changes are avoided by keeping current paths intact.
  - Overlapping stock inquiry endpoints: `GET /api/warehouses/:id/stock` duplicates a subset of `GET /api/inventory/balances?warehouse_id=:id` (supporting fewer query filters than `/inventory/balances`).

### 2.2 HTTP Methods & Status Codes
- **Verified**: `GET` (reads, except `/api/tests/run` which executes the in-memory test harness), `POST` (resource creation & state-machine commands), `PUT` (full updates, status toggles, settings, mark-read, employee transfer, stock count item entry), `DELETE` (staff unassignment, empty unused department deletion).
- **Status Codes**: Creations consistently return `201` (except `POST /api/departments/:id/employees` which returns `200`, and `POST /api/warehouse/grns/:id/post` / workflow actions which return `200`).
- **Correction Needed**:
  - `DepartmentService` throws plain `new Error(...)` without `statusCode` / `code` in several places (`getDepartmentById` line 186, `removeEmployee` line 886, `deleteDepartment` lines 912/919/927/935), causing `errorHandler` to return **HTTP `500 INTERNAL_SERVER_ERROR`** instead of `404` or `409`.

### 2.3 Request & Response Structures
- **Success Envelope**: All controllers except `HealthController` wrap responses in `{ success: true, data, message? }`. `AuditController.getLogs` additionally includes `pagination: { total, limit, offset }`. (`HealthController` intentionally returns `{ status, database, server }` for standard health probes.)
- **Error Envelope Inconsistencies (Correction Needed)**:
  - Canonical format (used by `errorHandler`, `auth.middleware.ts`, `validation.middleware.ts`, `WarehouseController`, `UserController`): `{ success: false, error: { code, message, details? }, timestamp? }`.
  - `DepartmentController` inline `400` responses (lines 52, 67, 82, 109, 134, 156, 186, 210, 245, 266) return `{ success: false, message: '...' }` **without** an `error` object.
  - `ProductionController` inline `400` responses (lines 65, 138, 193, 258, 273, 298) return `{ success: false, error: { message: '...' } }` **without** `error.code`.
  - Global `errorHandler` attaches `timestamp`, whereas middleware/controller early returns do not.

### 2.4 Pagination, Filtering & Sorting
- **Verified Filtering**:
  - `Departments`: `?status=`, `?parent_id=`, `?search=`
  - `Production`: `GET /production/lines?hallId=`
  - `Audit`: `?action=&limit=&offset=` (with pagination metadata and clamped `Math.min(limit || 50, 200)`).
  - `WMS`:Rich domain filters across balances, lots, movements, GRNs, QC, requisitions, transfers, counts, adjustments, reorders, and notifications (`limit` capped on `queryMovements` up to 500 and `listNotifications` up to 300).
- **Gaps Identified**:
  - `AuditService.getLogs` uses `limit || 50` without checking negative/zero values (`limit=-1` or `offset=-1` could error in SQL).
  - High-volume WMS list endpoints (`listGrns`, `listRequisitions`, `listIssues`, `listReturns`, `listTransfers`, `listStockCounts`, `listAdjustments`, `listReorders`, `queryBalances`, `queryLots`) currently return complete filtered arrays without `limit`/`offset` pagination metadata. Under multi-year factory volume, pagination (`limit`, `offset`, `pagination` object) will be needed as an additive backward-compatible enhancement.

### 2.5 Input Validation
- **Verified**: `validateBody(requiredFields)` catches missing/empty-string required fields across routes. WMS additionally provides centralized typed validators in `warehouse.errors.ts` (`parsePositiveInt`, `parsePositiveNumber`, `parseNonNegativeNumber`, `parseEnumValue`, `roundQty`) and strict business equation validation (GRN reconciliation equation, `PARAM-03` tolerance, `DEC-05` QC quarantine guard, `DEC-04` FIFO override reason check).
- **Correction Needed**:
  - `UserController.updateUserStatus` / `updateUserRoles` (`parseInt(req.params.id, 10)`) and `ProductionController` (`updateHall`, `toggleHallStatus`, `updateLine`, `toggleLineStatus`, `updateStage`, `toggleStageStatus`, `getWorkflow`, `updateWorkflow`, `reorderWorkflowSteps`, `toggleWorkflowStatus`, `listLines?hallId=`) lack `isNaN` validation on `:id`, allowing `NaN` to hit PostgreSQL queries and produce `500` errors.
  - `ProductionController.createLine` / `updateLine` uses truthiness (`supervisor_id ? ... : null`) instead of explicit numeric validation.
  - `WarehouseController.scanDelayedTransfers` reads `Number(req.body.max_hours_in_transit)` and passes to `parseNonNegativeNumber`, which handles `NaN`/`<0`, though upper-bound/default handling is solid.

### 2.6 Authentication, Permission & Scope Enforcement
- **Verified**:
  - `authenticateJWT` validates signature & expiry and re-queries PostgreSQL live (`is_active`, roles, permissions, `managed_department_ids`, `managed_warehouse_ids`, `supervised_line_ids`). Account deactivation and warehouse staff revocation apply immediately.
  - Multi-layered scopes (`requireDepartmentScope`, `requireDepartmentTargetScope`, `requireWarehouseScope`, `requireProductionLineScope`) plus service-layer defense-in-depth checks (`WarehouseInboundService`, `WarehouseOutboundService`, `WarehouseControlService`, `WarehouseMasterService`, `DepartmentService`).
- **Correction Needed**:
  - `WarehouseMasterService.markNotificationRead(notificationId, actor)` (`warehouse-master.service.ts:1144`) updates `warehouse_notifications` by `id` without validating that the notification belongs to `actor.id`, `actor.roles`, or `actor.managed_warehouse_ids`.
  - `WarehouseController.createWarehouse` / `toggleWarehouseStatus` checks `hasGlobalWarehouseAccess(req.user!)`, which checks membership in `GLOBAL_WAREHOUSE_ROLES` (7 roles including `Finance Viewer`, `Purchasing Manager`, etc.); while route `requirePermission('warehouse:manage')` limits this to `System Administrator` and `Factory Manager` in seeded roles, granting `warehouse:manage` to a custom role containing `QC Inspector` would allow warehouse creation unless explicitly restricted to `System Administrator` / `Factory Manager`.

### 2.7 Transaction Boundaries & Audit Logging
- **Verified**:
  - Phase 04 WMS writes (`inventory-engine.service.ts`, inbound, outbound, control, master) consistently run inside `withTransaction(async (txQuery) => ...)`, using `SELECT ... FOR UPDATE` on balances, GRN headers, requisitions, requisition items, transfers, counts, and adjustments, and execute `AuditService.log(..., txQuery)` **inside the same transaction**.
  - `DepartmentService.assignManager`, `assignEmployee`, `transferEmployee` use `withTransaction` + `AuditService.log(..., txQuery)`.
- **Correction Needed (Legacy Non-Transactional Audit/Write Paths)**:
  - `UserService.createUser`, `updateUserStatus`, and `updateUserRoles` execute multi-statement DB mutations and `AuditService.log(...)` sequentially outside `withTransaction`.
  - `ProductionService` mutations execute updates and `AuditService.log(...)` outside `withTransaction` (except workflow creation/step reorder — verify if `ProductionService.createWorkflow` wraps `tx`).
  - `DepartmentService.removeEmployee` and `deleteDepartment` execute `DELETE` then `AuditService.log` outside `withTransaction`.
  - `WarehouseMasterService.markNotificationRead` logs `WMS_NOTIFICATION_READ` after updating `warehouse_notifications` outside a transaction.

### 2.8 Documentation Discrepancies Fixed/Identified
Verified discrepancies in pre-Phase-05 `docs/API_SPECIFICATION.md`:
1. Duplicate `## 7.` section numbers (Department Management and WMS both numbered `## 7.`).
2. `GET /api/health` example listed `tables_count: 6` (stale v0.1 value; live schema with `005` has `40` tables).
3. `POST /api/auth/login` and `GET /api/auth/me` examples omitted `managed_department_ids`, `primary_department_id`, `managed_warehouse_ids`, and `supervised_line_ids`.
4. `GET /api/tests/run` documented `- Auth: Protected`, omitting that `routes/index.ts:373` restricts it to `requireRole('System Administrator')`.
5. Missing documented endpoints present in `routes/index.ts`:
   - `GET /api/departments/:id/lines`
   - `GET /api/departments/:id/assignable-users`
   - `PUT /api/production/stages/:id` & `PUT /api/production/stages/:id/status`
   - `GET /api/production/workflows/:id`, `PUT /api/production/workflows/:id`, `PUT /api/production/workflows/:id/status`

*(Updated in `docs/API_SPECIFICATION.md` during Phase 05.)*

---

## 3. Warehouse Integration Readiness Validation

| Integration Area | Verified Behavior in Phase 04 Codebase | Validation Result |
|---|---|---|
| **Production Material Requisitions** | `material_requisitions` references `departments(id)` (`ON DELETE RESTRICT`) and optional `production_lines(id)` (`ON DELETE SET NULL`), plus free-text `reference_type` / `reference_code`. `DRAFT -> SUBMITTED -> APPROVED` reserves `AVAILABLE` stock (`DEC-06`) before picking is allowed (`409 REQUISITION_NOT_APPROVED`). | **Verified Compatible** |
| **Production-Line Scope** | `requireProductionLineScope({ requireLineWhenSupervisorOnly: true })` validates `production_lines.department_id == department_id` (`400` on spoofing) and binds Line Supervisors strictly to `supervised_line_ids` derived from `production_lines.supervisor_id`. | **Verified Compatible** |
| **Finished Goods Handover** | `POST /api/warehouse/finished-goods/receive` verifies `category_type === 'FINISHED_GOOD'`, target warehouse `FINISHED_GOODS`/`GENERAL`, auto-uses `DEFAULT` bin (`WH-FG` has `require_bin_tracking = FALSE`), captures `department_id` + optional `production_line_id` + `handover_ref`, and routes `requires_qc_on_receipt` items into `QUARANTINE`. | **Verified Compatible** |
| **Quality Inspection Gates** | Keepers cannot post `AVAILABLE` on QC-required SKUs (`400 QC_REQUIRED_ON_RECEIPT`). Only `inventory:qc_inspect` transitions `QUARANTINE -> AVAILABLE` (updating Global WAC) or `DAMAGED`/`SCRAP`. Over-inspection blocked (`409 QC_QUANTITY_EXCEEDED`). | **Verified Compatible** |
| **Purchasing-to-GRN Boundaries** | Zero hard dependency on unbuilt PO tables. `goods_receipts.po_reference` stores external PO strings across multiple partial deliveries; `goods_receipt_items.expected_qty` enforces `PARAM-03` tolerance; `reorder_requests` enforces `OPEN -> SUBMITTED -> PURCHASING_REVIEWED -> APPROVED` (`DEC-10`). | **Verified Compatible** *(cumulative multi-GRN cap deferred to Purchasing module PO lines)* |
| **Inventory Valuation Access** | `weighted_avg_cost` and `total_global_valuation` are stripped on `/inventory/balances`, `/warehouses/:id/stock`, and `/inventory/summary` unless caller holds `warehouse:reports:valuation`. Dedicated `/inventory/valuation` and `/inventory/reconcile` require `warehouse:reports:valuation`. | **Verified Compatible** |
| **Warehouse Approvals** | `PARAM-01` defaults to `UNCONFIGURED` (routing all adjustments to Factory Manager); `WRITE_OFF` unconditionally enforces `requires_factory_manager = true` + `inventory:adjust:approve_high` (`DEC-08`); maker-checker blocks self-approval in service + DB `CHECK`. | **Verified Compatible** |
| **Audit Trail Consistency** | Dual complementary traceability: security/actor decisions in `audit_logs` (`WMS_*`) and immutable quantity/cost deltas in `stock_movements`, committed together inside `withTransaction` (`33` distinct `WMS_*` audit event types verified). | **Verified Compatible** |

---

## 4. Offline-First Local Network Compatibility Assessment

GFMS targets deployment on a **factory Local Area Network (LAN)** with a local PostgreSQL/Node server and multiple shop-floor terminals/tablets that may experience intermittent Wi-Fi drops, browser refreshes during submission, or concurrent scans.

### 4.1 Current Compatibility Strengths
1. **Zero Cloud Coupling**: Runs purely on local Node.js + PostgreSQL (`pg`) with zero external auth, cloud storage, or third-party SaaS dependencies.
2. **ACID Balance Locking**: `withTransaction` + `SELECT ... FOR UPDATE` protects PostgreSQL inventory balances against lost-update race conditions when two kiosks issue or adjust stock concurrently.
3. **Database Uniqueness Guards**: `UNIQUE(sku)`, `UNIQUE(material_id, lot_number, roll_number)`, normalized `lot_key` balance uniqueness, and `UNIQUE(warehouse_id, user_id)` block duplicate master creations at the database layer.
4. **Dual Immutable Ledger**: `stock_movements` + `audit_logs` are append-only, allowing deterministic event replay and reconciliation (`/inventory/reconcile`).

### 4.2 Architectural Gaps & Mandatory Requirements Before Offline Queueing
To safely support offline-first client buffering and automatic retries in future phases, the following API capabilities are required (not yet implemented):

1. **Idempotency Keys (`Idempotency-Key` Header / `client_request_id`)**:
   - *Gap*: Currently, calling `POST /api/warehouse/grns`, `POST /api/warehouse/requisitions`, `POST /api/warehouse/issues`, `POST /api/warehouse/returns`, or `POST /api/warehouse/transfers/internal` twice on a flaky LAN creates **two** distinct documents (`generateDocRef()` mints a new ref per request) or double-deducts stock. (Only `POST /grns/:id/post`, `approve`, and `qc/inspect` protect against double-application via document state / remaining qty checks.)
   - *Requirement*: Future mutating endpoints (`POST`/`PUT`) must accept `Idempotency-Key` (UUIDv4) persisted in an idempotency ledger keyed by `(user_id, method, path, idempotency_key)` storing payload hash + cached HTTP response within transaction boundaries. Mismatched payload with same key returns `409 IDEMPOTENCY_PAYLOAD_MISMATCH`.
2. **Duplicate Request & Action Replay Protection**:
   - Require unique `client_tx_uuid` on offline-queued inventory postings (`stock_issues`, `material_returns`, `warehouse_transfers`, `stock_adjustments`, `qc_inspections`) enforced by unique DB index so delayed retries never duplicate movements.
3. **Optimistic Concurrency & Conflict Detection (`version` / `updated_at` / `ETag`)**:
   - *Gap*: `PUT /warehouses/:id`, `PUT /warehouse/materials/:id`, `PUT /production/lines/:id`, `PUT /departments/:id`, and `PUT /warehouse/counts/:id/items` apply last-write-wins overwrites without checking an expected `version` or `If-Match`.
   - *Requirement*: Mutable documents and master records should expose an integer `version` (or ISO `updated_at` `ETag`) and return `409 VERSION_CONFLICT` when an offline client edits stale state.
4. **Synchronization Identifiers & Record Timestamps**:
   - Sequential PostgreSQL `SERIAL` IDs remain authoritative on the LAN server; offline clients must track a temporary `client_local_id` alongside server-assigned `id` and an immutable `sync_uuid` (UUID) for cross-device correlation.
   - Distinguish `client_occurred_at` (when scanned offline on the floor) from `server_created_at` (`NOW()`, authoritative for FIFO/ledger ordering and audit timeline).
5. **Retry-Safe Operations & Conflict Resolution Policy**:
   - Safe auto-retry: Read-only queries (`GET`), draft creation with idempotency key, mark-read (`PUT /notifications/:id/read`), status toggles.
   - Server-reconciled / non-blind-retry: Stock consumption (`ISSUE`, `TRANSFER`, `ADJUSTMENT OUT`) where stock may have been consumed by another terminal while offline — server must reject with `409 INSUFFICIENT_STOCK` / `409 FIFO_OVERRIDE_REASON_REQUIRED` rather than forcing negative inventory.
6. **Offline Auditability**:
   - When offline-queued mutations sync later, `audit_logs` and `stock_movements` must record both the authenticated `actor_id` (not a shared terminal account), `client_occurred_at`, `server_synced_at`, and `idempotency_key` / `client_tx_uuid`.
