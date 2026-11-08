-- GFMS Database Seed: 004_seed_department_manager_role.sql
-- Garment Factory Management System - Department Manager Role & Scoped Privileges (Part 4)

-- 1. Insert Department Manager Role
INSERT INTO roles (role_name, description) VALUES
('Department Manager', 'Department head authority: scoped to manage personnel, view production lines, and oversee operational settings for assigned department')
ON CONFLICT (role_name) DO NOTHING;

-- 2. Insert Department-Scoped Permissions
INSERT INTO permissions (permission_key, description) VALUES
('departments:scoped:view', 'View details, staffing, and lines for assigned department'),
('departments:scoped:manage', 'Manage operational staffing and settings for assigned department')
ON CONFLICT (permission_key) DO NOTHING;

-- 3. Map Permissions to Department Manager
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'Department Manager'), (SELECT id FROM permissions WHERE permission_key = 'dashboard:view')),
((SELECT id FROM roles WHERE role_name = 'Department Manager'), (SELECT id FROM permissions WHERE permission_key = 'departments:scoped:view')),
((SELECT id FROM roles WHERE role_name = 'Department Manager'), (SELECT id FROM permissions WHERE permission_key = 'departments:scoped:manage'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Also System Administrator receives scoped permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'System Administrator'), (SELECT id FROM permissions WHERE permission_key = 'departments:scoped:view')),
((SELECT id FROM roles WHERE role_name = 'System Administrator'), (SELECT id FROM permissions WHERE permission_key = 'departments:scoped:manage'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Assign Department Manager Role to Ahmed Tarek (user_id 3, assigned manager of DEP-CUT)
INSERT INTO user_roles (user_id, role_id) VALUES
(3, (SELECT id FROM roles WHERE role_name = 'Department Manager'))
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 5. Seed Audit Trail Record
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES
(1, 'ROLE_PROVISION', 'ROLE', 'SEED_004', 'Department Manager role provisioned with department-scoped permissions and assigned to @deptuser', '127.0.0.1');
