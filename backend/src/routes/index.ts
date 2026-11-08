import { Router } from 'express';
import { HealthController } from '../modules/health/health.controller.ts';
import { AuthController } from '../modules/auth/auth.controller.ts';
import { UserController } from '../modules/users/user.controller.ts';
import { AuditController } from '../modules/audit/audit.controller.ts';
import { ProductionController } from '../modules/production/production.controller.ts';
import { DepartmentController } from '../modules/departments/department.controller.ts';
import { authenticateJWT, requirePermission, requireRole } from '../middleware/auth.middleware.ts';
import { validateBody } from '../middleware/validation.middleware.ts';
import { runAllTests } from '../tests/runner.ts';

export const apiRouter = Router();

// Health Check (Public)
apiRouter.get('/health', HealthController.check);

// Authentication (Public)
apiRouter.post('/auth/login', validateBody(['username', 'password']), AuthController.login);
apiRouter.post('/auth/logout', AuthController.logout);

// Current User Profile (Protected)
apiRouter.get('/auth/me', authenticateJWT, AuthController.me);

// User Management (Protected with granular RBAC permissions)
apiRouter.get(
  '/users',
  authenticateJWT,
  requirePermission('users:read'),
  UserController.listUsers
);

apiRouter.post(
  '/users',
  authenticateJWT,
  requirePermission('users:create'),
  validateBody(['username', 'password', 'full_name']),
  UserController.createUser
);

apiRouter.put(
  '/users/:id/status',
  authenticateJWT,
  requirePermission('users:update'),
  UserController.updateUserStatus
);

apiRouter.put(
  '/users/:id/roles',
  authenticateJWT,
  requirePermission('users:roles'),
  UserController.updateUserRoles
);

// Roles & Permissions Reference
apiRouter.get(
  '/roles',
  authenticateJWT,
  requirePermission('roles:read'),
  UserController.listRoles
);

// Audit Trail (Protected, System Admin & Authorized Audit readers only)
apiRouter.get(
  '/audit-logs',
  authenticateJWT,
  requirePermission('audit:read'),
  AuditController.getLogs
);

// ==========================================
// Production Module Setup & Configuration (Part 2)
// ==========================================

// Overview Statistics
apiRouter.get(
  '/production/stats',
  authenticateJWT,
  requirePermission('production:view'),
  ProductionController.getOverviewStats
);

// Production Halls
apiRouter.get(
  '/production/halls',
  authenticateJWT,
  requirePermission('production:view'),
  ProductionController.listHalls
);

apiRouter.post(
  '/production/halls',
  authenticateJWT,
  requirePermission('production:halls:create'),
  validateBody(['name', 'code']),
  ProductionController.createHall
);

apiRouter.put(
  '/production/halls/:id',
  authenticateJWT,
  requirePermission('production:halls:edit'),
  validateBody(['name', 'code']),
  ProductionController.updateHall
);

apiRouter.put(
  '/production/halls/:id/status',
  authenticateJWT,
  requirePermission('production:halls:edit'),
  ProductionController.toggleHallStatus
);

// Production Lines
apiRouter.get(
  '/production/lines',
  authenticateJWT,
  requirePermission('production:view'),
  ProductionController.listLines
);

apiRouter.post(
  '/production/lines',
  authenticateJWT,
  requirePermission('production:lines:manage'),
  validateBody(['line_number', 'name', 'hall_id', 'production_type']),
  ProductionController.createLine
);

apiRouter.put(
  '/production/lines/:id',
  authenticateJWT,
  requirePermission('production:lines:manage'),
  validateBody(['line_number', 'name', 'hall_id', 'production_type']),
  ProductionController.updateLine
);

apiRouter.put(
  '/production/lines/:id/status',
  authenticateJWT,
  requirePermission('production:lines:manage'),
  ProductionController.toggleLineStatus
);

// Production Stages
apiRouter.get(
  '/production/stages',
  authenticateJWT,
  requirePermission('production:view'),
  ProductionController.listStages
);

apiRouter.post(
  '/production/stages',
  authenticateJWT,
  requirePermission('production:stages:manage'),
  validateBody(['name', 'stage_code']),
  ProductionController.createStage
);

apiRouter.put(
  '/production/stages/:id',
  authenticateJWT,
  requirePermission('production:stages:manage'),
  validateBody(['name', 'stage_code']),
  ProductionController.updateStage
);

