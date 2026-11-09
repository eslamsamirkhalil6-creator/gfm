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
}
