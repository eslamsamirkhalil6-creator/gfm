import fs from 'fs';
import path from 'path';
import http from 'http';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initDatabase, checkConnection, query } from '../config/database.ts';
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
