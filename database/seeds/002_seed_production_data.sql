-- GFMS Database Seed: 002_seed_production_data.sql
-- Garment Factory Management System - Production Module Seed (Part 2)

-- 1. Insert Production Permissions (IDs 9 through 15)
INSERT INTO permissions (permission_key, description) VALUES
('production:view', 'View production configuration, statistics, and dashboards'),
('production:halls:create', 'Create and register new production halls'),
('production:halls:edit', 'Edit hall details, descriptions, and toggle active status'),
('production:lines:manage', 'Configure production lines, capacity, and supervisor assignments'),
('production:stages:manage', 'Create and configure factory production stages'),
('production:workflows:manage', 'Design, reorder, and configure production workflows'),
('production:settings:manage', 'Configure production policies, bypass controls, and thresholds');

-- 2. Map Permissions to Roles
-- System Administrator (Role 1) receives all production permissions (9 through 15)
INSERT INTO role_permissions (role_id, permission_id) VALUES
(1, 9), (1, 10), (1, 11), (1, 12), (1, 13), (1, 14), (1, 15);

-- Factory Manager (Role 2) receives production configuration permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
(2, 9), (2, 10), (2, 11), (2, 12), (2, 13), (2, 14);

-- 3. Insert Initial Production Halls (IDs 1, 2)
INSERT INTO production_halls (name, code, description, status) VALUES
('Hall A - Main Production Complex', 'HALL-A', 'Primary facility floor hosting automated spreading/cutting tables and high-speed sewing lines', 'active'),
('Hall B - Finishing & Quality Logistics', 'HALL-B', 'Secondary facility dedicated to specialized wash compliance, garment pressing, quality inspection, and export carton packaging', 'active');

-- 4. Insert Default Configurable Production Stages (IDs 1 through 6)
-- Section 6 defaults: Cutting, Sewing, Quality Inspection, Packing + optional stages
INSERT INTO production_stages (name, stage_code, description, stage_type, is_mandatory_default, status) VALUES
('Fabric Cutting & Bundling', 'STG-CUT', 'Laser and rotary fabric spreading, computerized pattern cutting, and bundle ticket tagging', 'STANDARD', TRUE, 'active'),
('Sewing & Garment Assembly', 'STG-SEW', 'In-line multi-operation stitching, seam overlocking, collar attachment, and sleeve assembly', 'STANDARD', TRUE, 'active'),
('Quality Assurance & In-line QC', 'STG-QC', 'Independent technical quality inspection, stitch defect audit, measurement tolerance check', 'QUALITY', TRUE, 'active'),
('Final Packing & Export Cartoning', 'STG-PCK', 'Poly-bagging, barcode price tagging, hanger insertion, and master export carton boxing', 'PACKING', TRUE, 'active'),
('Garment Washing & Enzyme Treatment', 'STG-WSH', 'Industrial soft-wash, stone wash, and wrinkle-resistant chemical bath processing', 'STANDARD', FALSE, 'active'),
('Embroidery & Screen Printing', 'STG-EMB', 'Multi-head computerized embroidery stitching and screen print heat-curing', 'STANDARD', FALSE, 'active');

-- 5. Insert Initial Production Lines
-- Section 5 rule: Support one Sewing Supervisor responsible for multiple sewing lines (e.g. User 2 / Sarah Jenkins)
INSERT INTO production_lines (line_number, name, hall_id, production_type, supervisor_id, capacity_per_day, description, status) VALUES
('LINE-SEW-01', 'Sewing Line Alpha (Knitwear)', 1, 'Sewing', 2, 700, 'Dedicated to basic crewneck and polo shirt assembly with 28 workstations', 'active'),
('LINE-SEW-02', 'Sewing Line Beta (Woven)', 1, 'Sewing', 2, 600, 'Configured for collared dress shirts and pocket attachment with 32 workstations', 'active'),
('LINE-CUT-01', 'Automated Cutting Unit 1', 1, 'Cutting', 3, 1500, 'Equipped with computerized spreading carriage and multi-ply vacuum cutting table', 'active'),
('LINE-FIN-01', 'Quality & Packing Conveyor 1', 2, 'Packing', 2, 900, 'Steam tunnel finisher, final QC inspection table, and carton boxing station', 'active');

