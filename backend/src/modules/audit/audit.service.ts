import { query } from '../../config/database.ts';

export interface AuditRecord {
  id: number;
  user_id: number | null;
  username?: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export class AuditService {
  /**
   * Log an audit event. Immutable and append-only.
   */
  static async log(params: {
    userId?: number | null;
    action: string;
    entityType: string;
    entityId?: string | number | null;
    details?: string | Record<string, any> | null;
    ipAddress?: string | null;
  }): Promise<AuditRecord> {
    const detailsStr = typeof params.details === 'object' && params.details !== null
      ? JSON.stringify(params.details)
      : (params.details || null);

    const entityIdStr = params.entityId !== undefined && params.entityId !== null
      ? String(params.entityId)
      : null;

    const res = await query<AuditRecord>(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        params.userId || null,
        params.action,
        params.entityType,
        entityIdStr,
        detailsStr,
        params.ipAddress || '127.0.0.1',
      ]
    );

    return res.rows[0];
  }

  /**
   * Fetch audit logs with optional filtering and pagination.
   * Read-only operation.
   */
  static async getLogs(options: {
    limit?: number;
    offset?: number;
    action?: string;
  }): Promise<{ logs: AuditRecord[]; total: number }> {
    const limit = Math.min(options.limit || 50, 200);
    const offset = options.offset || 0;

    let whereClause = '';
    const params: any[] = [];

    if (options.action) {
      params.push(options.action);
      whereClause = `WHERE a.action = $${params.length}`;
    }

    const countRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM audit_logs a ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;
    params.push(limit, offset);

    const logsRes = await query<AuditRecord>(
      `SELECT 
         a.id, 
         a.user_id, 
         u.username,
         u.full_name as user_full_name,
         a.action, 
         a.entity_type, 
         a.entity_id, 
         a.details, 
         a.ip_address, 
         a.created_at
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
      params
    );

    return {
      logs: logsRes.rows,
      total,
    };
  }
}
