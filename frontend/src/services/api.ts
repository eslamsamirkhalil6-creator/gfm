import {
  AuditLogItem,
  CurrentUser,
  HealthCheckData,
  RoleItem,
  TestSuiteResult,
  UserItem,
  AssignableUser,
  DepartmentWithDetails,
  DepartmentTreeNode,
  DepartmentStats,
  CreateDepartmentDTO,
  UpdateDepartmentDTO,
  AssignManagerDTO,
  AssignEmployeeDTO,
  TransferEmployeeDTO,
  DepartmentEmployee,
  DepartmentManagerHistoryItem,
  DepartmentProductionLine,
  PlanningDashboardData,
  PlanningSchedule,
  PaginatedResult,
  Warehouse,
  WarehouseLocation,
  WarehouseStaffAssignment,
  WarehouseSetting,
  MaterialCategory,
  MaterialItem,
  InventoryBalance,
  InventoryLot,
  StockMovement,
  InventorySummary,
  InventoryValuationReport,
  LedgerReconciliationReport,
  GoodsReceipt,
  GoodsReceiptItem,
  PendingQcItem,
  QcInspection,
  MaterialRequisition,
  MaterialRequisitionItem,
  StockIssue,
  MaterialReturn,
  WarehouseTransfer,
  WarehouseTransferItem,
  StockCount,
  StockCountItem,
  StockAdjustment,
  ReorderRequest,
  WarehouseNotification,
  WarehouseDepartmentOption,
} from '../types/index.ts';

const TOKEN_KEY = 'gfms_auth_token';

export class ApiService {
  private static getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  static getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  static setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  static clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  private static async handleResponse<T>(res: Response): Promise<T> {
    const contentType = res.headers.get('content-type');
    let data: any = {};
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = { message: await res.text() };
    }

    if (!res.ok) {
      const errorMessage = data?.error?.message || data?.message || `HTTP ${res.status}: Request failed`;
      const err: any = new Error(errorMessage);
      err.status = res.status;
      err.code = data?.error?.code;
      err.details = data?.error?.details;
      throw err;
    }

