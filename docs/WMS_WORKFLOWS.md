# GFMS v0.3 – Warehouse Management System (WMS)
## Finalized Operational Workflow Specifications (`WMS_WORKFLOWS.md`)

**Version:** Phase 02 Final Consolidation  
**Consistency:** Aligned with `DEC-01` through `DEC-12`, Mandatory Clarifications §4.1–§4.4, and Role Matrix §5.

---

## Global Transactional & Ledger Invariants (Apply to All 10 Workflows)
- Every stock-altering post executes inside `withTransaction` (atomic PG `BEGIN/COMMIT/ROLLBACK` or serialized `pg-mem` snapshot).
- Every posted movement generates immutable row(s) in `stock_movements` (`balance_before`, `balance_after`, `unit_cost`, `actor_id`, timestamp, unique `tx_number`) and a corresponding `AuditService.log(..., txQuery)` entry.
- `inventory_balances.qty_on_hand >= 0` and `qty_reserved >= 0` and `qty_reserved <= qty_on_hand` at all times.
- Posted documents and movements cannot be edited or deleted; corrections use compensating/reversal documents.

---

### Workflow 1: Goods Receiving & Put-Away
- **Trigger**: Physical supplier shipment arrives at warehouse dock (with PO reference or supplier delivery note).
- **Responsible Role**: Warehouse Keeper (create/post GRN & put-away); Warehouse Manager (discrepancy review).
- **Required Input**: `warehouse_id`, `supplier_name`, `delivery_note_no`, optional `po_reference`, received date, line items (`material_id`, `expected_qty` optional, `received_qty`, `accepted_qty`, `rejected_qty`, `damaged_qty`, `pending_inspection_qty`, `unit_cost`, `target_location_id`, and for lot/roll materials: `lot_number`, `roll_number`, `shade_code`, actual measured roll qty).
- **Validation Rules**:
  - **Exact Reconciliation**: `Received = Accepted + Rejected + Damaged + PendingInspection` (hard-enforced; rejects mismatch).
  - Quantities `>= 0` with `Received > 0`; active warehouse, material, and location (or warehouse `DEFAULT` bin per `DEC-01`).
  - If `materials.requires_qc_on_receipt = true`, incoming usable qty must enter as `PendingInspection` (`QUARANTINE` / `PENDING`), **not** directly `Accepted` into `AVAILABLE`.
  - Lot/roll-tracked items require `lot_number` (and unique `(material_id, lot_number, roll_number)` for rolls per `DEC-02`).
- **Approval Sequence**: Direct posting by Warehouse Keeper for standard receipts; Warehouse Manager sign-off if over-receipt exceeds policy tolerance.
- **Status Transitions**: GRN Header: `DRAFT → POSTED` (or `CANCELLED` prior to posting). Linked PO/delivery reference supports multiple partial GRNs.
- **Inventory Impact**:
  - `Accepted` (QC-exempt) → `IN` to `AVAILABLE`; recalculates **WAC (`DEC-11`)**.
  - `PendingInspection` → `IN` to `QUARANTINE` (`qc_status = 'PENDING'`).
  - `Damaged` → `IN` to `DAMAGED` (non-issuable) or tracked separately on GRN discrepancy log; `Rejected` → returned at dock / does not enter `AVAILABLE`.
- **Audit Requirements**: `AuditService.log(WMS_GRN_POST)` + immutable `stock_movements` (`RECEIPT`).
- **Notifications**: In-app alert to QC Queue if `PendingInspection > 0`; alert to Purchasing/Warehouse Manager on shortages/damages.
- **Exception Handling**: Partial delivery keeps delivery open for future GRNs; clerical error before posting → edit `DRAFT`; error after posting → post compensating Adjustment/Return reversal (no edit/delete of posted GRN).

---

### Workflow 2: QC Inspection & Release
- **Trigger**: GRN posts stock into `QUARANTINE` (`qc_status = 'PENDING'`), or existing stock is placed on `HOLD`.
- **Responsible Role**: QC Manager / QC Inspector (sole authority per independent QC rule).
- **Required Input**: `lot_id` / `grn_line_id` / `balance_id`, `passed_qty`, `rejected_qty` (damaged/scrap), target storage `location_id` for released stock, `qc_notes`, optional defect summary.
- **Validation Rules**:
  - Actor must hold `inventory:qc_inspect` (Warehouse Keeper blocked with `403`).
  - `passed_qty >= 0`, `rejected_qty >= 0`, `passed_qty + rejected_qty > 0`.
  - **Anti-Double-Processing**: `passed_qty + rejected_qty <= remaining_pending_qty` (cannot accept/reject already-processed quantity twice) and `<= QUARANTINE/HOLD` balance.
