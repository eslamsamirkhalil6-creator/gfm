import { query } from '../../config/database.ts';
import { AuditService } from '../audit/audit.service.ts';
import {
  ProductionHallDto,
  ProductionLineDto,
  ProductionOverviewStats,
  ProductionSettingDto,
  ProductionStageDto,
  ProductionWorkflowDto,
  WorkflowStepDto,
} from './production.types.ts';

export class ProductionService {
  /**
   * Aggregate statistics for the Production Dashboard
   */
  static async getOverviewStats(): Promise<ProductionOverviewStats> {
    const [hallsRes, linesRes, stagesRes, workflowsRes] = await Promise.all([
      query<{ count: string; active_count: string }>(
        `SELECT count(*) as count, count(*) FILTER (WHERE status = 'active') as active_count FROM production_halls`
      ),
      query<{
        count: string;
        active_count: string;
        idle_count: string;
        maint_count: string;
        total_capacity: string;
        supervisors_count: string;
      }>(
        `SELECT 
           count(*) as count,
           count(*) FILTER (WHERE status = 'active') as active_count,
           count(*) FILTER (WHERE status = 'idle') as idle_count,
           count(*) FILTER (WHERE status = 'maintenance') as maint_count,
           coalesce(sum(capacity_per_day), 0) as total_capacity,
           count(DISTINCT supervisor_id) FILTER (WHERE supervisor_id IS NOT NULL) as supervisors_count
         FROM production_lines`
      ),
      query<{ count: string; qc_count: string }>(
        `SELECT 
           count(*) as count,
           count(*) FILTER (WHERE stage_type = 'QUALITY') as qc_count
         FROM production_stages`
      ),
      query<{ count: string; active_count: string }>(
        `SELECT 
           count(*) as count,
           count(*) FILTER (WHERE status = 'active') as active_count
         FROM production_workflows`
      ),
    ]);

    return {
      halls_count: parseInt(hallsRes.rows[0]?.count || '0', 10),
      active_halls_count: parseInt(hallsRes.rows[0]?.active_count || '0', 10),
      lines_count: parseInt(linesRes.rows[0]?.count || '0', 10),
      active_lines_count: parseInt(linesRes.rows[0]?.active_count || '0', 10),
      idle_lines_count: parseInt(linesRes.rows[0]?.idle_count || '0', 10),
      maintenance_lines_count: parseInt(linesRes.rows[0]?.maint_count || '0', 10),
      total_daily_capacity: parseInt(linesRes.rows[0]?.total_capacity || '0', 10),
      supervisors_assigned_count: parseInt(linesRes.rows[0]?.supervisors_count || '0', 10),
      stages_count: parseInt(stagesRes.rows[0]?.count || '0', 10),
      quality_stages_count: parseInt(stagesRes.rows[0]?.qc_count || '0', 10),
      workflows_count: parseInt(workflowsRes.rows[0]?.count || '0', 10),
      active_workflows_count: parseInt(workflowsRes.rows[0]?.active_count || '0', 10),
    };
  }

  // ==========================================
  // 1. Production Halls Management
  // ==========================================

  static async listHalls(): Promise<ProductionHallDto[]> {
    const hallsRes = await query<ProductionHallDto>(
      `SELECT id, name, code, description, status, created_at, updated_at 
       FROM production_halls 
       ORDER BY id ASC`
    );

    const linesRes = await query<{
      id: number;
      line_number: string;
      name: string;
      hall_id: number;
      production_type: string;
      status: string;
    }>(
      `SELECT id, line_number, name, hall_id, production_type, status 
       FROM production_lines 
       ORDER BY line_number ASC`
    );

    const linesByHall = new Map<number, any[]>();
    for (const line of linesRes.rows) {
      if (!linesByHall.has(line.hall_id)) {
        linesByHall.set(line.hall_id, []);
      }
      linesByHall.get(line.hall_id)!.push(line);
    }

    return hallsRes.rows.map((hall) => {
      const hallLines = linesByHall.get(hall.id) || [];
      return {
        ...hall,
        lines_count: hallLines.length,
        active_lines_count: hallLines.filter((l) => l.status === 'active').length,
        lines: hallLines,
      };
    });
  }

