# GFMS – Standardized API Conventions & Engineering Standards

**Application:** Garment Factory Management System (GFMS v0.3)  
**Scope:** Canonical REST, Validation, RBAC, Audit & Transaction Standards for existing remediation and all future GFMS modules.

---

## 1. Backward Compatibility Policy

Existing endpoints under `/api/*` MUST NOT break active frontend consumers or automated tests (`#1`–`#74+`). Changes to legacy controllers (`DepartmentController`, `ProductionController`, `UserController`) to match these standards must be additive (preserving `success`, `data`, `message` fields while standardizing `error: { code, message, details }`).

---

## 2. URL & Endpoint Naming Standards

1. **Base Path**: `/api` (future breaking API generations reserve `/api/v2/...`; additive evolution remains under `/api`).
2. **Resource Nouns**: Lowercase plural kebab-case for collections (`/api/departments`, `/api/audit-logs`, `/api/warehouses`, `/api/warehouse/requisitions`, `/api/purchase-orders`).
   - *Legacy Grandfather Clause*: Existing singular `/api/warehouse/*` and `/api/inventory/*` prefixes from Phase 04 remain permanent for backward compatibility. New future modules MUST use plural module/resource roots (`/api/hr/employees`, `/api/planning/plans`, `/api/purchasing/orders`, `/api/qc/inspections`, `/api/transportation/schedules`).
3. **Relationship Nesting**: Max 2 levels deep for ownership sub-resources:
   - `GET/POST /api/<parent>/:id/<subresource>` (e.g., `/api/warehouses/:id/locations`, `/api/departments/:id/employees`).
4. **Workflow Command / State-Transition Routes**: Use explicit `POST` action sub-paths for irreversible or multi-step transitions with side effects:
   - `POST /api/<module>/<resource>/:id/submit`
   - `POST /api/<module>/<resource>/:id/approve`
   - `POST /api/<module>/<resource>/:id/reject`
   - `POST /api/<module>/<resource>/:id/cancel`
   - `POST /api/<module>/<resource>/:id/post`
5. **Status Toggles**: `PUT /api/<module>/<resource>/:id/status` with `{ "status": "..." }`.

---

## 3. Request Validation Standard

1. **Body Presence & Required Keys**: Use `validateBody([...requiredFields])` on all `POST`/`PUT` routes requiring JSON payloads.
2. **Route & Query Parameter Parsing**:
   - Every `:id` or numeric query parameter MUST be parsed with `parsePositiveInt(val, fieldName)` -> returns `400 VALIDATION_ERROR` (never raw `parseInt` passing `NaN` into SQL).
3. **Numeric & Decimal Validation**:
   - Quantities strictly $> 0$: `parsePositiveNumber` rounded to 4 decimal places (`roundQty`, `DECIMAL(14,4)` compatible).
   - Costs / tolerances $\ge 0$: `parseNonNegativeNumber`.
   - Enums: Strictly validated via `parseEnumValue(val, ALLOWED_VALUES, fieldName)` matching database `CHECK` constraints.
4. **Pagination Parameters**:
   - `limit`: integer clamped to `1..200` (default `50`). Reject non-integer or `<= 0` with `400 VALIDATION_ERROR`.
   - `offset`: integer `>= 0` (default `0`).

---

## 4. Standard Response Envelope & Error Structure

### 4.1 Success Envelopes
- **Single Resource / Command**:
```json
{
  "success": true,
  "message": "Optional human-readable outcome",
  "data": { }
}
```
- **Collection (Paginated Standard for new & updated list endpoints)**:
```json
{
  "success": true,
  "data": [ ],
  "pagination": {
    "total": 128,
    "limit": 50,
    "offset": 0
  }
}
```
*(Health probe `/api/health` intentionally keeps `{ status, database, server }` for infrastructure monitor compatibility.)*

### 4.2 Canonical Error Envelope
All middleware, controllers, and global `errorHandler` MUST return:
```json
{
  "success": false,
  "error": {
    "code": "MACHINE_READABLE_ERROR_CODE",
    "message": "Clear, safe operational or validation message (never stack traces or SQL internals)",
    "details": null
  },
  "timestamp": "2026-11-09T12:00:00.000Z"
}
```
- **Rule**: Services MUST throw typed `HttpError` objects (`statusCode`, `code`, `message`, optional `details`) rather than raw `new Error(...)` so `400`/`403`/`404`/`409` never leak as `500`.

### 4.3 Standard HTTP Status & Error Code Matrix

