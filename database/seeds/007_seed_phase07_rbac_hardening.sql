-- GFMS Database Seed: 007_seed_phase07_rbac_hardening.sql
-- Phase 07: Platform Security Hardening, Operational Role Separation & UAT Accounts
-- Idempotent across PostgreSQL 14+ and pg-mem v3.0
-- NO DDL schema changes.

-- 1. Add Phase 07 Granular Permissions
INSERT INTO permissions (permission_key, description) VALUES
('warehouse:create', 'Create and activate/deactivate physical warehouse master records (System Administrator / Factory Manager)'),
('inventory:qc_override', 'QC Manager authority to override quarantine/hold/damaged stock status with mandatory reason and audit trail')
ON CONFLICT (permission_key) DO NOTHING;

-- 2. Grant warehouse:create ONLY to System Administrator & Factory Manager (not Warehouse Manager)
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'System Administrator'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:create')),
((SELECT id FROM roles WHERE role_name = 'Factory Manager'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:create'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Grant Production Manager production:view so operational production tab/screens are accessible without system config edit
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'Production Manager'), (SELECT id FROM permissions WHERE permission_key = 'production:view'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Grant Department Manager planning:view (read-only planning visibility strictly scoped to their managed department)
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'Department Manager'), (SELECT id FROM permissions WHERE permission_key = 'planning:view'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. Differentiate QC Manager from QC Inspector by granting QC Manager inventory:qc_override
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'QC Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:qc_override'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 6. Seed Standalone UAT Operational Accounts Across Warehouse & Inventory Roles
INSERT INTO users (username, password_hash, full_name, is_active) VALUES
('whmanager', '$2b$10$kgkREs9Gm34tMFRPeoSvbeY90qnb0CwnWpDbRG70frNL..zPytIeq', 'Karim Soliman (Warehouse Manager)', TRUE),
('whkeeper', '$2b$10$NPgnCaPfrIDCPPHojAMsd.KW3XghM.y/d6l4tq8ekhSFXrthsv0BC', 'Hassan Mahmoud (Warehouse Keeper)', TRUE),
('qcmanager', '$2b$10$ZS0ePEcDodizZHCEwnYI6OY0XaIANGYmKhtZNZ4SJT0NHuJMt9Ub2', 'Salma Abdelrahman (QC Manager)', TRUE),
('qcinspector', '$2b$10$0n/niEtOs.cvEGZy6x4Bsuv7jKEfKJtq/HaTLkwmXRZK1IdTEOD2y', 'Youssef Ibrahim (QC Inspector)', TRUE),
('purchasing', '$2b$10$3C36WVV5v7nqbTQPXCPcfuEId4T.kvIDKRaNgk8epPgjTWX8HzMeq', 'Mona Farouk (Purchasing Manager)', TRUE),
('prodmanager', '$2b$10$V5vuRzNEGrmb27/K9YU/UOqm0alGSRqgZvhplpoltgxuazOAaSmle', 'Adel Mostafa (Production Manager)', TRUE),
('finance', '$2b$10$LG3j.w1dw2CYL54/tbFwa.pT78QNNOAtzZARsK2J9NLbljJ/oeV86', 'Nourhan Samir (Finance Viewer)', TRUE)
ON CONFLICT (username) DO NOTHING;

-- 7. Map Seeded Operational UAT Accounts to Roles
INSERT INTO user_roles (user_id, role_id) VALUES
((SELECT id FROM users WHERE username = 'whmanager'), (SELECT id FROM roles WHERE role_name = 'Warehouse Manager')),
((SELECT id FROM users WHERE username = 'whkeeper'), (SELECT id FROM roles WHERE role_name = 'Warehouse Keeper')),
((SELECT id FROM users WHERE username = 'qcmanager'), (SELECT id FROM roles WHERE role_name = 'QC Manager')),
((SELECT id FROM users WHERE username = 'qcinspector'), (SELECT id FROM roles WHERE role_name = 'QC Inspector')),
((SELECT id FROM users WHERE username = 'purchasing'), (SELECT id FROM roles WHERE role_name = 'Purchasing Manager')),
((SELECT id FROM users WHERE username = 'prodmanager'), (SELECT id FROM roles WHERE role_name = 'Production Manager')),
((SELECT id FROM users WHERE username = 'finance'), (SELECT id FROM roles WHERE role_name = 'Finance Viewer'))
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 8. Assign Scoped Warehouse Staff Memberships for Seeded Warehouse Users
-- whmanager -> WH-RAW (primary) + WH-TRIM
-- whkeeper -> WH-RAW (primary)
-- qcinspector -> WH-RAW (primary)
INSERT INTO warehouse_staff (warehouse_id, user_id, staff_role, is_primary, assigned_by, notes) VALUES
(
  (SELECT id FROM warehouses WHERE warehouse_code = 'WH-RAW'),
  (SELECT id FROM users WHERE username = 'whmanager'),
  'WAREHOUSE_MANAGER',
  TRUE,
  1,
  'Phase 07 baseline primary manager for WH-RAW'
),
(
  (SELECT id FROM warehouses WHERE warehouse_code = 'WH-TRIM'),
  (SELECT id FROM users WHERE username = 'whmanager'),
  'WAREHOUSE_MANAGER',
  FALSE,
  1,
  'Phase 07 baseline secondary manager for WH-TRIM'
),
(
  (SELECT id FROM warehouses WHERE warehouse_code = 'WH-RAW'),
  (SELECT id FROM users WHERE username = 'whkeeper'),
  'WAREHOUSE_KEEPER',
  TRUE,
  1,
  'Phase 07 baseline storekeeper for WH-RAW'
),
(
  (SELECT id FROM warehouses WHERE warehouse_code = 'WH-RAW'),
  (SELECT id FROM users WHERE username = 'qcinspector'),
  'QC_INSPECTOR',
  TRUE,
  1,
  'Phase 07 baseline scoped QC inspector for WH-RAW'
)
ON CONFLICT (warehouse_id, user_id) DO NOTHING;

-- 9. Audit Record
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES
(1, 'PHASE_07_RBAC_HARDENING', 'SECURITY', 'SEED_007', 'Seeded warehouse:create, inventory:qc_override, Production/Department planning & production alignment, and operational UAT accounts', '127.0.0.1');
