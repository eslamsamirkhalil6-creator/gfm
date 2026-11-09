# GFMS v0.3 – Warehouse Management System (WMS) REST API Specification

**Base URL:** `/api`  
**Phase:** 04 – Backend Services & REST APIs  
**Authentication:** All WMS endpoints require `Authorization: Bearer <JWT_TOKEN>` validated live against PostgreSQL (`users`, `roles`, `permissions`, `warehouse_staff`, `departments`, `production_lines`).

---

## 1. Security, RBAC & Scope Rules

### 1.1 Auth Context Additions
`POST /api/auth/login` and `GET /api/auth/me` include:
- `managed_department_ids: number[]`
- `managed_warehouse_ids: number[]` *(active `warehouse_staff` assignments within `effective_from..effective_to` + active `warehouses.manager_id`)*
- `supervised_line_ids: number[]` *(from `production_lines.supervisor_id`)*

### 1.2 Scope Enforcement Rules
- **Global Warehouse Roles** (`System Administrator`, `Factory Manager`, `Production Manager`, `Purchasing Manager`, `Finance Viewer`, `QC Manager`, `QC Inspector`): bypass per-warehouse scoping where their route permissions permit.
- **Scoped Warehouse Roles** (`Warehouse Manager`, `Warehouse Keeper`, custom warehouse roles): strictly constrained to `managed_warehouse_ids`. Accessing or mutating an unassigned warehouse returns **`403 FORBIDDEN`**. Unassigned keepers are denied by default.
- **Department & Production Line Scopes**:
  - `Department Manager`: constrained to `managed_department_ids` on requisitions & approvals.
  - Line Supervisors (`production_lines.supervisor_id`): constrained to `supervised_line_ids`, required to provide `production_line_id`, and blocked (`400` / `403`) from cross-department line spoofing or unassigned lines.
- **Valuation Masking**: `weighted_avg_cost` and `total_global_valuation` are hidden (`undefined`) on general inquiry endpoints unless the caller holds `warehouse:reports:valuation`.
- **System Administrator Segregation**: `System Administrator` holds setup/settings/read-only valuation permissions only (`warehouse:view`, `warehouse:manage`, `warehouse:materials:manage`, `warehouse:settings:manage`, `warehouse:reports:valuation`) and is blocked (`403`) from routine operational approvals (`inventory:qc_inspect`, `inventory:requisition:approve`, `inventory:adjust:approve*`, `inventory:reorder:approve`).

