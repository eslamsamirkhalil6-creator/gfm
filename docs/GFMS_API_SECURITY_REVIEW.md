# GFMS – API Security Review

**Application:** Garment Factory Management System (GFMS v0.3)  
**Phase:** 05 – Security & Authorization Review  
**Source of Truth:** Verified against `backend/src/middleware/auth.middleware.ts`, `backend/src/config/env.ts`, `backend/src/routes/index.ts`, `backend/src/modules/*`, and `database/seeds/001..005`.

---

## 1. Authentication & Token Security (`JWT`)

### 1.1 Verified Controls
- **Password Hashing**: `bcryptjs` (`$2b$`, 10 salt rounds) across seeds and `UserService.createUser`; `password_hash` is stripped from all user list/login/me DTOs.
- **Live DB Re-Validation on Every Request**: `authenticateJWT` does **not** trust stale JWT claims. On every HTTP call, it verifies signature/expiry (`jwt.verify`) and queries PostgreSQL for `users.is_active`, `roles`, `permissions`, `managed_department_ids`, `managed_warehouse_ids`, and `supervised_line_ids`.
  - Deactivating a user (`users.is_active = FALSE`) blocks all active tokens immediately (`403 ACCOUNT_DEACTIVATED`).
  - Revoking a warehouse assignment (`DELETE /api/warehouses/:id/staff/:userId`) or changing department manager takes effect immediately on the next request.

### 1.2 Findings & Hardening Requirements
| Severity | Finding | Code Location | Required Remediation |
|---|---|---|---|
| **High** | Hardcoded fallback `JWT_SECRET` (`'gfms-super-secret-jwt-key-2026-production-prototype'`) is used if `.env` omits `JWT_SECRET`. | `backend/src/config/env.ts:16` | Fail fast at server startup when `NODE_ENV=production` and `JWT_SECRET` is missing or uses the prototype default. |
| **Medium** | `CORS_ORIGIN` defaults to `'*'` with `credentials: true`. | `backend/src/config/env.ts:19`, `app.ts:12` | Restrict `CORS_ORIGIN` to explicit LAN frontend origins in production `.env`. |
| **Medium** | No rate limiting on `POST /api/auth/login`. | `backend/src/routes/index.ts:26` | Add `express-rate-limit` (e.g., 10 attempts / 15 min per IP/username) before production LAN rollout. |
| **Low** | No token revocation list on password change or explicit logout. | `auth.service.ts:188` | Maintain `users.token_version` or `password_changed_at` claim check in `authenticateJWT` when password-reset UI/endpoints are added. |

---

## 2. RBAC & Permission Enforcement

### 2.1 Verified Controls
- Every endpoint except `/api/health`, `POST /api/auth/login`, and `POST /api/auth/logout` enforces `authenticateJWT` + explicit `requirePermission(...)`, `requireAnyPermission(...)`, `requireRole(...)`, or domain scope middleware.
- `Finance Viewer` holds read-only permissions (`dashboard:view`, `warehouse:view`, `warehouse:reports:valuation`) and receives `403` on all write endpoints.
- `Warehouse Keeper` holds operational execution permissions only (`receive`, `issue`, `return`, `transfer`, `count`, `adjust:propose`, `reorder:create`) and receives `403` on `inventory:qc_inspect`, `inventory:requisition:approve`, `inventory:adjust:approve*`, `inventory:reorder:review|approve`, `warehouse:reports:valuation`, and `warehouse:settings:manage`.

### 2.2 System Administrator Operational Segregation (Verified)
- Seed `005_seed_warehouse_data.sql` intentionally grants `System Administrator` ONLY administrative setup & read-only valuation (`warehouse:view`, `warehouse:manage`, `warehouse:materials:manage`, `warehouse:reports:valuation`, `warehouse:settings:manage`).
- Verified via automated test (`#57`): `System Administrator` is denied (`403`) on QC inspection (`POST /warehouse/qc/inspect`), requisition approval, adjustment/write-off approval, and reorder approval.
- **Residual Risk (Governance)**: Because `System Administrator` holds `users:roles` (`PUT /api/users/:id/roles`), a compromised SysAdmin account could assign itself an operational role. This is mitigated by immutable `USER_ROLES_UPDATE` audit logs and must be monitored via `audit-logs`.

