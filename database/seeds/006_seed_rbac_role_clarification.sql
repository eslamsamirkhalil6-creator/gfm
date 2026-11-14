-- GFMS Database Seed: 006_seed_rbac_role_clarification.sql
-- Garment Factory Management System - RBAC Role Clarification, Department Planner & Department User Separation
-- Idempotent across PostgreSQL 14+ and pg-mem v3.0

-- 1. Ensure Department Planner Role exists (distinct from Department Manager)
INSERT INTO roles (role_name, description) VALUES
('Department Planner', 'Department planning specialist: scoped capacity planning, production schedule visibility, and planning dashboards for assigned departments')
ON CONFLICT (role_name) DO NOTHING;

-- 2. Insert Explicit Planning Permissions
INSERT INTO permissions (permission_key, description) VALUES
('planning:view', 'View planning dashboards, capacity schedules, and resource plans within authorized scope'),
('planning:manage', 'Create and update departmental production planning schedules within authorized scope')
ON CONFLICT (permission_key) DO NOTHING;

-- 3. Map ONLY planning-related permissions + base dashboard:view to Department Planner
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'Department Planner'), (SELECT id FROM permissions WHERE permission_key = 'dashboard:view')),
((SELECT id FROM roles WHERE role_name = 'Department Planner'), (SELECT id FROM permissions WHERE permission_key = 'planning:view')),
((SELECT id FROM roles WHERE role_name = 'Department Planner'), (SELECT id FROM permissions WHERE permission_key = 'planning:manage'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Grant read-only planning visibility to Factory Manager (NO planning:manage, NO Department Manager impersonation)
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'Factory Manager'), (SELECT id FROM permissions WHERE permission_key = 'planning:view'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. Remove Department Manager scoped permissions from System Administrator
--    (System Administrator manages users/roles/settings/structure, never impersonates Department Manager)
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE role_name = 'System Administrator')
  AND permission_id IN (
    SELECT id FROM permissions WHERE permission_key IN ('departments:scoped:view', 'departments:scoped:manage')
  );

-- 6. Clarify @deptuser role assignment: @deptuser is the Department Manager of DEP-CUT,
--    not a generic Department User (remove redundant Department User role from @deptuser)
DELETE FROM user_roles
WHERE user_id = (SELECT id FROM users WHERE username = 'deptuser')
  AND role_id = (SELECT id FROM roles WHERE role_name = 'Department User');

-- 7. Seed clear standalone Department Planner ('planner' / Planner@123) and generic Department User ('deptstaff' / Staff@123)
INSERT INTO users (username, password_hash, full_name, is_active) VALUES
('planner', '$2b$10$/aYv1Y/q5nqqfEHSOTUod.iSpzcrMCrK2jjGRLstLpxMWmdOd9pEW', 'Nadia Hassan (PPC Department Planner)', TRUE),
('deptstaff', '$2b$10$RSf83HgAhl3MZ0BEFdAjouIXhRiXBcGXpsqLwfTNEqw3ZTnyg16rW', 'Tariq Mansour (Cutting Line Operator)', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Assign Department Planner role ONLY to 'planner'
INSERT INTO user_roles (user_id, role_id) VALUES
((SELECT id FROM users WHERE username = 'planner'), (SELECT id FROM roles WHERE role_name = 'Department Planner'))
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Assign generic Department User role ONLY to 'deptstaff'
INSERT INTO user_roles (user_id, role_id) VALUES
((SELECT id FROM users WHERE username = 'deptstaff'), (SELECT id FROM roles WHERE role_name = 'Department User'))
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Assign 'planner' to DEP-PLAN (Production Planning & Control) and 'deptstaff' to DEP-CUT (Cutting Section)
-- Note: Membership in department_employees does NOT grant Department User any department management or dashboard access.
INSERT INTO department_employees (department_id, user_id, position_title, is_primary, notes) VALUES
(
  (SELECT id FROM departments WHERE dept_code = 'DEP-PLAN'),
  (SELECT id FROM users WHERE username = 'planner'),
  'Production Planning Specialist',
  TRUE,
  'Scoped to Production Planning & Control (PPC)'
),
(
  (SELECT id FROM departments WHERE dept_code = 'DEP-CUT'),
  (SELECT id FROM users WHERE username = 'deptstaff'),
  'Fabric Spreading Operator',
  TRUE,
  'Generic departmental staff without management or dashboard authority'
)
ON CONFLICT (department_id, user_id) DO NOTHING;

-- 8. Seed initial sample planning schedule inside DEP-PLAN
INSERT INTO department_planning_schedules (department_id, production_line_id, plan_code, title, target_daily_output, planned_start_date, planned_end_date, status, notes, created_by) VALUES
(
  (SELECT id FROM departments WHERE dept_code = 'DEP-PLAN'),
  NULL,
  'PLN-PPC-2026-01',
  'Q2 Master Capacity & Line Balancing Plan',
  1800,
  CURRENT_DATE,
  CURRENT_DATE + 14,
  'active',
  'Baseline master planning schedule scoped to DEP-PLAN',
  (SELECT id FROM users WHERE username = 'planner')
)
ON CONFLICT (plan_code) DO NOTHING;

-- 9. Audit Record
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES
(1, 'RBAC_ROLE_CLARIFICATION', 'ROLE', 'SEED_006', 'Clarified Department User vs Department Manager, stripped scoped perms from SysAdmin, and provisioned Department Planner role & planning permissions', '127.0.0.1');