### 1.3 Standard Error Codes
| HTTP Status | Error Code | Description |
|---|---|---|
| `400` | `BAD_REQUEST` / `VALIDATION_ERROR` / `BIN_REQUIRED` / `GRN_RECONCILIATION_MISMATCH` / `OVER_DELIVERY_EXCEEDED` / `QC_REQUIRED_ON_RECEIPT` / `FIFO_OVERRIDE_REASON_REQUIRED` | Input, business equation, tolerance, or policy validation error |
| `401` | `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | Missing, expired, or forged JWT |
| `403` | `FORBIDDEN` / `MAKER_CHECKER_VIOLATION` / `FACTORY_MANAGER_APPROVAL_REQUIRED` | Missing permission, scope violation, maker-checker block, or threshold escalation |
| `404` | `NOT_FOUND` | Referenced warehouse, bin, material, lot, GRN, requisition, transfer, count, adjustment, or reorder missing |
| `409` | `CONFLICT` / `ALREADY_POSTED` / `QC_QUANTITY_EXCEEDED` / `REQUISITION_NOT_APPROVED` / `INSUFFICIENT_STOCK` / `INSUFFICIENT_AVAILABLE_STOCK` / `RETURN_EXCEEDS_ISSUED` / `INVALID_REORDER_STAGE` | State-machine conflict, duplicate SKU/lot, insufficient stock, or over-issue/over-return |

---

## 2. §5.1 Warehouse Setup, Locations/Bins, Staff & Settings

| Method | Endpoint | Permission(s) & Scope | Description |
|---|---|---|---|
| `GET` | `/api/warehouses` | `warehouse:view` *(scoped for WM/WK)* | List warehouses with location & active staff counts |
| `POST` | `/api/warehouses` | `warehouse:manage` + Global Role | Create warehouse + auto-provision mandatory `DEFAULT` bin (`DEC-01`) |
| `GET` | `/api/warehouses/:id` | `warehouse:view` + Warehouse Scope | Get warehouse metadata, bins, and assigned staff |
| `PUT` | `/api/warehouses/:id` | `warehouse:manage` + Warehouse Scope | Update warehouse metadata and `require_bin_tracking` |
| `PUT` | `/api/warehouses/:id/status` | `warehouse:manage` + Global Role | Toggle `active`/`inactive` (blocked `409` if stock remains) |
| `GET` | `/api/warehouses/:id/stock` | `warehouse:view` + Warehouse Scope | View inventory balances inside warehouse |
| `GET` | `/api/warehouses/:id/locations` | `warehouse:view` + Warehouse Scope | List storage bins (`DEFAULT` + custom bins) |
| `POST` | `/api/warehouses/:id/locations` | `warehouse:manage` + Warehouse Scope | Create bin (`STORAGE`, `RECEIVING`, `STAGING`, `QC_HOLD`, `DISPATCH`, `DAMAGED`) |
| `PUT` | `/api/warehouses/:id/locations/:locationId/status` | `warehouse:manage` + Warehouse Scope | Toggle bin status (`DEFAULT` cannot be deactivated) |
| `GET` | `/api/warehouses/:id/staff` | `warehouse:view` + Warehouse Scope | List assigned staff (`warehouse_staff`) |
| `POST` | `/api/warehouses/:id/staff` | `warehouse:manage` + Warehouse Scope | Assign/update user (`WAREHOUSE_MANAGER` / `WAREHOUSE_KEEPER`, effective dates) |
| `DELETE` | `/api/warehouses/:id/staff/:userId` | `warehouse:manage` + Warehouse Scope | Remove user warehouse assignment |
| `GET` | `/api/warehouse/settings` | `warehouse:view` | Read global WMS policy parameters |
| `PUT` | `/api/warehouse/settings/:key` | `warehouse:settings:manage` | Update `adjustment_approval_threshold`, `grn_over_delivery_tolerance_pct`, `fifo_override_requires_reason` (`write_off_requires_factory_manager` stays `true`) |

---

## 3. §5.2 Material Categories & Material Catalog

| Method | Endpoint | Permission(s) | Description |
|---|---|---|---|
| `GET` | `/api/warehouse/categories` | `warehouse:view` | List material categories (`?status=`) |
| `GET` | `/api/warehouse/categories/:id` | `warehouse:view` | Get material category details |
| `POST` | `/api/warehouse/categories` | `warehouse:materials:manage` | Create category with default QC / lot / roll tracking flags |
| `GET` | `/api/warehouse/materials` | `warehouse:view` \| `inventory:requisition:create` | Search/filter active materials (`?category_id=&status=&search=`) |
| `GET` | `/api/warehouse/materials/:id` | `warehouse:view` \| `inventory:requisition:create` | Get material details including `attributes_json` |
| `POST` | `/api/warehouse/materials` | `warehouse:materials:manage` | Create SKU (`meter`, `kg`, `pcs`, `cone`, `roll`, `box`, `set`), attributes, tracking & reorder config |
| `PUT` | `/api/warehouse/materials/:id` | `warehouse:materials:manage` | Update full material definition |
| `PUT` | `/api/warehouse/materials/:id/attributes` | `warehouse:materials:manage` | Update hybrid `attributes` / `attributes_json` |
| `PUT` | `/api/warehouse/materials/:id/reorder` | `warehouse:materials:manage` | Update `min_stock_level` and `reorder_level` |
| `PUT` | `/api/warehouse/materials/:id/qc-config` | `warehouse:materials:manage` | Update `requires_qc_on_receipt`, `is_lot_tracked`, `is_roll_tracked` |

---

## 4. §5.3 Inventory Inquiry, Valuation & Reconciliation

| Method | Endpoint | Permission(s) & Scope | Description |
|---|---|---|---|
| `GET` | `/api/inventory/balances` | `warehouse:view` + Optional Warehouse Scope | Query bin/lot/status balances (`?warehouse_id=&location_id=&material_id=&lot_id=&stock_status=`) |
| `GET` | `/api/inventory/available` | `warehouse:view` \| `inventory:requisition:create` + Optional Scope | Query unreserved `AVAILABLE` (`qty_available > 0`) stock |
| `GET` | `/api/inventory/reserved` | `warehouse:view` + Optional Scope | Query balances with `qty_reserved > 0` |
| `GET` | `/api/inventory/lots` | `warehouse:view` + Optional Scope | Query lots/fabric rolls with QC status and bin breakdown |
| `GET` | `/api/inventory/movements` | `warehouse:view` + Optional Scope | Query immutable `stock_movements` audit ledger |
| `GET` | `/api/inventory/summary` | `warehouse:view` + Optional Scope | Aggregated stock & workflow queue KPIs (valuation masked unless permitted) |
| `GET` | `/api/inventory/valuation` | `warehouse:reports:valuation` | Global Weighted Average Cost (`materials.weighted_avg_cost`, `total_inventory_value`) report |
| `GET` | `/api/inventory/reconcile` | `warehouse:reports:valuation` | Reconcile `SUM(inventory_balances.qty_on_hand)` vs net `stock_movements` ledger (`IN - OUT`) |

---

## 5. §5.4 Goods Receiving (GRN) & §5.5 QC Inspection

- **GRN Equation**: `received_qty === accepted_qty + rejected_qty + damaged_qty + pending_inspection_qty` (`400` on mismatch).
- **Over-Delivery (`PARAM-03`)**: If `expected_qty` is provided on a GRN line, `received_qty <= expected_qty * (1 + grn_over_delivery_tolerance_pct / 100)`. *(Note: Since Purchasing / external PO master tables are outside Phase 04 scope, `po_reference` captures PO strings for multi-GRN partial deliveries while line-level `expected_qty` enforces tolerance per receipt line.)*
- **QC Quarantine (`DEC-05`)**: When `materials.requires_qc_on_receipt = true`, `accepted_qty` on GRN must be `0`; usable stock must go to `pending_inspection_qty` → `QUARANTINE`.

| Method | Endpoint | Permission(s) & Scope | Status Flow |
|---|---|---|---|
| `GET` | `/api/warehouse/grns` | `warehouse:view` + Scope | List GRNs (`?warehouse_id=&status=&po_reference=`) |
| `GET` | `/api/warehouse/grns/:id` | `warehouse:view` + Scope | Get GRN header & lines |
| `POST` | `/api/warehouse/grns` | `inventory:receive` + Scope | Create `DRAFT` GRN (optionally with initial `items[]`) |
| `POST` | `/api/warehouse/grns/:id/items` | `inventory:receive` + Scope | Add line item to `DRAFT` GRN (`409` if `POSTED`) |
| `POST` | `/api/warehouse/grns/:id/post` | `inventory:receive` + Scope | Atomic `DRAFT → POSTED`: writes `RECEIPT` movements, Global WAC for accepted non-QC items, `QUARANTINE`/`DAMAGED` buckets, notifications |
| `GET` | `/api/warehouse/qc/pending` | `warehouse:view` + Optional Scope | List posted GRN lines with `pending_inspection_qty > 0` |
| `GET` | `/api/warehouse/qc/history` | `warehouse:view` + Optional Scope | List QC inspection history |
| `POST` | `/api/warehouse/qc/inspect` | `inventory:qc_inspect` | Inspect partial/full pending qty: `passed_qty` (`QUARANTINE → AVAILABLE` + Global WAC) and `rejected_qty + damaged_qty` (`QUARANTINE → DAMAGED\|SCRAP`, never `AVAILABLE`). Rejects over-inspection (`409 QC_QUANTITY_EXCEEDED`). |

---

## 6. §5.6 Material Requisitions, §5.7 Stock Issuing & §5.8 Returns

- **Requisition Approval (`DEC-06`)**: `DRAFT → SUBMITTED → APPROVED` (or `REJECTED` / `CANCELLED`). Approval atomically increments `inventory_balances.qty_reserved` on `AVAILABLE` stock. Issuing is strictly blocked (`409 REQUISITION_NOT_APPROVED`) prior to approval.
- **Advisory FIFO (`DEC-04`)**: If a lot-tracked material is issued from a newer lot when an older `AVAILABLE` lot has positive stock in the same warehouse, `fifo_override_reason` is mandatory when `fifo_override_requires_reason = true` (`400` otherwise) and is stored on `stock_issue_items` + `audit_logs`.

| Method | Endpoint | Permission(s) & Scope | Description |
|---|---|---|---|
| `GET` | `/api/warehouse/requisitions` | `warehouse:view` \| `inventory:requisition:create` \| `inventory:requisition:approve` | List requisitions filtered by caller's dept / line / warehouse scope |
| `GET` | `/api/warehouse/requisitions/:id` | Same + Record Scope | Get requisition header & items |
| `POST` | `/api/warehouse/requisitions` | `inventory:requisition:create` + Production Line Scope | Create `DRAFT` requisition |
| `POST` | `/api/warehouse/requisitions/:id/items` | `inventory:requisition:create` + Scope | Add line item to `DRAFT` requisition |
| `POST` | `/api/warehouse/requisitions/:id/submit` | `inventory:requisition:create` + Scope | `DRAFT → SUBMITTED` |
| `POST` | `/api/warehouse/requisitions/:id/approve` | `inventory:requisition:approve` + Dept Scope | `SUBMITTED → APPROVED` + reserve `AVAILABLE` stock |
| `POST` | `/api/warehouse/requisitions/:id/reject` | `inventory:requisition:approve` + Dept Scope | `SUBMITTED → REJECTED` |
| `POST` | `/api/warehouse/requisitions/:id/cancel` | `inventory:requisition:create` \| `approve` + Scope | Cancel `DRAFT`/`SUBMITTED`/`APPROVED` & release unissued reservation |
| `GET` | `/api/warehouse/issues` | `warehouse:view` + Optional Scope | List posted stock issues |
| `GET` | `/api/warehouse/issues/:id` | `warehouse:view` \| `inventory:requisition:create` \| `inventory:issue` | Get stock issue header & lines |
| `POST` | `/api/warehouse/issues` | `inventory:issue` + Warehouse Scope | Issue `AVAILABLE` stock (partial or full), FIFO check, Global WAC outbound decrement, low-stock alert check |
| `GET` | `/api/warehouse/returns` | `warehouse:view` \| `inventory:requisition:create` \| `inventory:return` | List material returns |
| `POST` | `/api/warehouse/returns` | `inventory:return` + Warehouse Scope | Post return (`USABLE_SURPLUS → AVAILABLE` + WAC inbound, `DAMAGED → DAMAGED`, `WASTE_SCRAP → SCRAP`); caps cumulative returns against `stock_issue_id` |

---

## 7. §5.9 Transfers, §5.10 Stock Counts, §5.11 Adjustments & §5.12 Reorders

| Method | Endpoint | Permission(s) & Scope | Description |
|---|---|---|---|
| `GET` | `/api/warehouse/transfers` | `warehouse:view` *(scoped)* | List transfers |
| `GET` | `/api/warehouse/transfers/:id` | `warehouse:view` *(source/target scope)* | Get transfer header & lines |
| `POST` | `/api/warehouse/transfers/internal` | `inventory:transfer` + Warehouse Scope | Single-step atomic internal bin move (`TRANSFER_OUT` + linked `TRANSFER_IN`); Global WAC unchanged |
| `POST` | `/api/warehouse/transfers/dispatch` | `inventory:transfer` + Source Warehouse Scope | Step 1 inter-warehouse (`AVAILABLE` OUT → target `IN_TRANSIT` unissuable bucket) |
| `POST` | `/api/warehouse/transfers/:id/receive` | `inventory:transfer` + Target Warehouse Scope | Step 2 inter-warehouse: clears `IN_TRANSIT` into `AVAILABLE` and/or `DAMAGED`, logs `RECEIVED` or `RECEIVED_WITH_DISCREPANCY` |
| `GET` | `/api/warehouse/counts` | `warehouse:view` + Optional Scope | List physical stock counts |
| `POST` | `/api/warehouse/counts` | `inventory:count` + Warehouse Scope | Snapshot balances (`CYCLE` / `FULL`) into `IN_PROGRESS` count sheet |
| `GET` | `/api/warehouse/counts/:id` | `warehouse:view` + Warehouse Scope | Get stock count lines & variances |
| `PUT` | `/api/warehouse/counts/:id/items` | `inventory:count` + Warehouse Scope | Record physical `counted_qty` & compute `variance_qty` |
| `POST` | `/api/warehouse/counts/:id/submit` | `inventory:count` + Warehouse Scope | `IN_PROGRESS → SUBMITTED_FOR_REVIEW` |
| `POST` | `/api/warehouse/counts/:id/approve` | `inventory:adjust:approve` *(+ `approve_high` if over threshold/unconfigured)* | Maker-checker enforced; creates linked `stock_adjustments` + `stock_movements` (`ADJUSTMENT_IN`/`OUT`) |
| `GET` | `/api/warehouse/adjustments` | `warehouse:view` + Optional Scope | List stock adjustments & write-offs |
| `POST` | `/api/warehouse/adjustments` | `inventory:adjust:propose` + Warehouse Scope | Submit reason-coded adjustment (`PENDING_APPROVAL`); evaluates `adjustment_approval_threshold` (`UNCONFIGURED` or `WRITE_OFF` → sets `requires_factory_manager = true`) |
| `POST` | `/api/warehouse/adjustments/:id/approve` | `inventory:adjust:approve` \| `approve_high` | Maker-checker (`submitted_by !== actor.id`), enforces `inventory:adjust:approve_high` for `WRITE_OFF` / high-value / unconfigured threshold |
| `POST` | `/api/warehouse/adjustments/:id/reject` | `inventory:adjust:approve` \| `approve_high` | Maker-checker enforced; sets `REJECTED` |
| `GET` | `/api/warehouse/reorders` | `warehouse:view` + Optional Scope | List reorder requests |
| `POST` | `/api/warehouse/reorders` | `inventory:reorder:create` + Warehouse Scope | Create `OPEN` reorder request with `available_qty_at_request` snapshot |
| `POST` | `/api/warehouse/reorders/:id/submit` | `inventory:reorder:create` + Scope | Stage 1: Warehouse Manager `OPEN → SUBMITTED` |
| `POST` | `/api/warehouse/reorders/:id/review` | `inventory:reorder:review` | Stage 2: Purchasing Manager `SUBMITTED → PURCHASING_REVIEWED` |
| `POST` | `/api/warehouse/reorders/:id/approve` | `inventory:reorder:approve` | Stage 3: Factory Manager `PURCHASING_REVIEWED → APPROVED` |
| `POST` | `/api/warehouse/reorders/:id/reject` | `reorder:create\|review\|approve` | Reject `OPEN` / `SUBMITTED` / `PURCHASING_REVIEWED` request |

---

## 8. §5.13 Finished Goods Receiving & §5.14 In-App Notifications

| Method | Endpoint | Permission(s) & Scope | Description |
|---|---|---|---|
| `POST` | `/api/warehouse/finished-goods/receive` | `inventory:receive` + Warehouse Scope | Receive packed `FINISHED_GOOD` SKUs from production (`department_id`, optional `production_line_id`) into `FINISHED_GOODS`/`GENERAL` warehouse (`FG_RECEIPT` movement, QC hold if required) |
| `GET` | `/api/warehouse/notifications` | `warehouse:view` \| `inventory:requisition:create` \| `inventory:qc_inspect` | List in-app notifications scoped by role, user, and assigned warehouses (`?unread_only=true`) |
| `PUT` | `/api/warehouse/notifications/:id/read` | Same | Mark notification read |
| `POST` | `/api/warehouse/notifications/scan-delayed-transfers` | `warehouse:manage` | Generate `TRANSFER_DELAYED` notifications for `IN_TRANSIT` transfers older than `max_hours_in_transit` |