### 2.3 Factory Manager Authority Boundaries (Verified)
- Holds `departments:view|edit|manage_manager|manage_employees|reports`, `production:*` (except `production:settings:manage`), `warehouse:view|manage|materials:manage|reports:valuation`, `inventory:requisition:approve`, `inventory:adjust:approve`, `inventory:adjust:approve_high`, `inventory:reorder:create|approve`.
- Intentionally excluded from `inventory:receive` and `inventory:transfer` (storekeeping execution roles) and `inventory:reorder:review` (`Purchasing Manager` stage 2) so stage separation (`DEC-10`) cannot be bypassed.

---

## 3. Multi-Dimensional Scope Enforcement

### 3.1 Department Scope (`requireDepartmentScope`, `requireDepartmentTargetScope`, `DepartmentService`)
- **Verified**:
  - `Department Manager` may view/update operational fields (`name`, `description`) and manage employees ONLY for departments where `departments.manager_id === req.user.id`.
  - Restricted fields (`manager_id`, `parent_id`, `status`) on `PUT /api/departments/:id` are blocked (`403`) in both middleware and `DepartmentService`.
  - Cross-department employee transfer (`PUT /api/departments/:id/employees/transfer`) verifies authorization on **BOTH** source and target departments in `requireDepartmentScope`, `requireDepartmentTargetScope`, and `DepartmentService.transferEmployee` inside `withTransaction`.
  - `/api/departments/:id/assignable-users` returns minimal `{ id, username, full_name }` active records scoped strictly to authorized managers (`403` for unrelated departments).

### 3.2 Warehouse Scope (`requireWarehouseScope` + Service Filters)
- **Verified**:
  - `Warehouse Manager` and `Warehouse Keeper` are restricted to `req.user.managed_warehouse_ids` (verified in `warehouse_staff` within effective dates or `warehouses.manager_id`).
  - Unassigned keepers receive `403` on warehouse-targeted reads/writes (`#58`) and empty filtered lists on list endpoints.
  - Inter-warehouse transfer dispatch requires source warehouse scope; transfer receipt (`POST /warehouse/transfers/:id/receive`) verifies target warehouse scope inside `WarehouseControlService.receiveInterWarehouseTransfer`.
- **Findings Requiring Correction**:
  1. **Medium — `PUT /api/warehouse/notifications/:id/read` Missing Scope/Ownership Check (`warehouse-master.service.ts:1144`)**: Any user with `warehouse:view`, `inventory:requisition:create`, or `inventory:qc_inspect` can mark any `notificationId` as read, even if targeted to a different user, role, or unassigned warehouse. Fix: assert actor matches `recipient_user_id` or (`target_role_name` + warehouse/global scope) before updating (`403` on mismatch).
  2. **Low — `createWarehouse` & `toggleWarehouseStatus` Global Check (`warehouse.controller.ts:75,97`)**: Checks `hasGlobalWarehouseAccess(req.user!)` (which lists 7 roles including `QC Inspector`, `Finance Viewer`, `Purchasing Manager`) alongside `requirePermission('warehouse:manage')`. While safe under current seeds, replacing with explicit `System Administrator` / `Factory Manager` role check hardens against custom role drift.

### 3.3 Production-Line Scope (`requireProductionLineScope`)
- **Verified**:
  - Validates that if both `department_id` and `production_line_id` are provided, `production_lines.department_id === department_id` (`400 VALIDATION_ERROR` on spoofing attempt — verified `#59`).
  - Line Supervisors (`production_lines.supervisor_id = user.id` without `Department Manager` / global production role) are forced to supply `production_line_id` (`requireLineWhenSupervisorOnly: true`) and denied (`403`) if targeting another line or another department.

---

## 4. Sensitive Valuation & Approval Controls

