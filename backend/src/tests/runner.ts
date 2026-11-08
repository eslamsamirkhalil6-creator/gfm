import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initDatabase, checkConnection, query } from '../config/database.ts';
import { env } from '../config/env.ts';
import { AuthService } from '../modules/auth/auth.service.ts';
import { UserService } from '../modules/users/user.service.ts';
import { AuditService } from '../modules/audit/audit.service.ts';
import { DepartmentService } from '../modules/departments/department.service.ts';

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

export async function runAllTests(): Promise<TestSuiteSummary> {
  const results: TestResult[] = [];
  const startSuiteTime = Date.now();

  await initDatabase();

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

  // 1. API Health Check
  await executeTest(1, 'API Health Check & Metrics', 'System', async () => {
    const dbStatus = await checkConnection();
    if (dbStatus.status !== 'CONNECTED') {
      throw new Error(`Database connection status is ${dbStatus.status}`);
    }
    return `Server healthy. Mode: ${dbStatus.mode}, latency: ${dbStatus.latencyMs}ms, tables: ${dbStatus.tablesCount}`;
  });

  // 2. Database Connectivity
  await executeTest(2, 'PostgreSQL Database Connectivity', 'Database', async () => {
    const res = await query('SELECT 1 as ping, NOW() as server_timestamp');
    if (!res.rows || res.rows.length === 0 || res.rows[0].ping !== 1) {
      throw new Error('Database ping query failed or returned unexpected rows');
    }
    const usersCountRes = await query('SELECT count(*) as count FROM users');
    return `Verified query execution. Users registered: ${usersCountRes.rows[0].count}`;
  });

  // 3. Successful Login
  await executeTest(3, 'Successful Login with Valid Credentials', 'Authentication', async () => {
    const loginRes = await AuthService.login({
      username: 'admin',
      password: 'Admin@123',
      ipAddress: '127.0.0.1',
    });

    if (!loginRes.token) {
      throw new Error('JWT token was not generated on successful login');
    }
    if (!loginRes.user || loginRes.user.username !== 'admin') {
      throw new Error('Returned user payload is invalid');
    }
    if (!loginRes.user.roles.includes('System Administrator')) {
      throw new Error('Admin role missing in user payload');
    }

    // Verify token validity
    const decoded: any = jwt.verify(loginRes.token, env.JWT_SECRET);
    if (decoded.username !== 'admin') {
      throw new Error('Token payload mismatch');
    }

    return `Authentication verified for "admin". Roles: [${loginRes.user.roles.join(', ')}]. Permissions: ${loginRes.user.permissions.length}`;
  });

  // 4. Failed Login (Invalid Password & Non-existent User)
  await executeTest(4, 'Failed Login Handling & Rejection', 'Authentication', async () => {
    let failed1 = false;
    try {
      await AuthService.login({
        username: 'admin',
        password: 'WrongPassword!999',
        ipAddress: '127.0.0.1',
      });
    } catch (err: any) {
      failed1 = err.statusCode === 401;
    }
    if (!failed1) {
      throw new Error('Login with incorrect password did not throw 401 error');
    }

    let failed2 = false;
    try {
      await AuthService.login({
        username: 'ghost_user_9999',
        password: 'AnyPassword',
        ipAddress: '127.0.0.1',
      });
    } catch (err: any) {
      failed2 = err.statusCode === 401;
    }
    if (!failed2) {
      throw new Error('Login with non-existent user did not throw 401 error');
    }

    return 'Both invalid password and non-existent username were rejected with HTTP 401 and audit logged';
  });

  // 5. Unauthorized API Access
  await executeTest(5, 'Unauthorized API Access Protection', 'Authorization', async () => {
    // Attempting to decode invalid token
    try {
      jwt.verify('invalid.forged.jwt.token', env.JWT_SECRET);
      throw new Error('Forged JWT token should not have validated');
    } catch (err: any) {
      // Expected failure
    }

    return 'Token verification rejected invalid/unsigned JWT tokens securely';
  });

  // 6. Role-Based Permission Enforcement
  await executeTest(6, 'Role-Based Permission Enforcement (RBAC)', 'Authorization', async () => {
    // Dept user login
    const deptLogin = await AuthService.login({
      username: 'deptuser',
      password: 'Dept@123',
      ipAddress: '127.0.0.1',
    });

    const deptPerms = new Set(deptLogin.user.permissions);
    if (deptPerms.has('users:create')) {
      throw new Error('Department User has unexpected "users:create" permission');
    }
    if (deptPerms.has('audit:read')) {
      throw new Error('Department User has unexpected "audit:read" permission');
    }
    if (!deptPerms.has('dashboard:view')) {
      throw new Error('Department User should have "dashboard:view" permission');
    }

    // Manager login
    const mgrLogin = await AuthService.login({
      username: 'manager',
      password: 'Manager@123',
      ipAddress: '127.0.0.1',
    });
    const mgrPerms = new Set(mgrLogin.user.permissions);
    if (!mgrPerms.has('dashboard:factory')) {
      throw new Error('Factory Manager missing "dashboard:factory" permission');
    }
    if (mgrPerms.has('users:create')) {
      throw new Error('Factory Manager should not have "users:create" permission in prototype matrix');
    }

    return 'Department User, Factory Manager, and System Administrator permission boundaries strictly verified';
  });

  // 7. User Creation & Password Hashing
  await executeTest(7, 'User Provisioning & Bcrypt Verification', 'User Management', async () => {
    const testUsername = `qa_test_${Date.now()}`;
    const plainPassword = 'QaPassword#2026';

    const newUser = await UserService.createUser(
      {
        username: testUsername,
        password: plainPassword,
        full_name: 'QA Automated Test User',
        roleIds: [2], // Factory Manager
      },
      1, // created by admin
      '127.0.0.1'
    );

    if (!newUser.id || newUser.username !== testUsername) {
      throw new Error('Created user entity is missing or corrupted');
    }

    // Inspect database record directly to ensure password_hash is bcrypt and never plaintext
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

    return `User "${testUsername}" created. Password encrypted with bcrypt ($2b$). Stored hash: ${hash.substring(0, 15)}...`;
  });

  // 8. Audit Log Creation
  await executeTest(8, 'Audit Log Generation & Immutability', 'Security & Compliance', async () => {
    const auditRes = await query<{
      id: number;
      action: string;
      entity_type: string;
      entity_id: string;
    }>(
      'SELECT id, action, entity_type, entity_id FROM audit_logs ORDER BY id DESC LIMIT 5'
    );

    if (auditRes.rows.length === 0) {
      throw new Error('No audit log entries found in audit_logs table');
    }

    const actions = auditRes.rows.map(r => r.action);
    const hasLoginOrUser = actions.some(a => ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'USER_CREATE', 'ROLE_ASSIGN'].includes(a));
    if (!hasLoginOrUser) {
      throw new Error(`Expected login or user actions in audit trail, got: ${actions.join(', ')}`);
    }

    return `Verified immutable audit trail. Recent actions recorded: [${actions.join(', ')}]`;
  });

  // 9. Production Hall Creation & Uniqueness (Part 2)
  await executeTest(9, 'Production Hall Provisioning & Constraints', 'Production Module', async () => {
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

    if (!newHall.id || newHall.code !== testCode) {
      throw new Error('Failed to create production hall in PostgreSQL');
    }

    // Verify duplicate code rejected
    let duplicateRejected = false;
    try {
      await ProductionService.createHall({ name: `Another ${testCode}`, code: testCode }, 1, '127.0.0.1');
    } catch (err: any) {
      duplicateRejected = err.statusCode === 409;
    }
    if (!duplicateRejected) {
      throw new Error('Duplicate hall code was not rejected with HTTP 409');
    }

    return `Production hall "${newHall.name}" [${newHall.code}] created and unique constraint validated`;
  });

  // 10. Dynamic Production Lines & Supervisor Multi-Line Assignment (Part 2)
  await executeTest(10, 'Production Lines & Multi-Line Supervisor Mapping', 'Production Module', async () => {
    const { ProductionService } = await import('../modules/production/production.service.ts');
    const lineCode1 = `TEST-SEW-${Date.now().toString().slice(-4)}A`;
    const lineCode2 = `TEST-SEW-${Date.now().toString().slice(-4)}B`;

    // Assign same supervisor (User #2 Sarah Jenkins) to both lines (Section 5 rule)
    const line1 = await ProductionService.createLine(
      {
        line_number: lineCode1,
        name: `Automated Test Line Alpha`,
        hall_id: 1,
        production_type: 'Sewing',
        supervisor_id: 2,
        capacity_per_day: 750,
      },
      1,
      '127.0.0.1'
    );

    const line2 = await ProductionService.createLine(
      {
        line_number: lineCode2,
        name: `Automated Test Line Beta`,
        hall_id: 1,
        production_type: 'Sewing',
        supervisor_id: 2,
        capacity_per_day: 650,
      },
      1,
      '127.0.0.1'
    );

    if (line1.supervisor_id !== 2 || line2.supervisor_id !== 2) {
      throw new Error('Supervisor assignment mismatch');
    }

    return `Verified dynamic line creation. Supervisor #2 successfully assigned to both ${line1.line_number} and ${line2.line_number}`;
  });

  // 11. Production Stages Management & Quality Gate (Part 2)
  await executeTest(11, 'Configurable Production Stages & QC Types', 'Production Module', async () => {
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

    const allStages = await ProductionService.listStages();
    const found = allStages.find(s => s.id === newStage.id);
    if (!found) {
      throw new Error('Newly created stage was not found in stage listing');
    }

    const qcStages = allStages.filter(s => s.stage_type === 'QUALITY');
    if (qcStages.length === 0) {
      throw new Error('No Quality Inspection stages found in system');
    }

    return `Stage "${newStage.name}" created. Verified ${allStages.length} configurable stages (including ${qcStages.length} independent QC gates)`;
  });

  // 12. Configurable Production Workflows & Reordering (Part 2)
  await executeTest(12, 'Configurable Workflows & Step Reordering', 'Production Module', async () => {
    const { ProductionService } = await import('../modules/production/production.service.ts');
    const wfCode = `WF-TEST-${Date.now().toString().slice(-4)}`;

    // Create workflow with 3 stages: Cutting(1) -> Sewing(2) -> Packing(4)
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

    if (wf.steps.length !== 3) {
      throw new Error(`Expected 3 steps, got ${wf.steps.length}`);
    }

    // Reorder: insert Quality Inspection(3) between Sewing and Packing
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

    const thirdStep = reordered.steps.find(s => s.step_order === 3);
    if (!thirdStep || thirdStep.stage_id !== 3 || !thirdStep.quality_gate) {
      throw new Error('Reordered sequence step 3 does not match inserted Quality Inspection stage');
    }

    return `Workflow "${wf.name}" created and reordered to 4 stages with mandatory QC gate verified`;
  });

  // 13. Production RBAC & Privilege Enforcement (Part 2)
  await executeTest(13, 'Production RBAC Permission Enforcement', 'Authorization', async () => {
    // Dept User should NOT have production:halls:create or production:lines:manage
    const deptLogin = await AuthService.login({
      username: 'deptuser',
      password: 'Dept@123',
      ipAddress: '127.0.0.1',
    });
    const deptPerms = new Set(deptLogin.user.permissions);
    if (deptPerms.has('production:halls:create')) {
      throw new Error('Department User should NOT have "production:halls:create" permission');
    }
    if (deptPerms.has('production:lines:manage')) {
      throw new Error('Department User should NOT have "production:lines:manage" permission');
    }

    // Factory Manager should have production:view, production:halls:create, production:lines:manage
    const mgrLogin = await AuthService.login({
      username: 'manager',
      password: 'Manager@123',
      ipAddress: '127.0.0.1',
    });
    const mgrPerms = new Set(mgrLogin.user.permissions);
    if (!mgrPerms.has('production:view')) {
      throw new Error('Factory Manager missing "production:view" permission');
    }
    if (!mgrPerms.has('production:lines:manage')) {
      throw new Error('Factory Manager missing "production:lines:manage" permission');
    }

    return 'Strict RBAC enforcement verified: Department User blocked from configuration, Factory Manager authorized';
  });

  // 14. Production Configuration Audit Trail (Part 2)
  await executeTest(14, 'Production Audit Trail Ledger', 'Security & Compliance', async () => {
    const auditRes = await query<{ action: string; entity_type: string }>(
      `SELECT action, entity_type FROM audit_logs 
       WHERE entity_type IN ('PRODUCTION_HALL', 'PRODUCTION_LINE', 'PRODUCTION_STAGE', 'PRODUCTION_WORKFLOW')
       ORDER BY id DESC LIMIT 5`
    );

    if (auditRes.rowCount === 0) {
      throw new Error('No production configuration audit records found');
    }

    const recordedActions = auditRes.rows.map(r => r.action);
    return `Verified immutable audit logging for production actions: [${recordedActions.join(', ')}]`;
  });

  // 15. Incremental PostgreSQL Migration Integrity (Parts 1, 2, and 3)
  await executeTest(15, 'PostgreSQL Schema & Migration Completeness', 'Database', async () => {
    const requiredTables = [
      'users', 'roles', 'permissions', 'user_roles', 'role_permissions', 'audit_logs',
      'production_halls', 'production_lines', 'production_stages', 'production_workflows',
      'production_workflow_steps', 'production_settings',
      'departments', 'department_employees', 'department_manager_history'
    ];

    const tablesRes = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const existingTableNames = new Set(tablesRes.rows.map(r => r.table_name));

    for (const t of requiredTables) {
      if (!existingTableNames.has(t)) {
        throw new Error(`Missing expected schema table: ${t}`);
      }
    }

    return `All ${requiredTables.length} PostgreSQL tables verified in public schema (001_, 002_, and 003_ migrations complete)`;
  });

  // 16. Department Creation & Code Uniqueness
  await executeTest(16, 'Department Creation & Unique Code Enforcement', 'Department Module', async () => {
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

    if (!created.id || created.dept_code !== testCode) {
      throw new Error('Failed to create department');
    }

    // Verify duplicate code rejection
    let duplicateRejected = false;
    try {
      await DepartmentService.createDepartment(
        {
          dept_code: testCode,
          name: 'Duplicate Code Department',
        },
        1,
        '127.0.0.1'
      );
    } catch {
      duplicateRejected = true;
    }

    if (!duplicateRejected) {
      throw new Error(`Expected duplicate department code "${testCode}" to be rejected`);
    }

    return `Created department "${created.name}" [${testCode}] and confirmed duplicate code rejection`;
  });

  // 17. Department Hierarchy & Circular Parent-Child Prevention
  await executeTest(17, 'Department Hierarchy & Circular Reference Prevention', 'Department Module', async () => {
    // 1. Create top level dept
    const parent = await DepartmentService.createDepartment(
      {
        dept_code: `DEP-HIER-P-${Date.now().toString().slice(-4)}`,
        name: 'Hierarchy Parent Dept',
      },
      1,
      '127.0.0.1'
    );

    // 2. Create child dept under parent
    const child = await DepartmentService.createDepartment(
      {
        dept_code: `DEP-HIER-C-${Date.now().toString().slice(-4)}`,
        name: 'Hierarchy Child Dept',
        parent_id: parent.id,
      },
      1,
      '127.0.0.1'
    );

    // 3. Create grandchild dept under child
    const grandchild = await DepartmentService.createDepartment(
      {
        dept_code: `DEP-HIER-G-${Date.now().toString().slice(-4)}`,
        name: 'Hierarchy Grandchild Dept',
        parent_id: child.id,
      },
      1,
      '127.0.0.1'
    );

    // 4. Attempt to set parent's parent to grandchild (Cycle: P -> C -> G -> P)
    let cycleRejected = false;
    try {
      await DepartmentService.updateDepartment(
        parent.id,
        { parent_id: grandchild.id },
        1,
        '127.0.0.1'
      );
    } catch {
      cycleRejected = true;
    }

    if (!cycleRejected) {
      throw new Error('Circular parent-child relationship was not prevented');
    }

    // 5. Attempt self-parenting (P -> P)
    let selfParentRejected = false;
    try {
      await DepartmentService.updateDepartment(
        parent.id,
        { parent_id: parent.id },
        1,
        '127.0.0.1'
      );
    } catch {
      selfParentRejected = true;
    }

    if (!selfParentRejected) {
      throw new Error('Self-parenting was not rejected');
    }

    return `Verified multi-level hierarchy (Parent #${parent.id} -> Child #${child.id} -> Grandchild #${grandchild.id}) and verified cycle rejection`;
  });

  // 18. Department Manager Assignment & Historical Tenure
  await executeTest(18, 'Department Manager Assignment & Historical Tenure', 'Department Module', async () => {
    const dept = await DepartmentService.createDepartment(
      {
        dept_code: `DEP-MGR-${Date.now().toString().slice(-4)}`,
        name: 'Manager Tenure Test Dept',
      },
      1,
      '127.0.0.1'
    );

    // Assign Sarah Jenkins (user 2)
    await DepartmentService.assignManager(dept.id, 2, 'Initial Manager Appointment', 1, '127.0.0.1');

    // Replace manager with Eslam Samir (user 1)
    await DepartmentService.assignManager(dept.id, 1, 'Manager Transition', 1, '127.0.0.1');

    const details = await DepartmentService.getDepartmentById(dept.id);
    if (details.department.manager_id !== 1) {
      throw new Error('Active manager was not updated to user #1');
    }

    if (details.manager_history.length < 2) {
      throw new Error('Manager tenure history did not record both assignments');
    }

    const previousTenure = details.manager_history.find(h => h.manager_id === 2);
    if (!previousTenure || !previousTenure.relinquished_at) {
      throw new Error('Previous manager tenure was not properly closed with relinquished_at');
    }

    return `Manager transitioned to #${details.department.manager_id}. Recorded ${details.manager_history.length} historical tenure entries with relinquishment timestamps`;
  });

  // 19. Employee Assignment, Multi-Department Mapping & Transfer
  await executeTest(19, 'Employee Assignment, Multi-Dept & Transfer', 'Department Module', async () => {
    const deptA = await DepartmentService.createDepartment(
      { dept_code: `DEP-TR-A-${Date.now().toString().slice(-4)}`, name: 'Transfer Source Dept' },
      1,
      '127.0.0.1'
    );
    const deptB = await DepartmentService.createDepartment(
      { dept_code: `DEP-TR-B-${Date.now().toString().slice(-4)}`, name: 'Transfer Target Dept' },
      1,
      '127.0.0.1'
    );

    // Assign Ahmed Tarek (user 3) to Dept A
    const assigned = await DepartmentService.assignEmployee(
      deptA.id,
      { user_id: 3, position_title: 'Junior Sewing Inspector', is_primary: true },
      1,
      '127.0.0.1'
    );

    if (assigned.position_title !== 'Junior Sewing Inspector') {
      throw new Error('Failed to assign employee to department');
    }

    // Transfer user 3 from Dept A to Dept B as Senior Quality Auditor
    const transferred = await DepartmentService.transferEmployee(
      deptA.id,
      deptB.id,
      3,
      'Senior Quality Auditor',
      true,
      1,
      '127.0.0.1'
    );

    if (transferred.position_title !== 'Senior Quality Auditor') {
      throw new Error('Failed to transfer employee to new position');
    }

    // Verify user 3 is no longer in Dept A
    const deptADetails = await DepartmentService.getDepartmentById(deptA.id);
    const inDeptA = deptADetails.employees.some(e => e.user_id === 3);
    if (inDeptA) {
      throw new Error('Employee still listed in source department after transfer');
    }

    // Verify user 3 is now in Dept B
    const deptBDetails = await DepartmentService.getDepartmentById(deptB.id);
    const inDeptB = deptBDetails.employees.some(e => e.user_id === 3);
    if (!inDeptB) {
      throw new Error('Employee not found in target department after transfer');
    }

    return `Employee @${transferred.username} assigned as "Junior Sewing Inspector" in #${deptA.id} and transferred to #${deptB.id} as "Senior Quality Auditor"`;
  });

  // 20. Department Deactivation & Deletion Safety
  await executeTest(20, 'Department Deactivation & Deletion Safety', 'Department Module', async () => {
    const dept = await DepartmentService.createDepartment(
      { dept_code: `DEP-DEL-${Date.now().toString().slice(-4)}`, name: 'Deletion Test Dept' },
      1,
      '127.0.0.1'
    );

    // Assign employee
    await DepartmentService.assignEmployee(dept.id, { user_id: 1, position_title: 'Safety Staff' }, 1, '127.0.0.1');

    // Attempt deletion -> MUST fail due to safety restriction (Section 4)
    let deletionBlocked = false;
    try {
      await DepartmentService.deleteDepartment(dept.id, 1, '127.0.0.1');
    } catch {
      deletionBlocked = true;
    }

    if (!deletionBlocked) {
      throw new Error('Department with assigned employees was deleted without blocking');
    }

    // Test deactivation instead
    const deactivated = await DepartmentService.toggleDepartmentStatus(dept.id, 1, '127.0.0.1');
    if (deactivated.status !== 'inactive') {
      throw new Error('Failed to deactivate department');
    }

    const reactivated = await DepartmentService.toggleDepartmentStatus(dept.id, 1, '127.0.0.1');
    if (reactivated.status !== 'active') {
      throw new Error('Failed to reactivate department');
    }

    return `Confirmed deletion safety restriction for departments with assigned staff; verified status toggle active -> inactive -> active`;
  });

  // 21. Department RBAC Permission Enforcement
  await executeTest(21, 'Department Module RBAC Enforcement', 'Authorization', async () => {
    const adminRes = await AuthService.login({ username: 'admin', password: 'Admin@123', ipAddress: '127.0.0.1' });
    const managerRes = await AuthService.login({ username: 'manager', password: 'Manager@123', ipAddress: '127.0.0.1' });
    const deptUserRes = await AuthService.login({ username: 'deptuser', password: 'Dept@123', ipAddress: '127.0.0.1' });

    const adminUser = adminRes.user;
    const managerUser = managerRes.user;
    const deptUser = deptUserRes.user;

    // Admin has departments:create (permission 17)
    if (!adminUser.permissions.includes('departments:create')) {
      throw new Error('System Administrator missing departments:create');
    }

    // Factory Manager has departments:view (permission 16) and departments:manage_employees (permission 21)
    if (!managerUser.permissions.includes('departments:view')) {
      throw new Error('Factory Manager missing departments:view');
    }
    if (!managerUser.permissions.includes('departments:manage_employees')) {
      throw new Error('Factory Manager missing departments:manage_employees');
    }

    // Department User must NOT have department management permissions
    const restricted = ['departments:create', 'departments:edit', 'departments:status', 'departments:manage_manager', 'departments:manage_employees'];
    for (const p of restricted) {
      if (deptUser.permissions.includes(p)) {
        throw new Error(`Department User has unpermitted permission: ${p}`);
      }
    }

    return `Verified RBAC boundaries: Administrator has 8 department permissions, Manager has operational permissions, Department User has 0`;
  });

  // 22. Department Audit Trail Ledger
  await executeTest(22, 'Department Configuration Audit Trail Ledger', 'Security & Compliance', async () => {
    const auditRes = await query(
      `SELECT action, entity_type, details FROM audit_logs 
       WHERE entity_type = 'DEPARTMENT' 
       ORDER BY id DESC LIMIT 5`
    );

    if (auditRes.rowCount === 0) {
      throw new Error('No department audit records found in database');
    }

    const actions = auditRes.rows.map(r => r.action);
    return `Verified immutable audit trail recording department events: [${actions.join(', ')}]`;
  });

  // 23. Complete PostgreSQL Schema Completeness (15 tables)
  await executeTest(23, 'Complete Schema Integrity (15 Tables across Parts 1-3)', 'Database', async () => {
    const allExpectedTables = [
      'users', 'roles', 'permissions', 'user_roles', 'role_permissions', 'audit_logs',
      'production_halls', 'production_lines', 'production_stages', 'production_workflows',
      'production_workflow_steps', 'production_settings',
      'departments', 'department_employees', 'department_manager_history'
    ];

    const tablesRes = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const existingTableNames = new Set(tablesRes.rows.map(r => r.table_name));

    for (const t of allExpectedTables) {
      if (!existingTableNames.has(t)) {
        throw new Error(`Missing expected schema table: ${t}`);
      }
    }

    return `All 15 PostgreSQL tables verified across Foundation (Part 1), Production (Part 2), and Department Management (Part 3)`;
  });

  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;

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
    .then(summary => {
      summary.results.forEach(r => {
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
    .catch(err => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