    return data;
  }

  // Health check
  static async getHealth(): Promise<HealthCheckData> {
    const res = await fetch('/api/health');
    return this.handleResponse<HealthCheckData>(res);
  }

  // Auth endpoints
  static async login(username: string, password: string): Promise<{ token: string; user: CurrentUser }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const result = await this.handleResponse<{ success: boolean; data: { token: string; user: CurrentUser } }>(res);
    this.setToken(result.data.token);
    return result.data;
  }

  static async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } catch (e) {
      console.warn('Logout notification failed:', e);
    } finally {
      this.clearToken();
    }
  }

  static async getMe(): Promise<CurrentUser> {
    const res = await fetch('/api/auth/me', {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: CurrentUser }>(res);
    return result.data;
  }

  // User management endpoints
  static async getUsers(): Promise<UserItem[]> {
    const res = await fetch('/api/users', {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: UserItem[] }>(res);
    return result.data;
  }

  static async createUser(payload: {
    username: string;
    password: string;
    full_name: string;
    roleIds: number[];
  }): Promise<UserItem> {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: UserItem }>(res);
    return result.data;
  }

  static async updateUserStatus(userId: number, isActive: boolean): Promise<void> {
    const res = await fetch(`/api/users/${userId}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ is_active: isActive }),
    });
    await this.handleResponse(res);
  }

  static async updateUserRoles(userId: number, roleIds: number[]): Promise<void> {
    const res = await fetch(`/api/users/${userId}/roles`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ roleIds }),
    });
    await this.handleResponse(res);
  }

  static async getRoles(): Promise<RoleItem[]> {
    const res = await fetch('/api/roles', {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: RoleItem[] }>(res);
    return result.data;
  }

  // Audit logs endpoint
  static async getAuditLogs(params?: { action?: string; limit?: number; offset?: number }): Promise<{
    logs: AuditLogItem[];
    pagination: { total: number; limit: number; offset: number };
  }> {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const res = await fetch(`/api/audit-logs?${query.toString()}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{
      success: boolean;
      data: AuditLogItem[];
      pagination: { total: number; limit: number; offset: number };
    }>(res);

    return {
      logs: result.data,
      pagination: result.pagination,
    };
  }

  // Interactive automated test runner
  static async runTests(): Promise<TestSuiteResult> {
    const res = await fetch('/api/tests/run', {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: TestSuiteResult }>(res);
    return result.data;
  }

  // ==========================================
  // Production Module APIs (Part 2)
  // ==========================================

  static async getProductionStats(): Promise<import('../types/index.ts').ProductionOverviewStats> {
    const res = await fetch('/api/production/stats', { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionOverviewStats }>(res);
    return result.data;
  }

  // Halls
  static async getHalls(): Promise<import('../types/index.ts').ProductionHall[]> {
    const res = await fetch('/api/production/halls', { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionHall[] }>(res);
    return result.data;
  }

  static async createHall(payload: { name: string; code: string; description?: string }): Promise<import('../types/index.ts').ProductionHall> {
    const res = await fetch('/api/production/halls', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionHall }>(res);
    return result.data;
  }

  static async updateHall(id: number, payload: { name: string; code: string; description?: string }): Promise<import('../types/index.ts').ProductionHall> {
    const res = await fetch(`/api/production/halls/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionHall }>(res);
    return result.data;
  }

  static async toggleHallStatus(id: number, status: 'active' | 'inactive'): Promise<void> {
    const res = await fetch(`/api/production/halls/${id}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    await this.handleResponse(res);
  }

  // Lines
  static async getLines(hallId?: number): Promise<import('../types/index.ts').ProductionLine[]> {
    const url = hallId ? `/api/production/lines?hallId=${hallId}` : '/api/production/lines';
    const res = await fetch(url, { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionLine[] }>(res);
    return result.data;
  }

  static async createLine(payload: {
    line_number: string;
    name: string;
    hall_id: number;
    production_type: string;
    supervisor_id?: number | null;
    capacity_per_day?: number;
    description?: string;
  }): Promise<import('../types/index.ts').ProductionLine> {
    const res = await fetch('/api/production/lines', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionLine }>(res);
    return result.data;
  }

  static async updateLine(id: number, payload: {
    line_number: string;
    name: string;
    hall_id: number;
    production_type: string;
    supervisor_id?: number | null;
    capacity_per_day?: number;
    description?: string;
    status?: 'active' | 'idle' | 'maintenance' | 'inactive';
  }): Promise<import('../types/index.ts').ProductionLine> {
    const res = await fetch(`/api/production/lines/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionLine }>(res);
    return result.data;
  }

  static async toggleLineStatus(id: number, status: 'active' | 'idle' | 'maintenance' | 'inactive'): Promise<void> {
    const res = await fetch(`/api/production/lines/${id}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    await this.handleResponse(res);
  }

  // Stages
  static async getStages(): Promise<import('../types/index.ts').ProductionStage[]> {
    const res = await fetch('/api/production/stages', { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionStage[] }>(res);
    return result.data;
  }

  static async createStage(payload: {
    name: string;
    stage_code: string;
    description?: string;
    stage_type?: 'STANDARD' | 'QUALITY' | 'PACKING';
    is_mandatory_default?: boolean;
  }): Promise<import('../types/index.ts').ProductionStage> {
    const res = await fetch('/api/production/stages', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionStage }>(res);
    return result.data;
  }

  static async updateStage(id: number, payload: {
    name: string;
    stage_code: string;
    description?: string;
    stage_type?: 'STANDARD' | 'QUALITY' | 'PACKING';
    is_mandatory_default?: boolean;
  }): Promise<import('../types/index.ts').ProductionStage> {
    const res = await fetch(`/api/production/stages/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionStage }>(res);
    return result.data;
  }

  static async toggleStageStatus(id: number, status: 'active' | 'inactive'): Promise<void> {
    const res = await fetch(`/api/production/stages/${id}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    await this.handleResponse(res);
  }

  // Workflows
  static async getWorkflows(): Promise<import('../types/index.ts').ProductionWorkflow[]> {
    const res = await fetch('/api/production/workflows', { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionWorkflow[] }>(res);
    return result.data;
  }

  static async getWorkflow(id: number): Promise<import('../types/index.ts').ProductionWorkflow> {
    const res = await fetch(`/api/production/workflows/${id}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionWorkflow }>(res);
    return result.data;
  }

  static async createWorkflow(payload: {
    name: string;
    workflow_code: string;
    description?: string;
    product_category?: string;
    steps: {
      stage_id: number;
      step_order: number;
      is_mandatory?: boolean;
      quality_gate?: boolean;
      notes?: string;
    }[];
  }): Promise<import('../types/index.ts').ProductionWorkflow> {
    const res = await fetch('/api/production/workflows', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionWorkflow }>(res);
    return result.data;
  }

  static async updateWorkflow(id: number, payload: {
    name: string;
    workflow_code: string;
    description?: string;
    product_category?: string;
  }): Promise<import('../types/index.ts').ProductionWorkflow> {
    const res = await fetch(`/api/production/workflows/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionWorkflow }>(res);
    return result.data;
  }

  static async reorderWorkflowSteps(id: number, steps: {
    stage_id: number;
    step_order?: number;
    is_mandatory: boolean;
    quality_gate: boolean;
    notes?: string;
  }[]): Promise<import('../types/index.ts').ProductionWorkflow> {
    const res = await fetch(`/api/production/workflows/${id}/steps`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ steps }),
    });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionWorkflow }>(res);
    return result.data;
  }

  static async toggleWorkflowStatus(id: number, status: 'active' | 'inactive'): Promise<void> {
    const res = await fetch(`/api/production/workflows/${id}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    await this.handleResponse(res);
  }

  // Production Settings
  static async getProductionSettings(): Promise<import('../types/index.ts').ProductionSetting[]> {
    const res = await fetch('/api/production/settings', { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionSetting[] }>(res);
    return result.data;
  }

  static async updateProductionSetting(key: string, value: string): Promise<import('../types/index.ts').ProductionSetting> {
    const res = await fetch(`/api/production/settings/${key}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ value }),
    });
    const result = await this.handleResponse<{ success: boolean; data: import('../types/index.ts').ProductionSetting }>(res);
    return result.data;
  }

  // ==========================================
  // Department Management (Part 3)
  // ==========================================

  static async getDepartmentStats(): Promise<DepartmentStats> {
    const res = await fetch('/api/departments/stats', { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: DepartmentStats }>(res);
    return result.data;
  }

  static async getDepartments(filter?: {
    status?: string;
    parent_id?: number;
    search?: string;
  }): Promise<DepartmentWithDetails[]> {
    const query = new URLSearchParams();
    if (filter?.status) query.set('status', filter.status);
    if (filter?.parent_id !== undefined) query.set('parent_id', String(filter.parent_id));
    if (filter?.search) query.set('search', filter.search);

    const res = await fetch(`/api/departments?${query.toString()}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: DepartmentWithDetails[] }>(res);
    return result.data;
  }

  static async getDepartmentTree(): Promise<DepartmentTreeNode[]> {
    const res = await fetch('/api/departments/tree', { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: DepartmentTreeNode[] }>(res);
    return result.data;
  }

  static async getDepartmentById(id: number): Promise<{
    department: DepartmentWithDetails;
    sub_departments: DepartmentWithDetails[];
    employees: DepartmentEmployee[];
    manager_history: DepartmentManagerHistoryItem[];
    production_lines: DepartmentProductionLine[];
  }> {
    const res = await fetch(`/api/departments/${id}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{
      success: boolean;
      data: {
        department: DepartmentWithDetails;
        sub_departments: DepartmentWithDetails[];
        employees: DepartmentEmployee[];
        manager_history: DepartmentManagerHistoryItem[];
        production_lines: DepartmentProductionLine[];
      };
    }>(res);
    return result.data;
  }

  static async getDepartmentLines(deptId: number): Promise<DepartmentProductionLine[]> {
    const res = await fetch(`/api/departments/${deptId}/lines`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{
      success: boolean;
      data: DepartmentProductionLine[];
    }>(res);
    return result.data;
  }

  static async getDepartmentAssignableUsers(deptId: number): Promise<AssignableUser[]> {
    const res = await fetch(`/api/departments/${deptId}/assignable-users`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{
      success: boolean;
      data: AssignableUser[];
    }>(res);
    return result.data;
  }

  static async createDepartment(data: CreateDepartmentDTO): Promise<DepartmentWithDetails> {
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await this.handleResponse<{ success: boolean; message: string; data: DepartmentWithDetails }>(res);
    return result.data;
  }

  static async updateDepartment(id: number, data: UpdateDepartmentDTO): Promise<DepartmentWithDetails> {
    const res = await fetch(`/api/departments/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await this.handleResponse<{ success: boolean; message: string; data: DepartmentWithDetails }>(res);
    return result.data;
  }

  static async toggleDepartmentStatus(id: number): Promise<DepartmentWithDetails> {
    const res = await fetch(`/api/departments/${id}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; message: string; data: DepartmentWithDetails }>(res);
    return result.data;
  }

  static async assignDepartmentManager(id: number, data: AssignManagerDTO): Promise<DepartmentWithDetails> {
    const res = await fetch(`/api/departments/${id}/manager`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await this.handleResponse<{ success: boolean; message: string; data: DepartmentWithDetails }>(res);
    return result.data;
  }

  static async assignDepartmentEmployee(deptId: number, data: AssignEmployeeDTO): Promise<DepartmentEmployee> {
    const res = await fetch(`/api/departments/${deptId}/employees`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await this.handleResponse<{ success: boolean; message: string; data: DepartmentEmployee }>(res);
    return result.data;
  }

  static async transferDepartmentEmployee(sourceDeptId: number, data: TransferEmployeeDTO): Promise<DepartmentEmployee> {
    const res = await fetch(`/api/departments/${sourceDeptId}/employees/transfer`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await this.handleResponse<{ success: boolean; message: string; data: DepartmentEmployee }>(res);
    return result.data;
  }

  static async removeDepartmentEmployee(deptId: number, userId: number): Promise<void> {
    const res = await fetch(`/api/departments/${deptId}/employees/${userId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    await this.handleResponse(res);
  }

  static async deleteDepartment(id: number): Promise<void> {
    const res = await fetch(`/api/departments/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    await this.handleResponse(res);
  }

  // ==========================================
  // Scoped Department Planning APIs
  // ==========================================

  static async getPlanningDashboard(): Promise<PlanningDashboardData> {
    const res = await fetch('/api/planning/dashboard', { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: PlanningDashboardData }>(res);
    return result.data;
  }

  static async createPlanningSchedule(payload: {
    department_id: number;
    production_line_id?: number | null;
    plan_code: string;
    title: string;
    target_daily_output?: number;
    planned_start_date: string;
    planned_end_date: string;
    status?: 'draft' | 'active' | 'completed' | 'cancelled';
    notes?: string;
  }): Promise<PlanningSchedule> {
    const res = await fetch('/api/planning/schedules', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: PlanningSchedule }>(res);
    return result.data;
  }

  static async updatePlanningScheduleStatus(
    scheduleId: number,
    status: 'draft' | 'active' | 'completed' | 'cancelled'
  ): Promise<PlanningSchedule> {
    const res = await fetch(`/api/planning/schedules/${scheduleId}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    const result = await this.handleResponse<{ success: boolean; data: PlanningSchedule }>(res);
    return result.data;
  }

  // ==========================================
  // Warehouse & Inventory Management (Phase 07)
  // ==========================================

  private static buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
    const q = new URLSearchParams();
    if (!params) return '';
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        q.set(k, String(v));
      }
    }
    const qs = q.toString();
    return qs ? `?${qs}` : '';
  }

  // 5.1 Warehouses, Bins, Staff & Settings
  static async getWarehouses(params?: {
    status?: string;
    warehouse_type?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<Warehouse>> {
    const res = await fetch(`/api/warehouses${this.buildQuery(params)}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: Warehouse[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async getWarehouseById(id: number): Promise<{
    warehouse: Warehouse;
    locations: WarehouseLocation[];
    staff: WarehouseStaffAssignment[];
  }> {
    const res = await fetch(`/api/warehouses/${id}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{
      success: boolean;
      data: { warehouse: Warehouse; locations: WarehouseLocation[]; staff: WarehouseStaffAssignment[] };
    }>(res);
    return result.data;
  }

  static async createWarehouse(payload: {
    warehouse_code: string;
    name: string;
    warehouse_type: string;
    department_id?: number | null;
    manager_id?: number | null;
    require_bin_tracking?: boolean;
    description?: string;
  }): Promise<{ warehouse: Warehouse; default_location: WarehouseLocation }> {
    const res = await fetch('/api/warehouses', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{
      success: boolean;
      data: { warehouse: Warehouse; default_location: WarehouseLocation };
    }>(res);
    return result.data;
  }

  static async updateWarehouse(
    id: number,
    payload: {
      name?: string;
      warehouse_type?: string;
      department_id?: number | null;
      manager_id?: number | null;
      require_bin_tracking?: boolean;
      description?: string;
    }
  ): Promise<Warehouse> {
    const res = await fetch(`/api/warehouses/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: Warehouse }>(res);
    return result.data;
  }

  static async toggleWarehouseStatus(id: number, status: 'active' | 'inactive'): Promise<Warehouse> {
    const res = await fetch(`/api/warehouses/${id}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    const result = await this.handleResponse<{ success: boolean; data: Warehouse }>(res);
    return result.data;
  }

  static async getWarehouseLocations(warehouseId: number): Promise<WarehouseLocation[]> {
    const res = await fetch(`/api/warehouses/${warehouseId}/locations`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: WarehouseLocation[] }>(res);
    return result.data;
  }

  static async createWarehouseLocation(
    warehouseId: number,
    payload: {
      location_code: string;
      name: string;
      location_type: string;
      zone?: string;
      aisle?: string;
      rack?: string;
      bin?: string;
    }
  ): Promise<WarehouseLocation> {
    const res = await fetch(`/api/warehouses/${warehouseId}/locations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: WarehouseLocation }>(res);
    return result.data;
  }

  static async toggleLocationStatus(
    warehouseId: number,
    locationId: number,
    status: 'active' | 'inactive'
  ): Promise<WarehouseLocation> {
    const res = await fetch(`/api/warehouses/${warehouseId}/locations/${locationId}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    const result = await this.handleResponse<{ success: boolean; data: WarehouseLocation }>(res);
    return result.data;
  }

  static async assignWarehouseStaff(
    warehouseId: number,
    payload: {
      user_id: number;
      staff_role: string;
      is_primary?: boolean;
      effective_from?: string;
      effective_to?: string | null;
      notes?: string;
    }
  ): Promise<WarehouseStaffAssignment> {
    const res = await fetch(`/api/warehouses/${warehouseId}/staff`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: WarehouseStaffAssignment }>(res);
    return result.data;
  }

  static async removeWarehouseStaff(warehouseId: number, userId: number): Promise<void> {
    const res = await fetch(`/api/warehouses/${warehouseId}/staff/${userId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    await this.handleResponse(res);
  }

  static async getWarehouseSettings(): Promise<WarehouseSetting[]> {
    const res = await fetch('/api/warehouse/settings', { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: WarehouseSetting[] }>(res);
    return result.data;
  }

  static async getWarehouseDepartments(): Promise<WarehouseDepartmentOption[]> {
    const res = await fetch('/api/warehouse/departments', { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: WarehouseDepartmentOption[] }>(res);
    return result.data;
  }

  static async updateWarehouseSetting(key: string, settingValue: string): Promise<WarehouseSetting> {
    const res = await fetch(`/api/warehouse/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ setting_value: settingValue }),
    });
    const result = await this.handleResponse<{ success: boolean; data: WarehouseSetting }>(res);
    return result.data;
  }

  // 5.2 Categories & Materials
  static async getMaterialCategories(status?: string): Promise<MaterialCategory[]> {
    const res = await fetch(`/api/warehouse/categories${this.buildQuery({ status })}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: MaterialCategory[] }>(res);
    return result.data;
  }

  static async createMaterialCategory(payload: {
    category_code: string;
    name: string;
    category_type: string;
    description?: string;
  }): Promise<MaterialCategory> {
    const res = await fetch('/api/warehouse/categories', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: MaterialCategory }>(res);
    return result.data;
  }

  static async getMaterials(params?: {
    category_id?: number;
    status?: string;
    search?: string;
    warehouse_id?: number;
    operation?: 'RETURN' | 'TRANSFER' | 'REQUISITION' | 'INBOUND';
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<MaterialItem>> {
    const res = await fetch(`/api/warehouse/materials${this.buildQuery(params)}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: MaterialItem[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async createMaterial(payload: {
    sku: string;
    name: string;
    category_id: number;
    base_uom: string;
    color?: string;
    size?: string;
    attributes?: Record<string, any>;
    is_lot_tracked?: boolean;
    is_roll_tracked?: boolean;
    requires_qc_on_receipt?: boolean;
    min_stock_level?: number;
    reorder_level?: number;
  }): Promise<MaterialItem> {
    const res = await fetch('/api/warehouse/materials', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: MaterialItem }>(res);
    return result.data;
  }

  static async updateMaterial(
    id: number,
    payload: {
      name?: string;
      category_id?: number;
      base_uom?: string;
      color?: string | null;
      size?: string | null;
      attributes?: Record<string, any>;
      is_lot_tracked?: boolean;
      is_roll_tracked?: boolean;
      requires_qc_on_receipt?: boolean;
      min_stock_level?: number;
      reorder_level?: number;
      status?: 'active' | 'inactive';
    }
  ): Promise<MaterialItem> {
    const res = await fetch(`/api/warehouse/materials/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: MaterialItem }>(res);
    return result.data;
  }

  // 5.3 Inventory Inquiry, Valuation & Reconciliation
  static async getInventoryBalances(params?: {
    warehouse_id?: number;
    location_id?: number;
    material_id?: number;
    lot_id?: number;
    stock_status?: string;
    only_available?: boolean;
    only_reserved?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<InventoryBalance>> {
    const res = await fetch(`/api/inventory/balances${this.buildQuery(params)}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: InventoryBalance[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async getAvailableBalances(warehouseId?: number, materialId?: number): Promise<InventoryBalance[]> {
    const res = await fetch(
      `/api/inventory/available${this.buildQuery({ warehouse_id: warehouseId, material_id: materialId })}`,
      { headers: this.getHeaders() }
    );
    const result = await this.handleResponse<{ success: boolean; data: InventoryBalance[] }>(res);
    return result.data;
  }

  static async getInventoryLots(params?: {
    warehouse_id?: number;
    material_id?: number;
    qc_status?: string;
    lot_number?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<InventoryLot>> {
    const res = await fetch(`/api/inventory/lots${this.buildQuery(params)}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: InventoryLot[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async getStockMovements(params?: {
    warehouse_id?: number;
    material_id?: number;
    lot_id?: number;
    movement_type?: string;
    source_document_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<StockMovement>> {
    const res = await fetch(`/api/inventory/movements${this.buildQuery(params)}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: StockMovement[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async getInventorySummary(warehouseId?: number): Promise<InventorySummary> {
    const res = await fetch(`/api/inventory/summary${this.buildQuery({ warehouse_id: warehouseId })}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: InventorySummary }>(res);
    return result.data;
  }

  static async getInventoryValuation(): Promise<InventoryValuationReport> {
    const res = await fetch('/api/inventory/valuation', { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: InventoryValuationReport }>(res);
    return result.data;
  }

  static async reconcileInventoryLedger(warehouseId?: number, materialId?: number): Promise<LedgerReconciliationReport> {
    const res = await fetch(
      `/api/inventory/reconcile${this.buildQuery({ warehouse_id: warehouseId, material_id: materialId })}`,
      { headers: this.getHeaders() }
    );
    const result = await this.handleResponse<{ success: boolean; data: LedgerReconciliationReport }>(res);
    return result.data;
  }

  // 5.4 Goods Receiving (GRN)
  static async getGrns(params?: {
    warehouse_id?: number;
    status?: string;
    po_reference?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<GoodsReceipt>> {
    const res = await fetch(`/api/warehouse/grns${this.buildQuery(params)}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: GoodsReceipt[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async getGrnById(id: number): Promise<{ grn: GoodsReceipt; items: GoodsReceiptItem[] }> {
    const res = await fetch(`/api/warehouse/grns/${id}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: { grn: GoodsReceipt; items: GoodsReceiptItem[] } }>(res);
    return result.data;
  }

  static async createGrn(payload: {
    warehouse_id: number;
    supplier_name: string;
    delivery_note_no?: string;
    po_reference?: string;
    notes?: string;
  }): Promise<{ grn: GoodsReceipt; items: GoodsReceiptItem[] }> {
    const res = await fetch('/api/warehouse/grns', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: { grn: GoodsReceipt; items: GoodsReceiptItem[] } }>(res);
    return result.data;
  }

  static async addGrnItem(
    grnId: number,
    payload: {
      material_id: number;
      target_location_id?: number;
      ordered_qty?: number;
      received_qty: number;
      accepted_qty?: number;
      rejected_qty?: number;
      damaged_qty?: number;
      pending_inspection_qty?: number;
      unit_cost?: number;
      lot_number?: string;
      roll_number?: string;
      shade_code?: string;
      supplier_batch?: string;
      notes?: string;
    }
  ): Promise<GoodsReceiptItem> {
    const res = await fetch(`/api/warehouse/grns/${grnId}/items`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: GoodsReceiptItem }>(res);
    return result.data;
  }

  static async postGrn(grnId: number): Promise<{ grn: GoodsReceipt }> {
    const res = await fetch(`/api/warehouse/grns/${grnId}/post`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: { grn: GoodsReceipt } }>(res);
    return result.data;
  }

  // 5.5 QC Inspection & Override
  static async getPendingQc(params?: { warehouse_id?: number; limit?: number; offset?: number }): Promise<PaginatedResult<PendingQcItem>> {
    const res = await fetch(`/api/warehouse/qc/pending${this.buildQuery(params)}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: PendingQcItem[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async getQcHistory(params?: {
    warehouse_id?: number;
    material_id?: number;
    lot_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<QcInspection>> {
    const res = await fetch(`/api/warehouse/qc/history${this.buildQuery(params)}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: QcInspection[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async performQcInspection(payload: {
    grn_item_id: number;
    passed_qty: number;
    rejected_qty?: number;
    damaged_qty?: number;
    target_location_id?: number;
    reject_stock_status?: 'DAMAGED' | 'SCRAP';
    notes?: string;
  }): Promise<{ inspection: QcInspection }> {
    const res = await fetch('/api/warehouse/qc/inspect', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: { inspection: QcInspection } }>(res);
    return result.data;
  }

  static async overrideQcStatus(payload: {
    warehouse_id: number;
    location_id?: number;
    target_location_id?: number;
    material_id: number;
    lot_id?: number;
    from_stock_status: 'QUARANTINE' | 'HOLD' | 'DAMAGED';
    to_stock_status?: 'AVAILABLE' | 'HOLD' | 'DAMAGED' | 'SCRAP';
    quantity: number;
    reason: string;
  }): Promise<{ inspection: QcInspection }> {
    const res = await fetch('/api/warehouse/qc/override', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: { inspection: QcInspection } }>(res);
    return result.data;
  }

  // 5.6 Material Requisitions
  static async getRequisitions(params?: {
    status?: string;
    warehouse_id?: number;
    department_id?: number;
    production_line_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<MaterialRequisition>> {
    const res = await fetch(`/api/warehouse/requisitions${this.buildQuery(params)}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: MaterialRequisition[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async getRequisitionById(id: number): Promise<{ requisition: MaterialRequisition; items: MaterialRequisitionItem[] }> {
    const res = await fetch(`/api/warehouse/requisitions/${id}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{
      success: boolean;
      data: { requisition: MaterialRequisition; items: MaterialRequisitionItem[] };
    }>(res);
    return result.data;
  }

  static async createRequisition(payload: {
    department_id: number;
    production_line_id?: number | null;
    warehouse_id: number;
    reference_type?: string;
    reference_code?: string;
    required_date?: string;
    notes?: string;
    items?: Array<{ material_id: number; preferred_lot_id?: number | null; requested_qty: number; notes?: string }>;
  }): Promise<{ requisition: MaterialRequisition; items: MaterialRequisitionItem[] }> {
    const res = await fetch('/api/warehouse/requisitions', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{
      success: boolean;
      data: { requisition: MaterialRequisition; items: MaterialRequisitionItem[] };
    }>(res);
    return result.data;
  }

  static async addRequisitionItem(
    requisitionId: number,
    payload: { material_id: number; preferred_lot_id?: number | null; requested_qty: number; notes?: string }
  ): Promise<MaterialRequisitionItem> {
    const res = await fetch(`/api/warehouse/requisitions/${requisitionId}/items`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: MaterialRequisitionItem }>(res);
    return result.data;
  }

  static async submitRequisition(id: number): Promise<MaterialRequisition> {
    const res = await fetch(`/api/warehouse/requisitions/${id}/submit`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: MaterialRequisition }>(res);
    return result.data;
  }

  static async approveRequisition(id: number): Promise<MaterialRequisition> {
    const res = await fetch(`/api/warehouse/requisitions/${id}/approve`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: MaterialRequisition }>(res);
    return result.data;
  }

  static async rejectRequisition(id: number, reason?: string): Promise<MaterialRequisition> {
    const res = await fetch(`/api/warehouse/requisitions/${id}/reject`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason }),
    });
    const result = await this.handleResponse<{ success: boolean; data: MaterialRequisition }>(res);
    return result.data;
  }

  static async cancelRequisition(id: number): Promise<MaterialRequisition> {
    const res = await fetch(`/api/warehouse/requisitions/${id}/cancel`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: MaterialRequisition }>(res);
    return result.data;
  }

  // 5.7 Stock Issuing
  static async getStockIssues(params?: {
    warehouse_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<StockIssue>> {
    const res = await fetch(`/api/warehouse/issues${this.buildQuery(params)}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: StockIssue[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async getStockIssueById(id: number): Promise<{ issue: StockIssue; items: any[] }> {
    const res = await fetch(`/api/warehouse/issues/${id}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: { issue: StockIssue; items: any[] } }>(res);
    return result.data;
  }

  static async issueStock(payload: {
    requisition_id: number;
    received_by?: number;
    notes?: string;
    items: Array<{
      requisition_item_id: number;
      location_id?: number;
      lot_id?: number | null;
      issued_qty: number;
      fifo_override_reason?: string;
    }>;
  }): Promise<{ issue: StockIssue }> {
    const res = await fetch('/api/warehouse/issues', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: { issue: StockIssue } }>(res);
    return result.data;
  }

  // 5.8 Material Returns
  static async getMaterialReturns(params?: {
    warehouse_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<MaterialReturn>> {
    const res = await fetch(`/api/warehouse/returns${this.buildQuery(params)}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: MaterialReturn[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async createMaterialReturn(payload: {
    department_id: number;
    production_line_id?: number;
    stock_issue_id?: number;
    warehouse_id: number;
    target_location_id?: number;
    material_id: number;
    lot_id?: number;
    returned_qty: number;
    return_condition: 'USABLE_SURPLUS' | 'DAMAGED' | 'WASTE_SCRAP';
    notes?: string;
  }): Promise<{ material_return: MaterialReturn }> {
    const res = await fetch('/api/warehouse/returns', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: { material_return: MaterialReturn } }>(res);
    return result.data;
  }

  // 5.9 Transfers
  static async getTransfers(params?: {
    status?: string;
    transfer_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<WarehouseTransfer>> {
    const res = await fetch(`/api/warehouse/transfers${this.buildQuery(params)}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: WarehouseTransfer[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async getTransferById(id: number): Promise<{ transfer: WarehouseTransfer; items: WarehouseTransferItem[] }> {
    const res = await fetch(`/api/warehouse/transfers/${id}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{
      success: boolean;
      data: { transfer: WarehouseTransfer; items: WarehouseTransferItem[] };
    }>(res);
    return result.data;
  }

  static async executeInternalTransfer(payload: {
    warehouse_id: number;
    notes?: string;
    items: Array<{
      source_location_id: number;
      target_location_id: number;
      material_id: number;
      lot_id?: number | null;
      quantity: number;
    }>;
  }): Promise<{ transfer: WarehouseTransfer }> {
    const res = await fetch('/api/warehouse/transfers/internal', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: { transfer: WarehouseTransfer } }>(res);
    return result.data;
  }

  static async dispatchInterWarehouseTransfer(payload: {
    source_warehouse_id: number;
    target_warehouse_id: number;
    notes?: string;
    items: Array<{
      source_location_id?: number;
      target_location_id?: number;
      material_id: number;
      lot_id?: number | null;
      dispatched_qty: number;
    }>;
  }): Promise<{ transfer: WarehouseTransfer }> {
    const res = await fetch('/api/warehouse/transfers/dispatch', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: { transfer: WarehouseTransfer } }>(res);
    return result.data;
  }

  static async receiveInterWarehouseTransfer(
    transferId: number,
    payload: {
      notes?: string;
      items: Array<{
        transfer_item_id: number;
        received_qty: number;
        damaged_qty?: number;
        discrepancy_qty?: number;
        notes?: string;
      }>;
    }
  ): Promise<{ transfer: WarehouseTransfer }> {
    const res = await fetch(`/api/warehouse/transfers/${transferId}/receive`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: { transfer: WarehouseTransfer } }>(res);
    return result.data;
  }

  // 5.10 Stock Counts
  static async getStockCounts(params?: {
    warehouse_id?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<StockCount>> {
    const res = await fetch(`/api/warehouse/counts${this.buildQuery(params)}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{ success: boolean; data: StockCount[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async createStockCount(payload: {
    warehouse_id: number;
    count_type: 'CYCLE' | 'FULL';
    material_id?: number;
    location_id?: number;
    notes?: string;
  }): Promise<{ stock_count: StockCount; items: StockCountItem[] }> {
    const res = await fetch('/api/warehouse/counts', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{
      success: boolean;
      data: { stock_count: StockCount; items: StockCountItem[] };
    }>(res);
    return result.data;
  }

  static async getStockCountById(id: number): Promise<{ stock_count: StockCount; items: StockCountItem[] }> {
    const res = await fetch(`/api/warehouse/counts/${id}`, { headers: this.getHeaders() });
    const result = await this.handleResponse<{
      success: boolean;
      data: { stock_count: StockCount; items: StockCountItem[] };
    }>(res);
    return result.data;
  }

  static async recordStockCountItems(
    countId: number,
    items: Array<{ stock_count_item_id: number; counted_qty: number; notes?: string }>
  ): Promise<{ items: StockCountItem[] }> {
    const res = await fetch(`/api/warehouse/counts/${countId}/items`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ items }),
    });
    const result = await this.handleResponse<{ success: boolean; data: { items: StockCountItem[] } }>(res);
    return result.data;
  }

  static async submitStockCount(countId: number): Promise<StockCount> {
    const res = await fetch(`/api/warehouse/counts/${countId}/submit`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: StockCount }>(res);
    return result.data;
  }

  static async approveStockCount(countId: number): Promise<{ stock_count: StockCount }> {
    const res = await fetch(`/api/warehouse/counts/${countId}/approve`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: { stock_count: StockCount } }>(res);
    return result.data;
  }

  // 5.11 Stock Adjustments & Write-Offs
  static async getAdjustments(params?: {
    warehouse_id?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<StockAdjustment>> {
    const res = await fetch(`/api/warehouse/adjustments${this.buildQuery(params)}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: StockAdjustment[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async createAdjustment(payload: {
    warehouse_id: number;
    location_id?: number;
    material_id: number;
    lot_id?: number | null;
    stock_status?: string;
    direction: 'IN' | 'OUT';
    quantity: number;
    unit_cost?: number;
    reason_code: string;
    notes?: string;
  }): Promise<StockAdjustment> {
    const res = await fetch('/api/warehouse/adjustments', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: StockAdjustment }>(res);
    return result.data;
  }

  static async approveAdjustment(id: number): Promise<{ adjustment: StockAdjustment }> {
    const res = await fetch(`/api/warehouse/adjustments/${id}/approve`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: { adjustment: StockAdjustment } }>(res);
    return result.data;
  }

  static async rejectAdjustment(id: number, reason?: string): Promise<StockAdjustment> {
    const res = await fetch(`/api/warehouse/adjustments/${id}/reject`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason }),
    });
    const result = await this.handleResponse<{ success: boolean; data: StockAdjustment }>(res);
    return result.data;
  }

  // 5.12 Reorder Requests
  static async getReorders(params?: {
    warehouse_id?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<ReorderRequest>> {
    const res = await fetch(`/api/warehouse/reorders${this.buildQuery(params)}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: ReorderRequest[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async createReorder(payload: {
    material_id: number;
    warehouse_id: number;
    requested_qty: number;
    priority?: 'NORMAL' | 'URGENT';
    required_date?: string;
    justification?: string;
  }): Promise<ReorderRequest> {
    const res = await fetch('/api/warehouse/reorders', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: ReorderRequest }>(res);
    return result.data;
  }

  static async submitReorder(id: number): Promise<ReorderRequest> {
    const res = await fetch(`/api/warehouse/reorders/${id}/submit`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: ReorderRequest }>(res);
    return result.data;
  }

  static async reviewReorder(id: number, payload: { supplier_note?: string; po_reference?: string }): Promise<ReorderRequest> {
    const res = await fetch(`/api/warehouse/reorders/${id}/review`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: ReorderRequest }>(res);
    return result.data;
  }

  static async approveReorder(id: number): Promise<ReorderRequest> {
    const res = await fetch(`/api/warehouse/reorders/${id}/approve`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: ReorderRequest }>(res);
    return result.data;
  }

  static async rejectReorder(id: number, reason?: string): Promise<ReorderRequest> {
    const res = await fetch(`/api/warehouse/reorders/${id}/reject`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason }),
    });
    const result = await this.handleResponse<{ success: boolean; data: ReorderRequest }>(res);
    return result.data;
  }

  // 5.13 Finished Goods Handover
  static async receiveFinishedGoods(payload: {
    department_id: number;
    production_line_id?: number;
    warehouse_id: number;
    target_location_id?: number;
    material_id: number;
    quantity: number;
    unit_cost?: number;
    lot_number?: string;
    handover_ref?: string;
    notes?: string;
  }): Promise<{ receipt: GoodsReceipt }> {
    const res = await fetch('/api/warehouse/finished-goods/receive', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await this.handleResponse<{ success: boolean; data: { receipt: GoodsReceipt } }>(res);
    return result.data;
  }

  // 5.14 In-App Notifications
  static async getWarehouseNotifications(params?: {
    unread_only?: boolean;
    warehouse_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<WarehouseNotification>> {
    const res = await fetch(`/api/warehouse/notifications${this.buildQuery(params)}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: WarehouseNotification[]; pagination: { total: number; limit: number; offset: number } }>(res);
    return { data: result.data, pagination: result.pagination };
  }

  static async markNotificationRead(id: number): Promise<WarehouseNotification> {
    const res = await fetch(`/api/warehouse/notifications/${id}/read`, {
      method: 'PUT',
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse<{ success: boolean; data: WarehouseNotification }>(res);
    return result.data;
  }

  static async scanDelayedTransfers(maxHoursInTransit = 24): Promise<{ alerts_created: number; transfers: any[] }> {
    const res = await fetch('/api/warehouse/notifications/scan-delayed-transfers', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ max_hours_in_transit: maxHoursInTransit }),
    });
    const result = await this.handleResponse<{ success: boolean; data: { alerts_created: number; transfers: any[] } }>(res);
    return result.data;
  }
}