- **Approval Sequence**: Single-step authorized QC decision (or QC Manager review for total lot rejection).
- **Status Transitions**:
  - Lot `qc_status`: `PENDING → PASSED` (if all passed), `REJECTED` (if all failed), or `PARTIALLY_PASSED` (mixed outcome or partial batch inspection).
  - Stock Status: `QUARANTINE`/`HOLD` → `AVAILABLE` (passed) or `DAMAGED`/`SCRAP` (rejected).
- **Inventory Impact**:
  - Atomic linked `OUT` (`QUARANTINE`) + `IN` (`AVAILABLE`) for `passed_qty` (triggers/confirms WAC inclusion of released stock).
  - Atomic linked `OUT` (`QUARANTINE`) + `IN` (`DAMAGED` or `SCRAP`) for `rejected_qty` — **rejected stock never enters `AVAILABLE`**.
- **Audit Requirements**: `AuditService.log(WMS_QC_INSPECT)` + linked `stock_movements` (`QC_RELEASE` / `QC_REJECT`).
- **Notifications**: In-app notification to Warehouse Keeper to put away newly `AVAILABLE` stock; alert to Warehouse & Purchasing Managers on rejections.
- **Exception Handling**: Mixed outcome on one roll/lot keeps separate `(lot_id, stock_status)` balances (`AVAILABLE` vs `DAMAGED`) while marking `qc_status = 'PARTIALLY_PASSED'`.

---

### Workflow 3: Material Requisition
- **Trigger**: Production floor (`DEP-CUT`, `DEP-SEW`, `DEP-PCK`) or Production Manager needs fabrics, trims, or packaging.
- **Responsible Role**: Line Responsible Person / Department Manager / Production Manager (requester); Department Manager (own dept) / Production Manager / Factory Manager (approver per `DEC-06`).
- **Required Input**: Requesting `department_id` (verified against `departments`), optional `production_line_id` (verified against `production_lines`), target `warehouse_id`, required date, optional order/cut ref, items (`material_id`, `requested_qty`, preferred shade/lot notes).
- **Validation Rules**:
  - `requested_qty > 0`; active material and department.
  - Line Responsible Person can create only for `production_lines.supervisor_id = req.user.id`; Dept Manager only for `departments.manager_id = req.user.id`.
  - On `APPROVED`: Check `available_qty >= requested_qty` (or allow partial reservation up to `available_qty` if backorder policy chosen; **reserved quantity can never exceed `AVAILABLE` stock**).
- **Approval Sequence (`DEC-06`)**: `Requester Submits (DRAFT → SUBMITTED) → Dept/Production Manager Approves (APPROVED)`.
- **Status Transitions**: `DRAFT → SUBMITTED → APPROVED → PARTIALLY_ISSUED → FULFILLED` (or `REJECTED` / `CANCELLED`).
- **Inventory Impact**:
  - `DRAFT` / `SUBMITTED`: Zero balance impact.
  - `APPROVED`: Increments `inventory_balances.qty_reserved` (reduces `qty_available`, keeps `qty_on_hand` unchanged).
  - `CANCELLED` (from `APPROVED`/`PARTIALLY_ISSUED`): Atomically releases unissued `qty_reserved`.
- **Audit Requirements**: `AuditService.log` on submit, approve, reject, and cancel.
- **Notifications**: In-app alert to Approver on `SUBMITTED`; alert to Warehouse Pick Queue on `APPROVED`; alert to Requester on `REJECTED`.
- **Exception Handling**: Insufficient `AVAILABLE` stock rejects full reservation or notifies Warehouse/Purchasing to raise Reorder Request.

---

### Workflow 4: Stock Issuing to Production
- **Trigger**: `APPROVED` or `PARTIALLY_ISSUED` Material Requisition enters Warehouse Pick Queue.
- **Responsible Role**: Warehouse Keeper (pick & post issue); Warehouse Manager (oversight); Line/Dept receiver (acknowledgement).
- **Required Input**: `requisition_id`, source `warehouse_id` & `location_id`, `material_id`, selected `lot_id` (for lot-tracked items), `issued_qty`, optional `fifo_override_reason` (required if skipping an older `AVAILABLE` lot per `DEC-04`).
- **Validation Rules**:
  - Requisition must be `APPROVED` or `PARTIALLY_ISSUED`.
  - Source balance **MUST** have `stock_status = 'AVAILABLE'`.
  - `issued_qty > 0`; `issued_qty <= qty_on_hand` and `issued_qty <= (qty_available + requisition_reserved_for_item)`; `issued_qty <= remaining_requisition_qty`.
  - **Advisory FIFO (`DEC-04`)**: If an older `AVAILABLE` lot exists for the same SKU/warehouse and is skipped, backend rejects post unless `fifo_override_reason` is provided.
