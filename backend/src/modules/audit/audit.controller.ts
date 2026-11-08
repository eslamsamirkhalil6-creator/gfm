import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service.ts';

export class AuditController {
  static async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;
      const action = req.query.action as string | undefined;

      const result = await AuditService.getLogs({ limit, offset, action });

      res.status(200).json({
        success: true,
        data: result.logs,
        pagination: {
          total: result.total,
          limit,
          offset,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