  static async createHall(
    data: { name: string; code: string; description?: string },
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<ProductionHallDto> {
    const name = data.name.trim();
    const code = data.code.trim().toUpperCase();

    if (!name || !code) {
      const err: any = new Error('Hall name and hall code are required');
      err.statusCode = 400;
      throw err;
    }

    const check = await query(
      `SELECT id FROM production_halls WHERE code = $1 OR name = $2`,
      [code, name]
    );
    if (check.rowCount > 0) {
      const err: any = new Error(`Production Hall with code "${code}" or name "${name}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    const res = await query<ProductionHallDto>(
      `INSERT INTO production_halls (name, code, description, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', NOW(), NOW())
       RETURNING id, name, code, description, status, created_at, updated_at`,
      [name, code, data.description?.trim() || null]
    );

    const newHall = res.rows[0];

    await AuditService.log({
      userId: actorUserId,
      action: 'HALL_CREATE',
      entityType: 'PRODUCTION_HALL',
      entityId: newHall.id,
      details: { name: newHall.name, code: newHall.code },
      ipAddress,
    });

    return { ...newHall, lines_count: 0, active_lines_count: 0, lines: [] };
  }

  static async updateHall(
    id: number,
    data: { name: string; code: string; description?: string },
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<ProductionHallDto> {
    const check = await query<ProductionHallDto>(
      `SELECT * FROM production_halls WHERE id = $1`,
      [id]
    );
    if (check.rowCount === 0) {
      const err: any = new Error(`Production Hall with ID ${id} not found`);
      err.statusCode = 404;
      throw err;
    }

    const oldHall = check.rows[0];
    const name = data.name.trim();
    const code = data.code.trim().toUpperCase();

    // Check unique conflicts
    const conflict = await query(
      `SELECT id FROM production_halls WHERE (code = $1 OR name = $2) AND id != $3`,
      [code, name, id]
    );
    if (conflict.rowCount > 0) {
      const err: any = new Error(`Another Production Hall with code "${code}" or name "${name}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    const res = await query<ProductionHallDto>(
      `UPDATE production_halls 
       SET name = $1, code = $2, description = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, code, description, status, created_at, updated_at`,
      [name, code, data.description?.trim() || null, id]
    );

    const updated = res.rows[0];

    await AuditService.log({
      userId: actorUserId,
      action: 'HALL_UPDATE',
      entityType: 'PRODUCTION_HALL',
      entityId: id,
      details: {
        previous: { name: oldHall.name, code: oldHall.code, description: oldHall.description },
        current: { name: updated.name, code: updated.code, description: updated.description },
      },
      ipAddress,
    });

    return updated;
  }

  static async toggleHallStatus(
    id: number,
    status: 'active' | 'inactive',
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<void> {
    const check = await query<ProductionHallDto>(
      `SELECT id, name, code, status FROM production_halls WHERE id = $1`,
      [id]
    );
    if (check.rowCount === 0) {
      const err: any = new Error(`Production Hall with ID ${id} not found`);
      err.statusCode = 404;
      throw err;
    }

    // Safety check: Cannot permanently delete if lines exist. Deactivation allowed.
    await query(
      `UPDATE production_halls SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id]
    );

    await AuditService.log({
      userId: actorUserId,
      action: 'HALL_STATUS_CHANGE',
      entityType: 'PRODUCTION_HALL',
      entityId: id,
      details: {
        hall: check.rows[0].name,
        previous_status: check.rows[0].status,
        new_status: status,
      },
      ipAddress,
    });
  }

  // ==========================================
  // 2. Production Lines Management
  // ==========================================

  static async listLines(hallId?: number): Promise<ProductionLineDto[]> {
    let sql = `
      SELECT 
        l.id,
        l.line_number,
        l.name,
        l.hall_id,
        h.name as hall_name,
        h.code as hall_code,
        l.production_type,
        l.supervisor_id,
        u.full_name as supervisor_name,
        u.username as supervisor_username,
        l.capacity_per_day,
        l.description,
        l.status,
        l.created_at,
        l.updated_at
      FROM production_lines l
      JOIN production_halls h ON l.hall_id = h.id
      LEFT JOIN users u ON l.supervisor_id = u.id
    `;
    const params: any[] = [];
    if (hallId) {
      params.push(hallId);
      sql += ` WHERE l.hall_id = $1`;
    }
    sql += ` ORDER BY l.id ASC`;

    const res = await query<ProductionLineDto>(sql, params);
    return res.rows;
  }

  static async createLine(
    data: {
      line_number: string;
      name: string;
      hall_id: number;
      production_type: string;
      supervisor_id?: number | null;
      capacity_per_day?: number;
      description?: string;
    },
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<ProductionLineDto> {
    const lineNumber = data.line_number.trim().toUpperCase();
    const name = data.name.trim();
    const productionType = data.production_type.trim();

    if (!lineNumber || !name || !data.hall_id || !productionType) {
      const err: any = new Error('Line number, name, hall ID, and production type are required');
      err.statusCode = 400;
      throw err;
    }

    // Verify hall exists
    const hallCheck = await query(`SELECT id, name FROM production_halls WHERE id = $1`, [data.hall_id]);
    if (hallCheck.rowCount === 0) {
      const err: any = new Error(`Associated Production Hall #${data.hall_id} does not exist`);
      err.statusCode = 404;
      throw err;
    }

    // Verify supervisor if provided
    let supervisorName: string | null = null;
    if (data.supervisor_id) {
      const supCheck = await query<{ full_name: string }>(
        `SELECT id, full_name FROM users WHERE id = $1`,
        [data.supervisor_id]
      );
      if (supCheck.rowCount === 0) {
        const err: any = new Error(`Supervisor user #${data.supervisor_id} not found`);
        err.statusCode = 404;
        throw err;
      }
      supervisorName = supCheck.rows[0].full_name;
    }

    // Verify unique line_number
    const checkLine = await query(`SELECT id FROM production_lines WHERE line_number = $1`, [lineNumber]);
    if (checkLine.rowCount > 0) {
      const err: any = new Error(`Production Line with number/code "${lineNumber}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    const capacity = data.capacity_per_day && data.capacity_per_day > 0 ? data.capacity_per_day : 500;

    const res = await query<ProductionLineDto>(
      `INSERT INTO production_lines (
         line_number, name, hall_id, production_type, supervisor_id, capacity_per_day, description, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW())
       RETURNING *`,
      [
        lineNumber,
        name,
        data.hall_id,
        productionType,
        data.supervisor_id || null,
        capacity,
        data.description?.trim() || null,
      ]
    );

    const newLine = res.rows[0];

    await AuditService.log({
      userId: actorUserId,
      action: 'LINE_CREATE',
      entityType: 'PRODUCTION_LINE',
      entityId: newLine.id,
      details: {
        line_number: newLine.line_number,
        name: newLine.name,
        hall: hallCheck.rows[0].name,
        supervisor: supervisorName || 'Unassigned',
        capacity: newLine.capacity_per_day,
      },
      ipAddress,
    });

    return newLine;
  }

  static async updateLine(
    id: number,
    data: {
      line_number: string;
      name: string;
      hall_id: number;
      production_type: string;
      supervisor_id?: number | null;
      capacity_per_day?: number;
      description?: string;
      status?: 'active' | 'idle' | 'maintenance' | 'inactive';
    },
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<ProductionLineDto> {
    const existing = await query<ProductionLineDto>(`SELECT * FROM production_lines WHERE id = $1`, [id]);
    if (existing.rowCount === 0) {
      const err: any = new Error(`Production Line #${id} not found`);
      err.statusCode = 404;
      throw err;
    }
    const old = existing.rows[0];

    const lineNumber = data.line_number.trim().toUpperCase();
    const name = data.name.trim();

    // Check unique conflict
    const conflict = await query(
      `SELECT id FROM production_lines WHERE line_number = $1 AND id != $2`,
      [lineNumber, id]
    );
    if (conflict.rowCount > 0) {
      const err: any = new Error(`Another line with number "${lineNumber}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    const capacity = data.capacity_per_day && data.capacity_per_day > 0 ? data.capacity_per_day : old.capacity_per_day;
    const status = data.status || old.status;

    const res = await query<ProductionLineDto>(
      `UPDATE production_lines 
       SET line_number = $1, name = $2, hall_id = $3, production_type = $4,
           supervisor_id = $5, capacity_per_day = $6, description = $7, status = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        lineNumber,
        name,
        data.hall_id,
        data.production_type,
        data.supervisor_id !== undefined ? data.supervisor_id : old.supervisor_id,
        capacity,
        data.description?.trim() || null,
        status,
        id,
      ]
    );

    const updated = res.rows[0];

    await AuditService.log({
      userId: actorUserId,
      action: 'LINE_UPDATE',
      entityType: 'PRODUCTION_LINE',
      entityId: id,
      details: {
        previous: { line_number: old.line_number, name: old.name, supervisor_id: old.supervisor_id, status: old.status },
        current: { line_number: updated.line_number, name: updated.name, supervisor_id: updated.supervisor_id, status: updated.status },
      },
      ipAddress,
    });

    return updated;
  }

  static async toggleLineStatus(
    id: number,
    status: 'active' | 'idle' | 'maintenance' | 'inactive',
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<void> {
    const existing = await query<ProductionLineDto>(`SELECT id, line_number, name, status FROM production_lines WHERE id = $1`, [id]);
    if (existing.rowCount === 0) {
      const err: any = new Error(`Production Line #${id} not found`);
      err.statusCode = 404;
      throw err;
    }

    await query(`UPDATE production_lines SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);

    await AuditService.log({
      userId: actorUserId,
      action: 'LINE_STATUS_CHANGE',
      entityType: 'PRODUCTION_LINE',
      entityId: id,
      details: {
        line_number: existing.rows[0].line_number,
        previous_status: existing.rows[0].status,
        new_status: status,
      },
      ipAddress,
    });
  }

  // ==========================================
  // 3. Production Stages Management
  // ==========================================

  static async listStages(): Promise<ProductionStageDto[]> {
    const stagesRes = await query<ProductionStageDto>(
      `SELECT id, name, stage_code, description, stage_type, is_mandatory_default, status, created_at, updated_at
       FROM production_stages 
       ORDER BY id ASC`
    );

    const stepsRes = await query<{
      stage_id: number;
      workflow_id: number;
      workflow_name: string;
      workflow_code: string;
      step_order: number;
    }>(
      `SELECT 
         s.stage_id,
         w.id as workflow_id,
         w.name as workflow_name,
         w.workflow_code,
         s.step_order
       FROM production_workflow_steps s
       JOIN production_workflows w ON s.workflow_id = w.id
       ORDER BY s.step_order ASC`
    );

    const workflowsByStage = new Map<number, any[]>();
    for (const step of stepsRes.rows) {
      if (!workflowsByStage.has(step.stage_id)) {
        workflowsByStage.set(step.stage_id, []);
      }
      workflowsByStage.get(step.stage_id)!.push({
        id: step.workflow_id,
        name: step.workflow_name,
        workflow_code: step.workflow_code,
        step_order: step.step_order,
      });
    }

    return stagesRes.rows.map((stg) => {
      const wf = workflowsByStage.get(stg.id) || [];
      return {
        ...stg,
        used_in_workflows_count: wf.length,
        workflows: wf,
      };
    });
  }

  static async createStage(
    data: {
      name: string;
      stage_code: string;
      description?: string;
      stage_type?: 'STANDARD' | 'QUALITY' | 'PACKING';
      is_mandatory_default?: boolean;
    },
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<ProductionStageDto> {
    const name = data.name.trim();
    const stageCode = data.stage_code.trim().toUpperCase();
    const stageType = data.stage_type || 'STANDARD';
    const isMandatory = data.is_mandatory_default !== undefined ? data.is_mandatory_default : true;

    if (!name || !stageCode) {
      const err: any = new Error('Stage name and stage code are required');
      err.statusCode = 400;
      throw err;
    }

    const check = await query(
      `SELECT id FROM production_stages WHERE stage_code = $1 OR name = $2`,
      [stageCode, name]
    );
    if (check.rowCount > 0) {
      const err: any = new Error(`Stage with code "${stageCode}" or name "${name}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    const res = await query<ProductionStageDto>(
      `INSERT INTO production_stages (
         name, stage_code, description, stage_type, is_mandatory_default, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
       RETURNING *`,
      [name, stageCode, data.description?.trim() || null, stageType, isMandatory]
    );

    const newStage = res.rows[0];

    await AuditService.log({
      userId: actorUserId,
      action: 'STAGE_CREATE',
      entityType: 'PRODUCTION_STAGE',
      entityId: newStage.id,
      details: { name: newStage.name, code: newStage.stage_code, type: newStage.stage_type },
      ipAddress,
    });

    return { ...newStage, used_in_workflows_count: 0, workflows: [] };
  }

  static async updateStage(
    id: number,
    data: {
      name: string;
      stage_code: string;
      description?: string;
      stage_type?: 'STANDARD' | 'QUALITY' | 'PACKING';
      is_mandatory_default?: boolean;
    },
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<ProductionStageDto> {
    const check = await query<ProductionStageDto>(`SELECT * FROM production_stages WHERE id = $1`, [id]);
    if (check.rowCount === 0) {
      const err: any = new Error(`Stage #${id} not found`);
      err.statusCode = 404;
      throw err;
    }
    const old = check.rows[0];

    const name = data.name.trim();
    const stageCode = data.stage_code.trim().toUpperCase();

    const conflict = await query(
      `SELECT id FROM production_stages WHERE (stage_code = $1 OR name = $2) AND id != $3`,
      [stageCode, name, id]
    );
    if (conflict.rowCount > 0) {
      const err: any = new Error(`Another stage with code "${stageCode}" or name "${name}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    const res = await query<ProductionStageDto>(
      `UPDATE production_stages 
       SET name = $1, stage_code = $2, description = $3, stage_type = $4, is_mandatory_default = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        name,
        stageCode,
        data.description?.trim() || null,
        data.stage_type || old.stage_type,
        data.is_mandatory_default !== undefined ? data.is_mandatory_default : old.is_mandatory_default,
        id,
      ]
    );

    const updated = res.rows[0];

    await AuditService.log({
      userId: actorUserId,
      action: 'STAGE_UPDATE',
      entityType: 'PRODUCTION_STAGE',
      entityId: id,
      details: {
        previous: { name: old.name, code: old.stage_code, type: old.stage_type },
        current: { name: updated.name, code: updated.stage_code, type: updated.stage_type },
      },
      ipAddress,
    });

    return updated;
  }

  static async toggleStageStatus(
    id: number,
    status: 'active' | 'inactive',
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<void> {
    const check = await query<ProductionStageDto>(`SELECT id, name, status FROM production_stages WHERE id = $1`, [id]);
    if (check.rowCount === 0) {
      const err: any = new Error(`Stage #${id} not found`);
      err.statusCode = 404;
      throw err;
    }

    await query(`UPDATE production_stages SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);

    await AuditService.log({
      userId: actorUserId,
      action: 'STAGE_STATUS_CHANGE',
      entityType: 'PRODUCTION_STAGE',
      entityId: id,
      details: { stage: check.rows[0].name, previous_status: check.rows[0].status, new_status: status },
      ipAddress,
    });
  }

  // ==========================================
  // 4. Configurable Production Workflows
  // ==========================================

  static async listWorkflows(): Promise<ProductionWorkflowDto[]> {
    const wfRes = await query<ProductionWorkflowDto>(
      `SELECT id, name, workflow_code, description, product_category, status, created_at, updated_at
       FROM production_workflows 
       ORDER BY id ASC`
    );

    const stepsRes = await query<WorkflowStepDto & { workflow_id: number }>(
      `SELECT 
         s.id,
         s.workflow_id,
         s.stage_id,
         stg.name as stage_name,
         stg.stage_code,
         stg.stage_type,
         s.step_order,
         s.is_mandatory,
         s.quality_gate,
         s.notes
       FROM production_workflow_steps s
       JOIN production_stages stg ON s.stage_id = stg.id
       ORDER BY s.step_order ASC`
    );

    const stepsByWorkflow = new Map<number, WorkflowStepDto[]>();
    for (const step of stepsRes.rows) {
      if (!stepsByWorkflow.has(step.workflow_id)) {
        stepsByWorkflow.set(step.workflow_id, []);
      }
      stepsByWorkflow.get(step.workflow_id)!.push({
        id: step.id,
        stage_id: step.stage_id,
        stage_name: step.stage_name,
        stage_code: step.stage_code,
        stage_type: step.stage_type,
        step_order: step.step_order,
        is_mandatory: step.is_mandatory,
        quality_gate: step.quality_gate,
        notes: step.notes,
      });
    }

    return wfRes.rows.map((wf) => ({
      ...wf,
      steps: stepsByWorkflow.get(wf.id) || [],
    }));
  }

  static async getWorkflow(id: number): Promise<ProductionWorkflowDto> {
    const wfRes = await query<ProductionWorkflowDto>(
      `SELECT id, name, workflow_code, description, product_category, status, created_at, updated_at
       FROM production_workflows WHERE id = $1`,
      [id]
    );
    if (wfRes.rowCount === 0) {
      const err: any = new Error(`Workflow #${id} not found`);
      err.statusCode = 404;
      throw err;
    }

    const stepsRes = await query<WorkflowStepDto>(
      `SELECT 
         s.id,
         s.stage_id,
         stg.name as stage_name,
         stg.stage_code,
         stg.stage_type,
         s.step_order,
         s.is_mandatory,
         s.quality_gate,
         s.notes
       FROM production_workflow_steps s
       JOIN production_stages stg ON s.stage_id = stg.id
       WHERE s.workflow_id = $1
       ORDER BY s.step_order ASC`,
      [id]
    );

    return {
      ...wfRes.rows[0],
      steps: stepsRes.rows,
    };
  }

  static async createWorkflow(
    data: {
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
    },
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<ProductionWorkflowDto> {
    const name = data.name.trim();
    const workflowCode = data.workflow_code.trim().toUpperCase();

    if (!name || !workflowCode) {
      const err: any = new Error('Workflow name and code are required');
      err.statusCode = 400;
      throw err;
    }

    if (!data.steps || data.steps.length === 0) {
      const err: any = new Error('A production workflow must contain at least one configured stage');
      err.statusCode = 400;
      throw err;
    }

    const check = await query(
      `SELECT id FROM production_workflows WHERE workflow_code = $1 OR name = $2`,
      [workflowCode, name]
    );
    if (check.rowCount > 0) {
      const err: any = new Error(`Workflow with code "${workflowCode}" or name "${name}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    // Insert Workflow
    const res = await query<ProductionWorkflowDto>(
      `INSERT INTO production_workflows (name, workflow_code, description, product_category, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
       RETURNING *`,
      [name, workflowCode, data.description?.trim() || null, data.product_category?.trim() || null]
    );
    const newWorkflow = res.rows[0];

    // Insert Steps in sequence
    const insertedSteps: WorkflowStepDto[] = [];
    for (let i = 0; i < data.steps.length; i++) {
      const step = data.steps[i];
      const stepOrder = i + 1; // normalize sequence

      const stgCheck = await query<{ name: string; stage_code: string; stage_type: 'STANDARD' | 'QUALITY' | 'PACKING' }>(
        `SELECT name, stage_code, stage_type FROM production_stages WHERE id = $1`,
        [step.stage_id]
      );
      if (stgCheck.rowCount === 0) {
        const err: any = new Error(`Configured stage ID #${step.stage_id} not found`);
        err.statusCode = 404;
        throw err;
      }

      const stg = stgCheck.rows[0];
      const qualityGate = step.quality_gate !== undefined ? step.quality_gate : stg.stage_type === 'QUALITY';
      const isMandatory = step.is_mandatory !== undefined ? step.is_mandatory : true;

      const stepRes = await query<{ id: number }>(
        `INSERT INTO production_workflow_steps (workflow_id, stage_id, step_order, is_mandatory, quality_gate, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [newWorkflow.id, step.stage_id, stepOrder, isMandatory, qualityGate, step.notes?.trim() || null]
      );

      insertedSteps.push({
        id: stepRes.rows[0].id,
        stage_id: step.stage_id,
        stage_name: stg.name,
        stage_code: stg.stage_code,
        stage_type: stg.stage_type,
        step_order: stepOrder,
        is_mandatory: isMandatory,
        quality_gate: qualityGate,
        notes: step.notes?.trim() || null,
      });
    }

    await AuditService.log({
      userId: actorUserId,
      action: 'WORKFLOW_CREATE',
      entityType: 'PRODUCTION_WORKFLOW',
      entityId: newWorkflow.id,
      details: {
        name: newWorkflow.name,
        code: newWorkflow.workflow_code,
        total_steps: insertedSteps.length,
        sequence: insertedSteps.map((s) => s.stage_name),
      },
      ipAddress,
    });

    return { ...newWorkflow, steps: insertedSteps };
  }

  static async updateWorkflow(
    id: number,
    data: {
      name: string;
      workflow_code: string;
      description?: string;
      product_category?: string;
    },
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<ProductionWorkflowDto> {
    const check = await query<ProductionWorkflowDto>(`SELECT * FROM production_workflows WHERE id = $1`, [id]);
    if (check.rowCount === 0) {
      const err: any = new Error(`Workflow #${id} not found`);
      err.statusCode = 404;
      throw err;
    }
    const old = check.rows[0];

    const name = data.name.trim();
    const workflowCode = data.workflow_code.trim().toUpperCase();

    const conflict = await query(
      `SELECT id FROM production_workflows WHERE (workflow_code = $1 OR name = $2) AND id != $3`,
      [workflowCode, name, id]
    );
    if (conflict.rowCount > 0) {
      const err: any = new Error(`Another workflow with code "${workflowCode}" or name "${name}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    await query(
      `UPDATE production_workflows 
       SET name = $1, workflow_code = $2, description = $3, product_category = $4, updated_at = NOW()
       WHERE id = $5`,
      [name, workflowCode, data.description?.trim() || null, data.product_category?.trim() || null, id]
    );

    await AuditService.log({
      userId: actorUserId,
      action: 'WORKFLOW_UPDATE',
      entityType: 'PRODUCTION_WORKFLOW',
      entityId: id,
      details: {
        previous: { name: old.name, code: old.workflow_code },
        current: { name, code: workflowCode },
      },
      ipAddress,
    });

    return this.getWorkflow(id);
  }

  /**
   * Reorder, add, or remove stages from an existing workflow
   */
  static async reorderWorkflowSteps(
    workflowId: number,
    steps: {
      stage_id: number;
      step_order?: number;
      is_mandatory: boolean;
      quality_gate: boolean;
      notes?: string;
    }[],
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<ProductionWorkflowDto> {
    const wfCheck = await query<ProductionWorkflowDto>(`SELECT * FROM production_workflows WHERE id = $1`, [workflowId]);
    if (wfCheck.rowCount === 0) {
      const err: any = new Error(`Workflow #${workflowId} not found`);
      err.statusCode = 404;
      throw err;
    }

    if (!steps || steps.length === 0) {
      const err: any = new Error('A production workflow must contain at least one stage');
      err.statusCode = 400;
      throw err;
    }

    // Capture previous steps for audit log
    const prevStepsRes = await query<{ stage_name: string; step_order: number }>(
      `SELECT stg.name as stage_name, s.step_order 
       FROM production_workflow_steps s 
       JOIN production_stages stg ON s.stage_id = stg.id 
       WHERE s.workflow_id = $1 ORDER BY s.step_order ASC`,
      [workflowId]
    );
    const prevSequence = prevStepsRes.rows.map((r) => r.stage_name);

    // Replace steps safely
    await query(`DELETE FROM production_workflow_steps WHERE workflow_id = $1`, [workflowId]);

    const newSequence: string[] = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepOrder = i + 1; // enforce 1-based sequential ordering

      const stgRes = await query<{ name: string }>(`SELECT name FROM production_stages WHERE id = $1`, [step.stage_id]);
      if (stgRes.rowCount === 0) {
        throw new Error(`Stage ID #${step.stage_id} not found in database`);
      }
      newSequence.push(stgRes.rows[0].name);

      await query(
        `INSERT INTO production_workflow_steps (workflow_id, stage_id, step_order, is_mandatory, quality_gate, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workflowId, step.stage_id, stepOrder, step.is_mandatory, step.quality_gate, step.notes?.trim() || null]
      );
    }

    await query(`UPDATE production_workflows SET updated_at = NOW() WHERE id = $1`, [workflowId]);

    await AuditService.log({
      userId: actorUserId,
      action: 'WORKFLOW_STEPS_REORDER',
      entityType: 'PRODUCTION_WORKFLOW',
      entityId: workflowId,
      details: {
        workflow: wfCheck.rows[0].name,
        previous_sequence: prevSequence,
        new_sequence: newSequence,
        total_stages: newSequence.length,
      },
      ipAddress,
    });

    return this.getWorkflow(workflowId);
  }

  static async toggleWorkflowStatus(
    id: number,
    status: 'active' | 'inactive',
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<void> {
    const check = await query<ProductionWorkflowDto>(`SELECT id, name, status FROM production_workflows WHERE id = $1`, [id]);
    if (check.rowCount === 0) {
      const err: any = new Error(`Workflow #${id} not found`);
      err.statusCode = 404;
      throw err;
    }

    await query(`UPDATE production_workflows SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);

    await AuditService.log({
      userId: actorUserId,
      action: 'WORKFLOW_STATUS_CHANGE',
      entityType: 'PRODUCTION_WORKFLOW',
      entityId: id,
      details: { workflow: check.rows[0].name, previous_status: check.rows[0].status, new_status: status },
      ipAddress,
    });
  }

  // ==========================================
  // 5. Production Settings & Policy Management
  // ==========================================

  static async getSettings(): Promise<ProductionSettingDto[]> {
    const res = await query<ProductionSettingDto>(
      `SELECT id, setting_key, setting_value, description, updated_at 
       FROM production_settings 
       ORDER BY id ASC`
    );
    return res.rows;
  }

  static async updateSetting(
    key: string,
    value: string,
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<ProductionSettingDto> {
    const check = await query<ProductionSettingDto>(`SELECT * FROM production_settings WHERE setting_key = $1`, [key]);
    if (check.rowCount === 0) {
      const err: any = new Error(`Setting key "${key}" not found`);
      err.statusCode = 404;
      throw err;
    }

    const old = check.rows[0];
    const res = await query<ProductionSettingDto>(
      `UPDATE production_settings 
       SET setting_value = $1, updated_at = NOW() 
       WHERE setting_key = $2 
       RETURNING *`,
      [value, key]
    );

    const updated = res.rows[0];

    await AuditService.log({
      userId: actorUserId,
      action: 'PRODUCTION_SETTING_UPDATE',
      entityType: 'PRODUCTION_SETTINGS',
      entityId: key,
      details: {
        setting_key: key,
        previous_value: old.setting_value,
        new_value: updated.setting_value,
      },
      ipAddress,
    });

    return updated;
  }
}