- **Approval Sequence**: Pre-authorized via Requisition approval (`DEC-06`); FIFO override logged automatically.
- **Status Transitions**: Issue Document: `POSTED`; Requisition: `APPROVED → PARTIALLY_ISSUED → FULFILLED`.
- **Inventory Impact**: Atomic `OUT` movement (`ISSUE`) at current **WAC (`DEC-11`)**; decrements `qty_on_hand` and `qty_reserved` cleanly; updates `inventory_lots.remaining_qty` for roll-tracked fabrics (`DEC-02`).
- **Audit Requirements**: `AuditService.log(WMS_STOCK_ISSUE)` (explicitly flagging any FIFO override) + immutable `stock_movements`.
- **Notifications**: Notify requesting department/line upon issue; trigger **Low-Stock Alert** if post-issue `available_qty <= reorder_level`.
- **Exception Handling**: Short pick leaves requisition `PARTIALLY_ISSUED`; if physical roll is damaged at pick time, Keeper places roll on `HOLD`/`DAMAGED` and picks substitute roll.

---

### Workflow 5: Material Return / Production Waste / Damage
- **Trigger**: Unused fabric rolls, surplus trims, or damaged/waste materials return from `DEP-CUT`/`DEP-SEW`/`DEP-PCK` to Warehouse.
- **Responsible Role**: Dept Manager / Line Responsible Person / Production Manager (initiates return); Warehouse Keeper (receives & verifies); QC Inspector (inspects damaged returns).
- **Required Input**: Source `department_id`, optional `production_line_id` & original issue/requisition ref, `material_id`, `lot_id`/`roll_number`, `returned_qty`, `return_condition` (`USABLE_SURPLUS`, `DAMAGED`, `WASTE_SCRAP`), target `warehouse_id` & `location_id`, reason notes.
- **Validation Rules**: `returned_qty > 0`; active warehouse/location; if linked to an issue doc, cumulative returned `<=` cumulative issued for that SKU/lot.
- **Approval Sequence**: Warehouse Keeper/Manager confirms physical measure on dock; QC inspection required if `return_condition = 'DAMAGED'` or uncertain usability.
- **Status Transitions**: `DRAFT → SUBMITTED → POSTED` (or `PENDING_QC` if condition requires inspection).
- **Inventory Impact**:
  - `USABLE_SURPLUS` → Atomic `IN` (`RETURN`) to `AVAILABLE` at original issue cost / current WAC (`DEC-11`).
  - `DAMAGED` / `WASTE_SCRAP` → Atomic `IN` to `DAMAGED` or `SCRAP` bucket (cannot be re-issued as `AVAILABLE` stock).
- **Audit Requirements**: `AuditService.log(WMS_STOCK_RETURN)` + `stock_movements` (`RETURN`).
- **Notifications**: Notify Warehouse receiving bay; notify QC if damaged return requires inspection; alert Production/Factory Manager on abnormal waste rates.
- **Exception Handling**: Partial roll return records actual re-measured length (`DEC-02`) on `inventory_lots`.

---

### Workflow 6: Warehouse Transfer (Internal Bin Move & Inter-Warehouse 2-Step)
- **Trigger**: Need to relocate stock between bins (put-away/consolidation) or between two physical warehouses (`DEC-07`).
- **Responsible Role**: Warehouse Keeper (dispatch & receive); Warehouse Manager (approval for inter-warehouse dispatch if scoped/configured).
- **Required Input**: `transfer_type` (`INTERNAL_BIN` or `INTER_WAREHOUSE`), `source_warehouse_id`, `source_location_id`, `target_warehouse_id`, `target_location_id`, items (`material_id`, `lot_id`, `dispatch_qty`, on receive: `received_qty`, `damaged_qty`, `discrepancy_notes`).
- **Validation Rules**:
  - Source location `!=` Target location; `dispatch_qty > 0`; source balance must be `AVAILABLE` with `dispatch_qty <= qty_available` (cannot transfer reserved stock).
  - For Inter-Warehouse Receive: `received_qty + damaged_qty <= dispatch_qty` (shortages explicitly logged as discrepancy).
- **Approval Sequence (`DEC-07`)**:
  - *Internal Bin Move*: Single-step Keeper execution.
  - *Inter-Warehouse*: Dispatch (Keeper/Manager) → Physical Transit → Destination Warehouse Keeper/Manager Confirm Receipt.