apiRouter.put(
  '/production/stages/:id/status',
  authenticateJWT,
  requirePermission('production:stages:manage'),
  ProductionController.toggleStageStatus
);

// Production Workflows
apiRouter.get(
  '/production/workflows',
  authenticateJWT,
  requirePermission('production:view'),
  ProductionController.listWorkflows
);

apiRouter.get(
  '/production/workflows/:id',
  authenticateJWT,
  requirePermission('production:view'),
  ProductionController.getWorkflow
);

apiRouter.post(
  '/production/workflows',
  authenticateJWT,
  requirePermission('production:workflows:manage'),
  validateBody(['name', 'workflow_code', 'steps']),
  ProductionController.createWorkflow
);

apiRouter.put(
  '/production/workflows/:id',
  authenticateJWT,
  requirePermission('production:workflows:manage'),
  validateBody(['name', 'workflow_code']),
  ProductionController.updateWorkflow
);

apiRouter.put(
  '/production/workflows/:id/steps',
  authenticateJWT,
  requirePermission('production:workflows:manage'),
  validateBody(['steps']),
  ProductionController.reorderWorkflowSteps
);

apiRouter.put(
  '/production/workflows/:id/status',
  authenticateJWT,
  requirePermission('production:workflows:manage'),
  ProductionController.toggleWorkflowStatus
);

// Production Settings
apiRouter.get(
  '/production/settings',
  authenticateJWT,
  requirePermission('production:view'),
  ProductionController.getSettings
);

apiRouter.put(
  '/production/settings/:key',
  authenticateJWT,
  requirePermission('production:settings:manage'),
  ProductionController.updateSetting
);

// ==========================================
// Department Management Module (Part 3)
// ==========================================

// Department Overview Statistics & Distribution
apiRouter.get(
  '/departments/stats',
  authenticateJWT,
  requirePermission('departments:view'),
  DepartmentController.getStats
);

// Department Directory List
apiRouter.get(
  '/departments',
  authenticateJWT,
  requirePermission('departments:view'),
  DepartmentController.listDepartments
);

// Department Hierarchy Tree
apiRouter.get(
  '/departments/tree',
  authenticateJWT,
  requirePermission('departments:view'),
  DepartmentController.getTree
);

// Single Department Details (Employees, Sub-departments, Manager History)
apiRouter.get(
  '/departments/:id',
  authenticateJWT,
  requirePermission('departments:view'),
  DepartmentController.getDepartment
);

// Create Department
apiRouter.post(
  '/departments',
  authenticateJWT,
  requirePermission('departments:create'),
  validateBody(['dept_code', 'name']),
  DepartmentController.createDepartment
);

// Update Department
apiRouter.put(
  '/departments/:id',
  authenticateJWT,
  requirePermission('departments:edit'),
  DepartmentController.updateDepartment
);

// Toggle Department Status (Activate / Deactivate)
apiRouter.put(
  '/departments/:id/status',
  authenticateJWT,
  requirePermission('departments:status'),
  DepartmentController.toggleStatus
);

// Assign or Replace Department Manager
apiRouter.put(
  '/departments/:id/manager',
  authenticateJWT,
  requirePermission('departments:manage_manager'),
  DepartmentController.assignManager
);

// Assign Employee to Department
apiRouter.post(
  '/departments/:id/employees',
  authenticateJWT,
  requirePermission('departments:manage_employees'),
  validateBody(['user_id', 'position_title']),
  DepartmentController.assignEmployee
);

// Transfer Employee to Another Department
apiRouter.put(
  '/departments/:id/employees/transfer',
  authenticateJWT,
  requirePermission('departments:manage_employees'),
  validateBody(['target_department_id', 'user_id']),
  DepartmentController.transferEmployee
);

// Remove Employee from Department
apiRouter.delete(
  '/departments/:id/employees/:userId',
  authenticateJWT,
  requirePermission('departments:manage_employees'),
  DepartmentController.removeEmployee
);

// Delete Empty Unused Department (Strict Safety Constraint)
apiRouter.delete(
  '/departments/:id',
  authenticateJWT,
  requirePermission('departments:create'),
  DepartmentController.deleteDepartment
);

// Automated Tests Runner (Interactive diagnostics for prototype validation)
apiRouter.get('/tests/run', authenticateJWT, async (req, res, next) => {
  try {
    const summary = await runAllTests();
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
});
