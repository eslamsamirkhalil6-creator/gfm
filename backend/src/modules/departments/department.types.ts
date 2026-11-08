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
  production_lines?: DepartmentProductionLineSummary[];
}

export interface DepartmentProductionLineSummary {
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