- **Status Transitions**:
  - *Internal*: `POSTED`.
  - *Inter-Warehouse*: `DRAFT → DISPATCHED (IN_TRANSIT) → RECEIVED` or `RECEIVED_WITH_DISCREPANCY`.
- **Inventory Impact**:
  - *Internal*: Atomic `OUT` source bin + `IN` target bin (`AVAILABLE`).
  - *Inter-Warehouse Dispatch*: Atomic `OUT` source warehouse `AVAILABLE` + `IN` `IN_TRANSIT` custody (preserving WAC).
  - *Inter-Warehouse Receive*: Atomic `OUT` `IN_TRANSIT` + `IN` target warehouse `AVAILABLE` (`received_qty`) and `DAMAGED` (`damaged_qty`). Source = In-Transit + Destination reconciled completely.
- **Audit Requirements**: `AuditService.log(WMS_TRANSFER_DISPATCH / RECEIVE)` + paired `OUT` and `IN` rows in `stock_movements`.
- **Notifications**: Alert target warehouse on dispatch; alert Warehouse Manager on overdue `IN_TRANSIT` transfers or transit discrepancies.
- **Exception Handling**: Transit shortage flags `RECEIVED_WITH_DISCREPANCY` and leaves/routes missing balance for investigation & Manager-approved loss adjustment (`DEC-08`).

---

### Workflow 7: Physical Stock Count (Cycle Count / Full Count)
- **Trigger**: Scheduled cycle count, full warehouse count, or variance investigation.
- **Responsible Role**: Warehouse Manager (creates/reviews count); Warehouse Keeper (counts); Factory Manager (approves variances exceeding threshold).
- **Required Input**: `count_type` (`CYCLE` / `FULL`), `warehouse_id`, optional zone/bin/material filters, `counted_qty` per line, counter remarks.
- **Validation Rules**: `counted_qty >= 0`; records frozen `system_qty_snapshot` at count initiation/freeze; Maker-checker enforced on resulting variance adjustments (`counter != approver`).
- **Approval Sequence**: `Create Count Sheet → Enter Counts (COUNTING) → Warehouse Manager Review → Post Variance Adjustments` (routed via `DEC-08` thresholds).
- **Status Transitions**: `PLANNED → IN_PROGRESS → SUBMITTED_FOR_REVIEW → APPROVED_AND_POSTED` (or `CANCELLED`).
- **Inventory Impact**: Zero stock change during `PLANNED`/`IN_PROGRESS`/`SUBMITTED_FOR_REVIEW`. Upon final approval, system generates linked Workflow 8 Stock Adjustment (`CYCLE_COUNT_GAIN` / `CYCLE_COUNT_LOSS`) inside `withTransaction`.
- **Audit Requirements**: `AuditService.log(WMS_COUNT_CREATE / SUBMIT / POST)` retaining expected vs. counted quantities.
- **Notifications**: Notify assigned counters; alert Managers if variance % exceeds tolerance.
- **Exception Handling**: If stock moved between snapshot and posting, system compares against live balance before posting to prevent negative stock; unresolved negative variance requires re-count.

---

### Workflow 8: Stock Adjustment & Write-Off
- **Trigger**: Approved Physical Count variance, discovered spoilage/damage, shrinkage, or posting error reversal.
- **Responsible Role**: Warehouse Keeper / Warehouse Manager (submits); Warehouse Manager (approves within threshold) OR Factory Manager (approves above threshold & all write-offs per `DEC-08`).
- **Required Input**: `warehouse_id`, `location_id`, `material_id`, `lot_id` (if tracked), `direction` (`IN` / `OUT`), `quantity`, mandatory `reason_code` (`CYCLE_COUNT_GAIN`, `CYCLE_COUNT_LOSS`, `DAMAGED`, `SHRINKAGE`, `WRITE_OFF`, `REVERSAL_CORRECTION`), optional `reference_tx_id`, remarks.
- **Validation Rules**:
  - `quantity > 0`; valid mandatory `reason_code`.
  - **Maker-Checker**: `approver_id !== created_by` (strictly enforced on backend).
  - For `OUT` / `WRITE_OFF`: `quantity <= qty_on_hand` and (for `AVAILABLE` stock) `quantity <= qty_available` — **never produces negative stock**.
- **Approval Sequence (`DEC-08`)**:
  - `DRAFT → PENDING_APPROVAL`
  - If `value/qty <= warehouse_settings.threshold` AND not `WRITE_OFF`: Warehouse Manager (non-maker) or Factory Manager approves.
  - If `> threshold` OR `WRITE_OFF`: Escalates strictly to **Factory Manager** approval.
