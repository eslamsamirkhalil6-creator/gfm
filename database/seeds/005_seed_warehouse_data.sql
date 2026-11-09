-- GFMS Database Seed: 005_seed_warehouse_data.sql
-- Garment Factory Management System - Independent WMS RBAC Roles, Permissions & Baseline Seed
-- Idempotent across PostgreSQL 14+ and pg-mem v3.0

-- 1. Extend Existing Roles Table with Dedicated Operational Roles (DEC-09)
INSERT INTO roles (role_name, description) VALUES
('Warehouse Manager', 'Manages warehouse operations, bins, material catalog, cycle counts, within-threshold adjustments, and reorder submissions within assigned scope'),
('Warehouse Keeper', 'Executes authorized receiving, put-away, picking/issuing against approved requisitions, transfers, returns, and physical counts'),
('QC Manager', 'Senior quality control authority overseeing quarantine inspection, lot release/rejection, and quality overrides'),
('QC Inspector', 'Quality inspection specialist authorized to inspect incoming quarantine lots and execute QC release or rejection transitions'),
('Purchasing Manager', 'Procurement reviewer responsible for evaluating reorder requests, supplier references, lead times, and external PO tracking'),
('Production Manager', 'Cross-section production head overseeing material requisitions, approvals, and finished goods handovers'),
('Finance Viewer', 'Read-only financial observer accessing inventory balances, movement history, and Weighted Average Cost valuation reports')
ON CONFLICT (role_name) DO NOTHING;

-- 2. Extend Existing Permissions Table with Granular Warehouse & Inventory Permissions
INSERT INTO permissions (permission_key, description) VALUES
('warehouse:view', 'View warehouses, storage locations, stock balances, lots, and immutable movement history'),
('warehouse:manage', 'Configure warehouses, storage locations/bins, and warehouse staff assignments'),
('warehouse:materials:manage', 'Create and manage material categories, SKUs, UOMs, garment attributes, and reorder levels'),
('inventory:receive', 'Create and post Goods Receipt Notes (GRN), put-away moves, and finished goods receipts'),
('inventory:qc_inspect', 'Inspect quarantined lots and execute QC release or rejection stock transitions'),
('inventory:requisition:create', 'Create and submit material requisitions and material return requests'),
('inventory:requisition:approve', 'Approve or reject material requisitions triggering stock reservation'),
('inventory:issue', 'Issue AVAILABLE stock against approved requisitions (including audited FIFO override)'),
('inventory:return', 'Receive and post production material returns, waste, and damaged stock returns'),
('inventory:transfer', 'Execute internal bin moves and two-step inter-warehouse dispatch/receive transfers'),
('inventory:count', 'Create cycle/full count sheets and record physical counted quantities'),
('inventory:adjust:propose', 'Propose reason-coded stock adjustments and write-off requests'),
('inventory:adjust:approve', 'Approve non-write-off stock adjustments within configured policy threshold'),
('inventory:adjust:approve_high', 'Approve high-value stock adjustments and all inventory write-offs (Factory Manager authority)'),
('inventory:reorder:create', 'Create and submit inventory reorder requests'),
('inventory:reorder:review', 'Review reorder requests for supplier sourcing and PO reference tracking'),
('inventory:reorder:approve', 'Final approval of inventory reorder requests'),
('warehouse:reports:valuation', 'View Weighted Average Cost inventory valuation and adjustment financial summaries'),
('warehouse:settings:manage', 'Configure global warehouse thresholds, tolerances, and system parameters')
ON CONFLICT (permission_key) DO NOTHING;

