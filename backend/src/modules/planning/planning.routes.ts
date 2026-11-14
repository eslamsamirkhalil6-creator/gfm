import { Router } from 'express';
import {
  authenticateJWT,
  requireAnyPermission,
  requirePermission,
  requirePlanningScope,
} from '../../middleware/auth.middleware.ts';
import { validateBody } from '../../middleware/validation.middleware.ts';
import { PlanningController } from './planning.controller.ts';

export const planningRouter = Router();

planningRouter.use(authenticateJWT);

planningRouter.get(
  '/planning/dashboard',
  requireAnyPermission('planning:view', 'planning:manage'),
  PlanningController.getDashboard
);

planningRouter.get(
  '/planning/departments/:id',
  requireAnyPermission('planning:view', 'planning:manage'),
  requirePlanningScope({ paramKey: 'id', readOnlyGlobalAllowed: true }),
  PlanningController.getDepartmentPlanning
);

planningRouter.post(
  '/planning/schedules',
  requirePermission('planning:manage'),
  validateBody(['department_id', 'plan_code', 'title', 'planned_start_date', 'planned_end_date']),
  requirePlanningScope({ bodyKey: 'department_id', readOnlyGlobalAllowed: false }),
  PlanningController.createSchedule
);

planningRouter.put(
  '/planning/schedules/:id/status',
  requirePermission('planning:manage'),
  validateBody(['status']),
  PlanningController.updateScheduleStatus
);
