import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../config/database.ts';
import { env } from '../../config/env.ts';
import { AuditService } from '../audit/audit.service.ts';
import { LoginResponse } from './auth.types.ts';

interface UserDbRow {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export class AuthService {
  /**
   * Authenticate user credentials, generate JWT, and record audit log.
   */
  static async login(params: {
    username: string;
    password: string;
    ipAddress?: string;
  }): Promise<LoginResponse> {
    const { username, password, ipAddress } = params;

    // Fetch user
    const res = await query<UserDbRow>(
      `SELECT id, username, password_hash, full_name, is_active, created_at 
       FROM users 
       WHERE username = $1`,
      [username.trim().toLowerCase()]
    );

    if (res.rowCount === 0) {
      // Record failed login audit log
      await AuditService.log({
        userId: null,
        action: 'LOGIN_FAILED',
        entityType: 'USER',
        entityId: username,
        details: 'Attempted login with non-existent username',
        ipAddress,
      });

      const err: any = new Error('Invalid username or password');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const user = res.rows[0];

    // Check if account is active
    if (!user.is_active) {
      await AuditService.log({
        userId: user.id,
        action: 'LOGIN_BLOCKED_INACTIVE',
        entityType: 'USER',
        entityId: user.id,
        details: 'Login rejected because account is deactivated',
        ipAddress,
      });

      const err: any = new Error('Account is inactive. Please contact the system administrator.');
      err.statusCode = 403;
      err.code = 'ACCOUNT_INACTIVE';
      throw err;
    }

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await AuditService.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'USER',
        entityId: user.id,
        details: 'Password verification mismatch',
        ipAddress,
      });

      const err: any = new Error('Invalid username or password');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Fetch user roles
    const rolesRes = await query<{ role_name: string }>(
      `SELECT r.role_name 
       FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [user.id]
    );
    const roles = rolesRes.rows.map(r => r.role_name);

    // Fetch user permissions
    const permRes = await query<{ permission_key: string }>(
      `SELECT DISTINCT p.permission_key
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [user.id]
    );
    const permissions = permRes.rows.map(p => p.permission_key);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    // Record successful login audit log
    await AuditService.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'USER',
      entityId: user.id,
      details: {
        roleCount: roles.length,
        permissionCount: permissions.length,
      },
      ipAddress,
    });

    // Fetch departments authoritatively managed by this user
    const managedDeptsRes = await query<{ id: number }>(
      `SELECT id FROM departments WHERE manager_id = $1 ORDER BY id ASC`,
      [user.id]
    );
    const managed_department_ids = managedDeptsRes.rows.map(r => r.id);
    const primary_department_id = managed_department_ids.length > 0 ? managed_department_ids[0] : null;

    return {
      token,
      expiresIn: env.JWT_EXPIRES_IN,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        is_active: user.is_active,
        roles,
        permissions,
        managed_department_ids,
        primary_department_id,
      },
    };
  }

  /**
   * Handle user logout and log audit
   */
  static async logout(userId?: number | null, ipAddress?: string): Promise<void> {
    if (userId) {
      await AuditService.log({
        userId,
        action: 'LOGOUT',
        entityType: 'USER',
        entityId: userId,
        details: 'User initiated session logout',
        ipAddress,
      });
    }
  }
}
