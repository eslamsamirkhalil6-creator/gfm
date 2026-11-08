import { query, QueryResult } from '../../config/database.ts';
import { AuditService } from '../audit/audit.service.ts';
import {
  Department,
  DepartmentWithDetails,
  DepartmentEmployee,
  DepartmentManagerHistoryItem,
  DepartmentTreeNode,
  DepartmentStats,
  CreateDepartmentDTO,
  UpdateDepartmentDTO,
  AssignEmployeeDTO,
} from './department.types.ts';

export class DepartmentService {
  /**
   * Helper to check circular parent-child dependency
   * Returns true if candidateParentId is a descendant of departmentId (which would create a cycle)
   */
  private static async isDescendant(candidateParentId: number, departmentId: number): Promise<boolean> {
    if (candidateParentId === departmentId) return true;

    let currentParentId: number | null = candidateParentId;
    const visited = new Set<number>();

    while (currentParentId !== null) {
      if (currentParentId === departmentId) {
        return true; // Cycle detected!
      }
      if (visited.has(currentParentId)) {
        break; // Guard against existing malformed cycle
      }
      visited.add(currentParentId);

      const res: QueryResult<{ parent_id: number | null }> = await query<{ parent_id: number | null }>(
        'SELECT parent_id FROM departments WHERE id = $1',
        [currentParentId]
      );
      if (res.rows.length === 0) break;
      currentParentId = res.rows[0].parent_id;
    }

    return false;
  }

