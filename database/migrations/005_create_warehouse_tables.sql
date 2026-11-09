-- GFMS Database Migration: 005_create_warehouse_tables.sql
-- Garment Factory Management System - Independent Warehouse Management System (WMS)
-- PostgreSQL 14+ and pg-mem v3.0 compatible DDL

-- ============================================================================
-- 1. WMS Configuration & Policy Settings (PARAM-01, PARAM-03)
-- ============================================================================
CREATE TABLE IF NOT EXISTS warehouse_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. Warehouse Topology (DEC-01)
-- ============================================================================
CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    warehouse_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    warehouse_type VARCHAR(30) NOT NULL CHECK (
        warehouse_type IN (
            'RAW_MATERIAL',
            'FABRIC',
            'TRIMS_ACCESSORIES',
            'WIP',
            'FINISHED_GOODS',
            'QUARANTINE',
            'GENERAL'
        )
    ),
    department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
    manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    require_bin_tracking BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_locations (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    location_code VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    location_type VARCHAR(30) NOT NULL DEFAULT 'STORAGE' CHECK (
        location_type IN ('DEFAULT', 'RECEIVING', 'STORAGE', 'STAGING', 'QC_HOLD', 'DISPATCH', 'DAMAGED')
    ),
    zone VARCHAR(40),
    aisle VARCHAR(40),
    rack VARCHAR(40),
    bin VARCHAR(40),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (warehouse_id, location_code),
    UNIQUE (warehouse_id, id)
);

