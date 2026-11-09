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
  managed_warehouse_ids: number[];
  supervised_line_ids: number[];
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

    // Fetch warehouses authoritatively assigned to this user (active warehouse_staff or manager_id)
    const [whStaffRes, whMgrRes, supLinesRes] = await Promise.all([
      query<{ warehouse_id: number }>(
        `SELECT warehouse_id FROM warehouse_staff
         WHERE user_id = $1 AND status = 'active'
           AND effective_from <= CURRENT_DATE
           AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)`,
        [user.id]
      ),
      query<{ id: number }>(
        `SELECT id FROM warehouses WHERE manager_id = $1 AND status = 'active'`,
        [user.id]
      ),
      query<{ id: number }>(
        `SELECT id FROM production_lines WHERE supervisor_id = $1 ORDER BY id ASC`,
        [user.id]
      ),
    ]);

    const warehouseIdSet = new Set<number>();
    for (const r of whStaffRes.rows) warehouseIdSet.add(r.warehouse_id);
    for (const r of whMgrRes.rows) warehouseIdSet.add(r.id);
    const managed_warehouse_ids = Array.from(warehouseIdSet).sort((a, b) => a - b);
    const supervised_line_ids = supLinesRes.rows.map(r => r.id);

    req.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      is_active: user.is_active,
      roles: rolesRes.rows.map(r => r.role_name),
      permissions: permRes.rows.map(p => p.permission_key),
      managed_department_ids,
      primary_department_id,
      managed_warehouse_ids,
      supervised_line_ids,
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
 * Middleware factory requiring at least one of the specified permissions.
 */
export function requireAnyPermission(...allowedPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const userPermissions = new Set(req.user.permissions);
    const hasAny = allowedPermissions.some(p => userPermissions.has(p));

    if (!hasAny) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of permission(s): ${allowedPermissions.join(', ')}`,
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

/**
 * Middleware enforcing target department authorization for cross-department employee transfers.
 * Global managers (departments:manage_employees) are allowed globally.
 * Department Managers must authoritatively manage the target department as well as the source department.
 */
export async function requireDepartmentTargetScope(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  if (req.user.permissions.includes('departments:manage_employees')) {
    return next();
  }

  const isDeptManager =
    req.user.roles.includes('Department Manager') ||
    req.user.permissions.includes('departments:scoped:manage');

  if (!isDeptManager) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied. Missing required permission: departments:manage_employees',
      },
    });
    return;
  }

  const targetDeptId = parseInt(String(req.body?.target_department_id), 10);
  if (isNaN(targetDeptId)) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Valid target department ID is required' },
    });
    return;
  }

  try {
    const deptRes = await query<{ id: number; manager_id: number | null }>(
      'SELECT id, manager_id FROM departments WHERE id = $1',
      [targetDeptId]
    );

    if (deptRes.rowCount === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Target Department #${targetDeptId} not found` },
      });
      return;
    }

    if (deptRes.rows[0].manager_id !== req.user.id) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. You are not authorized to transfer employees into Department #${targetDeptId}.`,
        },
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

export const GLOBAL_WAREHOUSE_ROLES = new Set([
  'System Administrator',
  'Factory Manager',
  'Production Manager',
  'Purchasing Manager',
  'Finance Viewer',
  'QC Manager',
  'QC Inspector',
]);

export function hasGlobalWarehouseAccess(user: AuthenticatedUser): boolean {
  return user.roles.some((r) => GLOBAL_WAREHOUSE_ROLES.has(r));
}

/**
 * Middleware enforcing warehouse-level scope based on warehouse_staff / warehouses.manager_id.
 * Global roles (System Administrator, Factory Manager, etc.) pass across warehouses if they hold the route's permission.
 * Warehouse-scoped roles (Warehouse Manager, Warehouse Keeper, or custom scoped roles) are strictly restricted
 * to req.user.managed_warehouse_ids and denied by default when scope cannot be established.
 */
