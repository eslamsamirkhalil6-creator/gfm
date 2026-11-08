import { Request, Response } from 'express';
import { checkConnection } from '../../config/database.ts';

const serverStartTime = Date.now();

export class HealthController {
  static async check(_req: Request, res: Response): Promise<void> {
    const dbStatus = await checkConnection();
    const isHealthy = dbStatus.status === 'CONNECTED';

    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

    const payload = {
      status: isHealthy ? 'UP' : 'DEGRADED',
      database: {
        status: dbStatus.status,
        mode: dbStatus.mode,
        engine: dbStatus.engine,
        latency_ms: dbStatus.latencyMs,
        tables_count: dbStatus.tablesCount,
        users_count: dbStatus.usersCount,
        roles_count: dbStatus.rolesCount,
        audit_logs_count: dbStatus.auditLogsCount,
        database_url_configured: dbStatus.databaseUrlConfigured,
        ...(dbStatus.error ? { error: dbStatus.error } : {}),
      },
      server: {
        timestamp: new Date().toISOString(),
        uptime_seconds: uptimeSeconds,
        environment: process.env.NODE_ENV || 'development',
        node_version: process.version,
      },
    };

    res.status(isHealthy ? 200 : 503).json(payload);
  }
}