-- 6. Insert Configurable Sample Workflows (Section 7 examples)
-- Workflow A: Standard 4-Stage Garment Flow
INSERT INTO production_workflows (name, workflow_code, description, product_category, status) VALUES
('Standard Garment Flow (4-Stage)', 'WF-STD-4S', 'Standard workflow for woven and jersey apparel: Cutting -> Sewing -> Quality Inspection -> Packing', 'General Apparel', 'active'),
('Direct Assembly Stitching Flow', 'WF-DIRECT-3S', 'Pre-cut fabric contract stitching workflow: Sewing -> Quality Inspection -> Packing', 'Contract Stitching', 'active'),
('Double-QC Tailored Garment Flow', 'WF-PREM-5S', 'High-end formalwear with pre-sewing cut inspection: Cutting -> QC Cut Pieces -> Sewing -> Final QC -> Packing', 'Premium Outerwear', 'active');

-- 7. Insert Workflow Steps (Ordering, Mandatory flag, Quality Gate flag)
-- Workflow 1: Cutting(1) -> Sewing(2) -> QC(3) -> Packing(4)
INSERT INTO production_workflow_steps (workflow_id, stage_id, step_order, is_mandatory, quality_gate, notes) VALUES
(1, 1, 1, TRUE, FALSE, 'Verify fabric roll lot and shade match before cut activation'),
(1, 2, 2, TRUE, FALSE, 'Strict adherence to garment SMV target times per station'),
(1, 3, 3, TRUE, TRUE, 'Critical quality gate: 100% inspection against AQL 2.5 standards'),
(1, 4, 4, TRUE, FALSE, 'Ensure correct SKU barcode labels and moisture silica packets in carton');

-- Workflow 2: Sewing(1) -> QC(2) -> Packing(3)
INSERT INTO production_workflow_steps (workflow_id, stage_id, step_order, is_mandatory, quality_gate, notes) VALUES
(2, 2, 1, TRUE, FALSE, 'Receive pre-bundled cuts from contract client'),
(2, 3, 2, TRUE, TRUE, 'Critical quality gate: verify stitch density and tension'),
(2, 4, 3, TRUE, FALSE, 'Bulk pack into client-designated containers');

-- Workflow 3: Cutting(1) -> QC(2) -> Sewing(3) -> QC(4) -> Packing(5)
INSERT INTO production_workflow_steps (workflow_id, stage_id, step_order, is_mandatory, quality_gate, notes) VALUES
(3, 1, 1, TRUE, FALSE, 'Precision laser cutting for structured panels'),
(3, 3, 2, TRUE, TRUE, 'Cut panel dimensions audit prior to stitching release'),
(3, 2, 3, TRUE, FALSE, 'Full garment construction on premium tailored line'),
(3, 3, 4, TRUE, TRUE, 'Final garment structural and seam stress testing'),
(3, 4, 5, TRUE, FALSE, 'Tissue wrap and individual branded luxury box packaging');

-- 8. Insert Production Settings & Policies
INSERT INTO production_settings (setting_key, setting_value, description) VALUES
('allow_stage_bypass', 'false', 'Enforce strict adherence: mandatory stages cannot be bypassed silently'),
('require_qc_signoff_to_bypass', 'true', 'Any emergency stage bypass requires explicit Quality Auditor signature'),
('max_active_lines_per_hall', '12', 'Safety and power grid capacity limitation per hall'),
('default_daily_target_efficiency', '85%', 'Standard baseline factory efficiency KPI target');

-- 9. Initial Seed Audit Log Record
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES
(1, 'MODULE_INIT', 'PRODUCTION', 'SEED_002', 'Production Module Setup & Configuration (Halls, Lines, Stages, Workflows) seeded successfully', '127.0.0.1');