1. **Cost / Valuation Masking (Verified `#57`)**:
   - `WarehouseMasterService.queryBalances` omits `weighted_avg_cost` unless `actor.permissions.includes('warehouse:reports:valuation')`.
   - `WarehouseMasterService.getInventorySummary` omits `total_global_valuation` (`undefined`) unless `warehouse:reports:valuation` is present.
   - `GET /api/inventory/valuation` and `GET /api/inventory/reconcile` require `warehouse:reports:valuation`.
   - *Note*: `goods_receipt_items.unit_cost` / `stock_movements.unit_cost` appear in GRN/movement queries for warehouse operations; if strict procurement price confidentiality from keepers is needed in a future phase, mask `unit_cost` on `listGrns`/`getGrnById`/`queryMovements` unless `warehouse:reports:valuation` or `inventory:receive` is held.
2. **Approval & Maker-Checker Controls (Verified `#69`, `#70`, `#71`)**:
   - Adjustment `PARAM-01` defaults to `'UNCONFIGURED'` (requiring `Factory Manager` / `inventory:adjust:approve_high`).
   - `WRITE_OFF` unconditionally enforces `requires_factory_manager = true` at both service and DB `CHECK` levels.
   - Self-approval on adjustments and stock counts is rejected `403 MAKER_CHECKER_VIOLATION` in service logic and `CHECK (approved_by IS NULL OR approved_by <> submitted_by)` in SQL.

---

## 5. Input Validation & Error Leakage Audit

- **SQL Injection Safety**: All queries across all modules use parameterized `$1, $2, ...` placeholders. Zero raw string interpolation of user input into SQL `WHERE` or `ORDER BY` clauses.
- **Missing `:id` Numeric Validation (Correction Needed)**:
  - `UserController` (`updateUserStatus`, `updateUserRoles`) and `ProductionController` (`updateHall`, `toggleHallStatus`, `updateLine`, `toggleLineStatus`, `updateStage`, `toggleStageStatus`, `getWorkflow`, `updateWorkflow`, `reorderWorkflowSteps`, `toggleWorkflowStatus`) call `parseInt(req.params.id, 10)` without checking `isNaN(id)` or `id <= 0`, causing malformed URL IDs like `/api/users/abc/status` to trigger DB errors (`500`) instead of `400 VALIDATION_ERROR`.
- **Untyped Errors Turning Into 500s (Correction Needed)**:
  - `DepartmentService` lines 186, 886, 912, 919, 927, 935 throw raw `Error(...)` without `.statusCode`, returning HTTP `500` instead of `404` / `409`.
- **Stack Trace / Detail Leakage**: `errorHandler` logs stack traces server-side (`console.error`) and returns only `{ success: false, error: { code, message, details }, timestamp }` to clients.

---

## 6. Cross-Warehouse & Cross-Department Risk Register

| Risk ID | Risk Description | Current Mitigation | Residual Gap / Priority |
|---|---|---|---|
| **SEC-01** | Weak default `JWT_SECRET` in `env.ts` if unconfigured in prod | Requires `.env` override on deployment | Enforce non-default secret check on `NODE_ENV=production` (**High**) |
| **SEC-02** | Cross-user/warehouse notification mark-read (`PUT /warehouse/notifications/:id/read`) | None on update target | Add actor/role/warehouse ownership check before `UPDATE` (**Medium**) |
| **SEC-03** | Brute-force login attempts on `/api/auth/login` | Audit logging of `LOGIN_FAILED` | Add IP + account rate limiter (**Medium**) |
| **SEC-04** | Inter-warehouse transfer tampering (`WH-RAW` keeper receiving into `WH-TRIM`) | Blocked `403` in `WarehouseControlService.receiveInterWarehouseTransfer` | **Mitigated** |
| **SEC-05** | Cross-department employee transfer escalation | Enforced in route middleware + `DepartmentService` tx | **Mitigated** |
| **SEC-06** | Line Supervisor spoofing `department_id` vs `production_line_id` | Enforced in `requireProductionLineScope` (`400`) & `WarehouseOutboundService` | **Mitigated** |
| **SEC-07** | Legacy non-numeric `:id` / untyped `Error` returning `500` | WMS uses `parsePositiveInt` + typed errors | Remediate `UserController`, `ProductionController`, `DepartmentService` (**Low-Medium**) |
