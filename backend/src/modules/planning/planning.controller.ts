import { Request, Response, NextFunction } from 'express';
import { PlanningService } from './planning.service.ts';

export class PlanningController {
  static async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isGlobalViewer =
        Boolean(req.user?.permissions.includes('planning:view')) &&
        Boolean(req.user?.permissions.includes('departments:view')) &&
        Boolean(req.user?.roles.includes('Factory Manager'));

      const data = await PlanningService.getDashboard({
        isGlobalViewer,
        allowedDepartmentIds: req.user?.planning_department_ids || [],
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getDepartmentPlanning(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deptId = parseInt(req.params.id, 10);
      if (isNaN(deptId) || deptId <= 0) {
        res.status(400).json({ success: false, error: { message: 'Valid department ID is required.' } });
        return;
      }

      const data = await PlanningService.getDepartmentPlanning(deptId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = req.user!.id;
      const ipAddress = req.ip;
      const created = await PlanningService.createSchedule(
        {
          department_id: Number(req.body.department_id),
          production_line_id:
            req.body.production_line_id !== undefined && req.body.production_line_id !== null && req.body.production_line_id !== ''
              ? Number(req.body.production_line_id)
              : null,
          plan_code: String(req.body.plan_code),
          title: String(req.body.title),
          target_daily_output: req.body.target_daily_output !== undefined ? Number(req.body.target_daily_output) : 0,
          planned_start_date: String(req.body.planned_start_date),
          planned_end_date: String(req.body.planned_end_date),
          status: req.body.status,
          notes: req.body.notes,
        },
        actorId,
        ipAddress
      );
      res.status(201).json({ success: true, message: 'Planning schedule created successfully', data: created });
    } catch (err) {
      next(err);
    }
  }

  static async updateScheduleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      if (isNaN(scheduleId) || scheduleId <= 0) {
        res.status(400).json({ success: false, error: { message: 'Valid schedule ID is required.' } });
        return;
      }
      const actorId = req.user!.id;
      const ipAddress = req.ip;
      const updated = await PlanningService.updateScheduleStatus(
        scheduleId,
        req.body.status,
        req.user?.planning_department_ids || [],
        actorId,
        ipAddress
      );
      res.status(200).json({ success: true, message: 'Planning schedule status updated', data: updated });
    } catch (err) {
      next(err);
    }
  }
}
