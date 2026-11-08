import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service.ts';

export class UserController {
  static async listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await UserService.listUsers();
      res.status(200).json({
        success: true,
        data: users,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password, full_name, roleIds } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

      const user = await UserService.createUser(
        { username, password, full_name, roleIds },
        req.user?.id,
        ipAddress.split(',')[0].trim()
      );

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      const { is_active } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

      if (typeof is_active !== 'boolean') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Field "is_active" must be a boolean',
          },
        });
        return;
      }

      await UserService.updateUserStatus(userId, is_active, req.user?.id, ipAddress.split(',')[0].trim());

      res.status(200).json({
        success: true,
        message: `User status successfully updated to ${is_active ? 'active' : 'inactive'}`,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateUserRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      const { roleIds } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

      if (!Array.isArray(roleIds)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Field "roleIds" must be an array of numeric IDs',
          },
        });
        return;
      }

      await UserService.updateUserRoles(userId, roleIds, req.user?.id, ipAddress.split(',')[0].trim());

      res.status(200).json({
        success: true,
        message: 'User roles updated successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  static async listRoles(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await UserService.listRoles();
      res.status(200).json({
        success: true,
        data: roles,
      });
    } catch (err) {
      next(err);
    }
  }
}
