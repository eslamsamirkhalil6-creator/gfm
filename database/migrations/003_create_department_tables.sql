-- GFMS Database Migration: 003_create_department_tables.sql
-- Garment Factory Management System - Department Management Module (Part 3)
-- PostgreSQL 14+ compatible DDL

-- 1. Departments Table (Supports organizational hierarchy via parent_id)
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    dept_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
    manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Department Employees Table (M:N linking users to departments with positions)
CREATE TABLE IF NOT EXISTS department_employees (
    id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position_title VARCHAR(100) NOT NULL DEFAULT 'Staff',
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE (department_id, user_id)
);

-- 3. Department Manager Assignment History (Preserves historical manager tenure)
CREATE TABLE IF NOT EXISTS department_manager_history (
    id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    relinquished_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- 4. Safe Non-Destructive Extension of Production Lines (References responsible department)
ALTER TABLE production_lines ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

-- 5. Performance Indices
CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_id);
CREATE INDEX IF NOT EXISTS idx_departments_manager ON departments(manager_id);
CREATE INDEX IF NOT EXISTS idx_dept_employees_user ON department_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_dept_employees_dept ON department_employees(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_mgr_history_dept ON department_manager_history(department_id);
CREATE INDEX IF NOT EXISTS idx_prod_lines_dept ON production_lines(department_id);
