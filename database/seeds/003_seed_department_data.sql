-- GFMS Database Seed: 003_seed_department_data.sql
-- Garment Factory Management System - Department Management Module Seed (Part 3)

-- 1. Insert Department Permissions (IDs 16 through 23)
INSERT INTO permissions (permission_key, description) VALUES
('departments:view', 'View organizational department directory, hierarchy, and dashboards'),
('departments:create', 'Create and register new departments and sub-departments'),
('departments:edit', 'Modify department names, descriptions, and functional scope'),
('departments:status', 'Activate or deactivate organizational departments'),
('departments:manage_manager', 'Assign, transfer, or replace primary department managers'),
('departments:manage_employees', 'Assign, transfer, and configure department staff positions'),
('departments:hierarchy', 'Restructure department parent-child organizational hierarchy'),
('departments:reports', 'Access department staffing distribution and allocation metrics');

-- 2. Map Department Permissions to Roles
-- System Administrator (Role 1) receives all department permissions (16 through 23)
INSERT INTO role_permissions (role_id, permission_id) VALUES
(1, 16), (1, 17), (1, 18), (1, 19), (1, 20), (1, 21), (1, 22), (1, 23);

-- Factory Manager (Role 2) receives operational department permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
(2, 16), (2, 18), (2, 20), (2, 21), (2, 23);

-- 3. Insert Initial Suggested Top-Level Departments (Section 3: 10 Core Departments)
INSERT INTO departments (dept_code, name, description, parent_id, manager_id, status) VALUES
('DEP-HR', 'Human Resources (HR)', 'Workforce relations, onboarding, compliance, and factory health & safety regulations', NULL, NULL, 'active'),
('DEP-PROD', 'Production Department', 'Core garment manufacturing operations including spreading, cutting, stitching, and finishing', NULL, 2, 'active'),
('DEP-INV', 'Inventory & Warehouse', 'Raw fabric roll storage, accessories/trims stock, and finished goods warehouse', NULL, NULL, 'active'),
('DEP-PUR', 'Purchasing & Suppliers', 'Yarn, fabric, zipper, button sourcing, vendor contracts, and supplier procurement', NULL, NULL, 'active'),
('DEP-QC', 'Quality Control (QC)', 'Independent technical quality assurance, inline needle audits, AQL 2.5 final inspections', NULL, NULL, 'active'),
('DEP-FIN', 'Finance & Accounting', 'Factory cost accounting, export invoicing, overhead budgeting, and financial ledger', NULL, NULL, 'active'),
('DEP-SALES', 'Clients & Orders / Sales', 'Buyer merchandising, customer order specifications, sample approval, and export shipments', NULL, NULL, 'active'),
('DEP-TRANS', 'Transportation & Logistics', 'Inter-facility material transport, inland container trucking, and export harbor delivery', NULL, NULL, 'active'),
('DEP-PLAN', 'Production Planning & Control (PPC)', 'Capacity scheduling, material requirement planning (MRP), and order line balancing', NULL, NULL, 'active'),
('DEP-IT', 'IT & Administration', 'Factory digital infrastructure, GFMS server operations, network, and industrial ERP systems', NULL, 1, 'active');

-- 4. Insert Sub-Departments under Production (Section 5: Hierarchy Example)
-- Cutting, Sewing, Packing under Production Department (Parent ID = 2)
INSERT INTO departments (dept_code, name, description, parent_id, manager_id, status) VALUES
('DEP-CUT', 'Cutting Section', 'Automated fabric spreading, pattern plotting, precision computerized cutting, and bundle ticket creation', 2, 3, 'active'),
('DEP-SEW', 'Sewing & Assembly Section', 'Assembly line balance, workstation stitching, overlock seam operations, and in-line assembly', 2, 2, 'active'),
('DEP-PCK', 'Packing & Finishing Section', 'Garment steaming, metal detection screening, poly-bagging, barcode labeling, and export carton packaging', 2, NULL, 'active');

-- 5. Link Production Lines to Respective Production Sub-Departments
UPDATE production_lines SET department_id = 12 WHERE line_number IN ('LINE-SEW-01', 'LINE-SEW-02');
UPDATE production_lines SET department_id = 11 WHERE line_number = 'LINE-CUT-01';
UPDATE production_lines SET department_id = 13 WHERE line_number = 'LINE-FIN-01';

-- 6. Insert Initial Department Employees (Section 7: Integration with existing users)
-- Sarah Jenkins (User 2) is Primary Production Manager & Sewing Head (Multi-dept assignment authorized)
INSERT INTO department_employees (department_id, user_id, position_title, is_primary, notes) VALUES
(2, 2, 'Head of Production Operations', TRUE, 'Primary factory floor production executive oversight'),
(12, 2, 'Senior Sewing Supervisor', FALSE, 'Direct technical leadership over lines LINE-SEW-01 and LINE-SEW-02'),
-- Ahmed Tarek (User 3) is assigned to Cutting Section
(11, 3, 'Cutting Floor Lead Technician', TRUE, 'Spreading carriage operator and computerized vacuum cutter supervisor'),
-- Eslam Samir (User 1) is assigned to IT & Administration
(10, 1, 'Chief Systems Architect & IT Lead', TRUE, 'Full GFMS platform administration and infrastructure maintenance');

-- 7. Record Manager Tenure History
INSERT INTO department_manager_history (department_id, manager_id, assigned_by, notes) VALUES
(2, 2, 1, 'Initial system provision: Sarah Jenkins appointed as Head of Production'),
(10, 1, 1, 'Initial system provision: Eslam Samir appointed as Head of IT & Administration'),
(11, 3, 1, 'Initial system provision: Ahmed Tarek appointed as Lead Cutting Supervisor'),
(12, 2, 1, 'Initial system provision: Sarah Jenkins appointed as Sewing Section Manager');

-- 8. Seed Audit Trail Record
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES
(1, 'MODULE_INIT', 'DEPARTMENT', 'SEED_003', 'Department Management Module initialized with 10 core departments, 3 sub-departments, and employee mappings', '127.0.0.1');