-- 3. Map Warehouse & Inventory Permissions to Roles (Respecting Phase 02 Segregation Rules)
-- System Administrator: Security, master setup & global settings ONLY (NO automatic operational approvals)
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'System Administrator'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:view')),
((SELECT id FROM roles WHERE role_name = 'System Administrator'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:manage')),
((SELECT id FROM roles WHERE role_name = 'System Administrator'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:materials:manage')),
((SELECT id FROM roles WHERE role_name = 'System Administrator'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:reports:valuation')),
((SELECT id FROM roles WHERE role_name = 'System Administrator'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:settings:manage'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Factory Manager: Broad operational visibility and final approval authority (DEC-08, DEC-10)
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'Factory Manager'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:view')),
((SELECT id FROM roles WHERE role_name = 'Factory Manager'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:manage')),
((SELECT id FROM roles WHERE role_name = 'Factory Manager'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:materials:manage')),
((SELECT id FROM roles WHERE role_name = 'Factory Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:requisition:approve')),
((SELECT id FROM roles WHERE role_name = 'Factory Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:adjust:approve')),
((SELECT id FROM roles WHERE role_name = 'Factory Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:adjust:approve_high')),
((SELECT id FROM roles WHERE role_name = 'Factory Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:reorder:create')),
((SELECT id FROM roles WHERE role_name = 'Factory Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:reorder:approve')),
((SELECT id FROM roles WHERE role_name = 'Factory Manager'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:reports:valuation'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Warehouse Manager: Scoped warehouse management, within-threshold approvals & reorder submission
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'Warehouse Manager'), (SELECT id FROM permissions WHERE permission_key = 'dashboard:view')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Manager'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:view')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Manager'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:manage')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Manager'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:materials:manage')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:receive')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:issue')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:return')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:transfer')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:count')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:adjust:propose')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:adjust:approve')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:reorder:create')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Manager'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:reports:valuation'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Warehouse Keeper: Execution-only storekeeping transactions (NO approval rights)
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'Warehouse Keeper'), (SELECT id FROM permissions WHERE permission_key = 'dashboard:view')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Keeper'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:view')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Keeper'), (SELECT id FROM permissions WHERE permission_key = 'inventory:receive')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Keeper'), (SELECT id FROM permissions WHERE permission_key = 'inventory:issue')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Keeper'), (SELECT id FROM permissions WHERE permission_key = 'inventory:return')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Keeper'), (SELECT id FROM permissions WHERE permission_key = 'inventory:transfer')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Keeper'), (SELECT id FROM permissions WHERE permission_key = 'inventory:count')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Keeper'), (SELECT id FROM permissions WHERE permission_key = 'inventory:adjust:propose')),
((SELECT id FROM roles WHERE role_name = 'Warehouse Keeper'), (SELECT id FROM permissions WHERE permission_key = 'inventory:reorder:create'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- QC Manager & QC Inspector: Independent quality inspection and quarantine release/rejection
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'QC Manager'), (SELECT id FROM permissions WHERE permission_key = 'dashboard:view')),
((SELECT id FROM roles WHERE role_name = 'QC Manager'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:view')),
((SELECT id FROM roles WHERE role_name = 'QC Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:qc_inspect')),
((SELECT id FROM roles WHERE role_name = 'QC Inspector'), (SELECT id FROM permissions WHERE permission_key = 'dashboard:view')),
((SELECT id FROM roles WHERE role_name = 'QC Inspector'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:view')),
((SELECT id FROM roles WHERE role_name = 'QC Inspector'), (SELECT id FROM permissions WHERE permission_key = 'inventory:qc_inspect'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Purchasing Manager: Procurement review of reorder requests
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'Purchasing Manager'), (SELECT id FROM permissions WHERE permission_key = 'dashboard:view')),
((SELECT id FROM roles WHERE role_name = 'Purchasing Manager'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:view')),
((SELECT id FROM roles WHERE role_name = 'Purchasing Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:reorder:review'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Production Manager: Production requisitions & approvals
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'Production Manager'), (SELECT id FROM permissions WHERE permission_key = 'dashboard:view')),
((SELECT id FROM roles WHERE role_name = 'Production Manager'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:view')),
((SELECT id FROM roles WHERE role_name = 'Production Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:requisition:create')),
((SELECT id FROM roles WHERE role_name = 'Production Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:requisition:approve'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Department Manager: Scoped requisition create/approve for own managed department
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'Department Manager'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:view')),
((SELECT id FROM roles WHERE role_name = 'Department Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:requisition:create')),
((SELECT id FROM roles WHERE role_name = 'Department Manager'), (SELECT id FROM permissions WHERE permission_key = 'inventory:requisition:approve'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Finance Viewer: Read-only inventory & WAC valuation visibility
INSERT INTO role_permissions (role_id, permission_id) VALUES
((SELECT id FROM roles WHERE role_name = 'Finance Viewer'), (SELECT id FROM permissions WHERE permission_key = 'dashboard:view')),
((SELECT id FROM roles WHERE role_name = 'Finance Viewer'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:view')),
((SELECT id FROM roles WHERE role_name = 'Finance Viewer'), (SELECT id FROM permissions WHERE permission_key = 'warehouse:reports:valuation'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Seed Warehouse Settings (PARAM-01: unconfigured threshold -> Factory Manager required; PARAM-03: 0% over-delivery tolerance)
INSERT INTO warehouse_settings (setting_key, setting_value, description) VALUES
('adjustment_approval_threshold', 'UNCONFIGURED', 'Configurable adjustment value threshold; until explicitly configured, all stock adjustments require Factory Manager approval (PARAM-01)'),
('write_off_requires_factory_manager', 'true', 'All WRITE_OFF reason adjustments unconditionally require Factory Manager approval (DEC-08)'),
('grn_over_delivery_tolerance_pct', '0', 'Maximum allowed percentage over expected PO quantity on GRN receipt (PARAM-03 default 0%)'),
('fifo_override_requires_reason', 'true', 'Advisory FIFO picking allows override only when an explicit reason code is recorded and audited (DEC-04)')
ON CONFLICT (setting_key) DO NOTHING;

-- 5. Seed Initial Warehouses (Linked organically to organizational DEP-INV id=3)
INSERT INTO warehouses (warehouse_code, name, warehouse_type, department_id, require_bin_tracking, description, status) VALUES
('WH-RAW', 'Main Fabric & Raw Material Warehouse', 'FABRIC', 3, TRUE, 'Primary bin-managed storage for woven/knitted fabric rolls and raw materials', 'active'),
('WH-TRIM', 'Trims & Accessories Store', 'TRIMS_ACCESSORIES', 3, TRUE, 'Bin-managed store for zippers, buttons, thread cones, interlining, and labels', 'active'),
('WH-FG', 'Finished Goods Export Warehouse', 'FINISHED_GOODS', 3, FALSE, 'Consolidated packed garment cartons ready for buyer export dispatch (uses DEFAULT bin)', 'active'),
('WH-QUAR', 'Incoming QC Quarantine Bay', 'QUARANTINE', 3, FALSE, 'Segregated holding bay for newly received fabrics and trims awaiting QC inspection', 'active')
ON CONFLICT (warehouse_code) DO NOTHING;

-- 6. Ensure Every Seeded Warehouse Has Its Mandatory DEFAULT Location (DEC-01) + Sample Bins
INSERT INTO warehouse_locations (warehouse_id, location_code, name, location_type, is_default, status)
SELECT id, 'DEFAULT', name || ' - Default Location', 'DEFAULT', TRUE, 'active'
FROM warehouses
ON CONFLICT (warehouse_id, location_code) DO NOTHING;

INSERT INTO warehouse_locations (warehouse_id, location_code, name, location_type, zone, aisle, rack, bin, is_default, status)
SELECT id, 'RCV-DOCK-01', 'Receiving Dock 01', 'RECEIVING', 'RCV', 'A01', 'R00', 'B01', FALSE, 'active'
FROM warehouses WHERE warehouse_code = 'WH-RAW'
ON CONFLICT (warehouse_id, location_code) DO NOTHING;

INSERT INTO warehouse_locations (warehouse_id, location_code, name, location_type, zone, aisle, rack, bin, is_default, status)
SELECT id, 'Z1-A01-R01-B01', 'Fabric Zone 1 Rack 1 Bin 1', 'STORAGE', 'Z1', 'A01', 'R01', 'B01', FALSE, 'active'
FROM warehouses WHERE warehouse_code = 'WH-RAW'
ON CONFLICT (warehouse_id, location_code) DO NOTHING;

INSERT INTO warehouse_locations (warehouse_id, location_code, name, location_type, zone, aisle, rack, bin, is_default, status)
SELECT id, 'TRM-A01-R01-B01', 'Trims Rack 1 Bin 1', 'STORAGE', 'TRM', 'A01', 'R01', 'B01', FALSE, 'active'
FROM warehouses WHERE warehouse_code = 'WH-TRIM'
ON CONFLICT (warehouse_id, location_code) DO NOTHING;

-- 7. Seed Material Categories (DEC-05 default QC flags)
INSERT INTO material_categories (category_code, name, category_type, requires_qc_default, is_lot_tracked_default, is_roll_tracked_default, description) VALUES
('CAT-FAB', 'Woven & Knitted Fabrics', 'FABRIC', TRUE, TRUE, TRUE, 'Roll-tracked fabrics requiring dye-lot/shade control and QC inspection on receipt'),
('CAT-TRM', 'Garment Trims & Accessories', 'TRIM_ACCESSORY', TRUE, TRUE, FALSE, 'Zippers, buttons, woven labels, elastics, and sewing threads'),
('CAT-PKG', 'Packing & Cartons', 'PACKAGING', FALSE, FALSE, FALSE, 'Export master cartons, polybags, hangtags, and silica packets'),
('CAT-FG', 'Finished Garments', 'FINISHED_GOOD', TRUE, TRUE, FALSE, 'Completed garments packed for export inventory'),
('CAT-CON', 'Factory Consumables', 'CONSUMABLE', FALSE, FALSE, FALSE, 'Machine needles, chalk, oils, and general cutting consumables')
ON CONFLICT (category_code) DO NOTHING;

-- 8. Seed Initial Baseline Material SKUs (DEC-02, DEC-03, DEC-11)
INSERT INTO materials (sku, name, category_id, base_uom, color, size, attributes_json, is_lot_tracked, is_roll_tracked, requires_qc_on_receipt, min_stock_level, reorder_level)
SELECT 'FAB-COT-220-NVY', '100% Combed Cotton Jersey 220 GSM (Navy)', id, 'meter', 'Navy', '165cm', '{"gsm":220,"width_cm":165,"composition":"100% Cotton","shrinkage_pct":2.5}', TRUE, TRUE, TRUE, 200, 500
FROM material_categories WHERE category_code = 'CAT-FAB'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO materials (sku, name, category_id, base_uom, color, size, attributes_json, is_lot_tracked, is_roll_tracked, requires_qc_on_receipt, min_stock_level, reorder_level)
SELECT 'TRM-ZIP-18-BLK', 'Nylon Coil Zipper #5 18cm (Black)', id, 'pcs', 'Black', '18cm', '{"teeth_type":"Nylon Coil","gauge":"#5"}', TRUE, FALSE, TRUE, 1000, 2500
FROM material_categories WHERE category_code = 'CAT-TRM'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO materials (sku, name, category_id, base_uom, color, size, attributes_json, is_lot_tracked, is_roll_tracked, requires_qc_on_receipt, min_stock_level, reorder_level)
SELECT 'PKG-CTN-EXP-L', '5-Ply Export Master Carton (Large)', id, 'pcs', 'Kraft', '60x40x40cm', '{"ply":5,"burst_strength":"ECT-44"}', FALSE, FALSE, FALSE, 150, 400
FROM material_categories WHERE category_code = 'CAT-PKG'
ON CONFLICT (sku) DO NOTHING;

-- 9. Record Initial Audit Trail Entry
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES
(1, 'MODULE_INIT', 'WAREHOUSE', 'SEED_005', 'WMS Phase 03 database schema, dedicated RBAC roles/permissions, and baseline warehouses/materials seeded', '127.0.0.1');
