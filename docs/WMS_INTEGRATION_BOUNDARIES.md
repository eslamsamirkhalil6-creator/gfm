# GFMS v0.3 – Warehouse Management System (WMS)
## Integration Boundaries Specification (`WMS_INTEGRATION_BOUNDARIES.md`)

**Version:** Phase 02 Final Consolidation  
**Mode:** Read-Only Documentation — Preserves Existing GFMS Infrastructure & Decoupled Boundaries

---

## 1. Core Integration Principles

1. **Zero Hard Dependencies on Unbuilt Modules**: The Warehouse Module must deploy, operate, and pass automated tests completely without requiring Purchasing, MRP/Planning, Production Execution/Work Orders, Finance GL, or External Notification services to be built first.
2. **Preserve Existing Modules**: Existing `/api/production/*`, `/api/departments/*`, `/api/users/*`, `/api/audit-logs`, and `/api/tests/run` endpoints and schemas remain untouched and backward-compatible.
3. **`DEP-INV` Boundary**: `departments` row `DEP-INV` (`id = 3`) represents organizational staffing and managerial hierarchy. Warehouse physical locations, SKUs, and stock ledgers reside exclusively in the dedicated WMS module.

---

## 2. Domain-by-Domain Integration Matrix

### 2.1 Production (`DEP-PROD`, `DEP-CUT`, `DEP-SEW`, `DEP-PCK`)
- **Currently Implemented in GFMS v0.3**:
  - `production_halls`, `production_lines` (including `supervisor_id` → `users.id` and `department_id` → `departments.id`), `production_stages`, `production_workflows`, `production_workflow_steps`, `production_settings`.
  - No Work Orders, Cut Bundles, Style Tech Packs, or BOM consumption execution tables exist yet.
- **Phase 03+ Warehouse Integration Contract**:
  - **Material Requisitions & Stock Issues**: Reference existing `departments(id)` (`ON DELETE RESTRICT`) and optional `production_lines(id)` (`ON DELETE SET NULL` / `RESTRICT`) plus optional free-text `reference_type` / `reference_number` (e.g., future order or cut ticket ref).
  - **Line Scope Security**: `Production Line Responsible Person` scope checks `production_lines.supervisor_id = req.user.id` directly against the existing `002` schema.
  - **Finished Goods Receipt**: Links incoming FG cartons to `DEP-PCK` / `production_lines(id)`.
- **Future Integration (Not Implemented Now)**:
  - Future Work Order / Cut Order Execution & BOM Backflushing will invoke Warehouse Reserve/Issue APIs via nullable `production_order_id` hooks.

### 2.2 Purchasing & Suppliers (`DEP-PUR`)
- **Currently Implemented in GFMS v0.3**:
  - Organizational placeholder row `DEP-PUR` (`id = 4`) in `departments` only. Zero supplier or PO tables exist.
- **Phase 03+ Warehouse Integration Contract**:
  - **Do NOT build a Purchasing module in this phase.**
  - **Goods Receiving (GRN)**: Stores optional `supplier_name`, `delivery_note_no`, and `po_reference` strings (plus nullable future `purchase_order_id` / `supplier_id` columns if desired).
  - **Reorder Requests (`DEC-10`)**: Self-contained approval chain (`Warehouse Manager → Purchasing Manager → Factory Manager`) with external `po_reference` tracking once Purchasing reviews/places an external PO.
- **Future Integration**:
  - Future Purchasing module will supply canonical `suppliers` and `purchase_orders` tables, consuming approved `reorder_requests` and automating 3-way PO–GRN quantity validation.

### 2.3 Planning / PPC (`DEP-PLAN`)
- **Currently Implemented in GFMS v0.3**:
  - Organizational placeholder row `DEP-PLAN` (`id = 9`) in `departments` only. Zero MRP/capacity scheduling tables exist.
- **Phase 03+ Warehouse Integration Contract**:
  - **Read-Only Availability Contract**: Warehouse exposes `GET /api/inventory/balances` and availability queries (`qty_on_hand`, `qty_reserved`, `qty_available = qty_on_hand - qty_reserved`) for Planning consumption.
