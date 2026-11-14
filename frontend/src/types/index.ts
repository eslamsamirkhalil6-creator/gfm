export interface CurrentUser {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  permissions: string[];
  managed_department_ids: number[];
  primary_department_id: number | null;
  managed_warehouse_ids?: number[];
  supervised_line_ids?: number[];
  planning_department_ids?: number[];
}

export interface AssignableUser {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
}

export interface UserItem {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  roles: {
    id: number;
    role_name: string;
  }[];
}

export interface RoleItem {
  id: number;
  role_name: string;
  description: string;
  permissions: {
    id: number;
    permission_key: string;
    description: string;
  }[];
}

export interface AuditLogItem {
  id: number;
  user_id: number | null;
  username?: string;
  user_full_name?: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface HealthCheckData {
  status: 'UP' | 'DEGRADED';
  database: {
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
    mode: string;
    engine: string;
    latency_ms: number;
    tables_count: number;
    users_count: number;
    roles_count: number;
    audit_logs_count: number;
    database_url_configured: boolean;
    error?: string;
  };
  server: {
    timestamp: string;
    uptime_seconds: number;
    environment: string;
    node_version: string;
  };
}

export interface TestResultItem {
  id: number;
  name: string;
  category: string;
  status: 'PASSED' | 'FAILED';
  durationMs: number;
  details?: string;
  error?: string;
}

export interface TestSuiteResult {
  total: number;
  passed: number;
  failed: number;
  allPassed: boolean;
  totalDurationMs: number;
  timestamp: string;
  results: TestResultItem[];
}

// ==========================================
// Production Module Setup & Configuration Types
// ==========================================

export interface ProductionHall {
  id: number;
  name: string;
  code: string;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  lines_count: number;
  active_lines_count: number;
  lines?: {
    id: number;
    line_number: string;
    name: string;
    production_type: string;
    status: string;
  }[];
}

export interface ProductionLine {
  id: number;
  line_number: string;
  name: string;
  hall_id: number;
  hall_name?: string;
  hall_code?: string;
  production_type: string;
  supervisor_id: number | null;
  supervisor_name?: string | null;
  supervisor_username?: string | null;
  capacity_per_day: number;
  description: string | null;
  status: 'active' | 'idle' | 'maintenance' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ProductionStage {
  id: number;
  name: string;
  stage_code: string;
  description: string | null;
  stage_type: 'STANDARD' | 'QUALITY' | 'PACKING';
  is_mandatory_default: boolean;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  used_in_workflows_count: number;
  workflows?: {
    id: number;
    name: string;
    workflow_code: string;
    step_order: number;
  }[];
}

export interface WorkflowStep {
  id?: number;
  stage_id: number;
  stage_name?: string;
  stage_code?: string;
  stage_type?: 'STANDARD' | 'QUALITY' | 'PACKING';
  step_order: number;
  is_mandatory: boolean;
  quality_gate: boolean;
  notes?: string | null;
}

export interface ProductionWorkflow {
  id: number;
  name: string;
  workflow_code: string;
  description: string | null;
  product_category: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  steps: WorkflowStep[];
}

export interface ProductionSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  description: string | null;
  updated_at: string;
}

export interface ProductionOverviewStats {
  halls_count: number;
  active_halls_count: number;
  lines_count: number;
  active_lines_count: number;
  idle_lines_count: number;
  maintenance_lines_count: number;
  stages_count: number;
  quality_stages_count: number;
  workflows_count: number;
  active_workflows_count: number;
  total_daily_capacity: number;
  supervisors_assigned_count: number;
}

// ==========================================
// Department Management Types (Part 3)
// ==========================================

export interface Department {
  id: number;
  dept_code: string;
  name: string;
  description: string | null;
  parent_id: number | null;
  manager_id: number | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface DepartmentWithDetails extends Department {
  parent_name: string | null;
  parent_code: string | null;
  manager_name: string | null;
  manager_username: string | null;
  sub_department_count: number;
  employee_count: number;
  production_lines_count?: number;
  production_lines?: DepartmentProductionLine[];
}

export interface DepartmentProductionLine {
  id: number;
  line_number: string;
  name: string;
  hall_id: number;
  hall_name: string | null;
  production_type: string;
  supervisor_id: number | null;
  supervisor_name: string | null;
  capacity_per_day: number;
  status: string;
  description: string | null;
}

export interface DepartmentEmployee {
  id: number;
  department_id: number;
  user_id: number;
  position_title: string;
  is_primary: boolean;
  assigned_at: string;
  notes: string | null;
  username: string;
  full_name: string;
  user_is_active: boolean;
}

export interface DepartmentManagerHistoryItem {
  id: number;
  department_id: number;
  manager_id: number | null;
  manager_name: string | null;
  manager_username: string | null;
  assigned_by: number | null;
  assigned_by_name: string | null;
  assigned_at: string;
  relinquished_at: string | null;
  notes: string | null;
}

export interface DepartmentTreeNode extends DepartmentWithDetails {
  children: DepartmentTreeNode[];
}

export interface DepartmentStats {
  total: number;
  active: number;
  inactive: number;
  with_manager: number;
  without_manager: number;
  total_employee_assignments: number;
  distribution: Array<{
    department_id: number;
    dept_code: string;
    name: string;
    employee_count: number;
  }>;
}

export interface CreateDepartmentDTO {
  dept_code: string;
  name: string;
  description?: string;
  parent_id?: number | null;
  manager_id?: number | null;
}

export interface UpdateDepartmentDTO {
  name?: string;
  description?: string;
  parent_id?: number | null;
  manager_id?: number | null;
}

export interface AssignManagerDTO {
  manager_id: number | null;
  notes?: string;
}

export interface AssignEmployeeDTO {
  user_id: number;
  position_title: string;
  is_primary?: boolean;
  notes?: string;
}

export interface TransferEmployeeDTO {
  target_department_id: number;
  user_id: number;
  position_title?: string;
  is_primary?: boolean;
}

export interface PlanningDepartmentOverview {
  id: number;
  dept_code: string;
  name: string;
  description: string | null;
  status: string;
  lines_count: number;
  total_daily_capacity: number;
  active_schedules_count: number;
}

export interface PlanningLineSummary {
  id: number;
  line_number: string;
  name: string;
  department_id: number;
  dept_code: string;
  production_type: string;
  capacity_per_day: number;
  status: string;
}

export interface PlanningSchedule {
  id: number;
  department_id: number;
  dept_code: string;
  department_name: string;
  production_line_id: number | null;
  line_number: string | null;
  line_name: string | null;
  plan_code: string;
  title: string;
  target_daily_output: number;
  planned_start_date: string;
  planned_end_date: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  notes: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanningDashboardData {
  scope: 'GLOBAL' | 'DEPARTMENT_SCOPED';
  departments: PlanningDepartmentOverview[];
  production_lines: PlanningLineSummary[];
  schedules: PlanningSchedule[];
}

// ==========================================
// Warehouse & Inventory Management (Phase 07)
// ==========================================

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export type WarehouseType =
  | 'RAW_MATERIAL'
  | 'TRIM_ACCESSORY'
  | 'WIP'
  | 'FINISHED_GOODS'
  | 'GENERAL';

export type LocationType =
  | 'DEFAULT'
  | 'RECEIVING'
  | 'STORAGE'
  | 'STAGING'
  | 'QC_HOLD'
  | 'DISPATCH'
  | 'DAMAGED';

export type StockStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'QUARANTINE'
  | 'HOLD'
  | 'IN_TRANSIT'
  | 'DAMAGED'
  | 'SCRAP';

export type WarehouseStaffRole =
  | 'WAREHOUSE_MANAGER'
  | 'WAREHOUSE_KEEPER'
  | 'QC_INSPECTOR'
  | 'VIEWER';

export interface Warehouse {
  id: number;
  warehouse_code: string;
  name: string;
  warehouse_type: WarehouseType;
  department_id: number | null;
  dept_code?: string | null;
  department_name?: string | null;
  manager_id: number | null;
  manager_name?: string | null;
  manager_username?: string | null;
  require_bin_tracking: boolean;
  description: string | null;
  status: 'active' | 'inactive';
  location_count?: number;
  staff_count?: number;
  created_at: string;
  updated_at: string;
}

export interface WarehouseLocation {
  id: number;
  warehouse_id: number;
  location_code: string;
  name: string;
  location_type: LocationType;
  zone: string | null;
  aisle: string | null;
  rack: string | null;
  bin: string | null;
  is_default: boolean;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface WarehouseStaffAssignment {
  id: number;
  warehouse_id: number;
  user_id: number;
  username: string;
  full_name: string;
  user_active: boolean;
  staff_role: WarehouseStaffRole;
  is_primary: boolean;
  status: 'active' | 'inactive';
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
}

export interface WarehouseSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  description: string | null;
  updated_at: string;
}

export interface MaterialCategory {
  id: number;
  category_code: string;
  name: string;
  category_type: 'FABRIC' | 'TRIM' | 'ACCESSORY' | 'PACKING' | 'FINISHED_GOOD' | 'OTHER';
  description: string | null;
  status: 'active' | 'inactive';
}

export interface MaterialItem {
  id: number;
  sku: string;
  name: string;
  category_id: number;
  category_code?: string;
  category_name?: string;
  category_type?: string;
  base_uom: string;
  color: string | null;
  size: string | null;
  attributes_json: Record<string, any> | string | null;
  is_lot_tracked: boolean;
  is_roll_tracked: boolean;
  requires_qc_on_receipt: boolean;
  min_stock_level: string | number;
  reorder_level: string | number;
  weighted_avg_cost: string | number;
  total_valued_qty: string | number;
  total_inventory_value: string | number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface InventoryBalance {
  id: number;
  warehouse_id: number;
  warehouse_code: string;
  warehouse_name: string;
  location_id: number;
  location_code: string;
  location_name: string;
  location_type: LocationType;
  material_id: number;
  sku: string;
  material_name: string;
  base_uom: string;
  weighted_avg_cost?: string | number;
  reorder_level?: string | number;
  lot_id: number | null;
  lot_number: string | null;
  roll_number: string | null;
  shade_code: string | null;
  qc_status: string | null;
  received_at: string | null;
  stock_status: StockStatus;
  qty_on_hand: string | number;
  qty_reserved: string | number;
  qty_available: string | number;
}

export interface InventoryLot {
  id: number;
  material_id: number;
  sku: string;
  material_name: string;
  base_uom: string;
  lot_number: string;
  roll_number: string | null;
  shade_code: string | null;
  supplier_batch: string | null;
  qc_status: string;
  initial_qty: string | number;
  remaining_qty: string | number;
  received_at: string;
  balances?: Array<{
    lot_id: number;
    warehouse_id: number;
    location_id: number;
    stock_status: StockStatus;
    qty_on_hand: string | number;
    qty_reserved: string | number;
    qty_available: string | number;
  }>;
}

export interface StockMovement {
  id: number;
  movement_number: string;
  warehouse_id: number;
  warehouse_code: string;
  warehouse_name: string;
  location_id: number;
  location_code: string;
  material_id: number;
  sku: string;
  material_name: string;
  base_uom: string;
  lot_id: number | null;
  lot_number: string | null;
  roll_number: string | null;
  stock_status: StockStatus;
  direction: 'IN' | 'OUT';
  movement_type: string;
  quantity: string | number;
  balance_before: string | number;
  balance_after: string | number;
  unit_cost: string | number;
  total_cost: string | number;
  source_document_type: string;
  source_document_id: number;
  source_document_ref: string | null;
  actor_id: number;
  actor_username: string;
  actor_name: string;
  notes: string | null;
  created_at: string;
}

export interface InventorySummary {
  active_materials_count: number;
  total_available_qty: number;
  total_reserved_qty: number;
  total_quarantine_qty: number;
  total_damaged_qty: number;
  total_in_transit_qty: number;
  total_global_valuation?: number;
  low_stock_count: number;
  pending_qc_lines_count: number;
  pending_requisition_approvals: number;
  pending_adjustment_approvals: number;
  in_transit_transfers_count: number;
}

export interface InventoryValuationReport {
  valuation_method: string;
  total_inventory_value: number;
  materials: Array<{
    id: number;
    sku: string;
    name: string;
    base_uom: string;
    category_code: string;
    category_type: string;
    weighted_avg_cost: string | number;
    total_valued_qty: string | number;
    total_inventory_value: string | number;
    last_cost_updated_at: string | null;
  }>;
}

export interface WarehouseDepartmentOption {
  id: number;
  dept_code: string;
  name: string;
  status: string;
}

export interface LedgerReconciliationReport {
  isBalanced: boolean;
  scope?: {
    mode: 'full' | 'warehouse' | 'material' | 'warehouse_material';
    warehouse_id: number | null;
    material_id: number | null;
  };
  checked_pairs_count?: number;
  execution_time_ms?: number;
  reconciled_at?: string;
  discrepancies: Array<{
    warehouse_id: number;
    material_id: number;
    balance_qty: number;
    ledger_qty: number;
    variance: number;
  }>;
}

export interface GoodsReceipt {
  id: number;
  grn_number: string;
  warehouse_id: number;
  warehouse_code: string;
  warehouse_name: string;
  supplier_name: string;
  delivery_note_no: string | null;
  po_reference: string | null;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  notes: string | null;
  received_by: number;
  received_by_username: string;
  posted_by: number | null;
  posted_by_username: string | null;
  posted_at: string | null;
  created_at: string;
}

export interface GoodsReceiptItem {
  id: number;
  grn_id: number;
  warehouse_id: number;
  target_location_id: number;
  location_code?: string;
  material_id: number;
  sku: string;
  material_name: string;
  base_uom: string;
  lot_id: number | null;
  lot_number?: string | null;
  roll_number?: string | null;
  shade_code?: string | null;
  ordered_qty: string | number | null;
  received_qty: string | number;
  accepted_qty: string | number;
  rejected_qty: string | number;
  damaged_qty: string | number;
  pending_inspection_qty: string | number;
  unit_cost: string | number;
  notes: string | null;
}

export interface PendingQcItem extends GoodsReceiptItem {
  grn_number: string;
  supplier_name: string;
  posted_at: string;
  warehouse_code: string;
}

export interface QcInspection {
  id: number;
  inspection_number: string;
  warehouse_id: number;
  warehouse_code: string;
  grn_item_id: number | null;
  material_id: number;
  sku: string;
  material_name: string;
  lot_id: number | null;
  lot_number: string | null;
  roll_number: string | null;
  inspected_qty: string | number;
  passed_qty: string | number;
  rejected_qty: string | number;
  damaged_qty: string | number;
  outcome_status: 'PENDING' | 'PASSED' | 'PARTIALLY_PASSED' | 'REJECTED' | string;
  inspector_id: number;
  inspector_username: string;
  notes: string | null;
  inspected_at: string;
}

export interface MaterialRequisition {
  id: number;
  requisition_number: string;
  department_id: number;
  dept_code: string;
  department_name: string;
  production_line_id: number | null;
  line_number: string | null;
  line_name: string | null;
  warehouse_id: number;
  warehouse_code: string;
  warehouse_name: string;
  reference_type: string | null;
  reference_code: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIALLY_ISSUED' | 'FULFILLED' | 'REJECTED' | 'CANCELLED';
  required_date: string | null;
  notes: string | null;
  requested_by: number;
  requested_by_username: string;
  approved_by: number | null;
  approved_by_username: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface MaterialRequisitionItem {
  id: number;
  requisition_id: number;
  material_id: number;
  sku: string;
  material_name: string;
  base_uom: string;
  preferred_lot_id: number | null;
  lot_number?: string | null;
  roll_number?: string | null;
  requested_qty: string | number;
  issued_qty: string | number;
  notes: string | null;
}

export interface StockIssue {
  id: number;
  issue_number: string;
  requisition_id: number;
  requisition_number: string;
  warehouse_id: number;
  warehouse_code: string;
  department_id: number;
  dept_code: string;
  production_line_id: number | null;
  line_number: string | null;
  issued_by: number;
  issued_by_username: string;
  received_by: number | null;
  received_by_username: string | null;
  status: string;
  notes: string | null;
  issued_at: string;
}

export interface MaterialReturn {
  id: number;
  return_number: string;
  warehouse_id: number;
  warehouse_code: string;
  department_id: number;
  dept_code: string;
  production_line_id: number | null;
  stock_issue_id: number | null;
  material_id: number;
  sku: string;
  material_name: string;
  lot_id: number | null;
  lot_number: string | null;
  returned_qty: string | number;
  return_condition: 'USABLE_SURPLUS' | 'DAMAGED' | 'WASTE_SCRAP';
  status: string;
  returned_by_username: string;
  notes: string | null;
  created_at: string;
}

export interface WarehouseTransfer {
  id: number;
  transfer_number: string;
  transfer_type: 'INTERNAL_BIN' | 'INTER_WAREHOUSE';
  source_warehouse_id: number;
  source_warehouse_code: string;
  target_warehouse_id: number;
  target_warehouse_code: string;
  status: 'COMPLETED' | 'DISPATCHED' | 'IN_TRANSIT' | 'RECEIVED' | 'RECEIVED_WITH_DISCREPANCY' | 'CANCELLED';
  notes: string | null;
  initiated_by_username: string;
  dispatched_at: string | null;
  received_at: string | null;
  created_at: string;
}

export interface WarehouseTransferItem {
  id: number;
  transfer_id: number;
  material_id: number;
  sku: string;
  material_name: string;
  base_uom: string;
  source_location_id: number;
  source_location_code: string;
  target_location_id: number;
  target_location_code: string;
  lot_id: number | null;
  lot_number: string | null;
  roll_number: string | null;
  dispatched_qty: string | number;
  received_qty: string | number;
  damaged_qty: string | number;
  discrepancy_qty: string | number;
  notes: string | null;
}

export interface StockCount {
  id: number;
  count_number: string;
  warehouse_id: number;
  warehouse_code: string;
  count_type: 'CYCLE' | 'FULL';
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'CANCELLED';
  notes: string | null;
  created_by: number;
  created_by_username: string;
  submitted_by: number | null;
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
}

export interface StockCountItem {
  id: number;
  stock_count_id: number;
  location_id: number;
  location_code: string;
  material_id: number;
  sku: string;
  material_name: string;
  base_uom: string;
  lot_id: number | null;
  lot_number: string | null;
  stock_status: StockStatus;
  system_qty: string | number;
  counted_qty: string | number | null;
  variance_qty: string | number | null;
  notes: string | null;
}

export interface StockAdjustment {
  id: number;
  adjustment_number: string;
  warehouse_id: number;
  warehouse_code: string;
  location_id: number;
  location_code: string;
  material_id: number;
  sku: string;
  material_name: string;
  lot_id: number | null;
  stock_status: StockStatus;
  direction: 'IN' | 'OUT';
  quantity: string | number;
  unit_cost: string | number;
  total_value: string | number;
  reason_code: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  requires_factory_manager: boolean;
  requested_by: number;
  requested_by_username: string;
  approved_by: number | null;
  approved_by_username: string | null;
  notes: string | null;
  created_at: string;
}

export interface ReorderRequest {
  id: number;
  request_number: string;
  warehouse_id: number;
  warehouse_code: string;
  material_id: number;
  sku: string;
  material_name: string;
  base_uom: string;
  current_available_qty: string | number;
  reorder_level_snapshot: string | number;
  requested_qty: string | number;
  priority: 'NORMAL' | 'URGENT';
  status: 'OPEN' | 'SUBMITTED' | 'PURCHASING_REVIEWED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  required_date: string | null;
  justification: string | null;
  supplier_note: string | null;
  po_reference: string | null;
  requested_by_username: string;
  created_at: string;
}

export interface WarehouseNotification {
  id: number;
  recipient_user_id: number | null;
  target_role_name: string | null;
  warehouse_id: number | null;
  notification_type:
    | 'LOW_STOCK'
    | 'QC_PENDING'
    | 'APPROVAL_REQUIRED'
    | 'TRANSFER_DELAYED'
    | 'RECEIPT_DISCREPANCY'
    | 'GENERAL';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

