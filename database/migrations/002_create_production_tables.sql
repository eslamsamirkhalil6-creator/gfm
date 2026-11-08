-- GFMS Database Migration: 002_create_production_tables.sql
-- Garment Factory Management System - Production Module Setup & Configuration (Part 2)
-- PostgreSQL 14+ compatible DDL

-- 1. Production Halls Table
CREATE TABLE IF NOT EXISTS production_halls (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Production Lines Table
CREATE TABLE IF NOT EXISTS production_lines (
    id SERIAL PRIMARY KEY,
    line_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    hall_id INTEGER NOT NULL REFERENCES production_halls(id) ON DELETE RESTRICT,
    production_type VARCHAR(50) NOT NULL, -- e.g. 'Sewing', 'Cutting', 'Finishing', 'Quality Inspection', 'Packing'
    supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    capacity_per_day INTEGER DEFAULT 500,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'idle', 'maintenance', 'inactive'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Production Stages Table (Configurable, not hardcoded)
CREATE TABLE IF NOT EXISTS production_stages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    stage_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    stage_type VARCHAR(50) NOT NULL DEFAULT 'STANDARD', -- 'STANDARD', 'QUALITY', 'PACKING'
    is_mandatory_default BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Production Workflows Table (Multi-flow per order/product)
CREATE TABLE IF NOT EXISTS production_workflows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    workflow_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    product_category VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Workflow Stage Sequence (M:N with sequence ordering and flags)
CREATE TABLE IF NOT EXISTS production_workflow_steps (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES production_workflows(id) ON DELETE CASCADE,
    stage_id INTEGER NOT NULL REFERENCES production_stages(id) ON DELETE RESTRICT,
    step_order INTEGER NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    quality_gate BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (workflow_id, step_order)
);

-- 6. Production Settings & Policy Table
CREATE TABLE IF NOT EXISTS production_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_lines_hall ON production_lines(hall_id);
CREATE INDEX IF NOT EXISTS idx_lines_supervisor ON production_lines(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON production_workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_order ON production_workflow_steps(workflow_id, step_order);
