import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../../config/database.ts';
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
   * Create a new user with secure password hash and assigned roles inside an atomic transaction.
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

    if (!fullName) {
      const err: any = new Error('Full name is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!input.password || input.password.length < 6) {
      const err: any = new Error('Password must be at least 6 characters long');
      err.statusCode = 400;
      err.code = 'INVALID_PASSWORD';
      throw err;
    }

    const roleIds = input.roleIds && input.roleIds.length > 0 ? input.roleIds : [3];
    const passwordHash = await bcrypt.hash(input.password, 10);

    return withTransaction(async (txQuery) => {
      const existing = await txQuery(`SELECT id FROM users WHERE username = $1`, [username]);
      if (existing.rowCount > 0) {
        const err: any = new Error(`Username "${username}" is already in use`);
        err.statusCode = 409;
        err.code = 'USERNAME_EXISTS';
        throw err;
      }

      const insertRes = await txQuery<{
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
      const assignedRoles: { id: number; role_name: string }[] = [];

      for (const rId of roleIds) {
        const roleCheck = await txQuery<{ id: number; role_name: string }>(
          `SELECT id, role_name FROM roles WHERE id = $1`,
          [rId]
        );
        if (roleCheck.rowCount === 0) {
          const err: any = new Error(`Role ID #${rId} not found`);
          err.statusCode = 404;
          err.code = 'NOT_FOUND';
          throw err;
        }
        await txQuery(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [newUser.id, rId]
        );
        assignedRoles.push(roleCheck.rows[0]);
      }

      await AuditService.log(
        {
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
        },
        txQuery
      );

      await AuditService.log(
        {
          userId: actorUserId,
          action: 'ROLE_ASSIGN',
          entityType: 'USER_ROLES',
          entityId: newUser.id,
          details: {
            roles: assignedRoles.map(r => r.role_name),
          },
          ipAddress,
        },
        txQuery
      );

      return {
        id: newUser.id,
        username: newUser.username,
        full_name: newUser.full_name,
        is_active: newUser.is_active,
        created_at: newUser.created_at,
        roles: assignedRoles,
      };
    });
  }

  /**
   * Update active status of a user (protects against self-deactivation and deactivating last active System Administrator).
   */
  static async updateUserStatus(
    userId: number,
    isActive: boolean,
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<void> {
    if (!isActive && actorUserId && actorUserId === userId) {
      const err: any = new Error('Administrators cannot deactivate their own active account');
      err.statusCode = 400;
      err.code = 'SELF_DEACTIVATION_FORBIDDEN';
      throw err;
    }

    await withTransaction(async (txQuery) => {
      const check = await txQuery<{ id: number; username: string; is_active: boolean }>(
        `SELECT id, username, is_active FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );

      if (check.rowCount === 0) {
        const err: any = new Error(`User with ID ${userId} not found`);
        err.statusCode = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }

      if (!isActive && check.rows[0].is_active) {
        const targetIsAdmin = await txQuery<{ cnt: string }>(
          `SELECT count(*) as cnt
           FROM user_roles ur
           JOIN roles r ON ur.role_id = r.id
           WHERE ur.user_id = $1 AND r.role_name = 'System Administrator'`,
          [userId]
        );
        if (parseInt(String(targetIsAdmin.rows[0]?.cnt || '0'), 10) > 0) {
          const activeAdmins = await txQuery<{ cnt: string }>(
            `SELECT count(DISTINCT u.id) as cnt
             FROM users u
             JOIN user_roles ur ON u.id = ur.user_id
             JOIN roles r ON ur.role_id = r.id
             WHERE r.role_name = 'System Administrator' AND u.is_active = TRUE AND u.id != $1`,
            [userId]
          );
          if (parseInt(String(activeAdmins.rows[0]?.cnt || '0'), 10) === 0) {
            const err: any = new Error('Cannot deactivate the last remaining active System Administrator');
            err.statusCode = 409;
            err.code = 'LAST_ADMIN_PROTECTION';
            throw err;
          }
        }
      }

      await txQuery(`UPDATE users SET is_active = $1 WHERE id = $2`, [isActive, userId]);

      await AuditService.log(
        {
          userId: actorUserId,
          action: 'USER_STATUS_UPDATE',
          entityType: 'USER',
          entityId: userId,
          details: {
            username: check.rows[0].username,
            new_is_active: isActive,
          },
          ipAddress,
        },
        txQuery
      );
    });
  }

  /**
   * Update user roles inside an atomic transaction (protects last active System Administrator).
   */
  static async updateUserRoles(
    userId: number,
    roleIds: number[],
    actorUserId?: number | null,
    ipAddress?: string
  ): Promise<void> {
    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      const err: any = new Error('At least one role ID must be assigned to the user');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    await withTransaction(async (txQuery) => {
      const check = await txQuery<{ id: number; username: string }>(
        `SELECT id, username FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );

      if (check.rowCount === 0) {
        const err: any = new Error(`User with ID ${userId} not found`);
        err.statusCode = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }

      const assignedRoleNames: string[] = [];
      for (const rId of roleIds) {
        const roleCheck = await txQuery<{ role_name: string }>(`SELECT role_name FROM roles WHERE id = $1`, [rId]);
        if (roleCheck.rowCount === 0) {
          const err: any = new Error(`Role ID #${rId} not found`);
          err.statusCode = 404;
          err.code = 'NOT_FOUND';
          throw err;
        }
        assignedRoleNames.push(roleCheck.rows[0].role_name);
      }

      if (!assignedRoleNames.includes('System Administrator')) {
        const otherActiveAdmins = await txQuery<{ cnt: string }>(
          `SELECT count(DISTINCT u.id) as cnt
           FROM users u
           JOIN user_roles ur ON u.id = ur.user_id
           JOIN roles r ON ur.role_id = r.id
           WHERE r.role_name = 'System Administrator' AND u.is_active = TRUE AND u.id != $1`,
          [userId]
        );
        const currentlyAdmin = await txQuery<{ cnt: string }>(
          `SELECT count(*) as cnt
           FROM user_roles ur
           JOIN roles r ON ur.role_id = r.id
           WHERE ur.user_id = $1 AND r.role_name = 'System Administrator'`,
          [userId]
        );
        if (
          parseInt(String(currentlyAdmin.rows[0]?.cnt || '0'), 10) > 0 &&
          parseInt(String(otherActiveAdmins.rows[0]?.cnt || '0'), 10) === 0
        ) {
          const err: any = new Error('Cannot remove System Administrator role from the last active administrator');
          err.statusCode = 409;
          err.code = 'LAST_ADMIN_PROTECTION';
          throw err;
        }
      }

      await txQuery(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);

      for (const rId of roleIds) {
        await txQuery(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, rId]
        );
      }

      await AuditService.log(
        {
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
        },
        txQuery
      );
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
