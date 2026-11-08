import { Request, Response, NextFunction } from 'express';
import { ProductionService } from './production.service.ts';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

export class ProductionController {
  static async getOverviewStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await ProductionService.getOverviewStats();
      res.status(200).json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  // Halls
  static async listHalls(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const halls = await ProductionService.listHalls();
      res.status(200).json({ success: true, data: halls });
    } catch (err) {
      next(err);
    }
  }

  static async createHall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, code, description } = req.body;
      const hall = await ProductionService.createHall(
        { name, code, description },
        req.user?.id,
        getClientIp(req)
      );
      res.status(201).json({ success: true, message: 'Production hall created successfully', data: hall });
    } catch (err) {
      next(err);
    }
  }

  static async updateHall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { name, code, description } = req.body;
      const hall = await ProductionService.updateHall(
        id,
        { name, code, description },
        req.user?.id,
        getClientIp(req)
      );
      res.status(200).json({ success: true, message: 'Production hall updated successfully', data: hall });
    } catch (err) {
      next(err);
    }
  }

  static async toggleHallStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body;
      if (status !== 'active' && status !== 'inactive') {
        res.status(400).json({ success: false, error: { message: 'Status must be "active" or "inactive"' } });
        return;
      }
      await ProductionService.toggleHallStatus(id, status, req.user?.id, getClientIp(req));
      res.status(200).json({ success: true, message: `Production hall status set to ${status}` });
    } catch (err) {
      next(err);
    }
  }

  // Lines
  static async listLines(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hallId = req.query.hallId ? parseInt(req.query.hallId as string, 10) : undefined;
      const lines = await ProductionService.listLines(hallId);
      res.status(200).json({ success: true, data: lines });
    } catch (err) {
      next(err);
    }
  }

  static async createLine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { line_number, name, hall_id, production_type, supervisor_id, capacity_per_day, description } = req.body;
      const line = await ProductionService.createLine(
        {
          line_number,
          name,
          hall_id: parseInt(hall_id, 10),
          production_type,
          supervisor_id: supervisor_id ? parseInt(supervisor_id, 10) : null,
          capacity_per_day: capacity_per_day ? parseInt(capacity_per_day, 10) : 500,
          description,
        },
        req.user?.id,
        getClientIp(req)
      );
      res.status(201).json({ success: true, message: 'Production line created successfully', data: line });
    } catch (err) {
      next(err);
    }
  }

  static async updateLine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { line_number, name, hall_id, production_type, supervisor_id, capacity_per_day, description, status } = req.body;
      const line = await ProductionService.updateLine(
        id,
        {
          line_number,
          name,
          hall_id: parseInt(hall_id, 10),
          production_type,
          supervisor_id: supervisor_id !== undefined ? (supervisor_id ? parseInt(supervisor_id, 10) : null) : undefined,
          capacity_per_day: capacity_per_day ? parseInt(capacity_per_day, 10) : undefined,
          description,
          status,
        },
        req.user?.id,
        getClientIp(req)
      );
      res.status(200).json({ success: true, message: 'Production line updated successfully', data: line });
    } catch (err) {
      next(err);
    }
  }

  static async toggleLineStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body;
      if (!['active', 'idle', 'maintenance', 'inactive'].includes(status)) {
        res.status(400).json({ success: false, error: { message: 'Invalid line status value' } });
        return;
      }
      await ProductionService.toggleLineStatus(id, status, req.user?.id, getClientIp(req));
      res.status(200).json({ success: true, message: `Production line status updated to ${status}` });
    } catch (err) {
      next(err);
    }
  }

  // Stages
  static async listStages(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stages = await ProductionService.listStages();
      res.status(200).json({ success: true, data: stages });
    } catch (err) {
      next(err);
    }
  }

  static async createStage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, stage_code, description, stage_type, is_mandatory_default } = req.body;
      const stage = await ProductionService.createStage(
        { name, stage_code, description, stage_type, is_mandatory_default },
        req.user?.id,
        getClientIp(req)
      );
      res.status(201).json({ success: true, message: 'Production stage created successfully', data: stage });
    } catch (err) {
      next(err);
    }
  }

  static async updateStage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { name, stage_code, description, stage_type, is_mandatory_default } = req.body;
      const stage = await ProductionService.updateStage(
        id,
        { name, stage_code, description, stage_type, is_mandatory_default },
        req.user?.id,
        getClientIp(req)
      );
      res.status(200).json({ success: true, message: 'Production stage updated successfully', data: stage });
    } catch (err) {
      next(err);
    }
  }

  static async toggleStageStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body;
      if (status !== 'active' && status !== 'inactive') {
        res.status(400).json({ success: false, error: { message: 'Status must be "active" or "inactive"' } });
        return;
      }
      await ProductionService.toggleStageStatus(id, status, req.user?.id, getClientIp(req));
      res.status(200).json({ success: true, message: `Production stage status set to ${status}` });
    } catch (err) {
      next(err);
    }
  }

  // Workflows
  static async listWorkflows(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workflows = await ProductionService.listWorkflows();
      res.status(200).json({ success: true, data: workflows });
    } catch (err) {
      next(err);
    }
  }

  static async getWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const workflow = await ProductionService.getWorkflow(id);
      res.status(200).json({ success: true, data: workflow });
    } catch (err) {
      next(err);
    }
  }

  static async createWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, workflow_code, description, product_category, steps } = req.body;
      const workflow = await ProductionService.createWorkflow(
        { name, workflow_code, description, product_category, steps },
        req.user?.id,
        getClientIp(req)
      );
      res.status(201).json({ success: true, message: 'Production workflow created successfully', data: workflow });
    } catch (err) {
      next(err);
    }
  }

  static async updateWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { name, workflow_code, description, product_category } = req.body;
      const workflow = await ProductionService.updateWorkflow(
        id,
        { name, workflow_code, description, product_category },
        req.user?.id,
        getClientIp(req)
      );
      res.status(200).json({ success: true, message: 'Production workflow updated successfully', data: workflow });
    } catch (err) {
      next(err);
    }
  }

  static async reorderWorkflowSteps(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { steps } = req.body;
      if (!Array.isArray(steps)) {
        res.status(400).json({ success: false, error: { message: 'Steps must be an array of step objects' } });
        return;
      }
      const workflow = await ProductionService.reorderWorkflowSteps(id, steps, req.user?.id, getClientIp(req));
      res.status(200).json({ success: true, message: 'Workflow steps reordered successfully', data: workflow });
    } catch (err) {
      next(err);
    }
  }

  static async toggleWorkflowStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body;
      if (status !== 'active' && status !== 'inactive') {
        res.status(400).json({ success: false, error: { message: 'Status must be "active" or "inactive"' } });
        return;
      }
      await ProductionService.toggleWorkflowStatus(id, status, req.user?.id, getClientIp(req));
      res.status(200).json({ success: true, message: `Workflow status set to ${status}` });
    } catch (err) {
      next(err);
    }
  }

  // Settings
  static async getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await ProductionService.getSettings();
      res.status(200).json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }

  static async updateSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = req.params.key;
      const { value } = req.body;
      if (value === undefined || value === null) {
        res.status(400).json({ success: false, error: { message: 'Field "value" is required' } });
        return;
      }
      const updated = await ProductionService.updateSetting(key, String(value), req.user?.id, getClientIp(req));
      res.status(200).json({ success: true, message: `Setting "${key}" updated successfully`, data: updated });
    } catch (err) {
      next(err);
    }
  }
}
