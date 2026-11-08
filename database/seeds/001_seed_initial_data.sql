-- GFMS Database Seed: 001_seed_initial_data.sql
-- Garment Factory Management System - Technical Foundation v0.1

-- 1. Insert Roles (Auto-assigned IDs 1, 2, 3)
INSERT INTO roles (role_name, description) VALUES
('System Administrator', 'Full administrative authority: user provisioning, role assignments, audit access, and system config'),
('Factory Manager', 'Factory oversight: production overview, metrics dashboard access, and workforce view'),
('Department User', 'Departmental staff: constrained basic operational dashboard and station activity');

-- 2. Insert Permissions (Auto-assigned IDs 1 through 8)
INSERT INTO permissions (permission_key, description) VALUES
('dashboard:view', 'Access to base operational dashboard'),
('dashboard:factory', 'Access to factory manager production metrics overview'),
('users:read', 'View list of users, profiles, and statuses'),
('users:create', 'Create and register new system users'),
('users:update', 'Update user profiles, activation status, and passwords'),
('users:roles', 'Assign and revoke user roles'),
('roles:read', 'View available system roles and associated permission keys'),
('audit:read', 'Review immutable system audit trail and security logs');

-- 3. Map Role Permissions
-- System Administrator (Role 1) has all permissions (1 through 8)
INSERT INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8);

-- Factory Manager (Role 2) has dashboard:view (1), dashboard:factory (2), users:read (3)
INSERT INTO role_permissions (role_id, permission_id) VALUES
(2, 1), (2, 2), (2, 3);

-- Department User (Role 3) has only dashboard:view (1)
INSERT INTO role_permissions (role_id, permission_id) VALUES
(3, 1);

-- 4. Insert Default Users (Auto-assigned IDs 1, 2, 3)
-- admin: Admin@123
-- manager: Manager@123
-- deptuser: Dept@123
INSERT INTO users (username, password_hash, full_name, is_active) VALUES
('admin', '$2b$10$3iiOMcg7pgibq1oRlD2mkuzywbDegp5U70Lz.c30CsYprm0r686Q6', 'Eslam Samir (System Architect)', TRUE),
('manager', '$2b$10$I7FYjnc7xDZA5W9gKkhdA.E1DxBiqEOtxmc8PCnRhncgy0kT6c/Mq', 'Sarah Jenkins (Production Floor Manager)', TRUE),
('deptuser', '$2b$10$dpo5uX6Ld06fs5JsOUjQpOauB2t4I2g/YZWZFcoEB0oI1ZwBpTLMG', 'Ahmed Tarek (Cutting Dept Operator)', TRUE);

-- 5. Assign User Roles
INSERT INTO user_roles (user_id, role_id) VALUES
(1, 1), -- admin -> System Administrator
(2, 2), -- manager -> Factory Manager
(3, 3); -- deptuser -> Department User

-- 6. Initial Seed Audit Log Record
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES
(1, 'SYSTEM_INIT', 'DATABASE', 'SEED_001', 'Initial database migration and seed data provisioned successfully', '127.0.0.1');
