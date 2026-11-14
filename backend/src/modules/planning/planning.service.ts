import { query, sqlInInt } from '../../config/database.ts';
import { AuditService } from '../audit/audit.service.ts';

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

export class PlanningService {
  private static buildInPlaceholders(ids: number[], startIndex = 1): { placeholders: string; params: number[] } {
    const placeholders = ids.map((_, idx) => `$${startIndex + idx}`).join(', ');
    return { placeholders, params: ids };
  }

  static async getDashboard(params: {
    isGlobalViewer: boolean;
    allowedDepartmentIds: number[];
  }): Promise<{
    scope: 'GLOBAL' | 'DEPARTMENT_SCOPED';
    departments: PlanningDepartmentOverview[];
    production_lines: PlanningLineSummary[];
    schedules: PlanningSchedule[];
  }> {
    const { isGlobalViewer, allowedDepartmentIds } = params;

    if (!isGlobalViewer && allowedDepartmentIds.length === 0) {
      return {
        scope: 'DEPARTMENT_SCOPED',
        departments: [],
        production_lines: [],
        schedules: [],
      };
    }

    let deptSql = `
      SELECT id, dept_code, name, description, status
      FROM departments
      WHERE status = 'active'
    `;
    let linesSql = `
      SELECT l.id, l.line_number, l.name, l.department_id, d.dept_code, l.production_type, l.capacity_per_day, l.status
      FROM production_lines l
      JOIN departments d ON l.department_id = d.id
      WHERE l.department_id IS NOT NULL
    `;
    let schedSql = `
      SELECT
        s.id, s.department_id, d.dept_code, d.name as department_name,
        s.production_line_id, l.line_number, l.name as line_name,
        s.plan_code, s.title, s.target_daily_output, s.planned_start_date, s.planned_end_date,
        s.status, s.notes, s.created_by, u.full_name as created_by_name, s.created_at, s.updated_at
      FROM department_planning_schedules s
      JOIN departments d ON s.department_id = d.id
      LEFT JOIN production_lines l ON s.production_line_id = l.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;

    let queryParams: number[] = [];
    if (!isGlobalViewer) {
      const { placeholders, params: idParams } = this.buildInPlaceholders(allowedDepartmentIds, 1);
      queryParams = idParams;
      deptSql += ` AND id IN (${placeholders})`;
      linesSql += ` AND ${sqlInInt('l.department_id', placeholders)}`;
      schedSql += ` AND ${sqlInInt('s.department_id', placeholders)}`;
    }

    deptSql += ` ORDER BY name ASC`;
    linesSql += ` ORDER BY l.id ASC`;
    schedSql += ` ORDER BY s.created_at DESC, s.id DESC`;

    const [deptsRes, linesRes, schedsRes] = await Promise.all([
      query<{ id: number; dept_code: string; name: string; description: string | null; status: string }>(
        deptSql,
        queryParams
      ),
      query<PlanningLineSummary>(linesSql, queryParams),
      query<PlanningSchedule>(schedSql, queryParams),
    ]);

    const linesByDept = new Map<number, PlanningLineSummary[]>();
    for (const line of linesRes.rows) {
      if (!linesByDept.has(line.department_id)) linesByDept.set(line.department_id, []);
      linesByDept.get(line.department_id)!.push(line);
    }

    const activeSchedCountByDept = new Map<number, number>();
    for (const s of schedsRes.rows) {
      if (s.status === 'active' || s.status === 'draft') {
        activeSchedCountByDept.set(s.department_id, (activeSchedCountByDept.get(s.department_id) || 0) + 1);
      }
    }

    const departments: PlanningDepartmentOverview[] = deptsRes.rows.map((d) => {
      const dLines = linesByDept.get(d.id) || [];
      return {
        ...d,
        lines_count: dLines.length,
        total_daily_capacity: dLines.reduce((sum, l) => sum + (Number(l.capacity_per_day) || 0), 0),
        active_schedules_count: activeSchedCountByDept.get(d.id) || 0,
      };
    });

    return {
      scope: isGlobalViewer ? 'GLOBAL' : 'DEPARTMENT_SCOPED',
      departments,
      production_lines: linesRes.rows,
      schedules: schedsRes.rows,
    };
  }

  static async getDepartmentPlanning(departmentId: number): Promise<{
    department: PlanningDepartmentOverview;
    production_lines: PlanningLineSummary[];
    schedules: PlanningSchedule[];
  }> {
    const dash = await this.getDashboard({
      isGlobalViewer: false,
      allowedDepartmentIds: [departmentId],
    });
    if (dash.departments.length === 0) {
      const err: any = new Error(`Active department #${departmentId} not found.`);
      err.statusCode = 404;
      throw err;
    }
    return {
      department: dash.departments[0],
      production_lines: dash.production_lines,
      schedules: dash.schedules,
    };
  }

  static async createSchedule(
    dto: {
      department_id: number;
      production_line_id?: number | null;
      plan_code: string;
      title: string;
      target_daily_output?: number;
      planned_start_date: string;
      planned_end_date: string;
      status?: 'draft' | 'active' | 'completed' | 'cancelled';
      notes?: string;
    },
    actorId: number,
    ipAddress?: string
  ): Promise<PlanningSchedule> {
    const deptCheck = await query<{ id: number; name: string }>(
      `SELECT id, name FROM departments WHERE id = $1 AND status = 'active'`,
      [dto.department_id]
    );
    if (deptCheck.rowCount === 0) {
      const err: any = new Error(`Department #${dto.department_id} not found or inactive.`);
      err.statusCode = 404;
      throw err;
    }

    if (dto.production_line_id !== undefined && dto.production_line_id !== null) {
      const lineCheck = await query<{ id: number; department_id: number | null }>(
        `SELECT id, department_id FROM production_lines WHERE id = $1`,
        [dto.production_line_id]
      );
      if (lineCheck.rowCount === 0) {
        const err: any = new Error(`Production Line #${dto.production_line_id} not found.`);
        err.statusCode = 404;
        throw err;
      }
      if (lineCheck.rows[0].department_id !== dto.department_id) {
        const err: any = new Error(
          `Production Line #${dto.production_line_id} does not belong to Department #${dto.department_id}.`
        );
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    }

    const planCode = dto.plan_code.trim().toUpperCase();
    const title = dto.title.trim();
    const targetOutput = dto.target_daily_output !== undefined ? Number(dto.target_daily_output) : 0;
    const status = dto.status || 'draft';

    if (!planCode || !title) {
      const err: any = new Error('plan_code and title are required.');
      err.statusCode = 400;
      throw err;
    }

    if (dto.planned_end_date < dto.planned_start_date) {
      const err: any = new Error('planned_end_date must be on or after planned_start_date.');
      err.statusCode = 400;
      throw err;
    }

    const existingCode = await query(`SELECT id FROM department_planning_schedules WHERE UPPER(plan_code) = $1`, [planCode]);
    if (existingCode.rowCount > 0) {
      const err: any = new Error(`Plan code "${planCode}" already exists.`);
      err.statusCode = 409;
      throw err;
    }

    const insRes = await query<{ id: number }>(
      `INSERT INTO department_planning_schedules
       (department_id, production_line_id, plan_code, title, target_daily_output, planned_start_date, planned_end_date, status, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        dto.department_id,
        dto.production_line_id ?? null,
        planCode,
        title,
        targetOutput,
        dto.planned_start_date,
        dto.planned_end_date,
        status,
        dto.notes?.trim() || null,
        actorId,
      ]
    );

    const createdId = insRes.rows[0].id;

    await AuditService.log({
      userId: actorId,
      action: 'PLANNING_SCHEDULE_CREATE',
      entityType: 'PLANNING_SCHEDULE',
      entityId: String(createdId),
      details: `Created planning schedule "${planCode}" for Department #${dto.department_id}`,
      ipAddress,
    });

    const rowRes = await query<PlanningSchedule>(
      `SELECT
        s.id, s.department_id, d.dept_code, d.name as department_name,
        s.production_line_id, l.line_number, l.name as line_name,
        s.plan_code, s.title, s.target_daily_output, s.planned_start_date, s.planned_end_date,
        s.status, s.notes, s.created_by, u.full_name as created_by_name, s.created_at, s.updated_at
       FROM department_planning_schedules s
       JOIN departments d ON s.department_id = d.id
       LEFT JOIN production_lines l ON s.production_line_id = l.id
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = $1`,
      [createdId]
    );
    return rowRes.rows[0];
  }

  static async updateScheduleStatus(
    scheduleId: number,
    status: 'draft' | 'active' | 'completed' | 'cancelled',
    allowedDepartmentIds: number[],
    actorId: number,
    ipAddress?: string
  ): Promise<PlanningSchedule> {
    if (!['draft', 'active', 'completed', 'cancelled'].includes(status)) {
      const err: any = new Error('Invalid schedule status.');
      err.statusCode = 400;
      throw err;
    }

    const existingRes = await query<{ id: number; department_id: number; plan_code: string }>(
      `SELECT id, department_id, plan_code FROM department_planning_schedules WHERE id = $1`,
      [scheduleId]
    );
    if (existingRes.rowCount === 0) {
      const err: any = new Error(`Planning schedule #${scheduleId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    const sched = existingRes.rows[0];
    if (!allowedDepartmentIds.includes(sched.department_id)) {
      const err: any = new Error(
        `Access denied. Planning schedule #${scheduleId} belongs to Department #${sched.department_id}, outside your planning scope.`
      );
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    await query(
      `UPDATE department_planning_schedules SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [status, scheduleId]
    );

    await AuditService.log({
      userId: actorId,
      action: 'PLANNING_SCHEDULE_STATUS',
      entityType: 'PLANNING_SCHEDULE',
      entityId: String(scheduleId),
      details: `Updated planning schedule "${sched.plan_code}" status to ${status}`,
      ipAddress,
    });

    const rowRes = await query<PlanningSchedule>(
      `SELECT
        s.id, s.department_id, d.dept_code, d.name as department_name,
        s.production_line_id, l.line_number, l.name as line_name,
        s.plan_code, s.title, s.target_daily_output, s.planned_start_date, s.planned_end_date,
        s.status, s.notes, s.created_by, u.full_name as created_by_name, s.created_at, s.updated_at
       FROM department_planning_schedules s
       JOIN departments d ON s.department_id = d.id
       LEFT JOIN production_lines l ON s.production_line_id = l.id
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = $1`,
      [scheduleId]
    );
    return rowRes.rows[0];
  }
}