- **Future Integration**:
  - Future MRP engine will read `qty_available`, `in_transit_qty`, and `reorder_level`, and may place automated material reservations via Warehouse reservation APIs.

### 2.4 Quality Control (`DEP-QC`)
- **Currently Implemented in GFMS v0.3**:
  - Organizational row `DEP-QC` (`id = 5`), `production_stages` (`STG-QC`, `stage_type = 'QUALITY'`), `quality_gate = true` on workflow steps, and `require_qc_signoff_to_bypass = true` in `production_settings`.
- **Phase 03+ Warehouse Integration Contract**:
  - Preserves GFMS's independent QC compliance principle: Warehouse Keepers cannot release `QUARANTINE` or `HOLD` stock.
  - Warehouse exposes dedicated QC inspection queue and `inventory:qc_inspect` endpoints to transition `qc_status` (`PENDING`, `PASSED`, `PARTIALLY_PASSED`, `REJECTED`) and `stock_status` (`QUARANTINE`/`HOLD` → `AVAILABLE` or `DAMAGED`/`SCRAP`).
- **Future Integration**:
  - Future AQL Inspection Execution module can attach detailed defect/test sheet IDs (`qc_inspection_ref`) to lot release/rejection events.

### 2.5 Finance & Accounting (`DEP-FIN`)
- **Currently Implemented in GFMS v0.3**:
  - Organizational row `DEP-FIN` (`id = 6`) in `departments` only. Zero accounting/GL tables exist.
- **Phase 03+ Warehouse Integration Contract**:
  - **Operational Valuation Policy Only (`DEC-11`)**: Weighted Average Cost (WAC) tracks inventory valuation per SKU/stock movement (`unit_cost`, `total_cost`) and exposes read-only valuation & write-off reports to `Finance Viewer` and Managers.
  - **Explicit Boundary**: WMS is **not** an accounting General Ledger, Accounts Payable, or financial journal system.
- **Future Integration**:
  - Future Finance/Costing module will consume immutable `stock_movements` cost snapshots (`RECEIPT`, `ISSUE`, `WRITE_OFF`) to generate GL postings and COGS reports.

### 2.6 Notifications (`DEC-12`)
- **Currently Implemented in GFMS v0.3**:
  - None (no email/SMTP, SMS, WebSocket, or persistent notification table exists).
- **Phase 03+ Warehouse Integration Contract**:
  - **In-App Notifications Only (`DEC-12`)**: Warehouse surfaces low-stock alerts, pending QC quarantine items, pending requisition/adjustment/reorder approvals, and delayed `IN_TRANSIT` transfers via in-app notification records/queries and UI badges.
- **Future Integration**:
  - Optional future SMTP/webhook dispatcher can subscribe to the same alert events without modifying Warehouse core transactions.

### 2.7 Reporting
- **Currently Implemented in GFMS v0.3**:
  - Module-scoped overview endpoints (`GET /api/production/stats`, `GET /api/departments/stats`).
- **Phase 03+ Warehouse Integration Contract**:
  - Warehouse exposes dedicated endpoints (`/api/warehouse/stats`, `/api/warehouse/reports/*`) for stock on-hand/available, WAC valuation, movement ledger, low-stock alerts, lot aging, and department/line consumption.
- **Future Integration**:
  - Executive dashboards may aggregate Warehouse KPIs alongside Production and Finance reports.

### 2.8 Audit Logs & Inventory Movement History
- **Currently Implemented in GFMS v0.3**:
  - `audit_logs` table + `AuditService.log(params, queryFn)` supporting transactional `txQuery` execution.
- **Phase 03+ Warehouse Integration Contract**:
  - **Dual Traceability (Complementary, Never Redundant)**:
    1. `AuditService.log(..., txQuery)`: Records security/business actor audit trail (who created/approved/rejected/overrode FIFO/posted what and when) inside the same transaction.
    2. `stock_movements`: Records immutable quantitative inventory history (`material_id`, `lot_id`, `quantity`, `direction`, `balance_before`, `balance_after`, `unit_cost`, source/destination, document reference).
  - Neither replaces the other; both commit atomically via `withTransaction`.
