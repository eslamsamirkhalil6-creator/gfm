import fs from 'fs';
import path from 'path';
import http from 'http';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initDatabase, checkConnection, query } from '../config/database.ts';
import {
  createConfiguredPgMemDb,
  createPgMemDriver,
  loadSqlEntries,
  runPendingMigrations,
} from '../config/migrations.ts';
import { env } from '../config/env.ts';
import { AuthService } from '../modules/auth/auth.service.ts';
import { UserService } from '../modules/users/user.service.ts';
import { AuditService } from '../modules/audit/audit.service.ts';
import { DepartmentService } from '../modules/departments/department.service.ts';
import { requireRole } from '../middleware/auth.middleware.ts';

export interface TestResult {
  id: number;
  name: string;
  category: string;
  status: 'PASSED' | 'FAILED';
  durationMs: number;
  details?: string;
  error?: string;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  allPassed: boolean;
  totalDurationMs: number;
  timestamp: string;
  results: TestResult[];
}

interface HttpResponse {
  status: number;
  data: any;
  rawText: string;
}

export async function runAllTests(): Promise<TestSuiteSummary> {
  const results: TestResult[] = [];
  const startSuiteTime = Date.now();

  await initDatabase();

  // Spin up an isolated ephemeral HTTP server wrapping the real Express backend app
  const { createBackendApp } = await import('../app.ts');
  const app = createBackendApp();
  const httpServer = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => resolve());
  });

  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    throw new Error('Failed to bind ephemeral HTTP test server');
  }
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  async function apiRequest(
    endpoint: string,
    options: {
      method?: string;
      token?: string;
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<HttpResponse> {
    const headers: Record<string, string> = {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    };

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = rawText;
    }

    return {
      status: res.status,
      data,
      rawText,
    };
  }

  async function loginViaHttp(username: string, password: string): Promise<{ token: string; user: any }> {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    if (res.status !== 200 || !res.data?.data?.token) {
      throw new Error(`HTTP login failed for "${username}" (status ${res.status}): ${res.rawText}`);
    }
    return res.data.data;
  }

  // Deterministic middleware test helper without arbitrary fixed timeouts
  async function testMiddleware(
    middleware: any,
    req: any,
    timeoutMs: number = 2000
  ): Promise<{ status: number; body?: any; nextCalled: boolean; nextError?: any }> {
    let status = 200;
    let body: any = null;
    let nextCalled = false;
    let nextError: any = undefined;

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`Middleware did not complete within ${timeoutMs}ms`));
        }
      }, timeoutMs);

      const finish = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ status, body, nextCalled, nextError });
        }
      };

      const res: any = {
        status(code: number) {
          status = code;
          return this;
        },
        json(data: any) {
          body = data;
          finish();
          return this;
        },
        send(data: any) {
          body = data;
          finish();
          return this;
        },
        end(data?: any) {
          if (data !== undefined) body = data;
          finish();
          return this;
        },
      };

      try {
        const maybePromise = middleware(req, res, (err?: any) => {
          if (err) {
            nextError = err;
          } else {
            nextCalled = true;
          }
          finish();
        });

        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.catch((err: any) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(err);
            }
          });
        }
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      }
    });
  }

  async function executeTest(
    id: number,
    name: string,
    category: string,
    fn: () => Promise<string>
  ) {
    const t0 = Date.now();
    try {
      const details = await fn();
      results.push({
        id,
        name,
        category,
        status: 'PASSED',
        durationMs: Date.now() - t0,
        details,
      });
    } catch (err: any) {
      results.push({
        id,
        name,
        category,
        status: 'FAILED',
        durationMs: Date.now() - t0,
        error: err.message || String(err),
      });
    }
  }

  // Helper to create & clean up temporary QA user safely
  async function createTempUser(usernamePrefix: string, roleIds: number[]) {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const username = `${usernamePrefix}_${uniqueSuffix}`;
    const password = `QaTemp#${uniqueSuffix}`;
    const created = await UserService.createUser(
      {
        username,
        password,
        full_name: `QA Temp ${username}`,
        roleIds,
      },
      1,
      '127.0.0.1'
    );
    return { user: created, password };
  }

  async function cleanupTempUser(userId: number) {
    await query('DELETE FROM department_employees WHERE user_id = $1', [userId]);
    await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    await query('DELETE FROM users WHERE id = $1', [userId]);
  }

  // Track created entity IDs across production tests so Audit test #14 can verify exact entries before/after
  let prodHallIdForAudit: number | null = null;
  let prodLineIdForAudit: number | null = null;
  let prodStageIdForAudit: number | null = null;
  let prodWorkflowIdForAudit: number | null = null;
  const deptIdsForAudit: number[] = [];

  try {
    // 1. API Health Check (HTTP + DB mode reporting)
    await executeTest(1, 'API Health Check & Active Engine Verification', 'System', async () => {
      const res = await apiRequest('/health');
      if (res.status !== 200 || res.data?.status !== 'UP') {
        throw new Error(`GET /api/health returned status ${res.status} (payload status: ${res.data?.status})`);
      }
      const dbStatus = await checkConnection();
      if (dbStatus.status !== 'CONNECTED') {
        throw new Error(`Database connection status is ${dbStatus.status}`);
      }
      const persistenceNote =
        dbStatus.mode === 'PostgreSQL (Live Connection)'
          ? 'PERSISTENT live TCP PostgreSQL'
          : 'EPHEMERAL In-Memory pg-mem (non-persistent across restarts)';
      return `HTTP /api/health 200 OK. Engine: ${dbStatus.engine}, Mode: ${dbStatus.mode} [${persistenceNote}], tables: ${dbStatus.tablesCount}, latency: ${dbStatus.latencyMs}ms`;
    });

    // 2. Database Connectivity & Engine Truthfulness
    await executeTest(2, 'PostgreSQL Connectivity & Persistence Mode Check', 'Database', async () => {
      const dbStatus = await checkConnection();
      const res = await query('SELECT 1 as ping, NOW() as server_timestamp');
      if (!res.rows || res.rows.length === 0 || res.rows[0].ping !== 1) {
        throw new Error('Database ping query failed or returned unexpected rows');
      }
      const usersCountRes = await query('SELECT count(*) as count FROM users');
      const modeDesc =
        dbStatus.mode === 'PostgreSQL (Live Connection)'
          ? 'Live PostgreSQL TCP (persistent storage active)'
          : 'pg-mem In-Memory Fallback (ephemeral storage; live PostgreSQL persistence NOT verified in this run)';
      return `Verified query execution. Users: ${usersCountRes.rows[0].count}. Active mode: ${modeDesc}`;
    });

    // 3. Successful Login via HTTP
    await executeTest(3, 'Successful Login with Valid Credentials (HTTP)', 'Authentication', async () => {
      const loginRes = await loginViaHttp('admin', 'Admin@123');
      if (!loginRes.token || !loginRes.user || loginRes.user.username !== 'admin') {
        throw new Error('Returned token or user payload is invalid');
      }
      if (!loginRes.user.roles.includes('System Administrator')) {
        throw new Error('Admin role missing in user payload');
      }

      const decoded: any = jwt.verify(loginRes.token, env.JWT_SECRET);
      if (decoded.username !== 'admin' || decoded.userId !== loginRes.user.id) {
        throw new Error('JWT token payload mismatch');
      }

      const meRes = await apiRequest('/auth/me', { token: loginRes.token });
      if (meRes.status !== 200 || meRes.data?.data?.username !== 'admin') {
        throw new Error(`GET /api/auth/me failed with status ${meRes.status}`);
      }

      return `HTTP login & /auth/me verified for "admin". Roles: [${loginRes.user.roles.join(', ')}]. Permissions: ${loginRes.user.permissions.length}`;
    });

    // 4. Failed Login via HTTP
    await executeTest(4, 'Failed Login Handling & Rejection (HTTP 401)', 'Authentication', async () => {
      const wrongPass = await apiRequest('/auth/login', {
        method: 'POST',
        body: { username: 'admin', password: 'WrongPassword!999' },
      });
      if (wrongPass.status !== 401) {
        throw new Error(`Expected HTTP 401 for wrong password, got ${wrongPass.status}`);
      }

      const ghostUser = await apiRequest('/auth/login', {
        method: 'POST',
        body: { username: 'ghost_user_9999', password: 'AnyPassword' },
      });
      if (ghostUser.status !== 401) {
        throw new Error(`Expected HTTP 401 for non-existent user, got ${ghostUser.status}`);
      }

      return 'Both invalid password and non-existent username rejected with HTTP 401 via /api/auth/login';
    });

    // 5. JWT Verification & Unauthorized HTTP API Access (Fixed false-positive catch bug)
    await executeTest(5, 'JWT Verification & Unauthorized API Access Protection', 'Authorization', async () => {
      const assertJwtRejected = (token: string, expectedErrorNames: string[], label: string) => {
        let rejected = false;
        let errName = '';
        try {
          jwt.verify(token, env.JWT_SECRET);
        } catch (err: any) {
          errName = err?.name || '';
          rejected = expectedErrorNames.includes(errName);
          if (!rejected) {
            throw new Error(`${label} threw unexpected error "${errName}": ${err?.message}`);
          }
        }
        if (!rejected) {
          throw new Error(`${label} unexpectedly passed jwt.verify()!`);
        }
      };

      // A. Cryptographic JWT rejections (never swallowing assertion errors)
      assertJwtRejected('invalid.forged.jwt.token', ['JsonWebTokenError'], 'Malformed JWT');

      const validToken = jwt.sign({ userId: 1, username: 'admin' }, env.JWT_SECRET, { expiresIn: '5m' });
      const parts = validToken.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.tamperedSignatureXYZ`;
      assertJwtRejected(tamperedToken, ['JsonWebTokenError'], 'Tampered signature JWT');

      const wrongSecretToken = jwt.sign({ userId: 1, username: 'admin' }, 'wrong-secret-key-000', { expiresIn: '5m' });
      assertJwtRejected(wrongSecretToken, ['JsonWebTokenError'], 'Wrong-secret JWT');

      const expiredToken = jwt.sign({ userId: 1, username: 'admin' }, env.JWT_SECRET, { expiresIn: '-10s' });
      assertJwtRejected(expiredToken, ['TokenExpiredError'], 'Expired JWT');

      // B. Real HTTP endpoint rejections via authenticateJWT middleware
      const noHeaderRes = await apiRequest('/users');
      const malformedRes = await apiRequest('/users', { headers: { Authorization: 'Basic abc123' } });
      const forgedHttpRes = await apiRequest('/departments', { token: tamperedToken });
      const expiredHttpRes = await apiRequest('/departments', { token: expiredToken });

      if (noHeaderRes.status !== 401) {
        throw new Error(`Missing Authorization header returned ${noHeaderRes.status}, expected 401`);
      }
      if (malformedRes.status !== 401) {
        throw new Error(`Malformed Authorization header returned ${malformedRes.status}, expected 401`);
      }
      if (forgedHttpRes.status !== 401) {
        throw new Error(`Tampered Bearer JWT returned ${forgedHttpRes.status}, expected 401`);
      }
      if (expiredHttpRes.status !== 401) {
        throw new Error(`Expired Bearer JWT returned ${expiredHttpRes.status}, expected 401`);
      }

      return 'Verified malformed, tampered, wrong-secret, and expired JWT rejection at both jwt.verify() and HTTP authenticateJWT (401)';
    });

    // 6. Role-Based Permission Enforcement
    await executeTest(6, 'Role-Based Permission Enforcement (RBAC)', 'Authorization', async () => {
      const deptLogin = await loginViaHttp('deptuser', 'Dept@123');
      const deptPerms = new Set(deptLogin.user.permissions);
      if (deptPerms.has('users:create') || deptPerms.has('audit:read')) {
        throw new Error('Department User has unexpected global administrative permissions');
      }
      if (!deptPerms.has('dashboard:view')) {
        throw new Error('Department User missing "dashboard:view"');
      }

      const mgrLogin = await loginViaHttp('manager', 'Manager@123');
      const mgrPerms = new Set(mgrLogin.user.permissions);
      if (!mgrPerms.has('dashboard:factory')) {
        throw new Error('Factory Manager missing "dashboard:factory"');
      }
      if (mgrPerms.has('users:create')) {
        throw new Error('Factory Manager should not have "users:create"');
      }

      // Real HTTP permission enforcement checks
      const deptAuditRes = await apiRequest('/audit-logs', { token: deptLogin.token });
      const mgrCreateUserRes = await apiRequest('/users', {
        method: 'POST',
        token: mgrLogin.token,
        body: { username: 'unauth_test', password: 'Password123', full_name: 'Unauth' },
      });

      if (deptAuditRes.status !== 403) {
        throw new Error(`Expected 403 for deptuser on /api/audit-logs, got ${deptAuditRes.status}`);
      }
      if (mgrCreateUserRes.status !== 403) {
        throw new Error(`Expected 403 for manager on POST /api/users, got ${mgrCreateUserRes.status}`);
      }

      return 'Department User, Factory Manager, and System Administrator permission boundaries verified via DB and HTTP (403)';
    });

    // 7. User Creation & Bcrypt Verification (with strict cleanup)
    await executeTest(7, 'User Provisioning & Bcrypt Verification (Isolated)', 'User Management', async () => {
      const testUsername = `qa_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const plainPassword = 'QaPassword#2026';

      const newUser = await UserService.createUser(
        {
          username: testUsername,
          password: plainPassword,
          full_name: 'QA Automated Test User',
          roleIds: [2],
        },
        1,
        '127.0.0.1'
      );

      try {
        if (!newUser.id || newUser.username !== testUsername) {
          throw new Error('Created user entity is missing or corrupted');
        }

        const dbRecord = await query<{ password_hash: string }>(
          'SELECT password_hash FROM users WHERE id = $1',
          [newUser.id]
        );
        const hash = dbRecord.rows[0].password_hash;
        if (hash === plainPassword) {
          throw new Error('SECURITY VIOLATION: Password stored in plaintext!');
        }
        if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$')) {
          throw new Error(`Password hash does not conform to bcrypt format: ${hash}`);
        }
        const matches = await bcrypt.compare(plainPassword, hash);
        if (!matches) {
          throw new Error('Bcrypt hash comparison failed on created user');
        }

        return `User "${testUsername}" created, bcrypt ($2b$) verified, and test user record cleaned up`;
      } finally {
        if (newUser?.id) {
          await cleanupTempUser(newUser.id);
        }
      }
    });

    // 8. Audit Log Creation & Schema Immutability Check (Truthful)
    await executeTest(8, 'Audit Log Event Generation & Metadata Verification', 'Security & Compliance', async () => {
      const markerAction = `QA_AUDIT_VERIFY_${Date.now()}`;
      const inserted = await AuditService.log({
        userId: 1,
        action: markerAction,
        entityType: 'QA_CHECK',
        entityId: '999999',
        details: 'Automated audit metadata verification entry',
        ipAddress: '127.0.0.1',
      });

      const verifyRes = await query<{
        id: number;
        user_id: number | null;
        action: string;
        entity_type: string;
        entity_id: string | null;
        ip_address: string | null;
        created_at: string;
      }>(
        'SELECT id, user_id, action, entity_type, entity_id, ip_address, created_at FROM audit_logs WHERE id = $1',
        [inserted.id]
      );

      if (verifyRes.rowCount !== 1) {
        throw new Error('Newly logged audit entry could not be retrieved by ID');
      }
      const row = verifyRes.rows[0];
      if (row.user_id !== 1 || row.action !== markerAction || row.entity_type !== 'QA_CHECK' || row.entity_id !== '999999') {
        throw new Error('Audit log metadata mismatch (user_id, action, entity_type, or entity_id)');
      }
      if (!row.created_at || isNaN(new Date(row.created_at).getTime())) {
        throw new Error('Audit log created_at timestamp is missing or invalid');
      }

      // Check service surface for absence of update/delete methods
      const serviceMethods = Object.getOwnPropertyNames(AuditService);
      const hasMutationMethods = serviceMethods.some((m) => /update|delete|remove|edit/i.test(m));
      if (hasMutationMethods) {
        throw new Error('AuditService exposes unexpected mutation methods');
      }

      // Inspect DDL for DB-level immutability enforcement (triggers/rules/revoke)
      const migration001 = fs.readFileSync(
        path.resolve(process.cwd(), 'database/migrations/001_create_initial_tables.sql'),
        'utf8'
      );
      const hasDbTriggerOrRule = /CREATE\s+(?:TRIGGER|RULE).*audit_logs|REVOKE\s+.*(?:UPDATE|DELETE).*audit_logs/i.test(
        migration001
      );

      return `Verified audit creation (id=${row.id}, actor=#${row.user_id}, entity=${row.entity_type}:${row.entity_id}, timestamp valid) & read-only AuditService. Note: DB-level immutability triggers/rules are ${hasDbTriggerOrRule ? 'present' : 'NOT implemented in schema'}`;
    });

    // 9. Production Hall Creation & Uniqueness (with cleanup)
    await executeTest(9, 'Production Hall Provisioning & Constraints (Isolated)', 'Production Module', async () => {
      const { ProductionService } = await import('../modules/production/production.service.ts');
      const testCode = `HALL-TEST-${Date.now().toString().slice(-4)}`;
      const newHall = await ProductionService.createHall(
        {
          name: `Test Unit Hall ${testCode}`,
          code: testCode,
          description: 'Automated test production hall',
        },
        1,
        '127.0.0.1'
      );
      prodHallIdForAudit = newHall.id;

      try {
        if (!newHall.id || newHall.code !== testCode) {
          throw new Error('Failed to create production hall');
        }

        let duplicateRejected = false;
        try {
          await ProductionService.createHall({ name: `Another ${testCode}`, code: testCode }, 1, '127.0.0.1');
        } catch (err: any) {
          duplicateRejected = err.statusCode === 409;
        }
        if (!duplicateRejected) {
          throw new Error('Duplicate hall code was not rejected with HTTP 409');
        }

        return `Production hall [${newHall.code}] created, duplicate rejected (409), and test hall cleaned up`;
      } finally {
        if (newHall?.id) {
          await query('DELETE FROM production_halls WHERE id = $1', [newHall.id]);
        }
      }
    });

    // 10. Dynamic Production Lines & Supervisor Multi-Line Assignment (with cleanup)
    await executeTest(10, 'Production Lines & Multi-Line Supervisor Mapping (Isolated)', 'Production Module', async () => {
      const { ProductionService } = await import('../modules/production/production.service.ts');
      const ts = Date.now().toString().slice(-4);
      const lineCode1 = `TEST-SEW-${ts}A`;
      const lineCode2 = `TEST-SEW-${ts}B`;

      const line1 = await ProductionService.createLine(
        {
          line_number: lineCode1,
          name: 'Automated Test Line Alpha',
          hall_id: 1,
          production_type: 'Sewing',
          supervisor_id: 2,
          capacity_per_day: 750,
        },
        1,
        '127.0.0.1'
      );
      prodLineIdForAudit = line1.id;

      const line2 = await ProductionService.createLine(
        {
          line_number: lineCode2,
          name: 'Automated Test Line Beta',
          hall_id: 1,
          production_type: 'Sewing',
          supervisor_id: 2,
          capacity_per_day: 650,
        },
        1,
        '127.0.0.1'
      );

      try {
        if (line1.supervisor_id !== 2 || line2.supervisor_id !== 2) {
          throw new Error('Supervisor assignment mismatch');
        }
        return `Verified multi-line supervisor mapping (#2 -> ${line1.line_number}, ${line2.line_number}) and cleaned up test lines`;
      } finally {
        if (line1?.id) await query('DELETE FROM production_lines WHERE id = $1', [line1.id]);
        if (line2?.id) await query('DELETE FROM production_lines WHERE id = $1', [line2.id]);
      }
    });

    // 11. Production Stages Management & Quality Gate (with cleanup)
    await executeTest(11, 'Configurable Production Stages & QC Types (Isolated)', 'Production Module', async () => {
      const { ProductionService } = await import('../modules/production/production.service.ts');
      const stageCode = `STG-TEST-${Date.now().toString().slice(-4)}`;

      const newStage = await ProductionService.createStage(
        {
          name: `Buttonhole & Riveting ${stageCode}`,
          stage_code: stageCode,
          description: 'Specialized hardware attachment station',
          stage_type: 'STANDARD',
          is_mandatory_default: false,
        },
        1,
        '127.0.0.1'
      );
      prodStageIdForAudit = newStage.id;

      try {
        const allStages = await ProductionService.listStages();
        const found = allStages.find((s) => s.id === newStage.id);
        if (!found) {
          throw new Error('Newly created stage was not found in stage listing');
        }
        const qcStages = allStages.filter((s) => s.stage_type === 'QUALITY');
        if (qcStages.length === 0) {
          throw new Error('No Quality Inspection stages found in system');
        }
        return `Stage "${newStage.name}" created, verified ${allStages.length} stages (${qcStages.length} QC gates), and test stage cleaned up`;
      } finally {
        if (newStage?.id) {
          await query('DELETE FROM production_stages WHERE id = $1', [newStage.id]);
        }
      }
    });

    // 12. Configurable Production Workflows & Reordering (with cleanup)
    await executeTest(12, 'Configurable Workflows & Step Reordering (Isolated)', 'Production Module', async () => {
      const { ProductionService } = await import('../modules/production/production.service.ts');
      const wfCode = `WF-TEST-${Date.now().toString().slice(-4)}`;

      const wf = await ProductionService.createWorkflow(
        {
          name: `Test Custom Flow ${wfCode}`,
          workflow_code: wfCode,
          description: 'Test workflow with reordering verification',
          product_category: 'Automated Test Garments',
          steps: [
            { stage_id: 1, step_order: 1, is_mandatory: true, quality_gate: false },
            { stage_id: 2, step_order: 2, is_mandatory: true, quality_gate: false },
            { stage_id: 4, step_order: 3, is_mandatory: true, quality_gate: false },
          ],
        },
        1,
        '127.0.0.1'
      );
      prodWorkflowIdForAudit = wf.id;

      try {
        if (wf.steps.length !== 3) {
          throw new Error(`Expected 3 steps, got ${wf.steps.length}`);
        }

        const reordered = await ProductionService.reorderWorkflowSteps(
          wf.id,
          [
            { stage_id: 1, is_mandatory: true, quality_gate: false },
            { stage_id: 2, is_mandatory: true, quality_gate: false },
            { stage_id: 3, is_mandatory: true, quality_gate: true, notes: 'Inserted QC gate' },
            { stage_id: 4, is_mandatory: true, quality_gate: false },
          ],
          1,
          '127.0.0.1'
        );

        if (reordered.steps.length !== 4) {
          throw new Error(`Expected 4 steps after reordering, got ${reordered.steps.length}`);
        }
        const thirdStep = reordered.steps.find((s) => s.step_order === 3);
        if (!thirdStep || thirdStep.stage_id !== 3 || !thirdStep.quality_gate) {
          throw new Error('Reordered sequence step 3 does not match inserted Quality Inspection stage');
        }

        return `Workflow "${wf.name}" created, reordered to 4 stages with QC gate, and test workflow cleaned up`;
      } finally {
        if (wf?.id) {
          await query('DELETE FROM production_workflow_steps WHERE workflow_id = $1', [wf.id]);
          await query('DELETE FROM production_workflows WHERE id = $1', [wf.id]);
        }
      }
    });

    // 13. Production RBAC & Privilege Enforcement (HTTP)
    await executeTest(13, 'Production RBAC Permission Enforcement (HTTP)', 'Authorization', async () => {
      const deptLogin = await loginViaHttp('deptuser', 'Dept@123');
      const mgrLogin = await loginViaHttp('manager', 'Manager@123');

      const deptCreateHall = await apiRequest('/production/halls', {
        method: 'POST',
        token: deptLogin.token,
        body: { name: 'Unauth Hall', code: 'UNAUTH-01' },
      });
      if (deptCreateHall.status !== 403) {
        throw new Error(`Expected HTTP 403 for deptuser creating hall, got ${deptCreateHall.status}`);
      }

      const mgrStats = await apiRequest('/production/stats', { token: mgrLogin.token });
      if (mgrStats.status !== 200) {
        throw new Error(`Expected HTTP 200 for manager reading production stats, got ${mgrStats.status}`);
      }

      return 'HTTP RBAC enforced: Department User blocked from production hall creation (403), Factory Manager authorized (200)';
    });

    // 14. Production Configuration Audit Trail (Specific entity/actor check)
    await executeTest(14, 'Production Audit Trail Ledger Verification', 'Security & Compliance', async () => {
      const auditRes = await query<{
        action: string;
        entity_type: string;
        entity_id: string | null;
        user_id: number | null;
        created_at: string;
      }>(
        `SELECT action, entity_type, entity_id, user_id, created_at FROM audit_logs 
         WHERE entity_type IN ('PRODUCTION_HALL', 'PRODUCTION_LINE', 'PRODUCTION_STAGE', 'PRODUCTION_WORKFLOW')
           AND user_id = 1
         ORDER BY id DESC LIMIT 20`
      );

      if (auditRes.rowCount === 0) {
        throw new Error('No production configuration audit records found');
      }

      const expectedEntities = [
        { type: 'PRODUCTION_HALL', id: String(prodHallIdForAudit) },
        { type: 'PRODUCTION_LINE', id: String(prodLineIdForAudit) },
        { type: 'PRODUCTION_STAGE', id: String(prodStageIdForAudit) },
        { type: 'PRODUCTION_WORKFLOW', id: String(prodWorkflowIdForAudit) },
      ];

      for (const exp of expectedEntities) {
        const match = auditRes.rows.find(
          (r) => r.entity_type === exp.type && r.entity_id === exp.id && r.user_id === 1 && r.created_at
        );
        if (!match) {
          throw new Error(`Missing production audit entry for ${exp.type} #${exp.id} by actor #1`);
        }
      }

      return `Verified actor (#1), entity IDs, and timestamps in audit_logs for Hall #${prodHallIdForAudit}, Line #${prodLineIdForAudit}, Stage #${prodStageIdForAudit}, Workflow #${prodWorkflowIdForAudit}`;
    });

    // 15. Incremental Migration Integrity (001–004, columns, ordering, tracking status)
    await executeTest(15, 'PostgreSQL Schema & Migration Order Integrity (001-004)', 'Database', async () => {
      const migrationsDir = path.resolve(process.cwd(), 'database/migrations');
      const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      const expectedFiles = [
        '001_create_initial_tables.sql',
        '002_create_production_tables.sql',
        '003_create_department_tables.sql',
        '004_create_department_manager_role.sql',
      ];
      for (const ef of expectedFiles) {
        if (!migrationFiles.includes(ef)) {
          throw new Error(`Missing migration file: ${ef}`);
        }
      }

      const requiredTables = [
        'users', 'roles', 'permissions', 'user_roles', 'role_permissions', 'audit_logs',
        'production_halls', 'production_lines', 'production_stages', 'production_workflows',
        'production_workflow_steps', 'production_settings',
        'departments', 'department_employees', 'department_manager_history',
      ];

      const tablesRes = await query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      );
      const existingTableNames = new Set(tablesRes.rows.map((r) => r.table_name));

      for (const t of requiredTables) {
        if (!existingTableNames.has(t)) {
          throw new Error(`Missing expected schema table: ${t}`);
        }
      }

      // Verify 003_ altered production_lines to add department_id
      const lineColsRes = await query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'production_lines'`
      );
      if (!lineColsRes.rows.some((c) => c.column_name === 'department_id')) {
        throw new Error('production_lines.department_id column from 003_ migration is missing');
      }

      // Verify 004_ seed state (Department Manager role & scoped permissions)
      const role004 = await query(`SELECT id FROM roles WHERE role_name = 'Department Manager'`);
      const perms004 = await query(
        `SELECT permission_key FROM permissions WHERE permission_key IN ('departments:scoped:view', 'departments:scoped:manage')`
      );
      if (role004.rowCount !== 1 || perms004.rowCount !== 2) {
        throw new Error('004_ Department Manager role or scoped permissions missing');
      }

      const hasMigrationTrackingTable = existingTableNames.has('schema_migrations');
      return `Verified 001–004 migration files, all 15 tables, production_lines.department_id, and 004_ role/permissions. schema_migrations tracking table present: ${hasMigrationTrackingTable}`;
    });

    // 16. Department Creation & Code Uniqueness (with cleanup)
    await executeTest(16, 'Department Creation & Unique Code Enforcement (Isolated)', 'Department Module', async () => {
      const testCode = `DEP-TEST-${Date.now().toString().slice(-4)}`;
      const created = await DepartmentService.createDepartment(
        {
          dept_code: testCode,
          name: `Automated Test Department ${testCode}`,
          description: 'Temporary unit testing department for code uniqueness',
        },
        1,
        '127.0.0.1'
      );
      deptIdsForAudit.push(created.id);

      try {
        if (!created.id || created.dept_code !== testCode) {
          throw new Error('Failed to create department');
        }

        let duplicateRejected = false;
        try {
          await DepartmentService.createDepartment(
            { dept_code: testCode, name: 'Duplicate Code Department' },
            1,
            '127.0.0.1'
          );
        } catch {
          duplicateRejected = true;
        }
        if (!duplicateRejected) {
          throw new Error(`Expected duplicate department code "${testCode}" to be rejected`);
        }

        return `Created department [${testCode}], confirmed duplicate rejection, and cleaned up test department`;
      } finally {
        if (created?.id) {
          await query('DELETE FROM departments WHERE id = $1', [created.id]);
        }
      }
    });

    // 17. Department Hierarchy & Circular Reference Prevention (with bottom-up cleanup)
    await executeTest(17, 'Department Hierarchy & Circular Reference Prevention (Isolated)', 'Department Module', async () => {
      const ts = Date.now().toString().slice(-4);
      const parent = await DepartmentService.createDepartment(
        { dept_code: `DEP-HIER-P-${ts}`, name: 'Hierarchy Parent Dept' },
        1,
        '127.0.0.1'
      );
      const child = await DepartmentService.createDepartment(
        { dept_code: `DEP-HIER-C-${ts}`, name: 'Hierarchy Child Dept', parent_id: parent.id },
        1,
        '127.0.0.1'
      );
      const grandchild = await DepartmentService.createDepartment(
        { dept_code: `DEP-HIER-G-${ts}`, name: 'Hierarchy Grandchild Dept', parent_id: child.id },
        1,
        '127.0.0.1'
      );

      try {
        let cycleRejected = false;
        try {
          await DepartmentService.updateDepartment(parent.id, { parent_id: grandchild.id }, 1, '127.0.0.1');
        } catch {
          cycleRejected = true;
        }
        if (!cycleRejected) {
          throw new Error('Circular parent-child relationship was not prevented');
        }

        let selfParentRejected = false;
        try {
          await DepartmentService.updateDepartment(parent.id, { parent_id: parent.id }, 1, '127.0.0.1');
        } catch {
          selfParentRejected = true;
        }
        if (!selfParentRejected) {
          throw new Error('Self-parenting was not rejected');
        }

        return `Verified 3-level hierarchy (${parent.id} -> ${child.id} -> ${grandchild.id}), cycle rejection, and cleaned up`;
      } finally {
        // Delete bottom-up due to ON DELETE RESTRICT on parent_id
        if (grandchild?.id) await query('DELETE FROM departments WHERE id = $1', [grandchild.id]);
        if (child?.id) await query('DELETE FROM departments WHERE id = $1', [child.id]);
        if (parent?.id) await query('DELETE FROM departments WHERE id = $1', [parent.id]);
      }
    });

    // 18. Department Manager Assignment & Historical Tenure (with cleanup)
    await executeTest(18, 'Department Manager Assignment & Historical Tenure (Isolated)', 'Department Module', async () => {
      const dept = await DepartmentService.createDepartment(
        { dept_code: `DEP-MGR-${Date.now().toString().slice(-4)}`, name: 'Manager Tenure Test Dept' },
        1,
        '127.0.0.1'
      );
      deptIdsForAudit.push(dept.id);

      try {
        await DepartmentService.assignManager(dept.id, 2, 'Initial Manager Appointment', 1, '127.0.0.1');
        await DepartmentService.assignManager(dept.id, 1, 'Manager Transition', 1, '127.0.0.1');

        const details = await DepartmentService.getDepartmentById(dept.id);
        if (details.department.manager_id !== 1) {
          throw new Error('Active manager was not updated to user #1');
        }
        if (details.manager_history.length < 2) {
          throw new Error('Manager tenure history did not record both assignments');
        }
        const previousTenure = details.manager_history.find((h) => h.manager_id === 2);
        if (!previousTenure || !previousTenure.relinquished_at) {
          throw new Error('Previous manager tenure was not closed with relinquished_at');
        }

        return `Verified manager tenure transition and relinquishment timestamp; cleaned up test dept & history`;
      } finally {
        if (dept?.id) {
          await query('DELETE FROM department_manager_history WHERE department_id = $1', [dept.id]);
          await query('DELETE FROM departments WHERE id = $1', [dept.id]);
        }
      }
    });

    // 19. Employee Assignment, Multi-Department Mapping & Transfer (using isolated temp user & depts)
    await executeTest(19, 'Employee Assignment, Multi-Dept & Transfer (Isolated)', 'Department Module', async () => {
      const ts = Date.now().toString().slice(-4);
      const { user: tempEmp } = await createTempUser('qa_emp19', [3]);
      const deptA = await DepartmentService.createDepartment(
        { dept_code: `DEP-TR-A-${ts}`, name: 'Transfer Source Dept' },
        1,
        '127.0.0.1'
      );
      const deptB = await DepartmentService.createDepartment(
        { dept_code: `DEP-TR-B-${ts}`, name: 'Transfer Target Dept' },
        1,
        '127.0.0.1'
      );

      try {
        const assigned = await DepartmentService.assignEmployee(
          deptA.id,
          { user_id: tempEmp.id, position_title: 'Junior Sewing Inspector', is_primary: true },
          1,
          '127.0.0.1'
        );
        if (assigned.position_title !== 'Junior Sewing Inspector') {
          throw new Error('Failed to assign employee to department');
        }

        const transferred = await DepartmentService.transferEmployee(
          deptA.id,
          deptB.id,
          tempEmp.id,
          'Senior Quality Auditor',
          true,
          1,
          '127.0.0.1'
        );
        if (transferred.position_title !== 'Senior Quality Auditor') {
          throw new Error('Failed to transfer employee to new position');
        }

        const deptADetails = await DepartmentService.getDepartmentById(deptA.id);
        if (deptADetails.employees.some((e) => e.user_id === tempEmp.id)) {
          throw new Error('Employee still listed in source department after transfer');
        }
        const deptBDetails = await DepartmentService.getDepartmentById(deptB.id);
        if (!deptBDetails.employees.some((e) => e.user_id === tempEmp.id)) {
          throw new Error('Employee not found in target department after transfer');
        }

        return `Employee @${tempEmp.username} assigned and transferred from #${deptA.id} to #${deptB.id}; all test records cleaned up`;
      } finally {
        await query('DELETE FROM department_employees WHERE department_id IN ($1, $2)', [deptA.id, deptB.id]);
        await query('DELETE FROM departments WHERE id IN ($1, $2)', [deptA.id, deptB.id]);
        await cleanupTempUser(tempEmp.id);
      }
    });

    // 20. Department Deactivation & Deletion Safety (using isolated temp user)
    await executeTest(20, 'Department Deactivation & Deletion Safety (Isolated)', 'Department Module', async () => {
      const { user: tempEmp } = await createTempUser('qa_emp20', [3]);
      const dept = await DepartmentService.createDepartment(
        { dept_code: `DEP-DEL-${Date.now().toString().slice(-4)}`, name: 'Deletion Test Dept' },
        1,
        '127.0.0.1'
      );

      try {
        await DepartmentService.assignEmployee(
          dept.id,
          { user_id: tempEmp.id, position_title: 'Safety Staff', is_primary: false },
          1,
          '127.0.0.1'
        );

        let deletionBlocked = false;
        try {
          await DepartmentService.deleteDepartment(dept.id, 1, '127.0.0.1');
        } catch {
          deletionBlocked = true;
        }
        if (!deletionBlocked) {
          throw new Error('Department with assigned employees was deleted without blocking');
        }

        const deactivated = await DepartmentService.toggleDepartmentStatus(dept.id, 1, '127.0.0.1');
        if (deactivated.status !== 'inactive') {
          throw new Error('Failed to deactivate department');
        }
        const reactivated = await DepartmentService.toggleDepartmentStatus(dept.id, 1, '127.0.0.1');
        if (reactivated.status !== 'active') {
          throw new Error('Failed to reactivate department');
        }

        return 'Confirmed deletion block with assigned staff, status toggle active->inactive->active, and cleaned up test records';
      } finally {
        await query('DELETE FROM department_employees WHERE department_id = $1', [dept.id]);
        await query('DELETE FROM departments WHERE id = $1', [dept.id]);
        await cleanupTempUser(tempEmp.id);
      }
    });

    // 21. Department RBAC Permission Enforcement
    await executeTest(21, 'Department Module RBAC Enforcement', 'Authorization', async () => {
      const adminRes = await loginViaHttp('admin', 'Admin@123');
      const managerRes = await loginViaHttp('manager', 'Manager@123');
      const deptUserRes = await loginViaHttp('deptuser', 'Dept@123');

      if (!adminRes.user.permissions.includes('departments:create')) {
        throw new Error('System Administrator missing departments:create');
      }
      if (!managerRes.user.permissions.includes('departments:view') || !managerRes.user.permissions.includes('departments:manage_employees')) {
        throw new Error('Factory Manager missing global department operational permissions');
      }

      const restricted = [
        'departments:create',
        'departments:edit',
        'departments:status',
        'departments:manage_manager',
        'departments:manage_employees',
      ];
      for (const p of restricted) {
        if (deptUserRes.user.permissions.includes(p)) {
          throw new Error(`Department User/Manager has unpermitted global permission: ${p}`);
        }
      }
      if (!deptUserRes.user.permissions.includes('departments:scoped:manage')) {
        throw new Error('Seeded deptuser missing departments:scoped:manage');
      }

      return 'Verified RBAC boundaries: Admin global, Factory Manager global operational, deptuser scoped only';
    });

    // 22. Department Audit Trail Ledger Verification
    await executeTest(22, 'Department Configuration Audit Trail Verification', 'Security & Compliance', async () => {
      const auditRes = await query<{
        action: string;
        entity_type: string;
        entity_id: string | null;
        user_id: number | null;
        created_at: string;
      }>(
        `SELECT action, entity_type, entity_id, user_id, created_at FROM audit_logs 
         WHERE entity_type = 'DEPARTMENT' AND user_id = 1
         ORDER BY id DESC LIMIT 20`
      );

      if (auditRes.rowCount === 0) {
        throw new Error('No department audit records found for actor #1');
      }

      for (const deptId of deptIdsForAudit) {
        const found = auditRes.rows.find((r) => r.entity_id === String(deptId) && r.created_at);
        if (!found) {
          throw new Error(`Missing audit record for test department #${deptId}`);
        }
      }

      const actions = Array.from(new Set(auditRes.rows.map((r) => r.action)));
      return `Verified department audit events (actor #1, entity_id, created_at): [${actions.join(', ')}]`;
    });

    // 23. Complete Schema & Constraint Integrity (Behavioral FK/Unique checks + 004_ Idempotency)
    await executeTest(23, 'Complete Schema, Constraint & Non-Destructive Re-run Integrity', 'Database', async () => {
      const allExpectedTables = [
        'users', 'roles', 'permissions', 'user_roles', 'role_permissions', 'audit_logs',
        'production_halls', 'production_lines', 'production_stages', 'production_workflows',
        'production_workflow_steps', 'production_settings',
        'departments', 'department_employees', 'department_manager_history',
      ];

      const tablesRes = await query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      );
      const existingTableNames = new Set(tablesRes.rows.map((r) => r.table_name));
      for (const t of allExpectedTables) {
        if (!existingTableNames.has(t)) {
          throw new Error(`Missing expected schema table: ${t}`);
        }
      }

      // Behavioral FK enforcement test (production_lines.department_id -> departments.id)
      let fkRejected = false;
      try {
        await query(
          `INSERT INTO production_lines (line_number, name, hall_id, production_type, department_id)
           VALUES ('FK-TEST-LINE', 'FK Check', 1, 'Sewing', 999999)`
        );
      } catch {
        fkRejected = true;
      }
      if (!fkRejected) {
        throw new Error('Foreign key constraint on production_lines.department_id did not reject invalid department_id');
      }

      // Non-destructive re-run of 004_ DDL
      const mig004 = fs.readFileSync(
        path.resolve(process.cwd(), 'database/migrations/004_create_department_manager_role.sql'),
        'utf8'
      );
      await query(mig004);

      return 'Verified all 15 tables, FK constraint enforcement on production_lines.department_id, and safe re-run of 004_ DDL';
    });

    // Log in real seeded users once for HTTP RBAC tests #24-#41
    const adminSession = await loginViaHttp('admin', 'Admin@123');
    const managerSession = await loginViaHttp('manager', 'Manager@123');
    const deptMgrSession = await loginViaHttp('deptuser', 'Dept@123');

    // 24. System Administrator Global Department Access (HTTP)
    await executeTest(24, 'System Administrator Global Department Authority (HTTP)', 'RBAC & Scoped Auth', async () => {
      const [d11, d12, stats, tree] = await Promise.all([
        apiRequest('/departments/11', { token: adminSession.token }),
        apiRequest('/departments/12', { token: adminSession.token }),
        apiRequest('/departments/stats', { token: adminSession.token }),
        apiRequest('/departments/tree', { token: adminSession.token }),
      ]);

      if (d11.status !== 200 || d12.status !== 200 || stats.status !== 200 || tree.status !== 200) {
        throw new Error(`Admin HTTP department access failed: ${d11.status}, ${d12.status}, ${stats.status}, ${tree.status}`);
      }

      // Preserve exact original fields during write check
      const orig = d11.data.data.department;
      try {
        const editRes = await apiRequest('/departments/11', {
          method: 'PUT',
          token: adminSession.token,
          body: { name: orig.name, description: orig.description },
        });
        if (editRes.status !== 200) {
          throw new Error(`Admin PUT /api/departments/11 returned ${editRes.status}`);
        }
      } finally {
        await query('UPDATE departments SET name = $1, description = $2 WHERE id = 11', [orig.name, orig.description]);
      }

      return 'System Administrator verified via HTTP across /departments/11, /departments/12, /stats, /tree, and PUT edit (200)';
    });

    // 25. Factory Manager Global Operational Capabilities (HTTP)
    await executeTest(25, 'Factory Manager Global Operational Department Capabilities (HTTP)', 'RBAC & Scoped Auth', async () => {
      const [d11, d12, stats, createDenied] = await Promise.all([
        apiRequest('/departments/11', { token: managerSession.token }),
        apiRequest('/departments/12', { token: managerSession.token }),
        apiRequest('/departments/stats', { token: managerSession.token }),
        apiRequest('/departments', {
          method: 'POST',
          token: managerSession.token,
          body: { dept_code: 'DEP-MGR-DENY', name: 'Should Deny' },
        }),
      ]);

      if (d11.status !== 200 || d12.status !== 200 || stats.status !== 200) {
        throw new Error(`Factory Manager global read failed: ${d11.status}, ${d12.status}, ${stats.status}`);
      }
      if (createDenied.status !== 403) {
        throw new Error(`Factory Manager should be blocked from creating departments (expected 403, got ${createDenied.status})`);
      }

      return 'Factory Manager verified via HTTP: global operational view (200) while blocked from structural create (403)';
    });

    // 26. Department Manager Access to Assigned Department (HTTP)
    await executeTest(26, 'Department Manager Scoped Assigned Department Access (HTTP)', 'RBAC & Scoped Auth', async () => {
      const [listRes, detailRes, linesRes] = await Promise.all([
        apiRequest('/departments', { token: deptMgrSession.token }),
        apiRequest('/departments/11', { token: deptMgrSession.token }),
        apiRequest('/departments/11/lines', { token: deptMgrSession.token }),
      ]);

      if (listRes.status !== 200 || detailRes.status !== 200 || linesRes.status !== 200) {
        const listErr = listRes.status !== 200 ? ` (${listRes.data?.error?.message || listRes.rawText})` : '';
        throw new Error(`Department Manager HTTP read failed: list=${listRes.status}${listErr}, detail=${detailRes.status}, lines=${linesRes.status}`);
      }

      const depts = listRes.data?.data || [];
      if (depts.length !== 1 || depts[0].id !== 11) {
        throw new Error(`Expected scoped list to return only department #11, got IDs: [${depts.map((d: any) => d.id).join(', ')}]`);
      }

      const lines = linesRes.data?.data || [];
      if (!lines.some((l: any) => l.line_number === 'LINE-CUT-01')) {
        throw new Error('Expected LINE-CUT-01 in /api/departments/11/lines response');
      }

      return `HTTP /departments returned only #11 (DEP-CUT) and /departments/11/lines returned ${lines.length} linked line(s)`;
    });

    // 27. Department Manager Employee Allocation in Assigned Department (Actual HTTP POST & DELETE)
    await executeTest(27, 'Department Manager Employee Allocation & Removal within Scope (HTTP)', 'RBAC & Scoped Auth', async () => {
      const { user: tempEmp } = await createTempUser('qa_alloc27', [3]);

      try {
        const assignRes = await apiRequest('/departments/11/employees', {
          method: 'POST',
          token: deptMgrSession.token,
          body: { user_id: tempEmp.id, position_title: 'Cutting Floor Overseer', is_primary: false },
        });
        if (assignRes.status !== 200) {
          throw new Error(`Expected HTTP 200 assigning staff in own dept #11, got ${assignRes.status}: ${assignRes.rawText}`);
        }

        const detailRes = await apiRequest('/departments/11', { token: deptMgrSession.token });
        const found = (detailRes.data?.data?.employees || []).some((e: any) => e.user_id === tempEmp.id);
        if (!found) {
          throw new Error('Assigned employee did not appear in GET /api/departments/11 roster');
        }

        const removeRes = await apiRequest(`/departments/11/employees/${tempEmp.id}`, {
          method: 'DELETE',
          token: deptMgrSession.token,
        });
        if (removeRes.status !== 200) {
          throw new Error(`Expected HTTP 200 removing staff in own dept #11, got ${removeRes.status}`);
        }

        return `Verified real HTTP POST /departments/11/employees and DELETE /departments/11/employees/${tempEmp.id} for @deptuser`;
      } finally {
        await cleanupTempUser(tempEmp.id);
      }
    });

    // 28. Department Manager Cross-Department Access Rejection (HTTP 403)
    await executeTest(28, 'Department Manager Cross-Department View Rejection (HTTP 403)', 'Security & Scoped Auth', async () => {
      const [crossDetail, crossLines] = await Promise.all([
        apiRequest('/departments/12', { token: deptMgrSession.token }),
        apiRequest('/departments/12/lines', { token: deptMgrSession.token }),
      ]);

      if (crossDetail.status !== 403) {
        throw new Error(`Expected HTTP 403 for unassigned dept #12 detail, got ${crossDetail.status}`);
      }
      if (crossLines.status !== 403) {
        throw new Error(`Expected HTTP 403 for unassigned dept #12 lines, got ${crossLines.status}`);
      }

      return `HTTP /departments/12 and /departments/12/lines rejected @deptuser with HTTP 403`;
    });

    // 29. Department Manager Cross-Department Employee Allocation Rejection (HTTP 403)
    await executeTest(29, 'Department Manager Cross-Department Employee Allocation Rejection (HTTP 403)', 'Security & Scoped Auth', async () => {
      const [crossAssign, crossDelete] = await Promise.all([
        apiRequest('/departments/12/employees', {
          method: 'POST',
          token: deptMgrSession.token,
          body: { user_id: 1, position_title: 'Unauthorized Tech' },
        }),
        apiRequest('/departments/12/employees/2', {
          method: 'DELETE',
          token: deptMgrSession.token,
        }),
      ]);

      if (crossAssign.status !== 403) {
        throw new Error(`Expected HTTP 403 on POST /departments/12/employees, got ${crossAssign.status}`);
      }
      if (crossDelete.status !== 403) {
        throw new Error(`Expected HTTP 403 on DELETE /departments/12/employees/2, got ${crossDelete.status}`);
      }

      return 'HTTP cross-department employee assignment and removal rejected with HTTP 403 Forbidden';
    });

    // 30. Department Manager Manager Appointment Rejection (HTTP 403)
    await executeTest(30, 'Department Manager Manager Appointment Rejection (HTTP 403)', 'Security & Scoped Auth', async () => {
      const [putMgrRes, editMgrRes] = await Promise.all([
        apiRequest('/departments/11/manager', {
          method: 'PUT',
          token: deptMgrSession.token,
          body: { manager_id: 2, notes: 'Unauthorized change' },
        }),
        apiRequest('/departments/11', {
          method: 'PUT',
          token: deptMgrSession.token,
          body: { manager_id: 2 },
        }),
      ]);

      if (putMgrRes.status !== 403) {
        throw new Error(`Expected HTTP 403 on PUT /departments/11/manager, got ${putMgrRes.status}`);
      }
      if (editMgrRes.status !== 403) {
        throw new Error(`Expected HTTP 403 on PUT /departments/11 with manager_id, got ${editMgrRes.status}`);
      }

      let serviceRejected = false;
      try {
        await DepartmentService.updateDepartment(11, { manager_id: 2 }, 3, undefined, ['departments:scoped:manage']);
      } catch (err: any) {
        serviceRejected = err.statusCode === 403;
      }
      if (!serviceRejected) {
        throw new Error('Service layer did not reject manager_id modification without permission');
      }

      return 'Manager reassignment rejected with HTTP 403 on /manager, /departments/11 PUT, and DepartmentService';
    });

    // 31. Department Manager Delete, Create & Status Rejection (Real HTTP routes)
    await executeTest(31, 'Department Manager Deletion, Creation & Status Rejection (HTTP 403)', 'Security & Scoped Auth', async () => {
      const [createRes, statusRes, deleteRes] = await Promise.all([
        apiRequest('/departments', {
          method: 'POST',
          token: deptMgrSession.token,
          body: { dept_code: 'DEP-UNAUTH', name: 'Unauthorized Create' },
        }),
        apiRequest('/departments/11/status', {
          method: 'PUT',
          token: deptMgrSession.token,
        }),
        apiRequest('/departments/11', {
          method: 'DELETE',
          token: deptMgrSession.token,
        }),
      ]);

      if (createRes.status !== 403) {
        throw new Error(`Expected HTTP 403 on POST /departments, got ${createRes.status}`);
      }
      if (statusRes.status !== 403) {
        throw new Error(`Expected HTTP 403 on PUT /departments/11/status, got ${statusRes.status}`);
      }
      if (deleteRes.status !== 403) {
        throw new Error(`Expected HTTP 403 on DELETE /departments/11, got ${deleteRes.status}`);
      }

      return 'Real HTTP routes POST /departments, PUT /departments/11/status, and DELETE /departments/11 rejected with HTTP 403';
    });

    // 32. Department Manager Hierarchy Modification Rejection (HTTP 403)
    await executeTest(32, 'Department Manager Hierarchy Modification Rejection (HTTP 403)', 'Security & Scoped Auth', async () => {
      const editHierarchy = await apiRequest('/departments/11', {
        method: 'PUT',
        token: deptMgrSession.token,
        body: { parent_id: 12 },
      });

      if (editHierarchy.status !== 403) {
        throw new Error(`Expected HTTP 403 on PUT /departments/11 with parent_id, got ${editHierarchy.status}`);
      }

      let serviceRejected = false;
      try {
        await DepartmentService.updateDepartment(11, { parent_id: 12 }, 3, undefined, ['departments:scoped:manage']);
      } catch (err: any) {
        serviceRejected = err.statusCode === 403;
      }
      if (!serviceRejected) {
        throw new Error('DepartmentService allowed parent_id change without departments:hierarchy permission');
      }

      return 'Hierarchy modification rejected with HTTP 403 at both HTTP route/middleware and DepartmentService layers';
    });

    // 33. Ordinary Department User Access Rejection (Real DB user + HTTP 403)
    await executeTest(33, 'Ordinary Department User Management Access Rejection (HTTP 403)', 'Security & Scoped Auth', async () => {
      const { user: ordinaryUser, password } = await createTempUser('qa_ordinary33', [3]); // Role 3 = Department User only

      try {
        const ordinarySession = await loginViaHttp(ordinaryUser.username, password);
        const [listRes, detailRes, editRes, assignRes] = await Promise.all([
          apiRequest('/departments', { token: ordinarySession.token }),
          apiRequest('/departments/11', { token: ordinarySession.token }),
          apiRequest('/departments/11', {
            method: 'PUT',
            token: ordinarySession.token,
            body: { description: 'Unauthorized' },
          }),
          apiRequest('/departments/11/employees', {
            method: 'POST',
            token: ordinarySession.token,
            body: { user_id: ordinaryUser.id, position_title: 'Operator' },
          }),
        ]);

        if (listRes.status !== 403 || detailRes.status !== 403 || editRes.status !== 403 || assignRes.status !== 403) {
          throw new Error(
            `Ordinary user not rejected with 403 across all dept endpoints: list=${listRes.status}, detail=${detailRes.status}, edit=${editRes.status}, assign=${assignRes.status}`
          );
        }

        return 'Real DB ordinary Department User rejected with HTTP 403 across list, view, edit, and employee assignment endpoints';
      } finally {
        await cleanupTempUser(ordinaryUser.id);
      }
    });

    // 34. Immediate Revocation on Manager Relinquishment (Real HTTP + exact DB restore)
    await executeTest(34, 'Immediate Revocation on Manager Relinquishment (HTTP & DB)', 'Security & Scoped Auth', async () => {
      const origRes = await query<{ manager_id: number | null }>('SELECT manager_id FROM departments WHERE id = 11');
      const originalManagerId = origRes.rows[0]?.manager_id ?? null;

      await query('UPDATE departments SET manager_id = NULL WHERE id = 11');
      try {
        // Use existing still-valid JWT token of deptuser
        const revokedView = await apiRequest('/departments/11', { token: deptMgrSession.token });
        if (revokedView.status !== 403) {
          throw new Error(`Immediate revocation failed: expected HTTP 403 after manager unassignment, got ${revokedView.status}`);
        }
      } finally {
        await query('UPDATE departments SET manager_id = $1 WHERE id = 11', [originalManagerId]);
      }

      const restoredView = await apiRequest('/departments/11', { token: deptMgrSession.token });
      if (restoredView.status !== 200) {
        throw new Error(`Restored manager assignment did not restore HTTP 200 access (got ${restoredView.status})`);
      }

      return `Verified instant HTTP 403 revocation on existing JWT upon DB relinquishment and exact restoration of manager_id=#${originalManagerId}`;
    });

    // 35. Multi-Department Scoped Access Boundaries (Real HTTP + isolated temp 2nd department)
    await executeTest(35, 'Multi-Department Scoped Access Boundaries (HTTP & DB)', 'Security & Scoped Auth', async () => {
      const tempDept = await DepartmentService.createDepartment(
        {
          dept_code: `DEP-MULTI-${Date.now().toString().slice(-4)}`,
          name: 'Multi-Dept Scope Test Dept',
          manager_id: deptMgrSession.user.id,
        },
        1,
        '127.0.0.1'
      );

      try {
        const [listRes, d11, dTemp, d12, d13] = await Promise.all([
          apiRequest('/departments', { token: deptMgrSession.token }),
          apiRequest('/departments/11', { token: deptMgrSession.token }),
          apiRequest(`/departments/${tempDept.id}`, { token: deptMgrSession.token }),
          apiRequest('/departments/12', { token: deptMgrSession.token }),
          apiRequest('/departments/13', { token: deptMgrSession.token }),
        ]);

        if (listRes.status !== 200) {
          throw new Error(
            `GET /api/departments failed during multi-dept tenure with HTTP ${listRes.status}: ${listRes.data?.error?.message || listRes.rawText}`
          );
        }
        const listIds = (listRes.data?.data || []).map((d: any) => d.id);
        if (!listIds.includes(11) || !listIds.includes(tempDept.id) || listIds.includes(12)) {
          throw new Error(`Scoped list mismatch during multi-dept tenure: [${listIds.join(', ')}]`);
        }
        if (d11.status !== 200 || dTemp.status !== 200) {
          throw new Error(`Authorized multi-dept access failed: #11=${d11.status}, #${tempDept.id}=${dTemp.status}`);
        }
        if (d12.status !== 403 || d13.status !== 403) {
          throw new Error(`Unassigned departments were not blocked with 403: #12=${d12.status}, #13=${d13.status}`);
        }

        return `Verified HTTP multi-department scope (#11, #${tempDept.id} -> 200; #12, #13 -> 403) and cleaned up temp department`;
      } finally {
        await query('DELETE FROM department_manager_history WHERE department_id = $1', [tempDept.id]);
        await query('DELETE FROM departments WHERE id = $1', [tempDept.id]);
      }
    });

    // 36. Department ID Parameter Spoofing Prevention (Real HTTP)
    await executeTest(36, 'Department ID Parameter Spoofing Prevention (HTTP 403)', 'Security & Scoped Auth', async () => {
      const [spoofView, spoofEdit, spoofAssign] = await Promise.all([
        apiRequest('/departments/12?department_id=11', { token: deptMgrSession.token }),
        apiRequest('/departments/12', {
          method: 'PUT',
          token: deptMgrSession.token,
          body: { id: 11, department_id: 11, name: 'Spoofed' },
        }),
        apiRequest('/departments/12/employees', {
          method: 'POST',
          token: deptMgrSession.token,
          body: { department_id: 11, user_id: 2, position_title: 'Spoof' },
        }),
      ]);

      if (spoofView.status !== 403 || spoofEdit.status !== 403 || spoofAssign.status !== 403) {
        throw new Error(
          `Spoofing attempt was not blocked with 403: view=${spoofView.status}, edit=${spoofEdit.status}, assign=${spoofAssign.status}`
        );
      }

      return 'HTTP parameter/body spoofing attempts targeting department #12 rejected with HTTP 403';
    });

    // 37. Automated Test Runner Gated Exclusively to System Administrator (Real HTTP non-admin + Admin middleware)
    await executeTest(37, 'Automated Test Runner Gated Exclusively to System Administrator', 'Security & RBAC', async () => {
      const [unauthRes, mgrRes, deptRes] = await Promise.all([
        apiRequest('/tests/run'),
        apiRequest('/tests/run', { token: managerSession.token }),
        apiRequest('/tests/run', { token: deptMgrSession.token }),
      ]);

      if (unauthRes.status !== 401) {
        throw new Error(`Expected 401 for unauthenticated /tests/run, got ${unauthRes.status}`);
      }
      if (mgrRes.status !== 403) {
        throw new Error(`Expected 403 for Factory Manager on /tests/run, got ${mgrRes.status}`);
      }
      if (deptRes.status !== 403) {
        throw new Error(`Expected 403 for Department Manager on /tests/run, got ${deptRes.status}`);
      }

      // Avoid calling GET /api/tests/run recursively with admin token; verify admin role guard directly
      const adminMiddlewareCheck = await testMiddleware(requireRole('System Administrator'), {
        user: adminSession.user,
      });
      if (!adminMiddlewareCheck.nextCalled) {
        throw new Error('System Administrator was improperly blocked by requireRole guard');
      }

      return 'GET /api/tests/run verified: unauth=401, Factory Manager=403, Department Manager=403, Admin role guard=authorized';
    });

    // 38. Cross-Department Employee Transfer Target Authorization Check (HTTP + Service + Multi-Dept Positive Path)
    await executeTest(38, 'Cross-Department Transfer Authorization Boundary (HTTP & Service)', 'Security & Scoped Auth', async () => {
      const { user: tempEmp } = await createTempUser('qa_xfer38', [3]);
      const tempManagedDept = await DepartmentService.createDepartment(
        {
          dept_code: `DEP-XFER-OK-${Date.now().toString().slice(-4)}`,
          name: 'Managed Transfer Target Dept',
          manager_id: deptMgrSession.user.id,
        },
        1,
        '127.0.0.1'
      );

      try {
        // Admin places tempEmp in dept 11 (Cutting Section managed by deptuser)
        const seedAssign = await apiRequest('/departments/11/employees', {
          method: 'POST',
          token: adminSession.token,
          body: { user_id: tempEmp.id, position_title: 'Cutting Operator', is_primary: false },
        });
        if (seedAssign.status !== 200) {
          throw new Error(`Setup failed assigning temp user to dept 11 (status ${seedAssign.status})`);
        }

        // 1) HTTP: deptuser manages ONLY dept 11, NOT dept 12. Attempting transfer into dept 12 MUST be rejected (403).
        const transferRes = await apiRequest('/departments/11/employees/transfer', {
          method: 'PUT',
          token: deptMgrSession.token,
          body: {
            target_department_id: 12,
            user_id: tempEmp.id,
            position_title: 'Unauthorized Transfer',
            is_primary: false,
          },
        });
        if (transferRes.status !== 403) {
          throw new Error(
            `Expected HTTP 403 transferring from #11 into unauthorized dept #12, got ${transferRes.status}`
          );
        }

        // 2) Service layer defense-in-depth check
        let serviceRejected = false;
        try {
          await DepartmentService.transferEmployee(
            11,
            12,
            tempEmp.id,
            'Service Bypass Attempt',
            false,
            deptMgrSession.user.id,
            '127.0.0.1',
            ['departments:scoped:manage']
          );
        } catch (err: any) {
          serviceRejected = err.statusCode === 403;
        }
        if (!serviceRejected) {
          throw new Error('DepartmentService.transferEmployee did not reject unauthorized target department with 403');
        }

        // Verify employee is STILL assigned to source dept 11
        const stillInSource = await query(
          'SELECT id FROM department_employees WHERE department_id = 11 AND user_id = $1',
          [tempEmp.id]
        );
        if (stillInSource.rowCount !== 1) {
          throw new Error('Employee was unexpectedly removed from source dept #11 after rejected transfer');
        }

        // 3) Positive path: deptuser CAN transfer between two departments they manage (#11 -> tempManagedDept)
        const okTransferRes = await apiRequest('/departments/11/employees/transfer', {
          method: 'PUT',
          token: deptMgrSession.token,
          body: {
            target_department_id: tempManagedDept.id,
            user_id: tempEmp.id,
            position_title: 'Authorized Multi-Dept Transfer',
            is_primary: false,
          },
        });
        if (okTransferRes.status !== 200) {
          throw new Error(
            `Expected HTTP 200 transferring between two managed departments, got ${okTransferRes.status}: ${okTransferRes.rawText}`
          );
        }

        return 'Verified cross-dept transfer into #12 blocked (HTTP 403 + Service 403), source roster preserved, and dual-managed transfer succeeded (200)';
      } finally {
        await query('DELETE FROM department_employees WHERE user_id = $1', [tempEmp.id]);
        await query('DELETE FROM department_manager_history WHERE department_id = $1', [tempManagedDept.id]);
        await query('DELETE FROM departments WHERE id = $1', [tempManagedDept.id]);
        await cleanupTempUser(tempEmp.id);
      }
    });

    // 39. Department Production Lines Response Shape Contract
    await executeTest(39, 'Department Production Lines API Response Contract (DEP-CUT)', 'API Contract', async () => {
      const [detailRes, linesRes] = await Promise.all([
        apiRequest('/departments/11', { token: deptMgrSession.token }),
        apiRequest('/departments/11/lines', { token: deptMgrSession.token }),
      ]);

      if (detailRes.status !== 200 || linesRes.status !== 200) {
        throw new Error(`Failed reading DEP-CUT details/lines: detail=${detailRes.status}, lines=${linesRes.status}`);
      }

      const topLevelLines = detailRes.data?.data?.production_lines;
      const dedicatedLines = linesRes.data?.data;

      if (!Array.isArray(topLevelLines) || topLevelLines.length === 0 || !topLevelLines.some((l: any) => l.line_number === 'LINE-CUT-01')) {
        throw new Error('Expected top-level data.production_lines to contain LINE-CUT-01');
      }
      if (!Array.isArray(dedicatedLines) || dedicatedLines.length === 0 || !dedicatedLines.some((l: any) => l.line_number === 'LINE-CUT-01')) {
        throw new Error('Expected GET /api/departments/11/lines to contain LINE-CUT-01');
      }

      return `Confirmed consistent top-level data.production_lines contract (${topLevelLines[0].line_number}) matching /departments/11/lines`;
    });

    // 40. Scoped Assignable Users Endpoint & User Directory Boundary
    await executeTest(40, 'Department Scoped Assignable Users Endpoint & Boundary (HTTP)', 'API Contract', async () => {
      const { user: ordinaryUser, password } = await createTempUser('qa_ord40', [3]);
      try {
        const ordinarySession = await loginViaHttp(ordinaryUser.username, password);
        const [deptUsersRes, scopedOkRes, scopedCrossRes, scopedOrdinaryRes] = await Promise.all([
          apiRequest('/users', { token: deptMgrSession.token }),
          apiRequest('/departments/11/assignable-users', { token: deptMgrSession.token }),
          apiRequest('/departments/12/assignable-users', { token: deptMgrSession.token }),
          apiRequest('/departments/11/assignable-users', { token: ordinarySession.token }),
        ]);

        if (deptUsersRes.status !== 403) {
          throw new Error(`Expected HTTP 403 for deptuser on global /api/users, got ${deptUsersRes.status}`);
        }
        if (scopedOkRes.status !== 200 || !Array.isArray(scopedOkRes.data?.data)) {
          throw new Error(`Expected HTTP 200 on /departments/11/assignable-users, got ${scopedOkRes.status}`);
        }
        if (scopedCrossRes.status !== 403) {
          throw new Error(`Expected HTTP 403 on cross-dept /departments/12/assignable-users, got ${scopedCrossRes.status}`);
        }
        if (scopedOrdinaryRes.status !== 403) {
          throw new Error(`Expected HTTP 403 for ordinary user on /departments/11/assignable-users, got ${scopedOrdinaryRes.status}`);
        }

        const assignable = scopedOkRes.data.data;
        if (assignable.length === 0) {
          throw new Error('Expected non-empty active assignable users list');
        }
        const allowedKeys = new Set(['id', 'username', 'full_name', 'is_active']);
        for (const item of assignable) {
          const keys = Object.keys(item);
          if (keys.some((k) => !allowedKeys.has(k)) || keys.length !== 4) {
            throw new Error(`Assignable user payload exposed unexpected fields: [${keys.join(', ')}]`);
          }
          if (!item.is_active) {
            throw new Error('Inactive user leaked into assignable-users endpoint');
          }
        }

        return `Verified /users stays 403, /departments/11/assignable-users returns ${assignable.length} minimal active records (200), and cross-dept/ordinary requests return 403`;
      } finally {
        await cleanupTempUser(ordinaryUser.id);
      }
    });

    // 41. Department Manager Operational Update vs Restricted Fields
    await executeTest(41, 'Department Manager Operational Update vs Restricted Fields (HTTP)', 'API Contract', async () => {
      const origRes = await apiRequest('/departments/11', { token: adminSession.token });
      const origDept = origRes.data.data.department;

      try {
        // Operational-only payload (matching fixed DepartmentFormModal when canManageManager=false & canManageHierarchy=false) succeeds (200)
        const opOnlyRes = await apiRequest('/departments/11', {
          method: 'PUT',
          token: deptMgrSession.token,
          body: {
            name: origDept.name,
            description: origDept.description,
          },
        });
        if (opOnlyRes.status !== 200) {
          throw new Error(`Expected HTTP 200 for operational-only PUT /departments/11, got ${opOnlyRes.status}`);
        }

        // Restricted keys (parent_id / manager_id / status) still strictly return 403
        const restrictedRes = await apiRequest('/departments/11', {
          method: 'PUT',
          token: deptMgrSession.token,
          body: {
            name: origDept.name,
            description: origDept.description,
            parent_id: origDept.parent_id,
            manager_id: origDept.manager_id,
          },
        });
        if (restrictedRes.status !== 403) {
          throw new Error(`Expected HTTP 403 when parent_id/manager_id keys are included, got ${restrictedRes.status}`);
        }

        return 'Confirmed operational-only PUT returns 200 while restricted parent_id/manager_id fields remain blocked (403)';
      } finally {
        await query('UPDATE departments SET name = $1, description = $2 WHERE id = 11', [
          origDept.name,
          origDept.description,
        ]);
      }
    });

    // 42. Atomic Transaction Rollback on Failed Employee Transfer
    await executeTest(42, 'Atomic Transaction Rollback on Failed Employee Transfer', 'Department Module', async () => {
      const ts = Date.now().toString().slice(-4);
      const { user: tempEmp } = await createTempUser('qa_tx42', [3]);
      const deptA = await DepartmentService.createDepartment(
        { dept_code: `DEP-TX-A-${ts}`, name: 'TX Source Dept', manager_id: deptMgrSession.user.id },
        1,
        '127.0.0.1'
      );
      const deptB = await DepartmentService.createDepartment(
        { dept_code: `DEP-TX-B-${ts}`, name: 'TX Target Dept', manager_id: deptMgrSession.user.id },
        1,
        '127.0.0.1'
      );

      const originalAuditLog = AuditService.log;
      try {
        await DepartmentService.assignEmployee(
          deptA.id,
          { user_id: tempEmp.id, position_title: 'TX Operator', is_primary: true },
          1,
          '127.0.0.1'
        );

        // Simulate a mid-transaction failure after source DELETE + target INSERT (during transfer audit step)
        AuditService.log = async (params: any, queryFn?: any) => {
          if (params?.action === 'DEPT_EMPLOYEE_TRANSFER') {
            throw new Error('Simulated mid-transaction transfer failure');
          }
          return originalAuditLog.call(AuditService, params, queryFn);
        };

        let transferFailed = false;
        try {
          await DepartmentService.transferEmployee(
            deptA.id,
            deptB.id,
            tempEmp.id,
            'Promoted TX Operator',
            true,
            deptMgrSession.user.id,
            '127.0.0.1',
            ['departments:scoped:manage']
          );
        } catch {
          transferFailed = true;
        }

        if (!transferFailed) {
          throw new Error('Simulated transfer failure did not reject transferEmployee');
        }

        const [srcRoster, tgtRoster] = await Promise.all([
          query('SELECT position_title FROM department_employees WHERE department_id = $1 AND user_id = $2', [
            deptA.id,
            tempEmp.id,
          ]),
          query('SELECT position_title FROM department_employees WHERE department_id = $1 AND user_id = $2', [
            deptB.id,
            tempEmp.id,
          ]),
        ]);

        if (srcRoster.rowCount !== 1 || srcRoster.rows[0].position_title !== 'TX Operator') {
          throw new Error('Transaction rollback failed: employee was lost or altered in source department!');
        }
        if (tgtRoster.rowCount !== 0) {
          throw new Error('Transaction rollback failed: employee remained assigned in target department!');
        }

        return 'Verified atomic transaction rollback: failed transfer preserved original source assignment and rolled back target write';
      } finally {
        AuditService.log = originalAuditLog;
        await query('DELETE FROM department_employees WHERE user_id = $1', [tempEmp.id]);
        await query('DELETE FROM department_manager_history WHERE department_id IN ($1, $2)', [deptA.id, deptB.id]);
        await query('DELETE FROM departments WHERE id IN ($1, $2)', [deptA.id, deptB.id]);
        await cleanupTempUser(tempEmp.id);
      }
    });

    // Helper: Spin up a clean migrated isolated pg-mem database for destructive/constraint DB tests
    async function createIsolatedMigratedDb() {
      const memDb = createConfiguredPgMemDb();
      const driver = createPgMemDriver(memDb);
      const report = await runPendingMigrations(driver);
      return { memDb, driver, report };
    }

    async function expectQueryError(
      fn: () => Promise<any>,
      label: string
    ): Promise<Error> {
      try {
        await fn();
      } catch (err: any) {
        return err;
      }
      throw new Error(`Expected database constraint/error for [${label}], but query succeeded`);
    }

    // 43. Fresh Database Initialization via Tracked Migrations
    await executeTest(43, 'Fresh Database Initialization via Tracked Migrations (40 Tables)', 'WMS Schema & Migrations', async () => {
      const { driver, report } = await createIsolatedMigratedDb();

      const tablesRes = await driver.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      );
      const tableNames = new Set(tablesRes.rows.map((r) => r.table_name));
      const requiredWmsTables = [
        'schema_migrations',
        'warehouse_settings',
        'warehouses',
        'warehouse_locations',
        'warehouse_staff',
        'material_categories',
        'materials',
        'inventory_lots',
        'inventory_balances',
        'goods_receipts',
        'goods_receipt_items',
        'qc_inspections',
        'material_requisitions',
        'material_requisition_items',
        'stock_issues',
        'stock_issue_items',
        'material_returns',
        'warehouse_transfers',
        'warehouse_transfer_items',
        'stock_counts',
        'stock_count_items',
        'stock_adjustments',
        'reorder_requests',
        'warehouse_notifications',
        'stock_movements',
      ];
      for (const tbl of requiredWmsTables) {
        if (!tableNames.has(tbl)) {
          throw new Error(`Missing required Phase 03 table: ${tbl}`);
        }
      }
      if (tableNames.size !== 40) {
        throw new Error(`Expected 40 total tables (15 legacy + schema_migrations + 24 WMS), found ${tableNames.size}`);
      }

      const [migRows, wmsRoles, wmsPerms, whRows, defaultBins, settingsRows] = await Promise.all([
        driver.query<{ migration_type: string; name: string; checksum: string }>(
          `SELECT migration_type, name, checksum FROM schema_migrations`
        ),
        driver.query<{ role_name: string }>(
          `SELECT role_name FROM roles WHERE role_name IN ('Warehouse Manager','Warehouse Keeper','QC Manager','QC Inspector','Purchasing Manager','Production Manager','Finance Viewer')`
        ),
        driver.query<{ permission_key: string }>(
          `SELECT permission_key FROM permissions WHERE permission_key LIKE 'warehouse:%' OR permission_key LIKE 'inventory:%'`
        ),
        driver.query<{ warehouse_code: string; require_bin_tracking: boolean }>(
          `SELECT warehouse_code, require_bin_tracking FROM warehouses`
        ),
        driver.query<{ cnt: string }>(
          `SELECT count(*) as cnt FROM warehouse_locations WHERE is_default = TRUE AND location_code = 'DEFAULT'`
        ),
        driver.query<{ setting_key: string; setting_value: string }>(
          `SELECT setting_key, setting_value FROM warehouse_settings`
        ),
      ]);

      if (report.appliedMigrations.length !== 5 || report.appliedSeeds.length !== 5) {
        throw new Error(`Expected 5 applied migrations and 5 applied seeds, got ${report.appliedMigrations.length}/${report.appliedSeeds.length}`);
      }
      if (migRows.rowCount !== 10 || migRows.rows.some((r) => !r.checksum || r.checksum.length !== 64)) {
        throw new Error('schema_migrations entries missing or invalid SHA-256 checksums');
      }
      if (wmsRoles.rowCount !== 7) {
        throw new Error(`Expected 7 dedicated WMS roles, got ${wmsRoles.rowCount}`);
      }
      if (wmsPerms.rowCount !== 19) {
        throw new Error(`Expected 19 WMS/inventory permissions, got ${wmsPerms.rowCount}`);
      }
      if (whRows.rowCount !== 4 || parseInt(String(defaultBins.rows[0]?.cnt || '0'), 10) !== 4) {
        throw new Error('Expected 4 seeded warehouses each with an auto-created DEFAULT bin');
      }
      const settingsMap = new Map(settingsRows.rows.map((s) => [s.setting_key, s.setting_value]));
      if (settingsMap.get('adjustment_approval_threshold') !== 'UNCONFIGURED' || settingsMap.get('grn_over_delivery_tolerance_pct') !== '0') {
        throw new Error('Default warehouse_settings PARAM-01 / PARAM-03 mismatch');
      }

      return `Fresh init verified: ${tableNames.size} tables, 10 tracked schema_migrations rows, 7 WMS roles, 19 permissions, 4 warehouses + DEFAULT bins`;
    });

    // 44. Legacy 001-004 Database Upgrade to 005 (Bootstrap + Incremental Migration)
    await executeTest(44, 'Legacy 001-004 Upgrade to 005 via Baseline Bootstrap', 'WMS Schema & Migrations', async () => {
      const memDb = createConfiguredPgMemDb();
      const driver = createPgMemDriver(memDb);

      const allMigrations = loadSqlEntries(path.resolve(process.cwd(), 'database/migrations'), 'migration');
      const allSeeds = loadSqlEntries(path.resolve(process.cwd(), 'database/seeds'), 'seed');

      // Apply only legacy 001-004 without schema_migrations table
      for (const m of allMigrations.filter((x) => !x.name.startsWith('005_'))) {
        await driver.execScript(m.sql);
      }
      for (const s of allSeeds.filter((x) => !x.name.startsWith('005_'))) {
        await driver.execScript(s.sql);
      }

      const report = await runPendingMigrations(driver);
      if (report.bootstrappedLegacyEntries.length !== 8) {
        throw new Error(`Expected 8 bootstrapped legacy entries (001-004 migrations + seeds), got ${report.bootstrappedLegacyEntries.length}: [${report.bootstrappedLegacyEntries.join(', ')}]`);
      }
      if (report.appliedMigrations.length !== 1 || report.appliedMigrations[0] !== '005_create_warehouse_tables.sql') {
        throw new Error(`Expected only 005_create_warehouse_tables.sql to apply, got [${report.appliedMigrations.join(', ')}]`);
      }
      if (report.appliedSeeds.length !== 1 || report.appliedSeeds[0] !== '005_seed_warehouse_data.sql') {
        throw new Error(`Expected only 005_seed_warehouse_data.sql to apply, got [${report.appliedSeeds.join(', ')}]`);
      }

      const usersRes = await driver.query<{ cnt: string }>(`SELECT count(*) as cnt FROM users`);
      const whRes = await driver.query<{ cnt: string }>(`SELECT count(*) as cnt FROM warehouses`);
      if (parseInt(String(usersRes.rows[0]?.cnt || '0'), 10) < 3 || parseInt(String(whRes.rows[0]?.cnt || '0'), 10) !== 4) {
        throw new Error('Legacy user records lost or 005 warehouses missing after upgrade');
      }

      return `Upgraded legacy 001-004 DB cleanly: bootstrapped ${report.bootstrappedLegacyEntries.length} legacy entries and applied 005 schema + seed`;
    });

    // 45. Migration Idempotency Check
    await executeTest(45, 'Migration Runner Idempotency Check', 'WMS Schema & Migrations', async () => {
      const { driver } = await createIsolatedMigratedDb();
      const secondRun = await runPendingMigrations(driver);

      if (
        secondRun.appliedMigrations.length !== 0 ||
        secondRun.appliedSeeds.length !== 0 ||
        secondRun.skippedMigrations.length !== 5 ||
        secondRun.skippedSeeds.length !== 5
      ) {
        throw new Error(
          `Idempotency check failed: applied=(${secondRun.appliedMigrations.length},${secondRun.appliedSeeds.length}), skipped=(${secondRun.skippedMigrations.length},${secondRun.skippedSeeds.length})`
        );
      }

      return 'Verified idempotency: second run applied 0 migrations/seeds and skipped all 5 migrations + 5 seeds';
    });

    // 46. Migration Failure Handling & Rollback
    await executeTest(46, 'Migration Failure Handling, Error Propagation & Rollback', 'WMS Schema & Migrations', async () => {
      const { driver } = await createIsolatedMigratedDb();

      const failingMigration = {
        migrationId: '999',
        name: '999_failing_migration.sql',
        migrationType: 'migration' as const,
        filePath: 'synthetic://999_failing_migration.sql',
        sql: `
          INSERT INTO warehouse_settings (setting_key, setting_value, description)
          VALUES ('temp_rollback_key', 'should_not_persist', 'Rollback verification');
          INSERT INTO warehouses (warehouse_code, name, warehouse_type)
          VALUES ('WH-BAD', 'Bad Type Warehouse', 'INVALID_WAREHOUSE_TYPE');
        `,
        checksum: '999'.padEnd(64, '0'),
      };

      const err = await expectQueryError(
        () =>
          runPendingMigrations(driver, {
            migrationEntries: [failingMigration],
            seedEntries: [],
            includeSeeds: false,
          }),
        'failing migration error propagation'
      );

      if (!err.message.toLowerCase().includes('check') && !err.message.toLowerCase().includes('constraint') && !err.message.toLowerCase().includes('invalid')) {
        throw new Error(`Unexpected failure reason in rollback test: ${err.message}`);
      }

      const [trackedFailed, tempSetting] = await Promise.all([
        driver.query<{ cnt: string }>(
          `SELECT count(*) as cnt FROM schema_migrations WHERE name = '999_failing_migration.sql'`
        ),
        driver.query<{ cnt: string }>(
          `SELECT count(*) as cnt FROM warehouse_settings WHERE setting_key = 'temp_rollback_key'`
        ),
      ]);

      if (parseInt(String(trackedFailed.rows[0]?.cnt || '0'), 10) !== 0) {
        throw new Error('Failed migration was erroneously recorded in schema_migrations');
      }
      if (parseInt(String(tempSetting.rows[0]?.cnt || '0'), 10) !== 0) {
        throw new Error('Pre-failure DML statement was not rolled back when migration failed');
      }

      return `Verified failing migration surfaced (${err.message.slice(0, 60)}), left schema_migrations clean, and rolled back pre-failure write`;
    });

    // 47. Foreign Key & Composite (warehouse_id, location_id) Integrity
    await executeTest(47, 'Foreign Key & Composite Warehouse-Location Integrity', 'WMS Schema & Migrations', async () => {
      const { driver } = await createIsolatedMigratedDb();

      const whRows = await driver.query<{ id: number; warehouse_code: string }>(`SELECT id, warehouse_code FROM warehouses`);
      const whRaw = whRows.rows.find((w) => w.warehouse_code === 'WH-RAW')!;
      const whTrim = whRows.rows.find((w) => w.warehouse_code === 'WH-TRIM')!;
      const locRawRes = await driver.query<{ id: number }>(
        `SELECT id FROM warehouse_locations WHERE warehouse_id = $1 LIMIT 1`,
        [whRaw.id]
      );
      const locTrimRes = await driver.query<{ id: number }>(
        `SELECT id FROM warehouse_locations WHERE warehouse_id = $1 LIMIT 1`,
        [whTrim.id]
      );
      const matRes = await driver.query<{ id: number }>(`SELECT id FROM materials WHERE sku = 'PKG-CTN-EXP-L'`);
      const rawLocId = locRawRes.rows[0].id;
      const trimLocId = locTrimRes.rows[0].id;
      const matId = matRes.rows[0].id;

      // Invalid category_id on materials
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO materials (sku, name, category_id, base_uom) VALUES ('BAD-CAT-1', 'Bad Mat', 999999, 'pcs')`
          ),
        'invalid category_id'
      );

      // Cross-warehouse location mismatch on inventory_balances (whTrim + rawLocId)
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand)
             VALUES ($1, $2, $3, NULL, 'NONE', 'AVAILABLE', 10)`,
            [whTrim.id, rawLocId, matId]
          ),
        'composite FK cross-warehouse location on inventory_balances'
      );

      // Cross-warehouse mismatch on stock_adjustments
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO stock_adjustments (adjustment_number, warehouse_id, location_id, material_id, direction, quantity, reason_code, submitted_by)
             VALUES ('ADJ-XWH-1', $1, $2, $3, 'IN', 5, 'DATA_CORRECTION', 1)`,
            [whTrim.id, rawLocId, matId]
          ),
        'composite FK cross-warehouse location on stock_adjustments'
      );

      // Valid balance insert then test ON DELETE RESTRICT on warehouse
      await driver.query(
        `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand)
         VALUES ($1, $2, $3, NULL, 'NONE', 'AVAILABLE', 10)`,
        [whTrim.id, trimLocId, matId]
      );

      await expectQueryError(
        () => driver.query(`DELETE FROM warehouses WHERE id = $1`, [whTrim.id]),
        'ON DELETE RESTRICT warehouse referenced by stock balance'
      );

      return 'Verified invalid FKs, cross-warehouse location mismatch via composite FK, and ON DELETE RESTRICT protection';
    });

    // 48. Unique SKU & Unique (material_id, lot_number, roll_number) Constraints
    await executeTest(48, 'Unique Material SKU & Lot/Roll Uniqueness Enforcement', 'WMS Schema & Migrations', async () => {
      const { driver } = await createIsolatedMigratedDb();
      const fabMat = (await driver.query<{ id: number }>(`SELECT id FROM materials WHERE sku = 'FAB-COT-220-NVY'`)).rows[0];
      const catFab = (await driver.query<{ id: number }>(`SELECT id FROM material_categories WHERE category_code = 'CAT-FAB'`)).rows[0];

      // Duplicate SKU rejected
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO materials (sku, name, category_id, base_uom) VALUES ('FAB-COT-220-NVY', 'Dup Fabric', $1, 'meter')`,
            [catFab.id]
          ),
        'duplicate SKU'
      );

      // Non-roll lot (default roll_number = '') succeeds once, duplicate fails
      await driver.query(
        `INSERT INTO inventory_lots (material_id, lot_number, initial_qty, remaining_qty) VALUES ($1, 'LOT-2026-01', 100, 100)`,
        [fabMat.id]
      );
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO inventory_lots (material_id, lot_number, initial_qty, remaining_qty) VALUES ($1, 'LOT-2026-01', 50, 50)`,
            [fabMat.id]
          ),
        'duplicate (material_id, lot_number, empty roll_number)'
      );

      // Numbered roll on same lot succeeds once, duplicate fails
      await driver.query(
        `INSERT INTO inventory_lots (material_id, lot_number, roll_number, initial_qty, remaining_qty) VALUES ($1, 'LOT-2026-01', 'ROLL-A', 62.5, 62.5)`,
        [fabMat.id]
      );
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO inventory_lots (material_id, lot_number, roll_number, initial_qty, remaining_qty) VALUES ($1, 'LOT-2026-01', 'ROLL-A', 40, 40)`,
            [fabMat.id]
          ),
        'duplicate (material_id, lot_number, ROLL-A)'
      );

      return 'Verified UNIQUE(sku) and UNIQUE(material_id, lot_number, roll_number) for both roll-free and roll-tracked lots';
    });

    // 49. Optional Lot Balance Uniqueness via lot_key Normalization
    await executeTest(49, 'Optional Lot Balance Uniqueness (lot_key Normalization)', 'WMS Schema & Migrations', async () => {
      const { driver } = await createIsolatedMigratedDb();
      const whRaw = (await driver.query<{ id: number }>(`SELECT id FROM warehouses WHERE warehouse_code = 'WH-RAW'`)).rows[0];
      const loc = (await driver.query<{ id: number }>(`SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND is_default = TRUE`, [whRaw.id])).rows[0];
      const pkgMat = (await driver.query<{ id: number }>(`SELECT id FROM materials WHERE sku = 'PKG-CTN-EXP-L'`)).rows[0];
      const fabMat = (await driver.query<{ id: number }>(`SELECT id FROM materials WHERE sku = 'FAB-COT-220-NVY'`)).rows[0];

      const lot = (
        await driver.query<{ id: number }>(
          `INSERT INTO inventory_lots (material_id, lot_number, roll_number, initial_qty, remaining_qty)
           VALUES ($1, 'LOT-KEY-1', 'R1', 50, 50) RETURNING id`,
          [fabMat.id]
        )
      ).rows[0];

      // Invalid lot_key mismatches rejected by CHECK
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand)
             VALUES ($1, $2, $3, NULL, '123', 'AVAILABLE', 10)`,
            [whRaw.id, loc.id, pkgMat.id]
          ),
        'lot_id NULL with non-NONE lot_key'
      );
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand)
             VALUES ($1, $2, $3, $4, 'NONE', 'AVAILABLE', 10)`,
            [whRaw.id, loc.id, fabMat.id, lot.id]
          ),
        'non-null lot_id with NONE lot_key'
      );

      // Non-lot balance uniqueness
      await driver.query(
        `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand)
         VALUES ($1, $2, $3, NULL, 'NONE', 'AVAILABLE', 250)`,
        [whRaw.id, loc.id, pkgMat.id]
      );
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand)
             VALUES ($1, $2, $3, NULL, 'NONE', 'AVAILABLE', 10)`,
            [whRaw.id, loc.id, pkgMat.id]
          ),
        'duplicate lot-free inventory_balances row'
      );

      // Lot balance uniqueness
      await driver.query(
        `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand)
         VALUES ($1, $2, $3, $4, $5, 'AVAILABLE', 50)`,
        [whRaw.id, loc.id, fabMat.id, lot.id, String(lot.id)]
      );
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand)
             VALUES ($1, $2, $3, $4, $5, 'AVAILABLE', 20)`,
            [whRaw.id, loc.id, fabMat.id, lot.id, String(lot.id)]
          ),
        'duplicate lot-tracked inventory_balances row'
      );

      return 'Verified lot_key CHECK invariants and uniqueness across both NULL-lot and lot-tracked balances';
    });

    // 50. Negative Quantity Prevention
    await executeTest(50, 'Negative & Zero Quantity Prevention (DB CHECK Constraints)', 'WMS Schema & Migrations', async () => {
      const { driver } = await createIsolatedMigratedDb();
      const whRaw = (await driver.query<{ id: number }>(`SELECT id FROM warehouses WHERE warehouse_code = 'WH-RAW'`)).rows[0];
      const loc = (await driver.query<{ id: number }>(`SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND is_default = TRUE`, [whRaw.id])).rows[0];
      const pkgMat = (await driver.query<{ id: number }>(`SELECT id FROM materials WHERE sku = 'PKG-CTN-EXP-L'`)).rows[0];

      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand)
             VALUES ($1, $2, $3, NULL, 'NONE', 'AVAILABLE', -1)`,
            [whRaw.id, loc.id, pkgMat.id]
          ),
        'negative qty_on_hand'
      );

      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand, qty_reserved)
             VALUES ($1, $2, $3, NULL, 'NONE', 'AVAILABLE', 10, -0.5)`,
            [whRaw.id, loc.id, pkgMat.id]
          ),
        'negative qty_reserved'
      );

      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO inventory_lots (material_id, lot_number, initial_qty, remaining_qty)
             VALUES ($1, 'LOT-ZERO', 0, 0)`,
            [pkgMat.id]
          ),
        'zero initial_qty on inventory_lots'
      );

      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO stock_movements (movement_ref, material_id, warehouse_id, location_id, stock_status, direction, movement_type, quantity, balance_before, balance_after, source_document_type, source_document_id, actor_id)
             VALUES ('MOV-ZERO', $1, $2, $3, 'AVAILABLE', 'IN', 'RECEIPT', 0, 0, 0, 'GRN', 1, 1)`,
            [pkgMat.id, whRaw.id, loc.id]
          ),
        'zero quantity on stock_movements'
      );

      return 'Verified DB CHECK constraints reject negative balances and zero/negative movement & lot quantities';
    });

    // 51. Reserved Quantity Boundary & Dynamic Generated qty_available
    await executeTest(51, 'Reserved Quantity Cap & Generated qty_available Calculation', 'WMS Schema & Migrations', async () => {
      const { driver } = await createIsolatedMigratedDb();
      const whRaw = (await driver.query<{ id: number }>(`SELECT id FROM warehouses WHERE warehouse_code = 'WH-RAW'`)).rows[0];
      const loc = (await driver.query<{ id: number }>(`SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND is_default = TRUE`, [whRaw.id])).rows[0];
      const pkgMat = (await driver.query<{ id: number }>(`SELECT id FROM materials WHERE sku = 'PKG-CTN-EXP-L'`)).rows[0];

      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand, qty_reserved)
             VALUES ($1, $2, $3, NULL, 'NONE', 'AVAILABLE', 50, 60)`,
            [whRaw.id, loc.id, pkgMat.id]
          ),
        'qty_reserved > qty_on_hand on insert'
      );

      const ins = await driver.query<{ id: number; qty_available: string }>(
        `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand, qty_reserved)
         VALUES ($1, $2, $3, NULL, 'NONE', 'AVAILABLE', 100, 25)
         RETURNING id, qty_available`,
        [whRaw.id, loc.id, pkgMat.id]
      );
      if (Number(ins.rows[0].qty_available) !== 75) {
        throw new Error(`Expected initial qty_available = 75, got ${ins.rows[0].qty_available}`);
      }

      const upd = await driver.query<{ qty_available: string }>(
        `UPDATE inventory_balances SET qty_reserved = 60 WHERE id = $1 RETURNING qty_available`,
        [ins.rows[0].id]
      );
      if (Number(upd.rows[0].qty_available) !== 40) {
        throw new Error(`Expected updated qty_available = 40, got ${upd.rows[0].qty_available}`);
      }

      await expectQueryError(
        () =>
          driver.query(
            `UPDATE inventory_balances SET qty_reserved = 101 WHERE id = $1`,
            [ins.rows[0].id]
          ),
        'qty_reserved > qty_on_hand on update'
      );

      return 'Verified qty_reserved <= qty_on_hand CHECK and dynamic STORED generated column qty_available (75 -> 40)';
    });

    // 52. Receiving Quantity Reconciliation & QC Inspection Outcome Integrity
    await executeTest(52, 'GRN Receiving Reconciliation & QC Inspection Outcome CHECKs', 'WMS Schema & Migrations', async () => {
      const { driver } = await createIsolatedMigratedDb();
      const whQuar = (await driver.query<{ id: number }>(`SELECT id FROM warehouses WHERE warehouse_code = 'WH-QUAR'`)).rows[0];
      const loc = (await driver.query<{ id: number }>(`SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND is_default = TRUE`, [whQuar.id])).rows[0];
      const fabMat = (await driver.query<{ id: number }>(`SELECT id FROM materials WHERE sku = 'FAB-COT-220-NVY'`)).rows[0];

      const grn = (
        await driver.query<{ id: number }>(
          `INSERT INTO goods_receipts (grn_number, warehouse_id, supplier_name, received_by)
           VALUES ('GRN-TEST-01', $1, 'Apex Textile Mills', 1) RETURNING id`,
          [whQuar.id]
        )
      ).rows[0];

      // Mismatched reconciliation (60+10+10+10 = 90 != 100) rejected
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO goods_receipt_items (grn_id, warehouse_id, target_location_id, material_id, received_qty, accepted_qty, rejected_qty, damaged_qty, pending_inspection_qty)
             VALUES ($1, $2, $3, $4, 100, 60, 10, 10, 10)`,
            [grn.id, whQuar.id, loc.id, fabMat.id]
          ),
        'mismatched GRN line qty reconciliation'
      );

      // Exact reconciliation (70+5+5+20 = 100) accepted
      const grnItem = (
        await driver.query<{ id: number }>(
          `INSERT INTO goods_receipt_items (grn_id, warehouse_id, target_location_id, material_id, received_qty, accepted_qty, rejected_qty, damaged_qty, pending_inspection_qty, qc_status)
           VALUES ($1, $2, $3, $4, 100, 70, 5, 5, 20, 'PARTIALLY_PASSED') RETURNING id`,
          [grn.id, whQuar.id, loc.id, fabMat.id]
        )
      ).rows[0];

      // QC inspection outcome mismatch (15+2+1 = 18 != 20) rejected
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO qc_inspections (inspection_number, grn_item_id, warehouse_id, location_id, material_id, inspected_qty, passed_qty, rejected_qty, damaged_qty, outcome_status, inspector_id)
             VALUES ('QC-BAD-1', $1, $2, $3, $4, 20, 15, 2, 1, 'PARTIALLY_PASSED', 1)`,
            [grnItem.id, whQuar.id, loc.id, fabMat.id]
          ),
        'mismatched QC inspection outcome breakdown'
      );

      // Valid QC inspection outcome (15+3+2 = 20) accepted
      await driver.query(
        `INSERT INTO qc_inspections (inspection_number, grn_item_id, warehouse_id, location_id, material_id, inspected_qty, passed_qty, rejected_qty, damaged_qty, outcome_status, inspector_id)
         VALUES ('QC-OK-1', $1, $2, $3, $4, 20, 15, 3, 2, 'PARTIALLY_PASSED', 1)`,
        [grnItem.id, whQuar.id, loc.id, fabMat.id]
      );

      return 'Verified GRN line reconciliation (received = accepted+rejected+damaged+pending) and QC outcome reconciliation';
    });

    // 53. Warehouse Staff Multi-Warehouse Assignments & Constraints (PARAM-04)
    await executeTest(53, 'Warehouse Staff Multi-Warehouse Assignment & Constraints (PARAM-04)', 'WMS Schema & Migrations', async () => {
      const { driver } = await createIsolatedMigratedDb();
      const whRows = await driver.query<{ id: number; warehouse_code: string }>(`SELECT id, warehouse_code FROM warehouses`);
      const whRaw = whRows.rows.find((w) => w.warehouse_code === 'WH-RAW')!;
      const whTrim = whRows.rows.find((w) => w.warehouse_code === 'WH-TRIM')!;

      // Multi-warehouse assignment for same user succeeds
      await driver.query(
        `INSERT INTO warehouse_staff (warehouse_id, user_id, staff_role, is_primary, assigned_by)
         VALUES ($1, 2, 'WAREHOUSE_MANAGER', TRUE, 1)`,
        [whRaw.id]
      );
      await driver.query(
        `INSERT INTO warehouse_staff (warehouse_id, user_id, staff_role, is_primary, assigned_by)
         VALUES ($1, 2, 'WAREHOUSE_KEEPER', FALSE, 1)`,
        [whTrim.id]
      );

      // Duplicate (warehouse_id, user_id) rejected
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO warehouse_staff (warehouse_id, user_id, staff_role) VALUES ($1, 2, 'VIEWER')`,
            [whRaw.id]
          ),
        'duplicate warehouse_staff assignment'
      );

      // Invalid staff_role rejected
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO warehouse_staff (warehouse_id, user_id, staff_role) VALUES ($1, 3, 'SUPER_ADMIN')`,
            [whRaw.id]
          ),
        'invalid warehouse_staff role'
      );

      // effective_to < effective_from rejected
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO warehouse_staff (warehouse_id, user_id, staff_role, effective_from, effective_to)
             VALUES ($1, 3, 'VIEWER', '2026-05-10', '2026-05-01')`,
            [whRaw.id]
          ),
        'effective_to before effective_from'
      );

      return 'Verified multi-warehouse user mapping, UNIQUE(warehouse_id, user_id), role CHECK, and date range CHECK';
    });

    // 54. Global Weighted Average Cost Schema Integrity (PARAM-02) & Attributes JSON (DEC-03)
    await executeTest(54, 'Global Weighted Average Cost Schema (PARAM-02) & Attributes JSON (DEC-03)', 'WMS Schema & Migrations', async () => {
      const { driver } = await createIsolatedMigratedDb();

      const [matCols, balCols, whCols] = await Promise.all([
        driver.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'materials'`
        ),
        driver.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_balances'`
        ),
        driver.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'warehouses'`
        ),
      ]);

      const matColSet = new Set(matCols.rows.map((c) => c.column_name));
      for (const requiredCol of ['weighted_avg_cost', 'total_valued_qty', 'total_inventory_value', 'last_cost_updated_at', 'attributes_json']) {
        if (!matColSet.has(requiredCol)) {
          throw new Error(`Missing Global WAC / hybrid column "${requiredCol}" on materials`);
        }
      }

      // Confirm WAC valuation columns do NOT live per warehouse or per bin balance
      const balColSet = new Set(balCols.rows.map((c) => c.column_name));
      const whColSet = new Set(whCols.rows.map((c) => c.column_name));
      if (balColSet.has('weighted_avg_cost') || whColSet.has('weighted_avg_cost')) {
        throw new Error('Per-warehouse or per-balance weighted_avg_cost violates PARAM-02 Global WAC');
      }

      await expectQueryError(
        () => driver.query(`UPDATE materials SET weighted_avg_cost = -1.5 WHERE sku = 'FAB-COT-220-NVY'`),
        'negative weighted_avg_cost'
      );

      return 'Verified Global WAC columns exclusively on materials, hybrid attributes_json column, and non-negative cost CHECK';
    });

    // 55. Operational Workflow Constraints (FIFO Override, Transfer Discrepancy, Write-Off, Maker-Checker)
    await executeTest(55, 'Operational DB CHECKs: FIFO Override, Transfers & Write-Off Controls', 'WMS Schema & Migrations', async () => {
      const { driver } = await createIsolatedMigratedDb();
      const whRows = await driver.query<{ id: number; warehouse_code: string }>(`SELECT id, warehouse_code FROM warehouses`);
      const whRaw = whRows.rows.find((w) => w.warehouse_code === 'WH-RAW')!;
      const whTrim = whRows.rows.find((w) => w.warehouse_code === 'WH-TRIM')!;
      const locRaw = (await driver.query<{ id: number }>(`SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND is_default = TRUE`, [whRaw.id])).rows[0];
      const locTrim = (await driver.query<{ id: number }>(`SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND is_default = TRUE`, [whTrim.id])).rows[0];
      const fabMat = (await driver.query<{ id: number }>(`SELECT id FROM materials WHERE sku = 'FAB-COT-220-NVY'`)).rows[0];

      // Requisition + issue item checks
      const req = (
        await driver.query<{ id: number }>(
          `INSERT INTO material_requisitions (requisition_number, department_id, warehouse_id, requested_by)
           VALUES ('REQ-TEST-1', 1, $1, 1) RETURNING id`,
          [whRaw.id]
        )
      ).rows[0];

      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO material_requisition_items (requisition_id, material_id, requested_qty, issued_qty)
             VALUES ($1, $2, 10, 15)`,
            [req.id, fabMat.id]
          ),
        'issued_qty > requested_qty'
      );

      const reqItem = (
        await driver.query<{ id: number }>(
          `INSERT INTO material_requisition_items (requisition_id, material_id, requested_qty, issued_qty)
           VALUES ($1, $2, 20, 10) RETURNING id`,
          [req.id, fabMat.id]
        )
      ).rows[0];

      const issue = (
        await driver.query<{ id: number }>(
          `INSERT INTO stock_issues (issue_number, requisition_id, warehouse_id, department_id, issued_by)
           VALUES ('ISS-TEST-1', $1, $2, 1, 1) RETURNING id`,
          [req.id, whRaw.id]
        )
      ).rows[0];

      // FIFO override without reason blocked; empty reason blocked; valid reason accepted
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO stock_issue_items (issue_id, requisition_item_id, warehouse_id, location_id, material_id, issued_qty, fifo_overridden, fifo_override_reason)
             VALUES ($1, $2, $3, $4, $5, 10, TRUE, '')`,
            [issue.id, reqItem.id, whRaw.id, locRaw.id, fabMat.id]
          ),
        'fifo_overridden=TRUE with empty reason'
      );

      await driver.query(
        `INSERT INTO stock_issue_items (issue_id, requisition_item_id, warehouse_id, location_id, material_id, issued_qty, fifo_overridden, fifo_override_reason)
         VALUES ($1, $2, $3, $4, $5, 10, TRUE, 'SHADE_BATCH_CONTINUITY')`,
        [issue.id, reqItem.id, whRaw.id, locRaw.id, fabMat.id]
      );

      // Transfer discrepancy constraint: received + damaged + discrepancy <= dispatched
      const trf = (
        await driver.query<{ id: number }>(
          `INSERT INTO warehouse_transfers (transfer_number, transfer_type, source_warehouse_id, target_warehouse_id, created_by)
           VALUES ('TRF-TEST-1', 'INTER_WAREHOUSE', $1, $2, 1) RETURNING id`,
          [whRaw.id, whTrim.id]
        )
      ).rows[0];

      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO warehouse_transfer_items (transfer_id, source_warehouse_id, source_location_id, target_warehouse_id, target_location_id, material_id, dispatched_qty, received_qty, damaged_qty, discrepancy_qty)
             VALUES ($1, $2, $3, $4, $5, $6, 50, 45, 5, 5)`,
            [trf.id, whRaw.id, locRaw.id, whTrim.id, locTrim.id, fabMat.id]
          ),
        'transfer received+damaged+discrepancy > dispatched'
      );

      // Write-off unconditional Factory Manager + maker-checker enforcement
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO stock_adjustments (adjustment_number, warehouse_id, location_id, material_id, direction, quantity, reason_code, requires_factory_manager, submitted_by)
             VALUES ('ADJ-WO-BAD', $1, $2, $3, 'OUT', 5, 'WRITE_OFF', FALSE, 1)`,
            [whRaw.id, locRaw.id, fabMat.id]
          ),
        'WRITE_OFF with requires_factory_manager=FALSE'
      );

      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO stock_adjustments (adjustment_number, warehouse_id, location_id, material_id, direction, quantity, reason_code, requires_factory_manager, status, submitted_by, approved_by)
             VALUES ('ADJ-SELF-1', $1, $2, $3, 'OUT', 5, 'WRITE_OFF', TRUE, 'APPROVED_AND_POSTED', 2, 2)`,
            [whRaw.id, locRaw.id, fabMat.id]
          ),
        'self-approval approved_by = submitted_by'
      );

      return 'Verified DB CHECKs for FIFO override reason, requisition cap, transfer reconciliation, WRITE_OFF FM lock, and maker-checker';
    });

    // 56. Stock Movements Immutability, Linked Pair References & FOR UPDATE Support
    await executeTest(56, 'Stock Movements Immutability, Linked Transfer Refs & FOR UPDATE', 'WMS Schema & Migrations', async () => {
      const { driver } = await createIsolatedMigratedDb();
      const whRows = await driver.query<{ id: number; warehouse_code: string }>(`SELECT id, warehouse_code FROM warehouses`);
      const whRaw = whRows.rows.find((w) => w.warehouse_code === 'WH-RAW')!;
      const whTrim = whRows.rows.find((w) => w.warehouse_code === 'WH-TRIM')!;
      const locRaw = (await driver.query<{ id: number }>(`SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND is_default = TRUE`, [whRaw.id])).rows[0];
      const locTrim = (await driver.query<{ id: number }>(`SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND is_default = TRUE`, [whTrim.id])).rows[0];
      const pkgMat = (await driver.query<{ id: number }>(`SELECT id FROM materials WHERE sku = 'PKG-CTN-EXP-L'`)).rows[0];

      // Invalid linked_movement_id rejected by self-FK
      await expectQueryError(
        () =>
          driver.query(
            `INSERT INTO stock_movements (movement_ref, material_id, warehouse_id, location_id, stock_status, direction, movement_type, quantity, balance_before, balance_after, source_document_type, source_document_id, linked_movement_id, actor_id)
             VALUES ('MOV-BAD-LINK', $1, $2, $3, 'AVAILABLE', 'IN', 'TRANSFER_IN', 10, 0, 10, 'TRANSFER', 1, 999999, 1)`,
            [pkgMat.id, whTrim.id, locTrim.id]
          ),
        'invalid linked_movement_id'
      );

      // Valid linked OUT -> IN transfer pair
      const outMov = (
        await driver.query<{ id: number }>(
          `INSERT INTO stock_movements (movement_ref, material_id, warehouse_id, location_id, stock_status, direction, movement_type, quantity, balance_before, balance_after, source_warehouse_id, source_location_id, destination_warehouse_id, destination_location_id, source_document_type, source_document_id, source_document_ref, actor_id)
           VALUES ('MOV-TRF-OUT-1', $1, $2, $3, 'AVAILABLE', 'OUT', 'TRANSFER_OUT', 25, 100, 75, $2, $3, $4, $5, 'TRANSFER', 10, 'TRF-0010', 1)
           RETURNING id`,
          [pkgMat.id, whRaw.id, locRaw.id, whTrim.id, locTrim.id]
        )
      ).rows[0];

      const inMov = (
        await driver.query<{ id: number; linked_movement_id: number }>(
          `INSERT INTO stock_movements (movement_ref, material_id, warehouse_id, location_id, stock_status, direction, movement_type, quantity, balance_before, balance_after, source_warehouse_id, source_location_id, destination_warehouse_id, destination_location_id, source_document_type, source_document_id, source_document_ref, linked_movement_id, actor_id)
           VALUES ('MOV-TRF-IN-1', $1, $4, $5, 'AVAILABLE', 'IN', 'TRANSFER_IN', 25, 0, 25, $2, $3, $4, $5, 'TRANSFER', 10, 'TRF-0010', $6, 1)
           RETURNING id, linked_movement_id`,
          [pkgMat.id, whRaw.id, locRaw.id, whTrim.id, locTrim.id, outMov.id]
        )
      ).rows[0];

      if (inMov.linked_movement_id !== outMov.id) {
        throw new Error('Linked transfer movement pair reference mismatch');
      }

      // DB-boundary immutability: UPDATE and DELETE must both fail
      const updErr = await expectQueryError(
        () => driver.query(`UPDATE stock_movements SET quantity = 999 WHERE id = $1`, [outMov.id]),
        'UPDATE on immutable stock_movements'
      );
      const delErr = await expectQueryError(
        () => driver.query(`DELETE FROM stock_movements WHERE id = $1`, [inMov.id]),
        'DELETE on immutable stock_movements'
      );

      if (!updErr.message.includes('IMMUTABLE_LEDGER') || !delErr.message.includes('IMMUTABLE_LEDGER')) {
        throw new Error(`Expected IMMUTABLE_LEDGER guard errors, got UPDATE="${updErr.message}", DELETE="${delErr.message}"`);
      }

      // Verify SELECT ... FOR UPDATE query compatibility on inventory_balances
      const bal = (
        await driver.query<{ id: number }>(
          `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand)
           VALUES ($1, $2, $3, NULL, 'NONE', 'AVAILABLE', 40) RETURNING id`,
          [whTrim.id, locTrim.id, pkgMat.id]
        )
      ).rows[0];

      const lockedRow = await driver.query<{ qty_on_hand: string; qty_available: string }>(
        `SELECT qty_on_hand, qty_available FROM inventory_balances WHERE id = $1 FOR UPDATE`,
        [bal.id]
      );
      if (Number(lockedRow.rows[0]?.qty_available) !== 40) {
        throw new Error('SELECT ... FOR UPDATE returned unexpected inventory balance');
      }

      return 'Verified linked transfer pair, IMMUTABLE_LEDGER rejection on UPDATE/DELETE, and SELECT ... FOR UPDATE balance read';
    });

    // =========================================================================
    // PHASE 04: WMS Backend Services & REST API Integration Tests (#57 - #74)
    // =========================================================================
    const roleRowsRes = await query<{ id: number; role_name: string }>(`SELECT id, role_name FROM roles`);
    const roleIdByName = new Map(roleRowsRes.rows.map((r) => [r.role_name, r.id]));
    const wmsRunTag = Date.now().toString(36).toUpperCase().slice(-6);

    // Resolve seeded warehouse & material IDs
    const whSeedRes = await query<{ id: number; warehouse_code: string }>(`SELECT id, warehouse_code FROM warehouses`);
    const whRawId = whSeedRes.rows.find((w) => w.warehouse_code === 'WH-RAW')!.id;
    const whTrimId = whSeedRes.rows.find((w) => w.warehouse_code === 'WH-TRIM')!.id;
    const whFgId = whSeedRes.rows.find((w) => w.warehouse_code === 'WH-FG')!.id;

    const locRawRes = await query<{ id: number; location_code: string }>(
      `SELECT id, location_code FROM warehouse_locations WHERE warehouse_id = $1`,
      [whRawId]
    );
    const rawBinId = locRawRes.rows.find((l) => l.location_code === 'Z1-A01-R01-B01')!.id;
    const rawDockBinId = locRawRes.rows.find((l) => l.location_code === 'RCV-DOCK-01')!.id;
    const trimBinId = (
      await query<{ id: number }>(`SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND location_code = 'TRM-A01-R01-B01'`, [whTrimId])
    ).rows[0].id;

    // Create dedicated Phase 04 role users (kept deactivated in cleanup if they own ledger rows)
    const wmUser = await createTempUser(`wms_wm_${wmsRunTag}`, [roleIdByName.get('Warehouse Manager')!]);
    const wkRawUser = await createTempUser(`wms_wk_raw_${wmsRunTag}`, [roleIdByName.get('Warehouse Keeper')!]);
    const wkUnassignedUser = await createTempUser(`wms_wk_none_${wmsRunTag}`, [roleIdByName.get('Warehouse Keeper')!]);
    const qcUser = await createTempUser(`wms_qc_${wmsRunTag}`, [roleIdByName.get('QC Inspector')!]);
    const pmPurchUser = await createTempUser(`wms_purch_${wmsRunTag}`, [roleIdByName.get('Purchasing Manager')!]);
    const prodMgrUser = await createTempUser(`wms_prod_${wmsRunTag}`, [roleIdByName.get('Production Manager')!]);
    const finUser = await createTempUser(`wms_fin_${wmsRunTag}`, [roleIdByName.get('Finance Viewer')!]);
    const lineSupUser = await createTempUser(`wms_lsup_${wmsRunTag}`, [roleIdByName.get('Department User')!]);
    // Grant lineSupUser requisition create + view via temporary custom role permissions?
    // Assign Department User role + grant supervisor permissions cleanly on a temporary role
    const supRoleRes = await query<{ id: number }>(
      `INSERT INTO roles (role_name, description) VALUES ($1, 'Temp Line Supervisor Role') RETURNING id`,
      [`LineSupervisorTemp_${wmsRunTag}`]
    );
    const supRoleId = supRoleRes.rows[0].id;
    await query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT $1::int, id FROM permissions WHERE permission_key IN ('warehouse:view', 'inventory:requisition:create')`,
      [supRoleId]
    );
    await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [lineSupUser.user.id, supRoleId]);

    // Create an isolated production line under DEP-CUT (#11) supervised by lineSupUser
    const testHallRes = await query<{ id: number }>(`SELECT id FROM production_halls ORDER BY id ASC LIMIT 1`);
    const supLineRes = await query<{ id: number }>(
      `INSERT INTO production_lines (line_number, name, hall_id, department_id, production_type, supervisor_id, status)
       VALUES ($1, 'WMS Supervised Cut Line', $2, 11, 'Cutting', $3, 'active') RETURNING id`,
      [`WMS-LINE-${wmsRunTag}`, testHallRes.rows[0].id, lineSupUser.user.id]
    );
    const supLineId = supLineRes.rows[0].id;
    const otherLineRes = await query<{ id: number }>(
      `INSERT INTO production_lines (line_number, name, hall_id, department_id, production_type, status)
       VALUES ($1, 'WMS Unsupervised Sew Line', $2, 12, 'Sewing', 'active') RETURNING id`,
      [`WMS-SEW-${wmsRunTag}`, testHallRes.rows[0].id]
    );
    const otherLineId = otherLineRes.rows[0].id;

    // Assign wmUser & wkRawUser to WH-RAW only (initially NOT WH-TRIM)
    await apiRequest(`/warehouses/${whRawId}/staff`, {
      method: 'POST',
      token: adminSession.token,
      body: { user_id: wmUser.user.id, staff_role: 'WAREHOUSE_MANAGER', is_primary: true },
    });
    await apiRequest(`/warehouses/${whRawId}/staff`, {
      method: 'POST',
      token: adminSession.token,
      body: { user_id: wkRawUser.user.id, staff_role: 'WAREHOUSE_KEEPER', is_primary: true },
    });

    const wmSession = await loginViaHttp(wmUser.user.username, wmUser.password);
    const wkRawSession = await loginViaHttp(wkRawUser.user.username, wkRawUser.password);
    const wkNoneSession = await loginViaHttp(wkUnassignedUser.user.username, wkUnassignedUser.password);
    const qcSession = await loginViaHttp(qcUser.user.username, qcUser.password);
    const purchSession = await loginViaHttp(pmPurchUser.user.username, pmPurchUser.password);
    const prodMgrSession = await loginViaHttp(prodMgrUser.user.username, prodMgrUser.password);
    const finSession = await loginViaHttp(finUser.user.username, finUser.password);
    const lineSupSession = await loginViaHttp(lineSupUser.user.username, lineSupUser.password);

    // 57. WMS Authentication, Role Segregation & Read-Only Enforcement
    await executeTest(57, 'WMS Auth, Role Segregation & Valuation Isolation (HTTP)', 'WMS Phase 04 - RBAC', async () => {
      const unauth = await apiRequest('/warehouses');
      if (unauth.status !== 401) throw new Error(`Expected 401 for unauthenticated request, got ${unauth.status}`);

      // Finance Viewer can read valuation & balances, blocked (403) from mutations
      const [finVal, finBal, finGrnPost, finAdjPost] = await Promise.all([
        apiRequest('/inventory/valuation', { token: finSession.token }),
        apiRequest('/inventory/balances', { token: finSession.token }),
        apiRequest('/warehouse/grns', { method: 'POST', token: finSession.token, body: { warehouse_id: whRawId, supplier_name: 'X' } }),
        apiRequest('/warehouse/adjustments', {
          method: 'POST',
          token: finSession.token,
          body: { warehouse_id: whRawId, material_id: 1, direction: 'IN', quantity: 5, reason_code: 'CYCLE_COUNT_GAIN' },
        }),
      ]);
      if (finVal.status !== 200 || finBal.status !== 200) {
        throw new Error(`Finance Viewer read access failed: val=${finVal.status}, bal=${finBal.status}`);
      }
      if (finGrnPost.status !== 403 || finAdjPost.status !== 403) {
        throw new Error(`Finance Viewer mutation not rejected with 403: grn=${finGrnPost.status}, adj=${finAdjPost.status}`);
      }

      // Warehouse Keeper blocked from valuation, QC inspection, requisition approval, adjustment approval
      const [wkVal, wkQc, wkAdjApp, wkReqApp] = await Promise.all([
        apiRequest('/inventory/valuation', { token: wkRawSession.token }),
        apiRequest('/warehouse/qc/inspect', {
          method: 'POST',
          token: wkRawSession.token,
          body: { grn_item_id: 1, passed_qty: 1 },
        }),
        apiRequest('/warehouse/adjustments/1/approve', { method: 'POST', token: wkRawSession.token }),
        apiRequest('/warehouse/requisitions/1/approve', { method: 'POST', token: wkRawSession.token }),
      ]);
      if (wkVal.status !== 403 || wkQc.status !== 403 || wkAdjApp.status !== 403 || wkReqApp.status !== 403) {
        throw new Error(
          `Warehouse Keeper segregation violation: val=${wkVal.status}, qc=${wkQc.status}, adjApp=${wkAdjApp.status}, reqApp=${wkReqApp.status}`
        );
      }

      // Verify general summary endpoint masks financial valuation for Warehouse Keeper
      const wkSum = await apiRequest(`/inventory/summary?warehouse_id=${whRawId}`, { token: wkRawSession.token });
      if (wkSum.status !== 200 || wkSum.data?.data?.total_global_valuation !== undefined) {
        throw new Error('Warehouse Keeper should not receive total_global_valuation on summary endpoint');
      }

      // System Administrator blocked from routine operational approvals (QC, requisition approve, adjustment approve)
      const [admQc, admReqApp, admAdjApp, admReoApp] = await Promise.all([
        apiRequest('/warehouse/qc/inspect', { method: 'POST', token: adminSession.token, body: { grn_item_id: 1, passed_qty: 1 } }),
        apiRequest('/warehouse/requisitions/1/approve', { method: 'POST', token: adminSession.token }),
        apiRequest('/warehouse/adjustments/1/approve', { method: 'POST', token: adminSession.token }),
        apiRequest('/warehouse/reorders/1/approve', { method: 'POST', token: adminSession.token }),
      ]);
      if (admQc.status !== 403 || admReqApp.status !== 403 || admAdjApp.status !== 403 || admReoApp.status !== 403) {
        throw new Error(`SysAdmin operational segregation failed: qc=${admQc.status}, req=${admReqApp.status}, adj=${admAdjApp.status}, reo=${admReoApp.status}`);
      }

      return 'Verified 401, Finance Viewer read-only, Keeper restrictions + masked valuation, and SysAdmin operational approval blocks';
    });

    // 58. Multi-Warehouse Scope Isolation & Default Denial
    await executeTest(58, 'Warehouse Scope Isolation & Default Denial (HTTP 403)', 'WMS Phase 04 - Scope', async () => {
      // Login user profile confirms managed_warehouse_ids
      if (!wmSession.user.managed_warehouse_ids.includes(whRawId) || wmSession.user.managed_warehouse_ids.includes(whTrimId)) {
        throw new Error(`Expected WH-RAW only on wmUser profile, got ${JSON.stringify(wmSession.user.managed_warehouse_ids)}`);
      }

      // Assigned to WH-RAW: allowed on WH-RAW, denied (403) on WH-TRIM
      const [rawOk, trimDenied, trimGrnDenied, noneListRes, noneGetDenied] = await Promise.all([
        apiRequest(`/warehouses/${whRawId}`, { token: wkRawSession.token }),
        apiRequest(`/warehouses/${whTrimId}`, { token: wkRawSession.token }),
        apiRequest('/warehouse/grns', {
          method: 'POST',
          token: wkRawSession.token,
          body: { warehouse_id: whTrimId, supplier_name: 'Forbidden Supplier' },
        }),
        apiRequest('/warehouses', { token: wkNoneSession.token }),
        apiRequest(`/warehouses/${whRawId}`, { token: wkNoneSession.token }),
      ]);

      if (rawOk.status !== 200) throw new Error(`Assigned WH-RAW GET failed: ${rawOk.status}`);
      if (trimDenied.status !== 403 || trimGrnDenied.status !== 403) {
        throw new Error(`Cross-warehouse access to WH-TRIM not denied 403: view=${trimDenied.status}, grn=${trimGrnDenied.status}`);
      }
      if (noneListRes.status !== 200 || noneListRes.data.data.length !== 0) {
        throw new Error('Unassigned keeper should see empty scoped warehouse list');
      }
      if (noneGetDenied.status !== 403) {
        throw new Error(`Unassigned keeper denied by default failed: got ${noneGetDenied.status}`);
      }

      return 'Verified WH-RAW scoped keeper allowed on WH-RAW, denied 403 on WH-TRIM, and unassigned keeper denied 403';
    });

    // 59. Department Scope & Production Line Scope on Requisitions
    await executeTest(59, 'Department & Production Line Scope on Requisitions (HTTP 403/400)', 'WMS Phase 04 - Scope', async () => {
      // Dept Mgr (#11 DEP-CUT) blocked 403 creating requisition for DEP-SEW (#12)
      const crossDeptReq = await apiRequest('/warehouse/requisitions', {
        method: 'POST',
        token: deptMgrSession.token,
        body: { department_id: 12, warehouse_id: whRawId },
      });
      if (crossDeptReq.status !== 403) {
        throw new Error(`Expected 403 for cross-dept requisition creation, got ${crossDeptReq.status}`);
      }

      // Line supervisor MUST specify assigned production_line_id
      const supNoLine = await apiRequest('/warehouse/requisitions', {
        method: 'POST',
        token: lineSupSession.token,
        body: { department_id: 11, warehouse_id: whRawId },
      });
      if (supNoLine.status !== 403) {
        throw new Error(`Expected 403 when line supervisor omits production_line_id, got ${supNoLine.status}`);
      }

      // Line supervisor blocked 403 using unassigned line on dept 12
      const supOtherLine = await apiRequest('/warehouse/requisitions', {
        method: 'POST',
        token: lineSupSession.token,
        body: { department_id: 12, production_line_id: otherLineId, warehouse_id: whRawId },
      });
      if (supOtherLine.status !== 403) {
        throw new Error(`Expected 403 for unassigned line/dept, got ${supOtherLine.status}`);
      }

      // Cross-dept line spoofing (dept=11 paired with line belonging to dept=12) blocked 400
      const spoofedLine = await apiRequest('/warehouse/requisitions', {
        method: 'POST',
        token: adminSession.token.length ? prodMgrSession.token : prodMgrSession.token,
        body: { department_id: 11, production_line_id: otherLineId, warehouse_id: whRawId },
      });
      if (spoofedLine.status !== 400) {
        throw new Error(`Expected 400 on cross-department line spoofing, got ${spoofedLine.status}`);
      }

      return 'Verified Dept Mgr #11 scope, Line Supervisor line enforcement, and cross-dept line spoofing block (400)';
    });

    // 60. Warehouse Setup, Bin Tracking Configuration & Dynamic Staff Scope
    await executeTest(60, 'Warehouse Setup, DEFAULT Bin Enforcement & Dynamic Staff Scope', 'WMS Phase 04 - Master Data', async () => {
      // Warehouse Manager (scoped) cannot create a new top-level warehouse (403)
      const wmCreateWh = await apiRequest('/warehouses', {
        method: 'POST',
        token: wmSession.token,
        body: { warehouse_code: `WH-NO-${wmsRunTag}`, name: 'Denied', warehouse_type: 'GENERAL' },
      });
      if (wmCreateWh.status !== 403) {
        throw new Error(`Expected 403 when scoped Warehouse Manager creates top-level warehouse, got ${wmCreateWh.status}`);
      }

      // Factory Manager creates a new bin-tracked warehouse with auto DEFAULT bin
      const whRes = await apiRequest('/warehouses', {
        method: 'POST',
        token: managerSession.token,
        body: {
          warehouse_code: `WH-TEST-${wmsRunTag}`,
          name: 'QA Bin Managed Store',
          warehouse_type: 'GENERAL',
          require_bin_tracking: true,
        },
      });
      if (whRes.status !== 201 || whRes.data?.data?.default_location?.location_code !== 'DEFAULT') {
        throw new Error(`Warehouse creation/DEFAULT bin failed: ${whRes.rawText}`);
      }
      const tempWhId = whRes.data.data.warehouse.id;

      // Grant wmUser access to WH-TRIM temporarily, verify instant JWT access, then revoke cleanly
      await apiRequest(`/warehouses/${whTrimId}/staff`, {
        method: 'POST',
        token: adminSession.token,
        body: { user_id: wmUser.user.id, staff_role: 'WAREHOUSE_MANAGER' },
      });
      const trimGranted = await apiRequest(`/warehouses/${whTrimId}`, { token: wmSession.token });
      if (trimGranted.status !== 200) {
        throw new Error(`Expected instant 200 access to WH-TRIM after staff assignment, got ${trimGranted.status}`);
      }

      await apiRequest(`/warehouses/${whTrimId}/staff/${wmUser.user.id}`, {
        method: 'DELETE',
        token: adminSession.token,
      });
      const trimRevoked = await apiRequest(`/warehouses/${whTrimId}`, { token: wmSession.token });
      if (trimRevoked.status !== 403) {
        throw new Error(`Expected instant 403 revocation after staff removal, got ${trimRevoked.status}`);
      }

      // Create storage bin inside tempWhId and verify DEFAULT bin cannot be deactivated
      const binRes = await apiRequest(`/warehouses/${tempWhId}/locations`, {
        method: 'POST',
        token: adminSession.token,
        body: { location_code: 'BIN-01', name: 'Shelf 1', location_type: 'STORAGE' },
      });
      if (binRes.status !== 201) throw new Error(`Create bin failed: ${binRes.rawText}`);

      const defLocId = whRes.data.data.default_location.id;
      const deactDef = await apiRequest(`/warehouses/${tempWhId}/locations/${defLocId}/status`, {
        method: 'PUT',
        token: adminSession.token,
        body: { status: 'inactive' },
      });
      if (deactDef.status !== 409) {
        throw new Error(`Expected 409 blocking DEFAULT bin deactivation, got ${deactDef.status}`);
      }

      return 'Verified DEFAULT bin auto-creation, DEFAULT lock, global warehouse creation guard, and live staff scope grant/revocation';
    });

    // Shared Test Materials created cleanly in Test #61 for operational tests #62-#74
    let matFabQcId = 0; // requires_qc=true, lot=true, roll=true
    let matNoQcId = 0;  // requires_qc=false, lot=false, roll=false
    let matLotFifoId = 0; // requires_qc=false, lot=true, roll=false (for FIFO tests)
    let matFgId = 0;    // FINISHED_GOOD category, requires_qc=true

    // 61. Material Catalog, Attributes JSON (DEC-03), Reorder & QC Config
    await executeTest(61, 'Material Catalog, Hybrid Attributes JSON & Config Endpoints', 'WMS Phase 04 - Catalog', async () => {
      const catsRes = await apiRequest('/warehouse/categories', { token: wmSession.token });
      const cats: any[] = catsRes.data.data;
      const fabCatId = cats.find((c) => c.category_code === 'CAT-FAB').id;
      const pkgCatId = cats.find((c) => c.category_code === 'CAT-PKG').id;
      const trmCatId = cats.find((c) => c.category_code === 'CAT-TRM').id;
      const fgCatId = cats.find((c) => c.category_code === 'CAT-FG').id;

      const m1 = await apiRequest('/warehouse/materials', {
        method: 'POST',
        token: wmSession.token,
        body: {
          sku: `FAB-QA-${wmsRunTag}`,
          name: 'QA Denim 12oz Indigo',
          category_id: fabCatId,
          base_uom: 'meter',
          color: 'Indigo',
          attributes: { gsm: 405, width_cm: 150, weave: '3x1 Twill' },
          is_lot_tracked: true,
          is_roll_tracked: true,
          requires_qc_on_receipt: true,
          min_stock_level: 20,
          reorder_level: 50,
        },
      });
      const m2 = await apiRequest('/warehouse/materials', {
        method: 'POST',
        token: wmSession.token,
        body: {
          sku: `PKG-QA-${wmsRunTag}`,
          name: 'QA Export Polybag',
          category_id: pkgCatId,
          base_uom: 'pcs',
          attributes: { thickness_micron: 50 },
          is_lot_tracked: false,
          is_roll_tracked: false,
          requires_qc_on_receipt: false,
          min_stock_level: 10,
          reorder_level: 25,
        },
      });
      const m3 = await apiRequest('/warehouse/materials', {
        method: 'POST',
        token: wmSession.token,
        body: {
          sku: `TRM-FIFO-${wmsRunTag}`,
          name: 'QA Lot Thread Cone',
          category_id: trmCatId,
          base_uom: 'cone',
          is_lot_tracked: true,
          is_roll_tracked: false,
          requires_qc_on_receipt: false,
          min_stock_level: 5,
          reorder_level: 15,
        },
      });
      const m4 = await apiRequest('/warehouse/materials', {
        method: 'POST',
        token: wmSession.token,
        body: {
          sku: `FG-SHIRT-${wmsRunTag}`,
          name: 'QA Woven Polo Shirt',
          category_id: fgCatId,
          base_uom: 'pcs',
          is_lot_tracked: true,
          is_roll_tracked: false,
          requires_qc_on_receipt: true,
          min_stock_level: 0,
          reorder_level: 10,
        },
      });

      if (m1.status !== 201 || m2.status !== 201 || m3.status !== 201 || m4.status !== 201) {
        throw new Error(`Material creation failed: ${m1.status}, ${m2.status}, ${m3.status}, ${m4.status}`);
      }
      matFabQcId = m1.data.data.id;
      matNoQcId = m2.data.data.id;
      matLotFifoId = m3.data.data.id;
      matFgId = m4.data.data.id;

      // Test dedicated attributes, reorder & qc-config sub-endpoints
      const attrUpd = await apiRequest(`/warehouse/materials/${matFabQcId}/attributes`, {
        method: 'PUT',
        token: wmSession.token,
        body: { attributes: { gsm: 410, width_cm: 152, composition: '100% Cotton' } },
      });
      const reoUpd = await apiRequest(`/warehouse/materials/${matFabQcId}/reorder`, {
        method: 'PUT',
        token: wmSession.token,
        body: { min_stock_level: 25, reorder_level: 60 },
      });
      const qcUpd = await apiRequest(`/warehouse/materials/${matNoQcId}/qc-config`, {
        method: 'PUT',
        token: wmSession.token,
        body: { requires_qc_on_receipt: false },
      });
      if (attrUpd.status !== 200 || reoUpd.status !== 200 || qcUpd.status !== 200) {
        throw new Error(`Material config updates failed: attr=${attrUpd.status}, reo=${reoUpd.status}, qc=${qcUpd.status}`);
      }

      return `Created 4 test SKUs (${wmsRunTag}) and verified attributes_json, reorder, and QC config updates`;
    });

    // 62. GRN Equation, Over-Delivery Tolerance (PARAM-03), QC Quarantine (DEC-05) & Duplicate Post
    await executeTest(62, 'GRN Reconciliation Equation, Tolerance, Quarantine (DEC-05) & Anti-Double-Post', 'WMS Phase 04 - Receiving', async () => {
      try {
        // 1. Mismatch equation rejected 400
        const badEq = await apiRequest('/warehouse/grns', {
          method: 'POST',
          token: wkRawSession.token,
          body: {
            warehouse_id: whRawId,
            supplier_name: 'Denim Mill A',
            items: [
              {
                material_id: matNoQcId,
                target_location_id: rawBinId,
                received_qty: 100,
                accepted_qty: 60,
                rejected_qty: 10,
                damaged_qty: 0,
                pending_inspection_qty: 10, // sums 80 != 100
                unit_cost: 2,
              },
            ],
          },
        });
        if (badEq.status !== 400) throw new Error(`Expected 400 on GRN equation mismatch, got ${badEq.status}`);

        // 2. Over-delivery tolerance default 0% blocks 105 > 100 (400)
        const badOver = await apiRequest('/warehouse/grns', {
          method: 'POST',
          token: wkRawSession.token,
          body: {
            warehouse_id: whRawId,
            supplier_name: 'Denim Mill A',
            items: [
              {
                material_id: matNoQcId,
                target_location_id: rawBinId,
                expected_qty: 100,
                received_qty: 105,
                accepted_qty: 105,
                unit_cost: 2,
              },
            ],
          },
        });
        if (badOver.status !== 400) throw new Error(`Expected 400 on 0% over-delivery excess, got ${badOver.status}`);

        // 3. Configure tolerance to 10% -> 105 <= 110 succeeds
        await apiRequest('/warehouse/settings/grn_over_delivery_tolerance_pct', {
          method: 'PUT',
          token: adminSession.token,
          body: { setting_value: '10' },
        });
        const okOver = await apiRequest('/warehouse/grns', {
          method: 'POST',
          token: wkRawSession.token,
          body: {
            warehouse_id: whRawId,
            supplier_name: 'Denim Mill A',
            items: [
              {
                material_id: matNoQcId,
                target_location_id: rawBinId,
                expected_qty: 100,
                received_qty: 105,
                accepted_qty: 105,
                unit_cost: 2,
              },
            ],
          },
        });
        if (okOver.status !== 201) throw new Error(`Expected 201 with 10% tolerance, got ${okOver.status}: ${okOver.rawText}`);

        // 4. DEC-05 QC Quarantine check: matFabQcId requires QC -> accepted_qty > 0 blocked 400
        const qcBypassAttempt = await apiRequest('/warehouse/grns', {
          method: 'POST',
          token: wkRawSession.token,
          body: {
            warehouse_id: whRawId,
            supplier_name: 'Denim Mill A',
            items: [
              {
                material_id: matFabQcId,
                target_location_id: rawDockBinId,
                received_qty: 50,
                accepted_qty: 50,
                lot_number: `LOT-BYPASS-${wmsRunTag}`,
                roll_number: 'R01',
                unit_cost: 10,
              },
            ],
          },
        });
        if (qcBypassAttempt.status !== 400) {
          throw new Error(`Expected 400 preventing direct accepted_qty on QC material (DEC-05), got ${qcBypassAttempt.status}`);
        }

        // 5. Post okOver GRN, then verify duplicate post is blocked 409
        const grnId = okOver.data.data.grn.id;
        const post1 = await apiRequest(`/warehouse/grns/${grnId}/post`, { method: 'POST', token: wkRawSession.token });
        if (post1.status !== 200) throw new Error(`GRN post failed: ${post1.rawText}`);

        const post2 = await apiRequest(`/warehouse/grns/${grnId}/post`, { method: 'POST', token: wkRawSession.token });
        if (post2.status !== 409) throw new Error(`Expected 409 on duplicate GRN post, got ${post2.status}`);

        return 'Verified GRN equation check, PARAM-03 over-delivery tolerance, DEC-05 quarantine guard, and 409 double-post block';
      } finally {
        await apiRequest('/warehouse/settings/grn_over_delivery_tolerance_pct', {
          method: 'PUT',
          token: adminSession.token,
          body: { setting_value: '0' },
        });
      }
    });

    // 63. Partial PO Deliveries & Global Weighted Average Cost (PARAM-02)
    await executeTest(63, 'Partial Deliveries & Global Weighted Average Cost Calculation', 'WMS Phase 04 - Costing', async () => {
      // Currently matNoQcId has 105 units at unit_cost=2.00 -> total value = 210.00, WAC = 2.00
      const poRef = `PO-PARTIAL-${wmsRunTag}`;
      const g1 = await apiRequest('/warehouse/grns', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          warehouse_id: whRawId,
          supplier_name: 'Poly Supplier',
          po_reference: poRef,
          items: [
            {
              material_id: matNoQcId,
              target_location_id: rawBinId,
              expected_qty: 100,
              received_qty: 45,
              accepted_qty: 45,
              unit_cost: 4.0,
            },
          ],
        },
      });
      await apiRequest(`/warehouse/grns/${g1.data.data.grn.id}/post`, { method: 'POST', token: wkRawSession.token });

      // Total valued qty = 105 + 45 = 150; total value = 210 + 180 = 390 -> WAC = 390 / 150 = 2.60
      const g2 = await apiRequest('/warehouse/grns', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          warehouse_id: whRawId,
          supplier_name: 'Poly Supplier',
          po_reference: poRef,
          items: [
            {
              material_id: matNoQcId,
              target_location_id: rawBinId,
              expected_qty: 55,
              received_qty: 50,
              accepted_qty: 50,
              unit_cost: 5.0,
            },
          ],
        },
      });
      await apiRequest(`/warehouse/grns/${g2.data.data.grn.id}/post`, { method: 'POST', token: wkRawSession.token });

      // Total valued qty = 200; total value = 390 + 250 = 640 -> Global WAC = 3.20
      const valRes = await apiRequest('/inventory/valuation', { token: finSession.token });
      const matVal = valRes.data.data.materials.find((m: any) => m.id === matNoQcId);
      if (!matVal || Math.abs(Number(matVal.weighted_avg_cost) - 3.2) > 0.001 || Math.abs(Number(matVal.total_inventory_value) - 640) > 0.01) {
        throw new Error(`Expected WAC=3.20 and value=640 for matNoQcId, got ${JSON.stringify(matVal)}`);
      }

      const poListRes = await apiRequest(`/warehouse/grns?po_reference=${poRef}`, { token: wmSession.token });
      if (poListRes.data.data.length !== 2) {
        throw new Error(`Expected 2 partial GRNs under ${poRef}, got ${poListRes.data.data.length}`);
      }

      return 'Verified partial PO receipts under shared po_reference and exact Global WAC progression (2.00 -> 2.60 -> 3.20)';
    });

    // Keep track of QC released fabric roll lot ID for FIFO/Issue/Return/Transfer tests
    let fabLot1Id = 0;

    // 64. QC Inspection Workflow: Partial Release + Rejection Isolation + Anti-Double-Accept
    await executeTest(64, 'QC Inspection Partial Release, Rejection Isolation & Over-Inspect Guard', 'WMS Phase 04 - QC', async () => {
      const grnRes = await apiRequest('/warehouse/grns', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          warehouse_id: whRawId,
          supplier_name: 'Denim Mill B',
          items: [
            {
              material_id: matFabQcId,
              target_location_id: rawDockBinId,
              expected_qty: 100,
              received_qty: 100,
              pending_inspection_qty: 100,
              lot_number: `LOT-DEN-${wmsRunTag}`,
              roll_number: 'ROLL-01',
              shade_code: 'SH-A',
              unit_cost: 8.5,
            },
          ],
        },
      });
      const grnId = grnRes.data.data.grn.id;
      const grnItemId = grnRes.data.data.items[0].id;
      fabLot1Id = grnRes.data.data.items[0].lot_id;
      await apiRequest(`/warehouse/grns/${grnId}/post`, { method: 'POST', token: wkRawSession.token });

      // Pending QC queue shows 100 pending
      const pendingRes = await apiRequest(`/warehouse/qc/pending?warehouse_id=${whRawId}`, { token: qcSession.token });
      if (!pendingRes.data.data.some((i: any) => i.id === grnItemId && Number(i.pending_inspection_qty) === 100)) {
        throw new Error('Posted GRN item missing from QC pending queue');
      }

      // Warehouse Keeper blocked 403 from performing QC inspection
      const keeperQc = await apiRequest('/warehouse/qc/inspect', {
        method: 'POST',
        token: wkRawSession.token,
        body: { grn_item_id: grnItemId, passed_qty: 50 },
      });
      if (keeperQc.status !== 403) throw new Error(`Expected 403 for keeper QC inspection, got ${keeperQc.status}`);

      // Partial QC inspection #1: pass 70 into rawBinId, reject/damage 10 into DAMAGED (20 remain QUARANTINE)
      const qc1 = await apiRequest('/warehouse/qc/inspect', {
        method: 'POST',
        token: qcSession.token,
        body: {
          grn_item_id: grnItemId,
          passed_qty: 70,
          rejected_qty: 6,
          damaged_qty: 4,
          target_location_id: rawBinId,
          reject_stock_status: 'DAMAGED',
          notes: 'End-of-roll edge fray on 10m',
        },
      });
      if (qc1.status !== 200 || Number(qc1.data.data.remaining_pending_qty) !== 20) {
        throw new Error(`Partial QC #1 unexpected result: ${qc1.rawText}`);
      }

      // Attempt to over-inspect 25 (> 20 remaining) -> blocked 409 (prevents double-acceptance)
      const overQc = await apiRequest('/warehouse/qc/inspect', {
        method: 'POST',
        token: qcSession.token,
        body: { grn_item_id: grnItemId, passed_qty: 25, target_location_id: rawBinId },
      });
      if (overQc.status !== 409) throw new Error(`Expected 409 on over-inspection (> pending), got ${overQc.status}`);

      // Complete remaining 20 as passed -> total AVAILABLE = 90, DAMAGED = 10, QUARANTINE = 0
      const qc2 = await apiRequest('/warehouse/qc/inspect', {
        method: 'POST',
        token: qcSession.token,
        body: { grn_item_id: grnItemId, passed_qty: 20, target_location_id: rawBinId },
      });
      if (qc2.status !== 200 || Number(qc2.data.data.remaining_pending_qty) !== 0) {
        throw new Error(`Final QC #2 unexpected result: ${qc2.rawText}`);
      }

      const balRes = await apiRequest(`/inventory/balances?material_id=${matFabQcId}`, { token: wmSession.token });
      const availRow = balRes.data.data.find((b: any) => b.stock_status === 'AVAILABLE');
      const dmgRow = balRes.data.data.find((b: any) => b.stock_status === 'DAMAGED');
      const quarRow = balRes.data.data.find((b: any) => b.stock_status === 'QUARANTINE');

      if (Number(availRow?.qty_on_hand) !== 90 || Number(dmgRow?.qty_on_hand) !== 10 || Number(quarRow?.qty_on_hand || 0) !== 0) {
        throw new Error(`Unexpected post-QC buckets: avail=${availRow?.qty_on_hand}, dmg=${dmgRow?.qty_on_hand}, quar=${quarRow?.qty_on_hand}`);
      }

      return 'Verified partial QC release (70 + 20), 10m DAMAGED segregation, Keeper 403 guard, and 409 anti-double-acceptance';
    });

    // 65. Material Requisitions (DEC-06): Draft -> Submit -> Approve Reservation & Cancel Release
    await executeTest(65, 'Material Requisitions, Stock Reservation (DEC-06) & Cancel Release', 'WMS Phase 04 - Requisitions', async () => {
      // Line supervisor creates requisition for assigned line on DEP-CUT (#11)
      const createRes = await apiRequest('/warehouse/requisitions', {
        method: 'POST',
        token: lineSupSession.token,
        body: {
          department_id: 11,
          production_line_id: supLineId,
          warehouse_id: whRawId,
          reference_code: `JOB-${wmsRunTag}`,
          items: [{ material_id: matFabQcId, preferred_lot_id: fabLot1Id, requested_qty: 30 }],
        },
      });
      if (createRes.status !== 201) throw new Error(`Create req failed: ${createRes.rawText}`);
      const reqId = createRes.data.data.requisition.id;

      // Issuing before approval MUST be rejected 409
      const preIssue = await apiRequest('/warehouse/issues', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          requisition_id: reqId,
          items: [{ requisition_item_id: createRes.data.data.items[0].id, location_id: rawBinId, lot_id: fabLot1Id, issued_qty: 10 }],
        },
      });
      if (preIssue.status !== 409) throw new Error(`Expected 409 issuing DRAFT requisition, got ${preIssue.status}`);

      // Submit requisition -> Line Supervisor cannot approve (403)
      const subRes = await apiRequest(`/warehouse/requisitions/${reqId}/submit`, { method: 'POST', token: lineSupSession.token });
      if (subRes.status !== 200) throw new Error(`Submit req failed: ${subRes.rawText}`);

      const supApprove = await apiRequest(`/warehouse/requisitions/${reqId}/approve`, { method: 'POST', token: lineSupSession.token });
      if (supApprove.status !== 403) throw new Error(`Expected 403 when line supervisor approves own req, got ${supApprove.status}`);

      // Department Manager (#11) approves -> atomically reserves 30m of matFabQcId
      const appRes = await apiRequest(`/warehouse/requisitions/${reqId}/approve`, { method: 'POST', token: deptMgrSession.token });
      if (appRes.status !== 200 || appRes.data.data.status !== 'APPROVED') {
        throw new Error(`Dept Mgr approve failed: ${appRes.rawText}`);
      }

      const resCheck = await apiRequest(`/inventory/reserved?material_id=${matFabQcId}`, { token: wkRawSession.token });
      if (Number(resCheck.data.data[0]?.qty_reserved) !== 30 || Number(resCheck.data.data[0]?.qty_available) !== 60) {
        throw new Error(`Expected reserved=30 & available=60, got ${resCheck.rawText}`);
      }

      // Cancel APPROVED requisition -> releases reservation back to 0 reserved / 90 available
      const cancelRes = await apiRequest(`/warehouse/requisitions/${reqId}/cancel`, { method: 'POST', token: deptMgrSession.token });
      if (cancelRes.status !== 200 || cancelRes.data.data.status !== 'CANCELLED') {
        throw new Error(`Cancel req failed: ${cancelRes.rawText}`);
      }
      const afterCancel = await apiRequest(`/inventory/available?material_id=${matFabQcId}`, { token: wkRawSession.token });
      if (Number(afterCancel.data.data[0]?.qty_available) !== 90 || Number(afterCancel.data.data[0]?.qty_reserved) !== 0) {
        throw new Error(`Cancel did not release reservation: ${afterCancel.rawText}`);
      }

      return 'Verified pre-approval issue block (409), approval atomic reservation (30 reserved), and cancel release';
    });

    // Track stock_issue_id for Test #67 Return traceability
    let testIssueId = 0;

    // 66. Stock Issuing: Partial Issues, Reservation Guard, Advisory FIFO (DEC-04) & Low-Stock Alert
    await executeTest(66, 'Stock Issuing, Partial Issue, Advisory FIFO Override (DEC-04) & Low Stock Alert', 'WMS Phase 04 - Issuing', async () => {
      // Receive 2 lots of matLotFifoId (reorder_level = 15) with distinct received_at timestamps to test Advisory FIFO
      const olderGrn = await apiRequest('/warehouse/grns', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          warehouse_id: whRawId,
          supplier_name: 'Thread Vendor',
          items: [
            {
              material_id: matLotFifoId,
              target_location_id: rawBinId,
              received_qty: 12,
              accepted_qty: 12,
              lot_number: `FIFO-OLD-${wmsRunTag}`,
              unit_cost: 3,
            },
          ],
        },
      });
      await apiRequest(`/warehouse/grns/${olderGrn.data.data.grn.id}/post`, { method: 'POST', token: wkRawSession.token });
      const oldLotId = olderGrn.data.data.items[0].lot_id;
      await query(`UPDATE inventory_lots SET received_at = $1 WHERE id = $2`, [
        new Date(Date.now() - 5 * 86400 * 1000),
        oldLotId,
      ]);

      const newerGrn = await apiRequest('/warehouse/grns', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          warehouse_id: whRawId,
          supplier_name: 'Thread Vendor',
          items: [
            {
              material_id: matLotFifoId,
              target_location_id: rawBinId,
              received_qty: 10,
              accepted_qty: 10,
              lot_number: `FIFO-NEW-${wmsRunTag}`,
              unit_cost: 3,
            },
          ],
        },
      });
      await apiRequest(`/warehouse/grns/${newerGrn.data.data.grn.id}/post`, { method: 'POST', token: wkRawSession.token });
      const newLotId = newerGrn.data.data.items[0].lot_id;

      // Create + submit + approve requisition for 10 cones of matLotFifoId + 20m of matFabQcId
      const reqRes = await apiRequest('/warehouse/requisitions', {
        method: 'POST',
        token: lineSupSession.token,
        body: {
          department_id: 11,
          production_line_id: supLineId,
          warehouse_id: whRawId,
          items: [
            { material_id: matLotFifoId, requested_qty: 10 },
            { material_id: matFabQcId, requested_qty: 20 },
          ],
        },
      });
      const reqId = reqRes.data.data.requisition.id;
      const reqItemFifoId = reqRes.data.data.items[0].id;
      const reqItemFabId = reqRes.data.data.items[1].id;
      await apiRequest(`/warehouse/requisitions/${reqId}/submit`, { method: 'POST', token: lineSupSession.token });
      await apiRequest(`/warehouse/requisitions/${reqId}/approve`, { method: 'POST', token: deptMgrSession.token });

      // Attempt to issue newer lot WITHOUT fifo_override_reason -> blocked 400
      const fifoNoReason = await apiRequest('/warehouse/issues', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          requisition_id: reqId,
          items: [{ requisition_item_id: reqItemFifoId, location_id: rawBinId, lot_id: newLotId, issued_qty: 8 }],
        },
      });
      if (fifoNoReason.status !== 400) {
        throw new Error(`Expected 400 when overriding FIFO without reason (DEC-04), got ${fifoNoReason.status}`);
      }

      // Issue newer lot WITH explicit fifo_override_reason + partial 15m of matFabQcId
      const issue1 = await apiRequest('/warehouse/issues', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          requisition_id: reqId,
          items: [
            {
              requisition_item_id: reqItemFifoId,
              location_id: rawBinId,
              lot_id: newLotId,
              issued_qty: 8,
              fifo_override_reason: 'DYE_LOT_MATCH_FOR_STYLE',
            },
            {
              requisition_item_id: reqItemFabId,
              location_id: rawBinId,
              lot_id: fabLot1Id,
              issued_qty: 15,
            },
          ],
        },
      });
      if (issue1.status !== 201 || issue1.data.data.requisition_status !== 'PARTIALLY_ISSUED') {
        throw new Error(`Partial stock issue #1 unexpected response: ${issue1.rawText}`);
      }
      testIssueId = issue1.data.data.issue.id;

      // Attempt to over-issue remaining requisition qty (request remaining 2 cones, ask for 5) -> blocked 409
      const overIssue = await apiRequest('/warehouse/issues', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          requisition_id: reqId,
          items: [{ requisition_item_id: reqItemFifoId, location_id: rawBinId, lot_id: oldLotId, issued_qty: 5 }],
        },
      });
      if (overIssue.status !== 409) throw new Error(`Expected 409 on over-issue, got ${overIssue.status}`);

      // Complete remaining 2 cones + 5m -> requisition becomes FULFILLED and total avail of matLotFifoId drops to 12 <= 15 (LOW_STOCK alert)
      const issue2 = await apiRequest('/warehouse/issues', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          requisition_id: reqId,
          items: [
            { requisition_item_id: reqItemFifoId, location_id: rawBinId, lot_id: oldLotId, issued_qty: 2 },
            { requisition_item_id: reqItemFabId, location_id: rawBinId, lot_id: fabLot1Id, issued_qty: 5 },
          ],
        },
      });
      if (issue2.status !== 201 || issue2.data.data.requisition_status !== 'FULFILLED') {
        throw new Error(`Partial stock issue #2 completion failed: ${issue2.rawText}`);
      }

      // Verify LOW_STOCK notification generated for matLotFifoId
      const notifRes = await apiRequest('/warehouse/notifications', { token: wmSession.token });
      const lowAlert = notifRes.data.data.find(
        (n: any) => n.notification_type === 'LOW_STOCK' && n.entity_id === String(matLotFifoId)
      );
      if (!lowAlert) throw new Error('Expected LOW_STOCK alert for matLotFifoId after balance dropped <= reorder_level');

      return 'Verified DEC-04 advisory FIFO block (400) + audited override, partial/full issuing (FULFILLED), over-issue 409 guard, and LOW_STOCK alert';
    });

    // 67. Material Returns & Cumulative Issue Traceability Cap
    await executeTest(67, 'Material Returns Routing (AVAILABLE/DAMAGED/SCRAP) & Cumulative Return Cap', 'WMS Phase 04 - Returns', async () => {
      // testIssueId issued 15m of matFabQcId (fabLot1Id). Return 3m USABLE_SURPLUS + 2m WASTE_SCRAP
      const ret1 = await apiRequest('/warehouse/returns', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          department_id: 11,
          production_line_id: supLineId,
          stock_issue_id: testIssueId,
          warehouse_id: whRawId,
          target_location_id: rawBinId,
          material_id: matFabQcId,
          lot_id: fabLot1Id,
          returned_qty: 3,
          return_condition: 'USABLE_SURPLUS',
        },
      });
      const ret2 = await apiRequest('/warehouse/returns', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          department_id: 11,
          production_line_id: supLineId,
          stock_issue_id: testIssueId,
          warehouse_id: whRawId,
          target_location_id: rawDockBinId,
          material_id: matFabQcId,
          lot_id: fabLot1Id,
          returned_qty: 2,
          return_condition: 'WASTE_SCRAP',
        },
      });
      if (ret1.status !== 201 || ret2.status !== 201) {
        throw new Error(`Material return failed: r1=${ret1.status}, r2=${ret2.status}`);
      }

      // Attempt to return 11 more against testIssueId (cumulative 3+2+11=16 > 15 issued) -> blocked 409
      const overRet = await apiRequest('/warehouse/returns', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          department_id: 11,
          stock_issue_id: testIssueId,
          warehouse_id: whRawId,
          target_location_id: rawBinId,
          material_id: matFabQcId,
          returned_qty: 11,
          return_condition: 'DAMAGED',
        },
      });
      if (overRet.status !== 409) throw new Error(`Expected 409 when cumulative return exceeds issued qty, got ${overRet.status}`);

      return 'Verified USABLE_SURPLUS -> AVAILABLE, WASTE_SCRAP -> SCRAP, and 409 cumulative return cap against Stock Issue';
    });

    // 68. Internal Bin Move & 2-Step Inter-Warehouse Transfer (IN_TRANSIT + Discrepancy)
    await executeTest(68, 'Internal Bin Move & 2-Step Inter-Warehouse Transfer (IN_TRANSIT & Discrepancy)', 'WMS Phase 04 - Transfers', async () => {
      // Snapshot WAC of matNoQcId before transfers (must remain unchanged)
      const valBefore = await apiRequest('/inventory/valuation', { token: finSession.token });
      const wacBefore = Number(valBefore.data.data.materials.find((m: any) => m.id === matNoQcId).weighted_avg_cost);

      // 1. Internal Bin Move (rawBinId -> rawDockBinId) of 20 units
      const binMove = await apiRequest('/warehouse/transfers/internal', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          warehouse_id: whRawId,
          items: [{ source_location_id: rawBinId, target_location_id: rawDockBinId, material_id: matNoQcId, quantity: 20 }],
        },
      });
      if (binMove.status !== 201 || binMove.data.data.transfer.status !== 'RECEIVED') {
        throw new Error(`Internal bin move failed: ${binMove.rawText}`);
      }

      // 2. Inter-Warehouse Transfer Step 1: Dispatch 30 units of matNoQcId from WH-RAW to WH-TRIM
      const dispRes = await apiRequest('/warehouse/transfers/dispatch', {
        method: 'POST',
        token: wkRawSession.token,
        body: {
          source_warehouse_id: whRawId,
          target_warehouse_id: whTrimId,
          items: [{ source_location_id: rawBinId, target_location_id: trimBinId, material_id: matNoQcId, dispatched_qty: 30 }],
        },
      });
      if (dispRes.status !== 201 || dispRes.data.data.transfer.status !== 'IN_TRANSIT') {
        throw new Error(`Inter-warehouse dispatch failed: ${dispRes.rawText}`);
      }
      const trfId = dispRes.data.data.transfer.id;
      const trfItemId = dispRes.data.data.items[0].id;

      // Confirm target IN_TRANSIT = 30 and available at WH-TRIM = 0
      const trimBalRes = await apiRequest(`/inventory/balances?warehouse_id=${whTrimId}&material_id=${matNoQcId}`, { token: managerSession.token });
      const transitBal = trimBalRes.data.data.find((b: any) => b.stock_status === 'IN_TRANSIT');
      const trimAvail = trimBalRes.data.data.find((b: any) => b.stock_status === 'AVAILABLE');
      if (Number(transitBal?.qty_on_hand) !== 30 || Number(trimAvail?.qty_on_hand || 0) !== 0) {
        throw new Error(`Expected 30 IN_TRANSIT and 0 AVAILABLE at WH-TRIM before receive, got ${trimBalRes.rawText}`);
      }

      // Scoped WH-RAW keeper cannot receive into WH-TRIM (403)
      const wrongReceiver = await apiRequest(`/warehouse/transfers/${trfId}/receive`, {
        method: 'POST',
        token: wkRawSession.token,
        body: { items: [{ transfer_item_id: trfItemId, received_qty: 28, damaged_qty: 2 }] },
      });
      if (wrongReceiver.status !== 403) {
        throw new Error(`Expected 403 when WH-RAW keeper receives for WH-TRIM, got ${wrongReceiver.status}`);
      }

      // Factory Manager intentionally lacks operational inventory:transfer -> 403
      const fmTransferBlock = await apiRequest(`/warehouse/transfers/${trfId}/receive`, {
        method: 'POST',
        token: managerSession.token,
        body: { items: [{ transfer_item_id: trfItemId, received_qty: 28, damaged_qty: 2, discrepancy_qty: 0 }] },
      });
      if (fmTransferBlock.status !== 403) {
        throw new Error(`Expected 403 for Factory Manager without inventory:transfer, got ${fmTransferBlock.status}`);
      }

      // Grant Warehouse Manager temporary scope to WH-TRIM to receive incoming transfer
      await apiRequest(`/warehouses/${whTrimId}/staff`, {
        method: 'POST',
        token: adminSession.token,
        body: { user_id: wmUser.user.id, staff_role: 'WAREHOUSE_MANAGER', is_primary: false },
      });

      try {
        // Scoped WH-TRIM Warehouse Manager receives transfer with transit damage (28 AVAILABLE + 2 DAMAGED = 30) -> RECEIVED_WITH_DISCREPANCY
        const rcvRes = await apiRequest(`/warehouse/transfers/${trfId}/receive`, {
          method: 'POST',
          token: wmSession.token,
          body: { items: [{ transfer_item_id: trfItemId, received_qty: 28, damaged_qty: 2, discrepancy_qty: 0 }] },
        });
        if (rcvRes.status !== 200 || rcvRes.data.data.transfer.status !== 'RECEIVED_WITH_DISCREPANCY') {
          throw new Error(`Transfer receive with discrepancy failed: ${rcvRes.rawText}`);
        }

        // Verify Global WAC remained identical across both transfers
        const valAfter = await apiRequest('/inventory/valuation', { token: finSession.token });
        const wacAfter = Number(valAfter.data.data.materials.find((m: any) => m.id === matNoQcId).weighted_avg_cost);
        if (Math.abs(wacAfter - wacBefore) > 0.0001) {
          throw new Error(`Transfers must preserve Global WAC: before=${wacBefore}, after=${wacAfter}`);
        }

        return 'Verified atomic internal bin move, 2-step IN_TRANSIT custody, target scope guard, discrepancy receipt, and Global WAC preservation';
      } finally {
        await apiRequest(`/warehouses/${whTrimId}/staff/${wmUser.user.id}`, {
          method: 'DELETE',
          token: adminSession.token,
        });
      }
    });

    // 69. Physical Stock Counts: Snapshot, Variance Entry & Maker-Checker Approval
    await executeTest(69, 'Physical Stock Count Snapshot, Variance Posting & Maker-Checker', 'WMS Phase 04 - Stock Counts', async () => {
      try {
        // Configure adjustment threshold to 500 so Warehouse Manager can approve small cycle count variance (e.g. 2 * 3.20 = 6.40)
        await apiRequest('/warehouse/settings/adjustment_approval_threshold', {
          method: 'PUT',
          token: adminSession.token,
          body: { setting_value: '500' },
        });

        // Warehouse Keeper creates cycle count for matNoQcId at WH-RAW (where rawDockBinId has 20 units)
        const cntCreate = await apiRequest('/warehouse/counts', {
          method: 'POST',
          token: wkRawSession.token,
          body: { warehouse_id: whRawId, count_type: 'CYCLE', material_id: matNoQcId, location_id: rawDockBinId },
        });
        if (cntCreate.status !== 201 || cntCreate.data.data.items.length !== 1) {
          throw new Error(`Cycle count snapshot failed: ${cntCreate.rawText}`);
        }
        const countId = cntCreate.data.data.stock_count.id;
        const countItem = cntCreate.data.data.items[0]; // system_qty = 20

        // Record counted_qty = 18 (variance = -2)
        const recRes = await apiRequest(`/warehouse/counts/${countId}/items`, {
          method: 'PUT',
          token: wkRawSession.token,
          body: { items: [{ stock_count_item_id: countItem.id, counted_qty: 18 }] },
        });
        if (recRes.status !== 200 || Number(recRes.data.data[0].variance_qty) !== -2) {
          throw new Error(`Expected variance_qty = -2, got ${recRes.rawText}`);
        }

        // Submit for review
        await apiRequest(`/warehouse/counts/${countId}/submit`, { method: 'POST', token: wkRawSession.token });

        // Warehouse Keeper blocked 403 from approving
        const wkApprove = await apiRequest(`/warehouse/counts/${countId}/approve`, { method: 'POST', token: wkRawSession.token });
        if (wkApprove.status !== 403) throw new Error(`Expected 403 for keeper count approval, got ${wkApprove.status}`);

        // Warehouse Manager (different user, within threshold) approves -> creates adjustment + movement -> bin qty becomes 18
        const wmApprove = await apiRequest(`/warehouse/counts/${countId}/approve`, { method: 'POST', token: wmSession.token });
        if (wmApprove.status !== 200 || wmApprove.data.data.adjustments.length !== 1 || wmApprove.data.data.movements.length !== 1) {
          throw new Error(`Stock count approval failed: ${wmApprove.rawText}`);
        }

        const balCheck = await apiRequest(`/inventory/balances?warehouse_id=${whRawId}&location_id=${rawDockBinId}&material_id=${matNoQcId}`, { token: wmSession.token });
        if (Number(balCheck.data.data[0]?.qty_on_hand) !== 18) {
          throw new Error(`Expected balance 18 after count approval, got ${balCheck.rawText}`);
        }

        return 'Verified cycle count snapshot, -2 variance recording, Keeper 403 block, and Manager variance posting via adjustment+ledger';
      } finally {
        await apiRequest('/warehouse/settings/adjustment_approval_threshold', {
          method: 'PUT',
          token: adminSession.token,
          body: { setting_value: 'UNCONFIGURED' },
        });
      }
    });

    // 70. Adjustment Threshold Policy (PARAM-01 UNCONFIGURED, High Threshold, WRITE_OFF DEC-08, Self-Approval Block)
    await executeTest(70, 'Adjustment Policy: UNCONFIGURED, Thresholds, WRITE_OFF (DEC-08) & Maker-Checker', 'WMS Phase 04 - Adjustments', async () => {
      try {
        // 1. Default UNCONFIGURED threshold: even tiny adjustment requires Factory Manager (403 for Warehouse Manager)
        const unconfAdj = await apiRequest('/warehouse/adjustments', {
          method: 'POST',
          token: wkRawSession.token,
          body: {
            warehouse_id: whRawId,
            location_id: rawDockBinId,
            material_id: matNoQcId,
            direction: 'IN',
            quantity: 2,
            reason_code: 'DATA_CORRECTION',
          },
        });
        if (unconfAdj.status !== 201 || !unconfAdj.data.data.requires_factory_manager) {
          throw new Error(`Expected requires_factory_manager=true under UNCONFIGURED threshold: ${unconfAdj.rawText}`);
        }
        const adjUnconfId = unconfAdj.data.data.id;

        const wmBlocked = await apiRequest(`/warehouse/adjustments/${adjUnconfId}/approve`, { method: 'POST', token: wmSession.token });
        if (wmBlocked.status !== 403) throw new Error(`Expected 403 for WM when threshold is UNCONFIGURED, got ${wmBlocked.status}`);

        // Factory Manager approves UNCONFIGURED adjustment
        const fmApp1 = await apiRequest(`/warehouse/adjustments/${adjUnconfId}/approve`, { method: 'POST', token: managerSession.token });
        if (fmApp1.status !== 200) throw new Error(`Factory Manager approve failed: ${fmApp1.rawText}`);

        // 2. Configure threshold = 20 -> WM can approve value <= 20, blocked > 20
        await apiRequest('/warehouse/settings/adjustment_approval_threshold', {
          method: 'PUT',
          token: adminSession.token,
          body: { setting_value: '20' },
        });

        // Self-approval block (Maker-Checker): WM creates small adjustment (value ~ 3.20 <= 20), cannot self-approve (403)
        const wmOwnAdj = await apiRequest('/warehouse/adjustments', {
          method: 'POST',
          token: wmSession.token,
          body: {
            warehouse_id: whRawId,
            location_id: rawDockBinId,
            material_id: matNoQcId,
            direction: 'OUT',
            quantity: 1,
            reason_code: 'DATA_CORRECTION',
          },
        });
        const wmSelfApp = await apiRequest(`/warehouse/adjustments/${wmOwnAdj.data.data.id}/approve`, {
          method: 'POST',
          token: wmSession.token,
        });
        if (wmSelfApp.status !== 403) throw new Error(`Maker-checker self-approval not blocked 403: got ${wmSelfApp.status}`);

        // High threshold exceeded (10 * 3.20 = 32 > 20) -> WM blocked 403
        const highAdj = await apiRequest('/warehouse/adjustments', {
          method: 'POST',
          token: wkRawSession.token,
          body: {
            warehouse_id: whRawId,
            location_id: rawDockBinId,
            material_id: matNoQcId,
            direction: 'OUT',
            quantity: 10,
            reason_code: 'DAMAGED',
          },
        });
        const wmHighBlock = await apiRequest(`/warehouse/adjustments/${highAdj.data.data.id}/approve`, { method: 'POST', token: wmSession.token });
        if (wmHighBlock.status !== 403) throw new Error(`Expected 403 for WM above threshold (32 > 20), got ${wmHighBlock.status}`);

        // 3. DEC-08: WRITE_OFF unconditionally requires Factory Manager even if value (3.20) <= threshold (20)
        const woAdj = await apiRequest('/warehouse/adjustments', {
          method: 'POST',
          token: wkRawSession.token,
          body: {
            warehouse_id: whRawId,
            location_id: rawDockBinId,
            material_id: matNoQcId,
            direction: 'OUT',
            quantity: 1,
            reason_code: 'WRITE_OFF',
          },
        });
        if (!woAdj.data.data.requires_factory_manager) throw new Error('WRITE_OFF must always set requires_factory_manager=true');
        const wmWoBlock = await apiRequest(`/warehouse/adjustments/${woAdj.data.data.id}/approve`, { method: 'POST', token: wmSession.token });
        const fmWoOk = await apiRequest(`/warehouse/adjustments/${woAdj.data.data.id}/approve`, { method: 'POST', token: managerSession.token });
        if (wmWoBlock.status !== 403 || fmWoOk.status !== 200) {
          throw new Error(`WRITE_OFF escalation failed: wm=${wmWoBlock.status}, fm=${fmWoOk.status}`);
        }

        return 'Verified PARAM-01 UNCONFIGURED, numeric threshold routing, Maker-Checker 403 self-block, and DEC-08 WRITE_OFF FM escalation';
      } finally {
        await apiRequest('/warehouse/settings/adjustment_approval_threshold', {
          method: 'PUT',
          token: adminSession.token,
          body: { setting_value: 'UNCONFIGURED' },
        });
      }
    });

    // 71. Reorder Request 3-Tier Sequence (DEC-10)
    await executeTest(71, 'Reorder Request 3-Tier Approval Sequence (DEC-10: WM -> Purchasing -> FM)', 'WMS Phase 04 - Reorder', async () => {
      const createRes = await apiRequest('/warehouse/reorders', {
        method: 'POST',
        token: wmSession.token,
        body: {
          material_id: matLotFifoId,
          warehouse_id: whRawId,
          requested_qty: 100,
          priority: 'URGENT',
          justification: 'Below reorder threshold after Batch Cutting run',
        },
      });
      if (createRes.status !== 201 || createRes.data.data.status !== 'OPEN') {
        throw new Error(`Create reorder failed: ${createRes.rawText}`);
      }
      const reoId = createRes.data.data.id;

      // Skipping stages blocked (409) and wrong roles blocked (403)
      const [skipReview, skipApprove] = await Promise.all([
        apiRequest(`/warehouse/reorders/${reoId}/review`, { method: 'POST', token: purchSession.token }),
        apiRequest(`/warehouse/reorders/${reoId}/approve`, { method: 'POST', token: managerSession.token }),
      ]);
      if (skipReview.status !== 409 || skipApprove.status !== 409) {
        throw new Error(`Stage skipping not rejected 409: review=${skipReview.status}, approve=${skipApprove.status}`);
      }

      // Stage 1: Warehouse Manager submits (OPEN -> SUBMITTED)
      const subRes = await apiRequest(`/warehouse/reorders/${reoId}/submit`, { method: 'POST', token: wmSession.token });
      if (subRes.status !== 200 || subRes.data.data.status !== 'SUBMITTED') {
        throw new Error(`Reorder submit failed: ${subRes.rawText}`);
      }

      // Stage 2: Factory Manager cannot bypass Purchasing Review (409), WM cannot review (403)
      const [bypassPurch, wmReview] = await Promise.all([
        apiRequest(`/warehouse/reorders/${reoId}/approve`, { method: 'POST', token: managerSession.token }),
        apiRequest(`/warehouse/reorders/${reoId}/review`, { method: 'POST', token: wmSession.token }),
      ]);
      if (bypassPurch.status !== 409 || wmReview.status !== 403) {
        throw new Error(`Purchasing review guard failed: bypass=${bypassPurch.status}, wmReview=${wmReview.status}`);
      }

      // Stage 2 valid: Purchasing Manager reviews (SUBMITTED -> PURCHASING_REVIEWED)
      const revRes = await apiRequest(`/warehouse/reorders/${reoId}/review`, {
        method: 'POST',
        token: purchSession.token,
        body: { supplier_note: 'Confirmed 5-day lead time', po_reference: `PO-REO-${wmsRunTag}` },
      });
      if (revRes.status !== 200 || revRes.data.data.status !== 'PURCHASING_REVIEWED') {
        throw new Error(`Purchasing review failed: ${revRes.rawText}`);
      }

      // Stage 3 valid: Factory Manager approves (PURCHASING_REVIEWED -> APPROVED)
      const appRes = await apiRequest(`/warehouse/reorders/${reoId}/approve`, { method: 'POST', token: managerSession.token });
      if (appRes.status !== 200 || appRes.data.data.status !== 'APPROVED') {
        throw new Error(`Factory Manager final reorder approval failed: ${appRes.rawText}`);
      }

      return 'Verified strict 3-tier Reorder sequence (WM submit -> Purchasing review -> FM approve) and stage/role guards';
    });

    // 72. Finished Goods Receiving (Packing -> WH-FG)
    await executeTest(72, 'Finished Goods Receiving Validation, Handover & Quarantine', 'WMS Phase 04 - Finished Goods', async () => {
      // Factory Manager intentionally lacks operational inventory:receive -> 403
      const fmRecvBlock = await apiRequest('/warehouse/finished-goods/receive', {
        method: 'POST',
        token: managerSession.token,
        body: { department_id: 11, warehouse_id: whFgId, material_id: matFgId, quantity: 10 },
      });
      if (fmRecvBlock.status !== 403) {
        throw new Error(`Expected 403 for Factory Manager without inventory:receive, got ${fmRecvBlock.status}`);
      }

      // Grant Warehouse Manager temporary scope to WH-FG
      await apiRequest(`/warehouses/${whFgId}/staff`, {
        method: 'POST',
        token: adminSession.token,
        body: { user_id: wmUser.user.id, staff_role: 'WAREHOUSE_MANAGER', is_primary: false },
      });

      try {
        // Cannot receive raw fabric into FG endpoint as Finished Good (400)
        const nonFgMat = await apiRequest('/warehouse/finished-goods/receive', {
          method: 'POST',
          token: wmSession.token,
          body: { department_id: 11, warehouse_id: whFgId, material_id: matNoQcId, quantity: 10 },
        });
        if (nonFgMat.status !== 400) throw new Error(`Expected 400 receiving non-FINISHED_GOOD SKU, got ${nonFgMat.status}`);

        // Valid Finished Goods receipt into WH-FG (uses DEFAULT bin automatically; matFgId requires QC -> QUARANTINE)
        const fgRecv = await apiRequest('/warehouse/finished-goods/receive', {
          method: 'POST',
          token: wmSession.token,
          body: {
            department_id: 11,
            production_line_id: supLineId,
            warehouse_id: whFgId,
            material_id: matFgId,
            quantity: 120,
            unit_cost: 6.25,
            lot_number: `FG-${wmsRunTag}`,
          },
        });
        if (fgRecv.status !== 201 || fgRecv.data.data.balance.stock_status !== 'QUARANTINE') {
          throw new Error(`FG receipt failed or skipped QC quarantine: ${fgRecv.rawText}`);
        }

        // QC Inspector releases FG lot -> AVAILABLE in WH-FG
        const fgQc = await apiRequest('/warehouse/qc/inspect', {
          method: 'POST',
          token: qcSession.token,
          body: { grn_item_id: fgRecv.data.data.item.id, passed_qty: 120 },
        });
        if (fgQc.status !== 200 || Number(fgQc.data.data.remaining_pending_qty) !== 0) {
          throw new Error(`FG QC release failed: ${fgQc.rawText}`);
        }

        return 'Verified FG role segregation (403), non-FG rejection (400), WH-FG DEFAULT bin handover, and QC release';
      } finally {
        await apiRequest(`/warehouses/${whFgId}/staff/${wmUser.user.id}`, {
          method: 'DELETE',
          token: adminSession.token,
        });
      }
    });

    // 73. In-App Notifications: Operational Triggers, Delayed Transfer Scan & Mark Read
    await executeTest(73, 'In-App Notifications: QC/Approval Triggers, Delayed Transfer Scan & Mark Read', 'WMS Phase 04 - Notifications', async () => {
      // Create an overdue IN_TRANSIT transfer (as scoped Warehouse Manager) and scan delayed transfers
      const trfDisp = await apiRequest('/warehouse/transfers/dispatch', {
        method: 'POST',
        token: wmSession.token,
        body: {
          source_warehouse_id: whRawId,
          target_warehouse_id: whTrimId,
          items: [{ source_location_id: rawBinId, target_location_id: trimBinId, material_id: matNoQcId, dispatched_qty: 5 }],
        },
      });
      if (trfDisp.status !== 201) {
        throw new Error(`Delayed transfer setup dispatch failed: ${trfDisp.rawText}`);
      }
      const delayedTrfId = trfDisp.data.data.transfer.id;
      await query(`UPDATE warehouse_transfers SET dispatched_at = $1 WHERE id = $2`, [
        new Date(Date.now() - 48 * 3600 * 1000),
        delayedTrfId,
      ]);

      const scanRes = await apiRequest('/warehouse/notifications/scan-delayed-transfers', {
        method: 'POST',
        token: managerSession.token,
        body: { max_hours_in_transit: 24 },
      });
      if (scanRes.status !== 200 || scanRes.data.data.alerts_created < 1) {
        throw new Error(`Expected delayed transfer alert creation, got ${scanRes.rawText}`);
      }

      const notifRes = await apiRequest('/warehouse/notifications?unread_only=true', { token: managerSession.token });
      const types = new Set(notifRes.data.data.map((n: any) => n.notification_type));
      if (!types.has('LOW_STOCK') || !types.has('QC_PENDING') || !types.has('APPROVAL_REQUIRED') || !types.has('TRANSFER_DELAYED')) {
        throw new Error(`Missing expected notification types, got [${Array.from(types).join(', ')}]`);
      }

      const firstId = notifRes.data.data[0].id;
      const readRes = await apiRequest(`/warehouse/notifications/${firstId}/read`, { method: 'PUT', token: managerSession.token });
      if (readRes.status !== 200 || !readRes.data.data.is_read) {
        throw new Error(`Failed marking notification read: ${readRes.rawText}`);
      }

      return `Verified in-app notification triggers (${Array.from(types).join(', ')}) and mark-read persistence`;
    });

    // 74. End-to-End Ledger Reconciliation & Audit Trail Verification
    await executeTest(74, 'End-to-End Ledger Reconciliation (Balances == Movements) & Audit Coverage', 'WMS Phase 04 - Integrity', async () => {
      const recRes = await apiRequest('/inventory/reconcile', { token: finSession.token });
      if (recRes.status !== 200 || !recRes.data?.data?.isBalanced) {
        throw new Error(`Inventory ledger reconciliation failed: ${recRes.rawText}`);
      }

      // Verify immutable WMS audit events were written across workflows
      const auditActionsRes = await query<{ action: string }>(
        `SELECT DISTINCT action FROM audit_logs WHERE action LIKE 'WMS_%'`
      );
      const actions = new Set(auditActionsRes.rows.map((r) => r.action));
      for (const expected of [
        'WMS_GRN_POST',
        'WMS_QC_INSPECT',
        'WMS_REQUISITION_APPROVE',
        'WMS_STOCK_ISSUE',
        'WMS_STOCK_RETURN',
        'WMS_TRANSFER_DISPATCH',
        'WMS_TRANSFER_RECEIVE',
        'WMS_STOCK_COUNT_APPROVE',
        'WMS_ADJUSTMENT_APPROVE',
        'WMS_REORDER_APPROVE',
        'WMS_FG_RECEIPT',
      ]) {
        if (!actions.has(expected)) {
          throw new Error(`Missing expected WMS audit event: ${expected}`);
        }
      }

      // Deactivate temporary Phase 04 users cleanly (preserving immutable ledger FKs)
      const tempUserIds = [
        wmUser.user.id,
        wkRawUser.user.id,
        wkUnassignedUser.user.id,
        qcUser.user.id,
        pmPurchUser.user.id,
        prodMgrUser.user.id,
        finUser.user.id,
        lineSupUser.user.id,
      ];
      for (const uid of tempUserIds) {
        await query(`UPDATE users SET is_active = FALSE WHERE id = $1`, [uid]);
      }

      return `Verified 0 discrepancies across full inventory_balances vs stock_movements ledger (${actions.size} distinct WMS audit event types)`;
    });
  } finally {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }

  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;

  return {
    total: results.length,
    passed,
    failed,
    allPassed: failed === 0,
    totalDurationMs: Date.now() - startSuiteTime,
    timestamp: new Date().toISOString(),
    results,
  };
}

// Standalone CLI execution
if (process.argv[1] && process.argv[1].endsWith('runner.ts')) {
  console.log('====================================================');
  console.log('GFMS Technical Foundation Prototype - Automated Tests');
  console.log('====================================================\n');
  runAllTests()
    .then((summary) => {
      summary.results.forEach((r) => {
        const symbol = r.status === 'PASSED' ? '✓' : '✗';
        console.log(`${symbol} [${r.category}] Test #${r.id}: ${r.name} (${r.durationMs}ms)`);
        if (r.details) console.log(`   → ${r.details}`);
        if (r.error) console.log(`   → ERROR: ${r.error}`);
      });
      console.log('\n----------------------------------------------------');
      console.log(`Summary: ${summary.passed}/${summary.total} tests passed in ${summary.totalDurationMs}ms`);
      console.log('====================================================');
      if (!summary.allPassed) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