| HTTP Status | Standard Error Code(s) | Mandatory Use Case |
|---|---|---|
| `400` | `VALIDATION_ERROR`, `BAD_REQUEST`, `BIN_REQUIRED`, `GRN_RECONCILIATION_MISMATCH`, `OVER_DELIVERY_EXCEEDED`, `QC_REQUIRED_ON_RECEIPT`, `FIFO_OVERRIDE_REASON_REQUIRED` | Missing/malformed fields, invalid `:id`, enum mismatch, business math/policy violation |
| `401` | `UNAUTHORIZED`, `TOKEN_EXPIRED`, `INVALID_TOKEN`, `USER_NOT_FOUND`, `INVALID_CREDENTIALS` | Missing/expired/forged JWT, wrong login credentials |
| `403` | `FORBIDDEN`, `ACCOUNT_DEACTIVATED`, `ACCOUNT_INACTIVE`, `MAKER_CHECKER_VIOLATION`, `FACTORY_MANAGER_APPROVAL_REQUIRED` | Inactive account, missing permission, scope violation (dept/warehouse/line), maker-checker block |
| `404` | `NOT_FOUND` | Referenced entity ID or setting key does not exist |
| `409` | `CONFLICT`, `USERNAME_EXISTS`, `ALREADY_POSTED`, `QC_QUANTITY_EXCEEDED`, `REQUISITION_NOT_APPROVED`, `INSUFFICIENT_STOCK`, `INSUFFICIENT_AVAILABLE_STOCK`, `RETURN_EXCEEDS_ISSUED`, `INVALID_REORDER_STAGE`, `VERSION_CONFLICT`, `IDEMPOTENCY_PAYLOAD_MISMATCH` | Duplicate unique key, invalid workflow state transition, insufficient balance, dependency delete block |
| `500` | `INTERNAL_SERVER_ERROR` | Unhandled server/DB failure only |

---

## 5. Filtering, Sorting & Pagination Standards

- **Standard Query Params**:
  - Filters: exact snake_case DB field names (`?warehouse_id=1&department_id=11&status=active`).
  - Search: `?search=` parameterized via `ILIKE` across approved display/code columns.
  - Sorting: `?sort_by=<whitelist_key>&sort_dir=asc|desc` mapped through an explicit server-side column whitelist (never interpolate raw user strings into `ORDER BY`).
  - Pagination: `?limit=50&offset=0`.

---

## 6. Authentication, RBAC & Scope Precedence

1. **Zero Trust Middleware Ordering**:
   `authenticateJWT` → `requirePermission(...)` / `requireAnyPermission(...)` → `require<Domain>Scope(...)` → `validateBody(...)` → Controller → Service defense-in-depth checks.
2. **Scope Enforcement Rules**:
   - **No Frontend Security Assumption**: UI visibility never replaces backend route + service checks.
   - **Default Deny**: Scoped roles (`Department Manager`, `Warehouse Manager`, `Warehouse Keeper`, Line Supervisor) are denied (`403`) whenever scope cannot be verified authoritatively against database ownership tables (`departments.manager_id`, active `warehouse_staff` effective window, `production_lines.supervisor_id`).
   - **Data Masking**: Sensitive financial/HR fields (e.g., `weighted_avg_cost`, `total_inventory_value`, future payroll/evaluation fields) MUST be stripped at the service projection layer unless the caller holds the dedicated valuation/HR permission.
   - **System Administrator Operational Segregation**: Administrative setup permissions (`users:*`, `roles:*`, `warehouse:manage`, `warehouse:settings:manage`) are strictly decoupled from operational execution and financial/quality approvals.

---

## 7. Audit Event & Transaction Standards

1. **Audit Event Naming**: `<MODULE>_<ENTITY>_<ACTION>` in `UPPER_SNAKE_CASE` (e.g., `WMS_GRN_POST`, `WMS_STOCK_ISSUE`, `DEPT_EMPLOYEE_TRANSFER`, `PUR_PO_APPROVE`).
2. **Transactional Atomicity**:
   - Every state mutation affecting 2+ tables, balance quantities, financial valuation, approvals, or audit history MUST execute inside `withTransaction(async (txQuery) => ...)`.
   - `AuditService.log({ ... }, txQuery)` MUST receive `txQuery` so audit events commit or roll back atomically with the underlying business state.
3. **Locking Order Rule (Deadlock Prevention)**:
   - When acquiring multiple `SELECT ... FOR UPDATE` locks inside a transaction, lock parent document first, then line items ordered `ORDER BY id ASC`, then `inventory_balances` ordered `ORDER BY id ASC` (or `(warehouse_id, location_id, material_id, lot_key)`), then `materials` (`ORDER BY id ASC`).

---

## 8. API Versioning & Evolution Strategy

- **Current Generation (`/api`, v0.x)**: Non-breaking additive changes only (new optional fields, new endpoints, standardized `error.code` additions, optional `?limit`/`?offset` query support).
- **Breaking Changes Policy**: Any future payload-breaking change MUST be introduced under `/api/v2/...` with `Deprecation` and `Sunset` HTTP response headers on deprecated routes for a minimum transition window before removal.