export function requireWarehouseScope(
  options: {
    paramKey?: string;
    bodyKey?: string;
    queryKey?: string;
    optional?: boolean;
  } = {}
) {
  const paramKey = options.paramKey || 'warehouseId';
  const bodyKey = options.bodyKey || 'warehouse_id';
  const queryKey = options.queryKey || 'warehouse_id';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const rawWhId =
      req.params?.[paramKey] ??
      (paramKey === 'warehouseId' ? undefined : req.params?.id) ??
      req.body?.[bodyKey] ??
      req.query?.[queryKey];

    if (rawWhId === undefined || rawWhId === null || rawWhId === '') {
      if (options.optional) {
        return next();
      }
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Valid warehouse_id is required' },
      });
      return;
    }

    const warehouseId = parseInt(String(rawWhId), 10);
    if (isNaN(warehouseId) || warehouseId <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Valid positive warehouse_id is required' },
      });
      return;
    }

    if (hasGlobalWarehouseAccess(req.user)) {
      return next();
    }

    // Deny access by default if user is not assigned to the target warehouse
    if (!req.user.managed_warehouse_ids.includes(warehouseId)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. You are not assigned to Warehouse #${warehouseId}.`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware enforcing production-line & department scope on production-facing warehouse endpoints
 * (requisitions, returns, FG receipts).
 * - Factory Manager, Production Manager, and System Administrator have global scope (subject to route permissions).
 * - Department Managers are scoped to lines within req.user.managed_department_ids.
 * - Production Line Responsible Persons (production_lines.supervisor_id = req.user.id) are strictly scoped
 *   to req.user.supervised_line_ids and rejected if trying to access/submit for unassigned lines or omit line scope.
 */
export function requireProductionLineScope(
  options: {
    requireLineWhenSupervisorOnly?: boolean;
  } = {}
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const isGlobalScope =
      req.user.roles.includes('Factory Manager') ||
      req.user.roles.includes('Production Manager') ||
      req.user.roles.includes('System Administrator');

    const rawDeptId = req.body?.department_id ?? req.query?.department_id;
    const rawLineId = req.body?.production_line_id ?? req.query?.production_line_id;

    const deptId = rawDeptId !== undefined && rawDeptId !== '' ? parseInt(String(rawDeptId), 10) : null;
    const lineId = rawLineId !== undefined && rawLineId !== '' ? parseInt(String(rawLineId), 10) : null;

    if (rawDeptId !== undefined && rawDeptId !== '' && (isNaN(deptId as number) || (deptId as number) <= 0)) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid department_id' } });
      return;
    }
    if (rawLineId !== undefined && rawLineId !== '' && (isNaN(lineId as number) || (lineId as number) <= 0)) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid production_line_id' } });
      return;
    }

    try {
      let lineDeptId: number | null = null;
      if (lineId !== null) {
        const lineRes = await query<{ id: number; department_id: number | null; supervisor_id: number | null }>(
          `SELECT id, department_id, supervisor_id FROM production_lines WHERE id = $1`,
          [lineId]
        );
        if (lineRes.rowCount === 0) {
          res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: `Production Line #${lineId} not found` },
          });
          return;
        }
        lineDeptId = lineRes.rows[0].department_id;

        if (deptId !== null && lineDeptId !== null && lineDeptId !== deptId) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Production Line #${lineId} belongs to Department #${lineDeptId}, not Department #${deptId}.`,
            },
          });
          return;
        }
      }

      if (isGlobalScope) {
        return next();
      }

      // Check Department Manager authority
      const isDeptMgr = req.user.managed_department_ids.length > 0;
      const isLineSupervisor = req.user.supervised_line_ids.length > 0;

      if (!isDeptMgr && !isLineSupervisor) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. No managed department or supervised production line scope established.',
          },
        });
        return;
      }

      // Check Department access when deptId is given
      if (deptId !== null) {
        const deptAuthorizedByMgmt = req.user.managed_department_ids.includes(deptId);
        const deptAuthorizedByLine =
          lineId !== null &&
          req.user.supervised_line_ids.includes(lineId) &&
          lineDeptId === deptId;

        if (!deptAuthorizedByMgmt && !deptAuthorizedByLine) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: `Access denied. Department #${deptId} is outside your assigned department/line scope.`,
            },
          });
          return;
        }
      }

      // Check Line access when lineId is given
      if (lineId !== null) {
        const lineInManagedDept = lineDeptId !== null && req.user.managed_department_ids.includes(lineDeptId);
        const lineSupervised = req.user.supervised_line_ids.includes(lineId);
        if (!lineInManagedDept && !lineSupervised) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: `Access denied. Production Line #${lineId} is outside your supervised scope.`,
            },
          });
          return;
        }
      } else if (options.requireLineWhenSupervisorOnly && !isDeptMgr && isLineSupervisor) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Production line supervisors must specify their assigned production_line_id.',
          },
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}



