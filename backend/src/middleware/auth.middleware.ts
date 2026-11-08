import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import { query } from '../config/database.ts';

export interface AuthenticatedUser {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

interface JwtPayload {
  userId: number;
  username: string;
}

/**
 * Verify JWT token and load active user profile with roles and permissions from PostgreSQL.
 */
export async function authenticateJWT(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is missing or malformed',
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Load fresh user data and active status directly from DB
    const userRes = await query<{
      id: number;
      username: string;
      full_name: string;
      is_active: boolean;
    }>(
      `SELECT id, username, full_name, is_active FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (userRes.rowCount === 0) {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The user associated with this token no longer exists',
        },
      });
      return;
    }

    const user = userRes.rows[0];

    if (!user.is_active) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'User account has been deactivated. Please contact the administrator.',
        },
      });
      return;
    }

    // Fetch user roles
    const rolesRes = await query<{ role_name: string }>(
      `SELECT r.role_name 
       FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [user.id]
    );

    // Fetch unique user permissions across all roles
    const permRes = await query<{ permission_key: string }>(
      `SELECT DISTINCT p.permission_key
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [user.id]
    );

    req.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      is_active: user.is_active,
      roles: rolesRes.rows.map(r => r.role_name),
      permissions: permRes.rows.map(p => p.permission_key),
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Session token has expired. Please log in again.',
        },
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or forged authentication token',
      },
    });
  }
}

/**
 * Middleware factory to enforce permissions.
 */
export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const userPermissions = new Set(req.user.permissions);
    const hasAll = requiredPermissions.every(p => userPermissions.has(p));

    if (!hasAll) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Missing required permission(s): ${requiredPermissions.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware factory to enforce roles.
 */
export function requireRole(...requiredRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const hasRole = req.user.roles.some(role => requiredRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of roles: ${requiredRoles.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
}