  /**
   * List all departments with details (manager, parent, sub-department count, employee count)
   */
  static async listDepartments(filter?: {
    status?: string;
    parent_id?: number | null;
    search?: string;
  }): Promise<DepartmentWithDetails[]> {
    let sql = `
      SELECT 
        d.id,
        d.dept_code,
        d.name,
        d.description,
        d.parent_id,
        d.manager_id,
        d.status,
        d.created_at,
        d.updated_at,
        p.name as parent_name,
        p.dept_code as parent_code,
        u.full_name as manager_name,
        u.username as manager_username
      FROM departments d
      LEFT JOIN departments p ON d.parent_id = p.id
      LEFT JOIN users u ON d.manager_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (filter?.status) {
      sql += ` AND d.status = $${paramIndex++}`;
      params.push(filter.status);
    }

    if (filter?.parent_id !== undefined) {
      if (filter.parent_id === null) {
        sql += ` AND d.parent_id IS NULL`;
      } else {
        sql += ` AND d.parent_id = $${paramIndex++}`;
        params.push(filter.parent_id);
      }
    }

    if (filter?.search) {
      sql += ` AND (d.dept_code ILIKE $${paramIndex} OR d.name ILIKE $${paramIndex} OR d.description ILIKE $${paramIndex})`;
      params.push(`%${filter.search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY d.parent_id NULLS FIRST, d.name ASC`;

    const [deptRes, subCountsRes, empCountsRes] = await Promise.all([
      query(sql, params),
      query<{ parent_id: number; cnt: string }>(
        'SELECT parent_id, count(*) as cnt FROM departments WHERE parent_id IS NOT NULL GROUP BY parent_id'
      ),
      query<{ department_id: number; cnt: string }>(
        'SELECT department_id, count(*) as cnt FROM department_employees GROUP BY department_id'
      ),
    ]);

    const subCountsMap = new Map<number, number>();
    for (const r of subCountsRes.rows) {
      subCountsMap.set(r.parent_id, parseInt(r.cnt || '0', 10));
    }

    const empCountsMap = new Map<number, number>();
    for (const r of empCountsRes.rows) {
      empCountsMap.set(r.department_id, parseInt(r.cnt || '0', 10));
    }

    return deptRes.rows.map(row => ({
      ...row,
      sub_department_count: subCountsMap.get(row.id) || 0,
      employee_count: empCountsMap.get(row.id) || 0,
    }));
  }

  /**
   * Return hierarchical tree of departments
   */
  static async getDepartmentTree(): Promise<DepartmentTreeNode[]> {
    const all = await this.listDepartments();
    const map = new Map<number, DepartmentTreeNode>();

    all.forEach(d => {
      map.set(d.id, { ...d, children: [] });
    });

    const roots: DepartmentTreeNode[] = [];

    all.forEach(d => {
      const node = map.get(d.id)!;
      if (d.parent_id && map.has(d.parent_id)) {
        map.get(d.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  /**
   * Get single department by ID with assigned employees, sub-departments, and manager history
   */
  static async getDepartmentById(id: number): Promise<{
    department: DepartmentWithDetails;
    sub_departments: DepartmentWithDetails[];
    employees: DepartmentEmployee[];
    manager_history: DepartmentManagerHistoryItem[];
  }> {
    const list = await this.listDepartments();
    const dept = list.find(d => d.id === id);
    if (!dept) {
      throw new Error(`Department with ID ${id} not found.`);
    }

    const subDepartments = list.filter(d => d.parent_id === id);

    // Fetch assigned employees
    const empRes = await query(
      `
      SELECT 
        de.id,
        de.department_id,
        de.user_id,
        de.position_title,
        de.is_primary,
        de.assigned_at,
        de.notes,
        u.username,
        u.full_name,
        u.is_active as user_is_active
      FROM department_employees de
      JOIN users u ON de.user_id = u.id
      WHERE de.department_id = $1
      ORDER BY de.is_primary DESC, de.position_title ASC
      `,
      [id]
    );

    // Fetch manager assignment history
    const historyRes = await query(
      `
      SELECT 
        dmh.id,
        dmh.department_id,
        dmh.manager_id,
        dmh.assigned_by,
        dmh.assigned_at,
        dmh.relinquished_at,
        dmh.notes,
        u.full_name as manager_name,
        u.username as manager_username,
        ab.full_name as assigned_by_name
      FROM department_manager_history dmh
      LEFT JOIN users u ON dmh.manager_id = u.id
      LEFT JOIN users ab ON dmh.assigned_by = ab.id
      WHERE dmh.department_id = $1
      ORDER BY dmh.assigned_at DESC
      `,
      [id]
    );

    return {
      department: dept,
      sub_departments: subDepartments,
      employees: empRes.rows,
      manager_history: historyRes.rows,
    };
  }

  /**
   * Get department dashboard statistics and distribution metrics
   */
  static async getDepartmentStats(): Promise<DepartmentStats> {
    const [countsRes, totalAssignmentsRes, distributionRes] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
          COUNT(*) FILTER (WHERE manager_id IS NOT NULL) as with_manager,
          COUNT(*) FILTER (WHERE manager_id IS NULL) as without_manager
        FROM departments
      `),
      query(`SELECT COUNT(*) as total_assignments FROM department_employees`),
      query(`
        SELECT 
          d.id as department_id,
          d.dept_code,
          d.name,
          COUNT(de.id) as employee_count
        FROM departments d
        LEFT JOIN department_employees de ON d.id = de.department_id
        WHERE d.status = 'active'
        GROUP BY d.id, d.dept_code, d.name
        ORDER BY employee_count DESC, d.name ASC
      `),
    ]);

    const c = countsRes.rows[0];
    return {
      total: parseInt(c.total || '0', 10),
      active: parseInt(c.active || '0', 10),
      inactive: parseInt(c.inactive || '0', 10),
      with_manager: parseInt(c.with_manager || '0', 10),
      without_manager: parseInt(c.without_manager || '0', 10),
      total_employee_assignments: parseInt(totalAssignmentsRes.rows[0]?.total_assignments || '0', 10),
      distribution: distributionRes.rows.map(r => ({
        department_id: r.department_id,
        dept_code: r.dept_code,
        name: r.name,
        employee_count: parseInt(r.employee_count || '0', 10),
      })),
    };
  }

  /**
   * Create a new department with unique code and hierarchy validation
   */
  static async createDepartment(
    dto: CreateDepartmentDTO,
    actorId: number,
    ipAddress?: string
  ): Promise<DepartmentWithDetails> {
    const code = dto.dept_code.trim().toUpperCase();
    const name = dto.name.trim();

    if (!code || !name) {
      throw new Error('Department code and name are required.');
    }

    // Check code uniqueness
    const codeCheck = await query('SELECT id FROM departments WHERE UPPER(dept_code) = $1', [code]);
    if (codeCheck.rows.length > 0) {
      throw new Error(`Department code "${code}" already exists. Department codes must be unique.`);
    }

    // Validate parent if provided
    if (dto.parent_id) {
      const parentCheck = await query('SELECT id, status FROM departments WHERE id = $1', [dto.parent_id]);
      if (parentCheck.rows.length === 0) {
        throw new Error(`Parent department with ID ${dto.parent_id} does not exist.`);
      }
    }

    // Validate manager if provided
    if (dto.manager_id) {
      const userCheck = await query('SELECT id, full_name FROM users WHERE id = $1', [dto.manager_id]);
      if (userCheck.rows.length === 0) {
        throw new Error(`User with ID ${dto.manager_id} specified as manager does not exist.`);
      }
    }

    const insertRes = await query(
      `
      INSERT INTO departments (dept_code, name, description, parent_id, manager_id, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING id
      `,
      [code, name, dto.description?.trim() || null, dto.parent_id || null, dto.manager_id || null]
    );

    const newId = insertRes.rows[0].id;

    // Record manager history if manager assigned on creation
    if (dto.manager_id) {
      await query(
        `
        INSERT INTO department_manager_history (department_id, manager_id, assigned_by, notes)
        VALUES ($1, $2, $3, 'Initial manager appointment on department creation')
        `,
        [newId, dto.manager_id, actorId]
      );
    }

    // Audit Log
    await AuditService.log({
      userId: actorId,
      action: 'DEPT_CREATE',
      entityType: 'DEPARTMENT',
      entityId: String(newId),
      details: `Created department "${name}" [${code}]${dto.parent_id ? ` under parent #${dto.parent_id}` : ''}`,
      ipAddress,
    });

    const full = await this.getDepartmentById(newId);
    return full.department;
  }

  /**
   * Update department information, parent hierarchy, or manager
   */
  static async updateDepartment(
    id: number,
    dto: UpdateDepartmentDTO,
    actorId: number,
    ipAddress?: string
  ): Promise<DepartmentWithDetails> {
    const existing = await query('SELECT * FROM departments WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new Error(`Department with ID ${id} not found.`);
    }
    const currentDept = existing.rows[0];

    // Hierarchy validation: circular check
    if (dto.parent_id !== undefined) {
      if (dto.parent_id === id) {
        throw new Error('A department cannot be its own parent.');
      }
      if (dto.parent_id !== null) {
        const parentCheck = await query('SELECT id FROM departments WHERE id = $1', [dto.parent_id]);
        if (parentCheck.rows.length === 0) {
          throw new Error(`Parent department with ID ${dto.parent_id} does not exist.`);
        }

        const isCycle = await this.isDescendant(dto.parent_id, id);
        if (isCycle) {
          throw new Error(
            'Invalid hierarchy: Circular parent-child relationship detected. A department cannot be placed under one of its own sub-departments.'
          );
        }
      }
    }

    // Validate manager if provided
    if (dto.manager_id !== undefined && dto.manager_id !== null) {
      const userCheck = await query('SELECT id FROM users WHERE id = $1', [dto.manager_id]);
      if (userCheck.rows.length === 0) {
        throw new Error(`User with ID ${dto.manager_id} specified as manager does not exist.`);
      }
    }

    const updatedName = dto.name !== undefined ? dto.name.trim() : currentDept.name;
    const updatedDesc = dto.description !== undefined ? (dto.description?.trim() || null) : currentDept.description;
    const updatedParent = dto.parent_id !== undefined ? dto.parent_id : currentDept.parent_id;
    const updatedManager = dto.manager_id !== undefined ? dto.manager_id : currentDept.manager_id;

    // Check if manager changed to record history
    if (dto.manager_id !== undefined && dto.manager_id !== currentDept.manager_id) {
      // Close previous active manager tenure
      await query(
        `
        UPDATE department_manager_history 
        SET relinquished_at = CURRENT_TIMESTAMP
        WHERE department_id = $1 AND relinquished_at IS NULL
        `,
        [id]
      );

      if (dto.manager_id !== null) {
        await query(
          `
          INSERT INTO department_manager_history (department_id, manager_id, assigned_by, notes)
          VALUES ($1, $2, $3, 'Manager updated via department edit')
          `,
          [id, dto.manager_id, actorId]
        );
      }
    }

    await query(
      `
      UPDATE departments 
      SET name = $1, description = $2, parent_id = $3, manager_id = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      `,
      [updatedName, updatedDesc, updatedParent, updatedManager, id]
    );

    // Audit log
    await AuditService.log({
      userId: actorId,
      action: 'DEPT_UPDATE',
      entityType: 'DEPARTMENT',
      entityId: String(id),
      details: `Updated department "${updatedName}". Parent: ${currentDept.parent_id} -> ${updatedParent}, Manager: ${currentDept.manager_id} -> ${updatedManager}`,
      ipAddress,
    });

    const full = await this.getDepartmentById(id);
    return full.department;
  }

  /**
   * Toggle department active / inactive status
   */
  static async toggleDepartmentStatus(
    id: number,
    actorId: number,
    ipAddress?: string
  ): Promise<DepartmentWithDetails> {
    const existing = await query('SELECT * FROM departments WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new Error(`Department with ID ${id} not found.`);
    }
    const dept = existing.rows[0];
    const newStatus = dept.status === 'active' ? 'inactive' : 'active';

    await query(
      `
      UPDATE departments 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [newStatus, id]
    );

    await AuditService.log({
      userId: actorId,
      action: 'DEPT_STATUS_TOGGLE',
      entityType: 'DEPARTMENT',
      entityId: String(id),
      details: `Toggled status for department "${dept.name}" [${dept.dept_code}] to ${newStatus}`,
      ipAddress,
    });

    const full = await this.getDepartmentById(id);
    return full.department;
  }

  /**
   * Assign or replace department manager (explicit manager action)
   */
  static async assignManager(
    id: number,
    managerId: number | null,
    notes: string | undefined,
    actorId: number,
    ipAddress?: string
  ): Promise<DepartmentWithDetails> {
    const existing = await query('SELECT * FROM departments WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new Error(`Department with ID ${id} not found.`);
    }
    const dept = existing.rows[0];

    if (managerId !== null) {
      const userCheck = await query('SELECT id, full_name, username FROM users WHERE id = $1', [managerId]);
      if (userCheck.rows.length === 0) {
        throw new Error(`User with ID ${managerId} not found.`);
      }
    }

    // Close previous tenure
    await query(
      `
      UPDATE department_manager_history 
      SET relinquished_at = CURRENT_TIMESTAMP
      WHERE department_id = $1 AND relinquished_at IS NULL
      `,
      [id]
    );

    // Record new tenure if not unassigning
    if (managerId !== null) {
      await query(
        `
        INSERT INTO department_manager_history (department_id, manager_id, assigned_by, notes)
        VALUES ($1, $2, $3, $4)
        `,
        [id, managerId, actorId, notes?.trim() || 'Assigned via Manager Assignment interface']
      );
    }

    await query(
      `
      UPDATE departments 
      SET manager_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [managerId, id]
    );

    await AuditService.log({
      userId: actorId,
      action: 'DEPT_MANAGER_ASSIGN',
      entityType: 'DEPARTMENT',
      entityId: String(id),
      details: `Manager for department "${dept.name}" changed from #${dept.manager_id ?? 'None'} to #${managerId ?? 'Unassigned'}`,
      ipAddress,
    });

    const full = await this.getDepartmentById(id);
    return full.department;
  }

  /**
   * Assign an existing employee/user to department with position title and primary flag
   */
  static async assignEmployee(
    deptId: number,
    dto: AssignEmployeeDTO,
    actorId: number,
    ipAddress?: string
  ): Promise<DepartmentEmployee> {
    const [deptRes, userRes] = await Promise.all([
      query('SELECT id, name FROM departments WHERE id = $1', [deptId]),
      query('SELECT id, full_name, username FROM users WHERE id = $1', [dto.user_id]),
    ]);

    if (deptRes.rows.length === 0) {
      throw new Error(`Department with ID ${deptId} not found.`);
    }
    if (userRes.rows.length === 0) {
      throw new Error(`User with ID ${dto.user_id} not found.`);
    }

    const dept = deptRes.rows[0];
    const user = userRes.rows[0];
    const pos = dto.position_title.trim() || 'Staff';
    const isPrimary = dto.is_primary !== undefined ? dto.is_primary : true;

    // If marked primary, unset primary on other assignments for this user if specified
    if (isPrimary) {
      await query('UPDATE department_employees SET is_primary = FALSE WHERE user_id = $1', [dto.user_id]);
    }

    // Upsert into department_employees
    await query(
      `
      INSERT INTO department_employees (department_id, user_id, position_title, is_primary, notes)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (department_id, user_id) 
      DO UPDATE SET position_title = $3, is_primary = $4, notes = $5, assigned_at = CURRENT_TIMESTAMP
      `,
      [deptId, dto.user_id, pos, isPrimary, dto.notes?.trim() || null]
    );

    await AuditService.log({
      userId: actorId,
      action: 'DEPT_EMPLOYEE_ASSIGN',
      entityType: 'DEPARTMENT',
      entityId: String(deptId),
      details: `Assigned user @${user.username} (${user.full_name}) as "${pos}" in department "${dept.name}" (Primary: ${isPrimary})`,
      ipAddress,
    });

    const empRes = await query(
      `
      SELECT 
        de.id, de.department_id, de.user_id, de.position_title, de.is_primary, de.assigned_at, de.notes,
        u.username, u.full_name, u.is_active as user_is_active
      FROM department_employees de
      JOIN users u ON de.user_id = u.id
      WHERE de.department_id = $1 AND de.user_id = $2
      `,
      [deptId, dto.user_id]
    );

    return empRes.rows[0];
  }

  /**
   * Transfer an employee from one department to another
   */
  static async transferEmployee(
    sourceDeptId: number,
    targetDeptId: number,
    userId: number,
    newPosition: string,
    isPrimary: boolean,
    actorId: number,
    ipAddress?: string
  ): Promise<DepartmentEmployee> {
    if (sourceDeptId === targetDeptId) {
      throw new Error('Source and target departments must be different for transfer.');
    }

    const [srcRes, tgtRes, userRes] = await Promise.all([
      query('SELECT id, name FROM departments WHERE id = $1', [sourceDeptId]),
      query('SELECT id, name FROM departments WHERE id = $1', [targetDeptId]),
      query('SELECT id, username, full_name FROM users WHERE id = $1', [userId]),
    ]);

    if (srcRes.rows.length === 0 || tgtRes.rows.length === 0 || userRes.rows.length === 0) {
      throw new Error('Invalid source department, target department, or user ID.');
    }

    // Delete from source department
    await query('DELETE FROM department_employees WHERE department_id = $1 AND user_id = $2', [sourceDeptId, userId]);

    // Assign to target department
    const assigned = await this.assignEmployee(
      targetDeptId,
      {
        user_id: userId,
        position_title: newPosition,
        is_primary: isPrimary,
        notes: `Transferred from ${srcRes.rows[0].name}`,
      },
      actorId,
      ipAddress
    );

    await AuditService.log({
      userId: actorId,
      action: 'DEPT_EMPLOYEE_TRANSFER',
      entityType: 'DEPARTMENT',
      entityId: String(targetDeptId),
      details: `Transferred user @${userRes.rows[0].username} from department "${srcRes.rows[0].name}" to "${tgtRes.rows[0].name}" as "${newPosition}"`,
      ipAddress,
    });

    return assigned;
  }

  /**
   * Remove employee assignment from department
   */
  static async removeEmployee(
    deptId: number,
    userId: number,
    actorId: number,
    ipAddress?: string
  ): Promise<void> {
    const [deptRes, userRes] = await Promise.all([
      query('SELECT id, name FROM departments WHERE id = $1', [deptId]),
      query('SELECT id, username, full_name FROM users WHERE id = $1', [userId]),
    ]);

    if (deptRes.rows.length === 0 || userRes.rows.length === 0) {
      throw new Error('Department or user not found.');
    }

    await query('DELETE FROM department_employees WHERE department_id = $1 AND user_id = $2', [deptId, userId]);

    await AuditService.log({
      userId: actorId,
      action: 'DEPT_EMPLOYEE_REMOVE',
      entityType: 'DEPARTMENT',
      entityId: String(deptId),
      details: `Removed user @${userRes.rows[0].username} (${userRes.rows[0].full_name}) from department "${deptRes.rows[0].name}"`,
      ipAddress,
    });
  }

  /**
   * Safe deletion verification (Section 4):
   * "A department with historical records or assigned employees must not be permanently deleted. Deactivation should be used instead."
   */
  static async deleteDepartment(
    id: number,
    actorId: number,
    ipAddress?: string
  ): Promise<void> {
    const existing = await query('SELECT * FROM departments WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new Error(`Department with ID ${id} not found.`);
    }
    const dept = existing.rows[0];

    // Check for assigned employees
    const empCheck = await query('SELECT count(*) as count FROM department_employees WHERE department_id = $1', [id]);
    if (parseInt(empCheck.rows[0].count, 10) > 0) {
      throw new Error(
        `Safety restriction: Department "${dept.name}" has ${empCheck.rows[0].count} assigned employees and cannot be deleted. Use deactivation to preserve organizational audit records.`
      );
    }

    // Check for sub-departments
    const subCheck = await query('SELECT count(*) as count FROM departments WHERE parent_id = $1', [id]);
    if (parseInt(subCheck.rows[0].count, 10) > 0) {
      throw new Error(
        `Safety restriction: Department "${dept.name}" has ${subCheck.rows[0].count} sub-departments. You must reassign or remove sub-departments before deleting.`
      );
    }

    // Check for production lines linked
    const lineCheck = await query('SELECT count(*) as count FROM production_lines WHERE department_id = $1', [id]);
    if (parseInt(lineCheck.rows[0].count, 10) > 0) {
      throw new Error(
        `Safety restriction: Department "${dept.name}" is referenced by ${lineCheck.rows[0].count} production lines. Use deactivation instead.`
      );
    }

    await query('DELETE FROM departments WHERE id = $1', [id]);

    await AuditService.log({
      userId: actorId,
      action: 'DEPT_DELETE',
      entityType: 'DEPARTMENT',
      entityId: String(id),
      details: `Permanently deleted unused empty department "${dept.name}" [${dept.dept_code}]`,
      ipAddress,
    });
  }
}
