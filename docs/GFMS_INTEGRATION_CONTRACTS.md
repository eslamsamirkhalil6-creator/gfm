# GFMS – Cross-Module Integration Contracts

**Application:** Garment Factory Management System (GFMS v0.3)  
**Phase:** 05 – Cross-Module Architecture Contracts  
**Important Scope Notice:** This document defines **architecture and integration contracts only** for future GFMS modules. It does **not** implement these modules, create fake routes, or invent concrete database DDL tables beyond conceptual contract boundaries.

---

## Integration Contract Matrix Overview

```text
Existing Foundation (Users/RBAC, Departments, Production Setup, Audit, WMS Phase 04)
   ├──► HR (DEP-HR)               : Employees, status cascades, evaluations, dept roster sync
   ├──► Planning / PPC (DEP-PLAN) : Schedules, targets, MRP read of WMS available stock, requisition hooks
   ├──► Purchasing (DEP-PUR)      : Suppliers, PO lifecycle consuming APPROVED reorder requests -> GRN PO link
   ├──► Quality Control (DEP-QC)  : Inline/AQL defects + production quality gates + WMS quarantine release
   ├──► Transportation (DEP-TRANS): Employee shuttles/contractors + FG export/inter-facility manifests
   └──► Reports & Notifications   : Cross-module KPIs + unified notification event bus (extending DEC-12)
```

---

## 1. Human Resources (`DEP-HR`)

### 1.1 Expected API Resources
- `GET/POST /api/hr/employees`, `GET/PUT /api/hr/employees/:id`, `PUT /api/hr/employees/:id/status`
- `GET/POST /api/hr/employees/:id/evaluations`, `POST /api/hr/evaluations/:id/submit`, `POST /api/hr/evaluations/:id/approve`
- `GET /api/hr/employees/:id/assignments` *(reads/bridges organizational `department_employees`)*

### 1.2 Expected Service Boundaries
- **HRService**: Owns workforce employment lifecycle (non-login factory workers + linked `users` employees), employment status transitions, and evaluation appraisal workflows.
- **Boundary with Users & Departments**: HR does **not** manage `roles`, `permissions`, or `password_hash` (`UserService`), nor does HR mutate `departments` structure directly (`DepartmentService` retains organizational roster authority).

### 1.3 Required Permissions
- `hr:view`, `hr:employees:manage`, `hr:employees:status`, `hr:evaluations:create`, `hr:evaluations:approve`, `hr:reports:confidential` *(salary/disciplinary masking)*.
- Department Managers hold scoped read/evaluation-propose permissions limited to `managed_department_ids`.

### 1.4 Data Ownership
- **Owns**: Worker employment profiles (employee code, hire/termination dates, shift/skill grade), employment statuses, evaluation scores, and HR approval histories.
- **Does NOT Own**: Authentication credentials (`users`), RBAC roles (`user_roles`), or department hierarchy (`departments`).

### 1.5 Relationships with Existing Modules
- **Users (`001`)**: Optional `1:1` link (`user_id` nullable — supports floor operators without system logins as well as login-enabled staff).
- **Departments (`003`)**: Syncs employee onboarding/transfer events with `department_employees` (`DepartmentService.assignEmployee` / `transferEmployee` / `removeEmployee`).
- **Production (`002`) & WMS (`005`)**: Deactivating/terminating an employee triggers validation against active `departments.manager_id`, `production_lines.supervisor_id`, and active `warehouse_staff`.

### 1.6 Events or Integration Points
- `HR_EMPLOYEE_STATUS_CHANGED`: On `TERMINATED` / `SUSPENDED`, calls `UserService.updateUserStatus(userId, false)` (if linked) and emits alerts if the employee currently holds an active `departments.manager_id`, `production_lines.supervisor_id`, or `warehouse_staff` assignment.
- `HR_EVALUATION_APPROVED`: Emits in-app notification + `AuditService.log`.

### 1.7 Dependencies on Other Modules
- `Users` (optional identity link), `Departments` (roster validation & manager authority), `AuditService`.

