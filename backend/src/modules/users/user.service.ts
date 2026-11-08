import bcrypt from 'bcryptjs';
import { query } from '../../config/database.ts';
import { AuditService } from '../audit/audit.service.ts';
import { CreateUserInput, RoleDto, UserDto } from './user.types.ts';

export class UserService {
  /**
   * List all users with their roles (excluding password_hash)
   */
  static async listUsers(): Promise<UserDto[]> {
    const usersRes = await query<{
      id: number;
      username: string;
      full_name: string;
      is_active: boolean;
      created_at: string;
    }>(
      `SELECT id, username, full_name, is_active, created_at 
       FROM users 
       ORDER BY id ASC`
    );

    const userRolesRes = await query<{
      user_id: number;
      role_id: number;
      role_name: string;
    }>(
      `SELECT ur.user_id, r.id as role_id, r.role_name 
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id`
    );

    const rolesByUserId = new Map<number, { id: number; role_name: string }[]>();
    for (const row of userRolesRes.rows) {
      if (!rolesByUserId.has(row.user_id)) {
        rolesByUserId.set(row.user_id, []);
      }
      rolesByUserId.get(row.user_id)!.push({
        id: row.role_id,
        role_name: row.role_name,
      });
    }

    return usersRes.rows.map(user => ({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      is_active: user.is_active,
      created_at: user.created_at,
      roles: rolesByUserId.get(user.id) || [],
    }));
  }

  /**
   * Create a new user with secure password hash and assigned roles.
   */
  static async createUser(
    input: CreateUserInput,
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<UserDto> {
    const username = input.username.trim().toLowerCase();
    const fullName = input.full_name.trim();

    if (!username || username.length < 3) {
      const err: any = new Error('Username must be at least 3 characters long');
      err.statusCode = 400;
      err.code = 'INVALID_USERNAME';
      throw err;
    }

    if (!input.password || input.password.length < 6) {
      const err: any = new Error('Password must be at least 6 characters long');
      err.statusCode = 400;
      err.code = 'INVALID_PASSWORD';
      throw err;
    }

    // Check unique username
    const existing = await query(`SELECT id FROM users WHERE username = $1`, [username]);
    if (existing.rowCount > 0) {
      const err: any = new Error(`Username "${username}" is already in use`);
      err.statusCode = 409;
      err.code = 'USERNAME_EXISTS';
      throw err;
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(input.password, 10);

    // Insert user
    const insertRes = await query<{
      id: number;
      username: string;
      full_name: string;
      is_active: boolean;
      created_at: string;
    }>(
      `INSERT INTO users (username, password_hash, full_name, is_active, created_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       RETURNING id, username, full_name, is_active, created_at`,
      [username, passwordHash, fullName]
    );

    const newUser = insertRes.rows[0];

    // Assign roles if provided
    const assignedRoles: { id: number; role_name: string }[] = [];
    const roleIds = input.roleIds && input.roleIds.length > 0 ? input.roleIds : [3]; // Default to Department User (id: 3)

    for (const rId of roleIds) {
      const roleCheck = await query<{ id: number; role_name: string }>(
        `SELECT id, role_name FROM roles WHERE id = $1`,
        [rId]
      );
      if (roleCheck.rowCount > 0) {
        await query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [newUser.id, rId]
        );
        assignedRoles.push(roleCheck.rows[0]);
      }
    }

    // Audit logs
    await AuditService.log({
      userId: actorUserId,
      action: 'USER_CREATE',
      entityType: 'USER',
      entityId: newUser.id,
      details: {
        username: newUser.username,
        full_name: newUser.full_name,
        assignedRoleIds: roleIds,
      },
      ipAddress,
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'ROLE_ASSIGN',
      entityType: 'USER_ROLES',
      entityId: newUser.id,
      details: {
        roles: assignedRoles.map(r => r.role_name),
      },
      ipAddress,
    });

    return {
      id: newUser.id,
      username: newUser.username,
      full_name: newUser.full_name,
      is_active: newUser.is_active,
      created_at: newUser.created_at,
      roles: assignedRoles,
    };
  }

  /**
   * Update active status of a user
   */
  static async updateUserStatus(
    userId: number,
    isActive: boolean,
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<void> {
    const check = await query<{ id: number; username: string }>(
      `SELECT id, username FROM users WHERE id = $1`,
      [userId]
    );

    if (check.rowCount === 0) {
      const err: any = new Error(`User with ID ${userId} not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    await query(`UPDATE users SET is_active = $1 WHERE id = $2`, [isActive, userId]);

    await AuditService.log({
      userId: actorUserId,
      action: 'USER_STATUS_UPDATE',
      entityType: 'USER',
      entityId: userId,
      details: {
        username: check.rows[0].username,
        new_is_active: isActive,
      },
      ipAddress,
    });
  }

  /**
   * Update user roles
   */
  static async updateUserRoles(
    userId: number,
    roleIds: number[],
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<void> {
    const check = await query<{ id: number; username: string }>(
      `SELECT id, username FROM users WHERE id = $1`,
      [userId]
    );

    if (check.rowCount === 0) {
      const err: any = new Error(`User with ID ${userId} not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Delete existing roles
    await query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);

    // Insert new roles
    const assignedRoleNames: string[] = [];
    for (const rId of roleIds) {
      const roleCheck = await query<{ role_name: string }>(`SELECT role_name FROM roles WHERE id = $1`, [rId]);
      if (roleCheck.rowCount > 0) {
        await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [userId, rId]);
        assignedRoleNames.push(roleCheck.rows[0].role_name);
      }
    }

    await AuditService.log({
      userId: actorUserId,
      action: 'USER_ROLES_UPDATE',
      entityType: 'USER_ROLES',
      entityId: userId,
      details: {
        username: check.rows[0].username,
        new_roles: assignedRoleNames,
        roleIds,
      },
      ipAddress,
    });
  }

  /**
   * List all roles and their mapped permissions
   */
  static async listRoles(): Promise<RoleDto[]> {
    const rolesRes = await query<{ id: number; role_name: string; description: string }>(
      `SELECT id, role_name, description FROM roles ORDER BY id ASC`
    );

    const permsRes = await query<{
      role_id: number;
      permission_id: number;
      permission_key: string;
      description: string;
    }>(
      `SELECT rp.role_id, p.id as permission_id, p.permission_key, p.description
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id`
    );

    const permsByRoleId = new Map<number, { id: number; permission_key: string; description: string }[]>();
    for (const row of permsRes.rows) {
      if (!permsByRoleId.has(row.role_id)) {
        permsByRoleId.set(row.role_id, []);
      }
      permsByRoleId.get(row.role_id)!.push({
        id: row.permission_id,
        permission_key: row.permission_key,
        description: row.description,
      });
    }

    return rolesRes.rows.map(r => ({
      id: r.id,
      role_name: r.role_name,
      description: r.description,
      permissions: permsByRoleId.get(r.id) || [],
    }));
  }
}