-- ============================================================================
-- 3. Warehouse Staff Assignments (PARAM-04)
-- ============================================================================
CREATE TABLE IF NOT EXISTS warehouse_staff (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    staff_role VARCHAR(30) NOT NULL CHECK (
        staff_role IN ('WAREHOUSE_MANAGER', 'WAREHOUSE_KEEPER', 'QC_INSPECTOR', 'VIEWER')
    ),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (warehouse_id, user_id),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- ============================================================================
-- 4. Material Master & Global Weighted Average Cost (DEC-02, DEC-03, DEC-05, DEC-11, PARAM-02)
-- ============================================================================
CREATE TABLE IF NOT EXISTS material_categories (
    id SERIAL PRIMARY KEY,
    category_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) UNIQUE NOT NULL,
    category_type VARCHAR(30) NOT NULL CHECK (
        category_type IN ('FABRIC', 'TRIM_ACCESSORY', 'PACKAGING', 'FINISHED_GOOD', 'CONSUMABLE')
    ),
    requires_qc_default BOOLEAN NOT NULL DEFAULT TRUE,
    is_lot_tracked_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_roll_tracked_default BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS materials (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(80) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category_id INTEGER NOT NULL REFERENCES material_categories(id) ON DELETE RESTRICT,
    base_uom VARCHAR(20) NOT NULL CHECK (
        base_uom IN ('meter', 'yard', 'kg', 'pcs', 'roll', 'cone', 'carton', 'set', 'box')
    ),
    color VARCHAR(60),
    size VARCHAR(40),
    attributes_json TEXT NOT NULL DEFAULT '{}',
    is_lot_tracked BOOLEAN NOT NULL DEFAULT FALSE,
    is_roll_tracked BOOLEAN NOT NULL DEFAULT FALSE,
    requires_qc_on_receipt BOOLEAN NOT NULL DEFAULT TRUE,
    min_stock_level NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (min_stock_level >= 0),
    reorder_level NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    -- Global Weighted Average Cost per material (PARAM-02; calculated in application service layer)
    weighted_avg_cost NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (weighted_avg_cost >= 0),
    total_valued_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (total_valued_qty >= 0),
    total_inventory_value NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (total_inventory_value >= 0),
    last_cost_updated_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. Lot, Dye-Lot & Fabric Roll Tracking (DEC-02, Section 6.3 & 6.8)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_lots (
    id SERIAL PRIMARY KEY,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    lot_number VARCHAR(80) NOT NULL,
    roll_number VARCHAR(80) NOT NULL DEFAULT '',
    shade_code VARCHAR(50),
    supplier_name VARCHAR(150),
    supplier_batch_ref VARCHAR(100),
    initial_qty NUMERIC(14,4) NOT NULL CHECK (initial_qty > 0),
    remaining_qty NUMERIC(14,4) NOT NULL CHECK (remaining_qty >= 0),
    qc_status VARCHAR(25) NOT NULL DEFAULT 'PENDING' CHECK (
        qc_status IN ('PENDING', 'PASSED', 'PARTIALLY_PASSED', 'REJECTED')
    ),
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (material_id, lot_number, roll_number)
);

-- ============================================================================
-- 6. Real-Time Inventory Balances (Section 6.4 & 6.8)
-- Uses normalized non-null lot_key ('NONE' or CAST(lot_id AS TEXT)) for pg-mem + PG uniqueness parity
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_balances (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    location_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    lot_key VARCHAR(64) NOT NULL DEFAULT 'NONE',
    stock_status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (
        stock_status IN ('AVAILABLE', 'QUARANTINE', 'HOLD', 'DAMAGED', 'SCRAP', 'IN_TRANSIT')
    ),
    qty_on_hand NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
    qty_reserved NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
    qty_available NUMERIC(14,4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (qty_reserved <= qty_on_hand),
    CHECK ((lot_id IS NULL AND lot_key = 'NONE') OR (lot_id IS NOT NULL AND lot_key <> 'NONE')),
    FOREIGN KEY (warehouse_id, location_id) REFERENCES warehouse_locations(warehouse_id, id) ON DELETE RESTRICT,
    UNIQUE (warehouse_id, location_id, material_id, lot_key, stock_status)
);

-- ============================================================================
-- 7. Goods Receiving & QC Inspection Outcomes (Section 6.8 & Clarification 4.2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS goods_receipts (
    id SERIAL PRIMARY KEY,
    grn_number VARCHAR(60) UNIQUE NOT NULL,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    supplier_name VARCHAR(150) NOT NULL,
    delivery_note_no VARCHAR(100),
    po_reference VARCHAR(100),
    received_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(25) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
    notes TEXT,
    received_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    posted_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    posted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id SERIAL PRIMARY KEY,
    grn_id INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    target_location_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    expected_qty NUMERIC(14,4) CHECK (expected_qty IS NULL OR expected_qty >= 0),
    received_qty NUMERIC(14,4) NOT NULL CHECK (received_qty > 0),
    accepted_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (accepted_qty >= 0),
    rejected_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0),
    damaged_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
    pending_inspection_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (pending_inspection_qty >= 0),
    unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    qc_status VARCHAR(25) NOT NULL DEFAULT 'PENDING' CHECK (
        qc_status IN ('PENDING', 'PASSED', 'PARTIALLY_PASSED', 'REJECTED')
    ),
    discrepancy_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (received_qty = accepted_qty + rejected_qty + damaged_qty + pending_inspection_qty),
    FOREIGN KEY (warehouse_id, target_location_id) REFERENCES warehouse_locations(warehouse_id, id) ON DELETE RESTRICT
);

-- Supports partial & multiple QC inspection outcomes per GRN line or lot
CREATE TABLE IF NOT EXISTS qc_inspections (
    id SERIAL PRIMARY KEY,
    inspection_number VARCHAR(60) UNIQUE NOT NULL,
    grn_item_id INTEGER REFERENCES goods_receipt_items(id) ON DELETE RESTRICT,
    lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    location_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    inspected_qty NUMERIC(14,4) NOT NULL CHECK (inspected_qty > 0),
    passed_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (passed_qty >= 0),
    rejected_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0),
    damaged_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
    outcome_status VARCHAR(25) NOT NULL CHECK (
        outcome_status IN ('PENDING', 'PASSED', 'PARTIALLY_PASSED', 'REJECTED')
    ),
    inspector_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    inspected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    CHECK (inspected_qty = passed_qty + rejected_qty + damaged_qty),
    FOREIGN KEY (warehouse_id, location_id) REFERENCES warehouse_locations(warehouse_id, id) ON DELETE RESTRICT
);

-- ============================================================================
-- 8. Material Requisitions, Stock Issuing & Material Returns (DEC-04, DEC-06)
-- ============================================================================
CREATE TABLE IF NOT EXISTS material_requisitions (
    id SERIAL PRIMARY KEY,
    requisition_number VARCHAR(60) UNIQUE NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    production_line_id INTEGER REFERENCES production_lines(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    reference_type VARCHAR(40),
    reference_code VARCHAR(100),
    required_date DATE,
    status VARCHAR(25) NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_ISSUED', 'FULFILLED', 'REJECTED', 'CANCELLED')
    ),
    requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS material_requisition_items (
    id SERIAL PRIMARY KEY,
    requisition_id INTEGER NOT NULL REFERENCES material_requisitions(id) ON DELETE RESTRICT,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    preferred_lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    requested_qty NUMERIC(14,4) NOT NULL CHECK (requested_qty > 0),
    reserved_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
    issued_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (issued_qty >= 0),
    notes TEXT,
    CHECK (issued_qty <= requested_qty)
);

CREATE TABLE IF NOT EXISTS stock_issues (
    id SERIAL PRIMARY KEY,
    issue_number VARCHAR(60) UNIQUE NOT NULL,
    requisition_id INTEGER NOT NULL REFERENCES material_requisitions(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    production_line_id INTEGER REFERENCES production_lines(id) ON DELETE RESTRICT,
    status VARCHAR(25) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
    issued_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    received_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    posted_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_issue_items (
    id SERIAL PRIMARY KEY,
    issue_id INTEGER NOT NULL REFERENCES stock_issues(id) ON DELETE RESTRICT,
    requisition_item_id INTEGER NOT NULL REFERENCES material_requisition_items(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    location_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    issued_qty NUMERIC(14,4) NOT NULL CHECK (issued_qty > 0),
    unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    fifo_overridden BOOLEAN NOT NULL DEFAULT FALSE,
    fifo_override_reason VARCHAR(120),
    FOREIGN KEY (warehouse_id, location_id) REFERENCES warehouse_locations(warehouse_id, id) ON DELETE RESTRICT,
    CHECK (fifo_overridden = FALSE OR (fifo_override_reason IS NOT NULL AND fifo_override_reason <> ''))
);

CREATE TABLE IF NOT EXISTS material_returns (
    id SERIAL PRIMARY KEY,
    return_number VARCHAR(60) UNIQUE NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    production_line_id INTEGER REFERENCES production_lines(id) ON DELETE RESTRICT,
    stock_issue_id INTEGER REFERENCES stock_issues(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    target_location_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    returned_qty NUMERIC(14,4) NOT NULL CHECK (returned_qty > 0),
    return_condition VARCHAR(25) NOT NULL CHECK (return_condition IN ('USABLE_SURPLUS', 'DAMAGED', 'WASTE_SCRAP')),
    target_stock_status VARCHAR(20) NOT NULL CHECK (target_stock_status IN ('AVAILABLE', 'HOLD', 'DAMAGED', 'SCRAP')),
    unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    status VARCHAR(25) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'POSTED', 'REJECTED')),
    returned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    received_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    posted_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id, target_location_id) REFERENCES warehouse_locations(warehouse_id, id) ON DELETE RESTRICT
);

-- ============================================================================
-- 9. Warehouse Transfers (DEC-07: Internal Bin & 2-Step Inter-Warehouse)
-- ============================================================================
CREATE TABLE IF NOT EXISTS warehouse_transfers (
    id SERIAL PRIMARY KEY,
    transfer_number VARCHAR(60) UNIQUE NOT NULL,
    transfer_type VARCHAR(25) NOT NULL CHECK (transfer_type IN ('INTERNAL_BIN', 'INTER_WAREHOUSE')),
    source_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    target_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status VARCHAR(35) NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN ('DRAFT', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'RECEIVED_WITH_DISCREPANCY', 'CANCELLED')
    ),
    dispatched_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    received_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    received_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_transfer_items (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL REFERENCES warehouse_transfers(id) ON DELETE RESTRICT,
    source_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    source_location_id INTEGER NOT NULL,
    target_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    target_location_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    dispatched_qty NUMERIC(14,4) NOT NULL CHECK (dispatched_qty > 0),
    received_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
    damaged_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
    discrepancy_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (discrepancy_qty >= 0),
    unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    notes TEXT,
    FOREIGN KEY (source_warehouse_id, source_location_id) REFERENCES warehouse_locations(warehouse_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (target_warehouse_id, target_location_id) REFERENCES warehouse_locations(warehouse_id, id) ON DELETE RESTRICT,
    CHECK (received_qty + damaged_qty + discrepancy_qty <= dispatched_qty)
);

-- ============================================================================
-- 10. Physical Stock Counts & Threshold-Approved Adjustments (DEC-08, PARAM-01)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_counts (
    id SERIAL PRIMARY KEY,
    count_number VARCHAR(60) UNIQUE NOT NULL,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    count_type VARCHAR(20) NOT NULL CHECK (count_type IN ('CYCLE', 'FULL')),
    status VARCHAR(30) NOT NULL DEFAULT 'PLANNED' CHECK (
        status IN ('PLANNED', 'IN_PROGRESS', 'SUBMITTED_FOR_REVIEW', 'APPROVED_AND_POSTED', 'CANCELLED')
    ),
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_count_items (
    id SERIAL PRIMARY KEY,
    count_id INTEGER NOT NULL REFERENCES stock_counts(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    location_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    stock_status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (
        stock_status IN ('AVAILABLE', 'QUARANTINE', 'HOLD', 'DAMAGED', 'SCRAP')
    ),
    system_qty NUMERIC(14,4) NOT NULL CHECK (system_qty >= 0),
    counted_qty NUMERIC(14,4) CHECK (counted_qty IS NULL OR counted_qty >= 0),
    variance_qty NUMERIC(14,4),
    counted_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    FOREIGN KEY (warehouse_id, location_id) REFERENCES warehouse_locations(warehouse_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
    id SERIAL PRIMARY KEY,
    adjustment_number VARCHAR(60) UNIQUE NOT NULL,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    location_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    stock_status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (
        stock_status IN ('AVAILABLE', 'QUARANTINE', 'HOLD', 'DAMAGED', 'SCRAP')
    ),
    stock_count_id INTEGER REFERENCES stock_counts(id) ON DELETE RESTRICT,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('IN', 'OUT')),
    quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    reason_code VARCHAR(40) NOT NULL CHECK (
        reason_code IN (
            'CYCLE_COUNT_GAIN',
            'CYCLE_COUNT_LOSS',
            'DAMAGED',
            'EXPIRED',
            'SHRINKAGE',
            'WRITE_OFF',
            'DATA_CORRECTION',
            'REVERSAL_CORRECTION'
        )
    ),
    requires_factory_manager BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED_AND_POSTED', 'REJECTED', 'CANCELLED')
    ),
    submitted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id, location_id) REFERENCES warehouse_locations(warehouse_id, id) ON DELETE RESTRICT,
    CHECK (reason_code <> 'WRITE_OFF' OR requires_factory_manager = TRUE),
    CHECK (approved_by IS NULL OR approved_by <> submitted_by)
);

-- ============================================================================
-- 11. Reorder Requests (DEC-10) & In-App Notifications (DEC-12)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reorder_requests (
    id SERIAL PRIMARY KEY,
    request_number VARCHAR(60) UNIQUE NOT NULL,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    available_qty_at_request NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (available_qty_at_request >= 0),
    reorder_level_snapshot NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (reorder_level_snapshot >= 0),
    requested_qty NUMERIC(14,4) NOT NULL CHECK (requested_qty > 0),
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL', 'URGENT')),
    required_date DATE,
    po_reference VARCHAR(100),
    supplier_note TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (
        status IN ('OPEN', 'SUBMITTED', 'PURCHASING_REVIEWED', 'APPROVED', 'LINKED_TO_PO', 'CLOSED', 'REJECTED', 'CANCELLED')
    ),
    requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    submitted_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    purchasing_reviewed_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    purchasing_reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMP WITH TIME ZONE,
    justification TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_notifications (
    id SERIAL PRIMARY KEY,
    recipient_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    target_role_name VARCHAR(50),
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
    notification_type VARCHAR(40) NOT NULL CHECK (
        notification_type IN ('LOW_STOCK', 'QC_PENDING', 'APPROVAL_REQUIRED', 'TRANSFER_DELAYED', 'RECEIPT_DISCREPANCY', 'GENERAL')
    ),
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(60),
    entity_id VARCHAR(60),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 12. Immutable Inventory Movement Ledger (Section 6.5 & Clarification 4.1)
-- Operational perpetual inventory history (NOT an accounting General Ledger).
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    movement_ref VARCHAR(80) UNIQUE NOT NULL,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    location_id INTEGER NOT NULL,
    stock_status VARCHAR(20) NOT NULL CHECK (
        stock_status IN ('AVAILABLE', 'QUARANTINE', 'HOLD', 'DAMAGED', 'SCRAP', 'IN_TRANSIT')
    ),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('IN', 'OUT')),
    movement_type VARCHAR(30) NOT NULL CHECK (
        movement_type IN (
            'RECEIPT',
            'QC_RELEASE',
            'QC_REJECT',
            'ISSUE',
            'RETURN',
            'TRANSFER_OUT',
            'TRANSFER_IN_TRANSIT',
            'TRANSFER_IN',
            'ADJUSTMENT_IN',
            'ADJUSTMENT_OUT',
            'WRITE_OFF',
            'FG_RECEIPT',
            'REVERSAL'
        )
    ),
    quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    balance_before NUMERIC(14,4) NOT NULL CHECK (balance_before >= 0),
    balance_after NUMERIC(14,4) NOT NULL CHECK (balance_after >= 0),
    unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    total_cost NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
    source_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE RESTRICT,
    source_location_id INTEGER,
    destination_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE RESTRICT,
    destination_location_id INTEGER,
    source_document_type VARCHAR(40) NOT NULL,
    source_document_id INTEGER NOT NULL,
    source_document_ref VARCHAR(80),
    linked_movement_id INTEGER REFERENCES stock_movements(id) ON DELETE RESTRICT,
    reversed_movement_id INTEGER REFERENCES stock_movements(id) ON DELETE RESTRICT,
    is_immutable BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_immutable = TRUE),
    actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id, location_id) REFERENCES warehouse_locations(warehouse_id, id) ON DELETE RESTRICT
);

-- ============================================================================
-- 13. Performance & Access-Pattern Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_warehouses_department ON warehouses(department_id);
CREATE INDEX IF NOT EXISTS idx_wh_locations_warehouse ON warehouse_locations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wh_staff_user ON warehouse_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_wh_staff_warehouse ON warehouse_staff(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category_id);
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
CREATE INDEX IF NOT EXISTS idx_lots_material_received ON inventory_lots(material_id, received_at);
CREATE INDEX IF NOT EXISTS idx_lots_qc_status ON inventory_lots(qc_status);
CREATE INDEX IF NOT EXISTS idx_balances_wh_mat_status ON inventory_balances(warehouse_id, material_id, stock_status);
CREATE INDEX IF NOT EXISTS idx_balances_material ON inventory_balances(material_id);
CREATE INDEX IF NOT EXISTS idx_balances_lot ON inventory_balances(lot_id);
CREATE INDEX IF NOT EXISTS idx_grn_warehouse_status ON goods_receipts(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn ON goods_receipt_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_lot ON qc_inspections(lot_id);
CREATE INDEX IF NOT EXISTS idx_req_dept_status ON material_requisitions(department_id, status);
CREATE INDEX IF NOT EXISTS idx_req_wh_status ON material_requisitions(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_issues_req ON stock_issues(requisition_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON warehouse_transfers(status);
CREATE INDEX IF NOT EXISTS idx_counts_wh_status ON stock_counts(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_adjustments_wh_status ON stock_adjustments(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_reorders_status ON reorder_requests(status);
CREATE INDEX IF NOT EXISTS idx_movements_material_created ON stock_movements(material_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_warehouse_created ON stock_movements(warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_doc ON stock_movements(source_document_type, source_document_id);
CREATE INDEX IF NOT EXISTS idx_movements_linked ON stock_movements(linked_movement_id);
CREATE INDEX IF NOT EXISTS idx_movements_reversed ON stock_movements(reversed_movement_id);
CREATE INDEX IF NOT EXISTS idx_wh_notif_recipient ON warehouse_notifications(recipient_user_id, is_read);