### 1.8 Required Validation Rules
- Cannot link one `user_id` to multiple active employee profiles (`UNIQUE` link).
- Cannot delete an employee with historical evaluations or active department/line/warehouse assignments (`409` deactivation required).
- Maker-checker: Employee/evaluator cannot approve their own evaluation (`evaluator_id / employee_id <> approved_by`).
- Department Manager cannot view or create evaluations for employees outside `managed_department_ids` (`403`).

---

## 2. Production Planning & Control (`DEP-PLAN`)

### 2.1 Expected API Resources
- `GET/POST /api/planning/plans`, `GET/PUT /api/planning/plans/:id`, `POST /api/planning/plans/:id/approve`
- `GET/POST /api/planning/schedules` *(assigns plans to `production_lines` and `production_workflows`)*
- `GET/POST /api/planning/targets` *(daily line/stage quantity targets)*
- `POST /api/planning/plans/:id/mrp-check` *(computes material shortage vs WMS stock)*

### 2.2 Expected Service Boundaries
- **PlanningService**: Owns buyer order demand breakdown, capacity scheduling against lines, target allocation, and MRP net requirement calculation.
- **Boundary with Production & WMS**: Planning reads `production_lines` / `production_workflows` (`ProductionService`) and reads `qty_available` / reserves materials via `WarehouseOutboundService` — Planning MUST NEVER mutate `inventory_balances` directly.

### 2.3 Required Permissions
- `planning:view`, `planning:manage`, `planning:schedule`, `planning:approve`, `planning:mrp:run`.

### 2.4 Data Ownership
- **Owns**: Production plans, style/order targets, line schedules, capacity utilization snapshots, and MRP shortage calculations.
- **Does NOT Own**: Physical `production_halls`/`lines`/`workflows` master setup (`ProductionService`), physical stock balances or WAC (`InventoryEngineService`).

### 2.5 Relationships with Existing Modules
- **Production (`002`)**: Targets `production_lines(id)` (validating `status = 'active'` and `capacity_per_day`) and binds each plan to a `production_workflows(id)` pipeline.
- **WMS (`005`)**:
  - Consumes `GET /api/inventory/available` and `GET /api/inventory/balances` (masked of WAC unless caller has `warehouse:reports:valuation`).
  - Generates `DRAFT`/`SUBMITTED` `material_requisitions` referencing `reference_type = 'PRODUCTION_PLAN'` and `reference_code = plan_number` — still requiring `inventory:requisition:approve` (`DEC-06`) before stock is reserved!
  - Triggers `reorder_requests` proposals when MRP detects net shortage.

### 2.6 Events or Integration Points
- `PLAN_APPROVED`: Triggers draft material requisition creation via `WarehouseOutboundService.createRequisition` inside coordinated workflow.
- `PLAN_SCHEDULE_CONFLICT`: Alerts Production Manager when scheduled daily quantity exceeds `production_lines.capacity_per_day`.

### 2.7 Dependencies on Other Modules
- `Production` (lines, stages, workflows), `Departments` (responsible line department), `WMS` (material catalog, available stock inquiry, requisitions), `AuditService`.

### 2.8 Required Validation Rules
- Target `production_line_id` and `workflow_id` must be `active`.
- Scheduled date windows `end_date >= start_date`; cannot overload inactive/maintenance lines without explicit override reason.
- Automated MRP requisitions CANNOT bypass `inventory:requisition:approve` (`DEC-06`) or `production_line` department consistency checks.

---

## 3. Purchasing & Suppliers (`DEP-PUR`)

### 3.1 Expected API Resources
- `GET/POST /api/purchasing/suppliers`, `GET/PUT /api/purchasing/suppliers/:id`, `PUT /api/purchasing/suppliers/:id/status`
- `GET/POST /api/purchasing/requests`, `POST /api/purchasing/requests/:id/submit`, `POST /api/purchasing/requests/:id/approve`
- `GET/POST /api/purchasing/orders`, `GET/PUT /api/purchasing/orders/:id`, `POST /api/purchasing/orders/:id/approve`, `POST /api/purchasing/orders/:id/issue`
- `GET /api/purchasing/orders/:id/receipt-summary` *(aggregates linked WMS GRNs)*

