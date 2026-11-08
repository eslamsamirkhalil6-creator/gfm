export interface ProductionHallDto {
  id: number;
  name: string;
  code: string;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  lines_count?: number;
  active_lines_count?: number;
  lines?: {
    id: number;
    line_number: string;
    name: string;
    production_type: string;
    status: string;
  }[];
}

export interface ProductionLineDto {
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

export interface ProductionStageDto {
  id: number;
  name: string;
  stage_code: string;
  description: string | null;
  stage_type: 'STANDARD' | 'QUALITY' | 'PACKING';
  is_mandatory_default: boolean;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  used_in_workflows_count?: number;
  workflows?: {
    id: number;
    name: string;
    workflow_code: string;
    step_order: number;
  }[];
}

export interface WorkflowStepDto {
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

export interface ProductionWorkflowDto {
  id: number;
  name: string;
  workflow_code: string;
  description: string | null;
  product_category: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  steps: WorkflowStepDto[];
}

export interface ProductionSettingDto {
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
