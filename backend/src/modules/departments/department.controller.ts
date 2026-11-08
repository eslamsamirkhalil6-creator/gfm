import { Request, Response, NextFunction } from 'express';
import { DepartmentService } from './department.service.ts';

export class DepartmentController {
  static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await DepartmentService.getDepartmentStats();
      res.status(200).json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  static async listDepartments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const parentId = req.query.parent_id !== undefined ? Number(req.query.parent_id) : undefined;
      const search = req.query.search as string | undefined;

      const hasGlobal = req.user?.permissions.includes('departments:view') ?? false;
      const actorId = req.user?.id;

      const departments = await DepartmentService.listDepartments(
        {
          status,
          parent_id: parentId,
          search,
        },
        actorId,
        hasGlobal
      );

      res.status(200).json({ success: true, data: departments });
    } catch (err) {
      next(err);
    }
  }

  static async getTree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tree = await DepartmentService.getDepartmentTree();
      res.status(200).json({ success: true, data: tree });
    } catch (err) {
      next(err);
    }
  }

  static async getDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid department ID.' });
        return;
      }

      const data = await DepartmentService.getDepartmentById(id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getLines(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid department ID.' });
        return;
      }

      const lines = await DepartmentService.getDepartmentLines(id);
      res.status(200).json({ success: true, data: lines });
    } catch (err) {
      next(err);
    }
  }

  static async createDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = (req as any).user?.id || 1;
      const ipAddress = req.ip;

      const created = await DepartmentService.createDepartment(req.body, actorId, ipAddress);
      res.status(201).json({ success: true, message: 'Department created successfully', data: created });
    } catch (err) {
      next(err);
    }
  }

  static async updateDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid department ID.' });
        return;
      }

      const actorId = (req as any).user?.id || 1;
      const ipAddress = req.ip;
      const actorPermissions = req.user?.permissions || [];

      const updated = await DepartmentService.updateDepartment(
        id,
        req.body,
        actorId,
        ipAddress,
        actorPermissions
      );
      res.status(200).json({ success: true, message: 'Department updated successfully', data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async toggleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid department ID.' });
        return;
      }

      const actorId = (req as any).user?.id || 1;
      const ipAddress = req.ip;

      const updated = await DepartmentService.toggleDepartmentStatus(id, actorId, ipAddress);
      res.status(200).json({
        success: true,
        message: `Department status changed to ${updated.status}`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async assignManager(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid department ID.' });
        return;
      }

      const { manager_id, notes } = req.body;
      const actorId = (req as any).user?.id || 1;
      const ipAddress = req.ip;

      const updated = await DepartmentService.assignManager(
        id,
        manager_id !== undefined ? (manager_id === null ? null : Number(manager_id)) : null,
        notes,
        actorId,
        ipAddress
      );

      res.status(200).json({
        success: true,
        message: 'Department manager assignment updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async assignEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deptId = parseInt(req.params.id, 10);
      if (isNaN(deptId)) {
        res.status(400).json({ success: false, message: 'Invalid department ID.' });
        return;
      }

      const actorId = (req as any).user?.id || 1;
      const ipAddress = req.ip;

      const assigned = await DepartmentService.assignEmployee(deptId, req.body, actorId, ipAddress);
      res.status(200).json({
        success: true,
        message: 'Employee assigned to department successfully',
        data: assigned,
      });
    } catch (err) {
      next(err);
    }
  }

  static async transferEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sourceDeptId = parseInt(req.params.id, 10);
      const { target_department_id, user_id, position_title, is_primary } = req.body;

      if (isNaN(sourceDeptId) || !target_department_id || !user_id) {
        res.status(400).json({ success: false, message: 'Source department, target department, and user ID are required.' });
        return;
      }

      const actorId = (req as any).user?.id || 1;
      const ipAddress = req.ip;

      const transferred = await DepartmentService.transferEmployee(
        sourceDeptId,
        Number(target_department_id),
        Number(user_id),
        position_title || 'Staff',
        is_primary !== undefined ? Boolean(is_primary) : true,
        actorId,
        ipAddress
      );

      res.status(200).json({
        success: true,
        message: 'Employee successfully transferred to target department',
        data: transferred,
      });
    } catch (err) {
      next(err);
    }
  }

  static async removeEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deptId = parseInt(req.params.id, 10);
      const userId = parseInt(req.params.userId, 10);

      if (isNaN(deptId) || !userId) {
        res.status(400).json({ success: false, message: 'Valid department ID and user ID are required.' });
        return;
      }

      const actorId = (req as any).user?.id || 1;
      const ipAddress = req.ip;

      await DepartmentService.removeEmployee(deptId, userId, actorId, ipAddress);
      res.status(200).json({
        success: true,
        message: 'Employee assignment removed from department',
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid department ID.' });
        return;
      }

      const actorId = (req as any).user?.id || 1;
      const ipAddress = req.ip;

      await DepartmentService.deleteDepartment(id, actorId, ipAddress);
      res.status(200).json({
        success: true,
        message: 'Department deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}
