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
  managed_department_ids: number[];
  primary_department_id: number | null;
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

    // Fetch departments authoritatively managed by this user
    const managedDeptsRes = await query<{ id: number }>(
      `SELECT id FROM departments WHERE manager_id = $1 ORDER BY id ASC`,
      [user.id]
    );
    const managed_department_ids = managedDeptsRes.rows.map(r => r.id);
    const primary_department_id = managed_department_ids.length > 0 ? managed_department_ids[0] : null;

    req.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      is_active: user.is_active,
      roles: rolesRes.rows.map(r => r.role_name),
      permissions: permRes.rows.map(p => p.permission_key),
      managed_department_ids,
      primary_department_id,
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

/**
 * Middleware enforcing department-scoped RBAC.
 * Allows access if:
 * 1. User has the global permission (e.g. System Administrator or Factory Manager).
 * 2. OR User has 'Department Manager' role (or 'departments:scoped:manage' / 'departments:scoped:view')
 *    AND authoritatively manages the requested department.
 */
export function requireDepartmentScope(action: 'view' | 'edit' | 'manage_employees') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const globalPermMap = {
      view: 'departments:view',
      edit: 'departments:edit',
      manage_employees: 'departments:manage_employees',
    };
    const requiredGlobalPerm = globalPermMap[action];

    // Check global permission first (System Administrator, Factory Manager)
    if (req.user.permissions.includes(requiredGlobalPerm)) {
      return next();
    }

    // Check if user is a Department Manager
    const isDeptManager =
      req.user.roles.includes('Department Manager') ||
      req.user.permissions.includes('departments:scoped:manage') ||
      req.user.permissions.includes('departments:scoped:view');

    if (!isDeptManager) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Missing required permission: ${requiredGlobalPerm}`,
        },
      });
      return;
    }

    // Resolve target department ID from params or body
    const rawId = req.params.id || req.body.department_id || req.body.source_department_id;
    const deptId = parseInt(String(rawId), 10);

    if (isNaN(deptId)) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Valid department ID is required' },
      });
      return;
    }

    // Authoritative database check: Verify that departments.manager_id === req.user.id
    try {
      const deptRes = await query<{ id: number; manager_id: number | null }>(
        'SELECT id, manager_id FROM departments WHERE id = $1',
        [deptId]
      );

      if (deptRes.rowCount === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Department #${deptId} not found` },
        });
        return;
      }

      if (deptRes.rows[0].manager_id !== req.user.id) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Access denied. You are not authorized to manage Department #${deptId}.`,
          },
        });
        return;
      }

      // Department Manager specific action constraints
      if (action === 'edit') {
        if (req.body.manager_id !== undefined || req.body.parent_id !== undefined || req.body.status !== undefined) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Department managers are not permitted to reassign managers, alter hierarchy, or change department status.',
            },
          });
          return;
        }
      }

      next();
    } catch (err: any) {
      next(err);
    }
  };
}

/**
 * Middleware allowing department list access to global viewers or department managers
 */
export function requireDepartmentListAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  const hasGlobal = req.user.permissions.includes('departments:view');
  const isDeptManager =
    req.user.roles.includes('Department Manager') ||
    req.user.permissions.includes('departments:scoped:view');

  if (hasGlobal || isDeptManager) {
    return next();
  }

  res.status(403).json({
    success: false,
    error: { code: 'FORBIDDEN', message: 'Access denied. Missing required permission(s): departments:view' },
  });
}