- **Status Transitions**: `DRAFT → PENDING_APPROVAL → APPROVED_AND_POSTED` or `REJECTED`.
- **Inventory Impact**: Atomic `IN` or `OUT` movement (`ADJUSTMENT_IN` / `ADJUSTMENT_OUT` / `WRITE_OFF`) at current WAC (`DEC-11`); updates `inventory_balances`.
- **Audit Requirements**: `AuditService.log(WMS_ADJUSTMENT_SUBMIT / APPROVE / REJECT)` + immutable `stock_movements`.
- **Notifications**: Notify approvers on `PENDING_APPROVAL`; notify Finance Viewer & Factory Manager on posted write-offs.
- **Exception Handling**: Rejected adjustment leaves stock untouched; erroneous posted adjustment requires a new approved compensating adjustment.

---

### Workflow 9: Reorder Request
- **Trigger**: Automatic low-stock trigger (`available_qty <= reorder_level`) post-issue/adjustment, or manual request for replenishment.
- **Responsible Role**: Warehouse Keeper / System Alert (drafts); Warehouse Manager (submits); Purchasing Manager (reviews); Factory Manager (final approval per `DEC-10`).
- **Required Input**: `material_id`, `warehouse_id`, current `available_qty`, `reorder_level`, `requested_qty`, required date, priority (`NORMAL`, `URGENT`), justification.
- **Validation Rules**: `requested_qty > 0`; active material; warn/prevent duplicate open active requests for the same `(warehouse_id, material_id)`.
- **Approval Sequence (`DEC-10`)**: `OPEN / DRAFT → Warehouse Manager Submits (SUBMITTED) → Purchasing Manager Reviews (PURCHASING_REVIEWED) → Factory Manager Approves (APPROVED)`.
- **Status Transitions**: `OPEN → SUBMITTED → PURCHASING_REVIEWED → APPROVED → LINKED_TO_PO / CLOSED` (or `REJECTED` / `CANCELLED`).
- **Inventory Impact**: **None** (stock only increases later via Workflow 1 GRN receipt).
- **Audit Requirements**: `AuditService.log(WMS_REORDER_SUBMIT / REVIEW / APPROVE / REJECT)`.
- **Notifications**: In-app alert to Warehouse & Purchasing on low stock; alert to next approver at each stage.
- **Exception Handling**: Purchasing may enter external `po_reference`, vendor name, and expected ETA in `LINKED_TO_PO` without requiring a full Purchasing module.

---

### Workflow 10: Finished Goods Receiving (Production Output → FG Warehouse)
- **Trigger**: Packing & Finishing (`DEP-PCK`) completes garment packing/cartoning and passes final QC (`STG-QC` / `STG-PCK`).
- **Responsible Role**: Production Manager / Packing Supervisor (handover); QC Inspector (if final audit gate required); FG Warehouse Keeper (receives & puts away).
- **Required Input**: Source `department_id` (`DEP-PCK`), optional `production_line_id` (`LINE-FIN-01`), Finished Good `material_id` (`FINISHED_GOOD`), `carton_count`, `pcs_qty`, `lot_number` / order ref, target `FINISHED_GOODS` warehouse & `location_id`, `unit_cost` (optional/standard).
- **Validation Rules**: `pcs_qty > 0`; material category = `FINISHED_GOOD`; target warehouse type in (`FINISHED_GOODS`, `GENERAL`); active entities.
- **Approval Sequence**: Production/Packing handover submission + QC pass check (if configured) → Warehouse Keeper confirms physical receipt.
- **Status Transitions**: `PACKED_HANDOVER → RECEIVED_IN_FG` (or `HOLD` / `RETURNED_TO_REWORK` if QC fails).
- **Inventory Impact**: Atomic `IN` movement (`FG_RECEIPT`) into `FINISHED_GOODS` warehouse `AVAILABLE` (or `QUARANTINE` if final FG QC pending), updating WAC (`DEC-11`).
- **Audit Requirements**: `AuditService.log(WMS_FG_RECEIPT)` + `stock_movements` linked to `department_id` and `production_line_id`.
- **Notifications**: Notify FG Warehouse Keeper on handover; alert Sales/Logistics (`DEP-SALES`/`DEP-TRANS`) when FG stock becomes `AVAILABLE`.
- **Exception Handling**: Damaged cartons at dock route to `HOLD`/`DAMAGED` or rework return rather than `AVAILABLE` FG stock.
