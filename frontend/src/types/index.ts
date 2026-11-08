export interface CurrentUser {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  permissions: string[];
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