### 3.2 Expected Service Boundaries
- **PurchasingService**: Owns supplier master, purchase requests, Purchase Orders (PO), PO pricing/terms, and PO fulfillment state (`OPEN`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CLOSED`).
- **Boundary with WMS**: Purchasing **never** writes directly to `inventory_balances`, `inventory_lots`, or `stock_movements`. Physical receiving remains strictly in `WarehouseInboundService` (GRN + QC quarantine).

### 3.3 Required Permissions
- `purchasing:view`, `purchasing:suppliers:manage`, `purchasing:requests:create`, `purchasing:orders:create`, `purchasing:orders:approve` *(Factory Manager / Purchasing authority)*, reusing existing `inventory:reorder:review`.

### 3.4 Data Ownership
- **Owns**: Approved suppliers, supplier contacts/lead times, purchase requests, PO headers, PO line items (`ordered_qty`, `unit_price`, `received_qty_cumulative`).
- **Does NOT Own**: Warehouse storage bins, `materials` Global WAC (receives PO `unit_price` into GRN `unit_cost` at receipt posting time), or QC release decisions.

### 3.5 Relationships with Existing Modules
- **WMS Reorders (`005` `DEC-10`)**: Purchasing consumes `APPROVED` `reorder_requests` (`warehouse_control`), transitions them to `LINKED_TO_PO` / `CLOSED`, and populates canonical PO references.
- **WMS GRNs (`005` `PARAM-03`)**: Upgrades free-text `goods_receipts.po_reference` / `supplier_name` contract by validating against canonical `purchase_orders(id)` and computing **cumulative received quantity across multiple partial GRNs** (`SUM(prior posted grn_items.received_qty) + current <= po_item.ordered_qty * (1 + grn_over_delivery_tolerance_pct / 100)`).
- **WMS Material Catalog (`005`)**: PO line items reference existing `materials(id)` and `base_uom`.

### 3.6 Events or Integration Points
- `PUR_PO_APPROVED`: Makes PO eligible for warehouse receiving at dock (`WarehouseInboundService.createGrn`).
- `WMS_GRN_POST` (inbound callback/hook): Updates PO line cumulative received progress and triggers PO status transition (`PARTIALLY_RECEIVED` / `RECEIVED`) plus discrepancy alerts if short-shipped or damaged.

### 3.7 Dependencies on Other Modules
- `WMS` (`materials`, `reorder_requests`, `goods_receipts`, `warehouse_settings.grn_over_delivery_tolerance_pct`), `AuditService`.

### 3.8 Required Validation Rules
- Cannot receive a GRN against an `UNAPPROVED` / `DRAFT` / `CANCELLED` / `CLOSED` PO (`409`).
- Inactive suppliers cannot receive new POs (`400`).
- Maker-checker: PO creator cannot approve high-value POs where threshold policy requires Factory Manager approval.
- System Administrator remains excluded from PO financial approvals.

---

## 4. Quality Control (`DEP-QC`)

### 4.1 Expected API Resources
- `GET/POST /api/qc/inspections` *(unified production inline/AQL + incoming material inspection details)*
- `POST /api/qc/inspections/:id/defects` *(defect classification codes, severity: `CRITICAL`/`MAJOR`/`MINOR`, sample size)*
- `POST /api/qc/inspections/:id/decision` *(`PASS` / `CONDITIONAL_PASS` / `REJECT` / `REWORK`)*
- `GET/POST /api/qc/gates/:workflowStepId/signoff` *(production workflow quality gate signoff)*

### 4.2 Expected Service Boundaries
- **QualityControlService**: Owns detailed defect catalogs, AQL sampling sheets, inline/end-line garment inspection records, and production quality gate signoffs.
- **Boundary with WMS & Production**:
  - For **Warehouse Incoming & FG Quarantine**: `WarehouseInboundService.performQcInspection` remains the sole transactional engine transitioning `inventory_balances` (`QUARANTINE -> AVAILABLE | DAMAGED | SCRAP`) and updating Global WAC; future QC attaches its detailed inspection report ID to the WMS QC event without letting keep/production roles bypass `inventory:qc_inspect`.
  - For **Manufacturing Stages**: Enforces `production_workflow_steps.quality_gate = true` and `production_settings.require_qc_signoff_to_bypass = true`.

### 4.3 Required Permissions
- Reuses `inventory:qc_inspect`, plus `qc:view`, `qc:inspect:production`, `qc:defects:manage`, `qc:gate:signoff`, `qc:gate:override` (`QC Manager` only).

### 4.4 Data Ownership
- **Owns**: Defect taxonomy, AQL sample plans, detailed inspection checklists, defect counts, rework directives, and stage gate signoff records.
- **Does NOT Own**: Inventory stock buckets (`inventory_balances`) or manufacturing line routing (`production_workflows`).

### 4.5 Relationships with Existing Modules
- **WMS (`005`)**: Consumes `GET /api/warehouse/qc/pending`, executes `POST /api/warehouse/qc/inspect` (with detailed `qc_inspection_ref` in notes/reference), and triggers `DAMAGED`/`SCRAP` segregation.
- **Production (`002`)**: Reads `production_stages (stage_type = 'QUALITY')`, `production_workflow_steps.quality_gate`, and `production_settings ('allow_stage_bypass', 'require_qc_signoff_to_bypass')`.

### 4.6 Events or Integration Points
- `WMS_QC_PENDING` (from GRN post or FG receive) -> opens QC inspection worklist item.
- `QC_GATE_REJECTED` -> blocks downstream workflow progression (Packing / FG handover) until `REWORK` passes or authorized `QC Manager` override is audited.

### 4.7 Dependencies on Other Modules
- `WMS` (quarantine items, `qc_inspections`, finished goods receipts), `Production` (stages, workflow steps, settings), `AuditService`.

### 4.8 Required Validation Rules
- Independent QC authority: Line Supervisors and Warehouse Keepers MUST receive `403` on all `qc:gate:signoff` and `inventory:qc_inspect` routes.
- Emergency workflow stage bypass blocked (`403`) whenever `require_qc_signoff_to_bypass = 'true'` unless signed by `QC Manager`.
- Rejected quantities (`DAMAGED` / `SCRAP`) can NEVER enter `AVAILABLE` stock.

---

## 5. Transportation & Logistics (`DEP-TRANS`)

### 5.1 Expected API Resources
- `GET/POST /api/transportation/contractors`, `PUT /api/transportation/contractors/:id/status`
- `GET/POST /api/transportation/buses`, `PUT /api/transportation/buses/:id/status`
- `GET/POST /api/transportation/schedules` *(employee shift pickup/drop-off routes)*
- `GET/POST /api/transportation/employee-assignments` *(assigns active employees to bus routes)*
- `GET/POST /api/transportation/dispatches` *(optional logistics vehicle manifest linked to `WH-FG` export or `IN_TRANSIT` inter-warehouse transfers)*

### 5.2 Expected Service Boundaries
- **TransportationService**: Owns fleet/contractor registry, employee shuttle schedules, passenger manifests, and vehicle dispatch logs.
- **Boundary with WMS & HR**: Transportation tracks vehicles, drivers, and schedules; it never alters `inventory_balances` or `warehouse_transfers` stock states directly (stock custody remains `WarehouseControlService`).

### 5.3 Required Permissions
- `transportation:view`, `transportation:contractors:manage`, `transportation:buses:manage`, `transportation:schedules:manage`, `transportation:dispatch:manage`.

### 5.4 Data Ownership
- **Owns**: Transport contractors, buses/vehicles (plate numbers, seat capacity), shift routes, stop schedules, employee bus allocations, and trip logs.
- **Does NOT Own**: Employee employment status (`HR`), warehouse transfer stock balances (`WMS`).

### 5.5 Relationships with Existing Modules
- **Departments / HR**: Links passenger manifests to active employees (`users` / future `hr.employees`) and `departments`.
- **WMS (`005`)**: Vehicle manifest may reference `warehouse_transfers(id)` (`INTER_WAREHOUSE` trips) or `WH-FG` outbound shipment docs without replacing `POST /warehouse/transfers/:id/receive`.

### 5.6 Events or Integration Points
- `HR_EMPLOYEE_STATUS_CHANGED`: Automatically flags/removes terminated employees from active bus route manifests.
- `WMS_TRANSFER_DISPATCH`: Optional trigger to schedule a logistics vehicle trip for heavy inter-facility transfers.

### 5.7 Dependencies on Other Modules
- `Departments` / `HR` (active employee validation), `WMS` (optional transfer document reference), `AuditService`.

### 5.8 Required Validation Rules
- Assigned passengers cannot exceed `bus.seat_capacity` (`409`).
- Inactive buses or terminated contractors/employees cannot be scheduled (`400`).
- Schedule timestamps must be valid non-overlapping windows per vehicle/driver.

---

## 6. Cross-Module Reports & Notifications

### 6.1 Expected API Resources
- **Cross-Module Reporting**:
  - `GET /api/reports/executive-summary` *(combines active lines, dept headcount, stock KPIs, pending approvals)*
  - `GET /api/reports/production-consumption` *(department & line `stock_issues` minus `material_returns` vs planned targets)*
  - `GET /api/reports/inventory-valuation-summary` *(strictly `warehouse:reports:valuation`)*
  - `GET /api/reports/quality-and-discrepancy` *(QC rejection rates, `RECEIPT_DISCREPANCY`, `TRANSFER_DISCREPANCY`, `WRITE_OFF` trend)*
- **Unified Notifications**:
  - `GET /api/notifications`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all` *(generalizing `warehouse_notifications` pattern)*

### 6.2 Expected Service Boundaries
- **ReportingService**: Strictly read-only query/aggregation layer across approved module projections; applies role-based data masking (e.g., strips `weighted_avg_cost` and financial totals unless `warehouse:reports:valuation` is present).
- **NotificationService**: Owns persisted in-app notification delivery, recipient/role/scope matching, deduplication, and read receipts (`DEC-12`). Optional LAN email/webhook workers may consume the same event queue later without altering transactional module APIs.

### 6.3 Required Permissions
- `reports:view`, `reports:production`, `reports:hr` *(sensitive)*, `warehouse:reports:valuation` *(financial cost masking guard)*, `audit:read`.
- Notifications inherit authenticated user identity + role + scope filters (`managed_department_ids`, `managed_warehouse_ids`, `supervised_line_ids`).

### 6.4 Data Ownership
- **Reports**: Ephemeral read-only aggregations (no authoritative operational writes).
- **Notifications**: Persistent notification records (`recipient_user_id`, `target_role_name`, `scope_type`, `scope_id`, `notification_type`, `severity`, `entity_type`, `entity_id`, `is_read`, `read_at`).

### 6.5 Standardized Notification Event Contract
Every producer module emitting a notification inside `withTransaction` supplies:
```typescript
interface NotificationEventContract {
  module: 'WMS' | 'PRODUCTION' | 'PURCHASING' | 'QC' | 'HR' | 'PLANNING' | 'TRANSPORTATION';
  notification_type: string;        // e.g. 'LOW_STOCK', 'APPROVAL_REQUIRED', 'QC_PENDING', 'TRANSFER_DELAYED'
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  recipient_user_id?: number | null;
  target_role_name?: string | null;
  department_id?: number | null;    // Enables Department Manager scoping
  warehouse_id?: number | null;     // Enables Warehouse Staff scoping
  title: string;
  message: string;
  entity_type: string;
  entity_id: string | number;
}
```

### 6.6 Relationships, Dependencies & Validation Rules
- **Dependencies**: Reads from `Users`, `Departments`, `Production`, `WMS`, `AuditLogs`, and future domain modules.
- **Scope Validation**:
  - A `Department Manager` calling `GET /api/reports/production-consumption` MUST only see departments in `managed_department_ids` (enforced server-side).
  - Marking a notification read (`PUT /notifications/:id/read`) MUST validate that the notification targets `actor.id` or matches `actor.roles` + actor's authorized department/warehouse scope (`403` otherwise) — addressing the current gap identified in `WarehouseMasterService.markNotificationRead`.
  - Report date range queries (`?from=&to=`) MUST validate ISO date syntax (`400`) and enforce maximum query span/pagination limits to protect local server memory.
