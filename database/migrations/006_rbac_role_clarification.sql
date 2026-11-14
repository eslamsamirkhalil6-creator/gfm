-- GFMS Database Migration: 006_rbac_role_clarification.sql
-- Garment Factory Management System - RBAC Role Clarification & Planning Scope Schema
-- PostgreSQL 14+ & pg-mem v3.0 compatible DDL

-- 1. Fast lookup index on department_employees(user_id, department_id) for role-authorized department scoping
CREATE INDEX IF NOT EXISTS idx_dept_employees_user_dept ON department_employees(user_id, department_id);

-- 2. Scoped Departmental Planning Schedules table for Department Planner role
CREATE TABLE IF NOT EXISTS department_planning_schedules (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  production_line_id INTEGER REFERENCES production_lines(id) ON DELETE SET NULL,
  plan_code VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  target_daily_output INTEGER NOT NULL DEFAULT 0 CHECK (target_daily_output >= 0),
  planned_start_date DATE NOT NULL,
  planned_end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (planned_end_date >= planned_start_date)
);

CREATE INDEX IF NOT EXISTS idx_dept_planning_dept_id ON department_planning_schedules(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_planning_line_id ON department_planning_schedules(production_line_id) WHERE production_line_id IS NOT NULL;
