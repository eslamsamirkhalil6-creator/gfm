import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.ts';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

      const result = await AuthService.login({
        username,
        password,
        ipAddress: ipAddress.split(',')[0].trim(),
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      await AuthService.logout(req.user?.id, ipAddress.split(',')[0].trim());

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  static async me(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  }
}
