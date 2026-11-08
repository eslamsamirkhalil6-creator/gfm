-- GFMS Database Migration: 004_create_department_manager_role.sql
-- Garment Factory Management System - Department-Scoped RBAC & Manager Role (Part 4)
-- PostgreSQL 14+ compatible DDL

-- 1. Ensure Index on departments.manager_id for fast authoritative ownership verification
CREATE INDEX IF NOT EXISTS idx_departments_manager_lookup ON departments(manager_id) WHERE manager_id IS NOT NULL;

-- 2. Ensure Index on production_lines.department_id for department-linked production lines
CREATE INDEX IF NOT EXISTS idx_prod_lines_dept_id ON production_lines(department_id) WHERE department_id IS NOT NULL;
