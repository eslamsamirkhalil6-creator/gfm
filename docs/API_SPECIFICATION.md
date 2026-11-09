# GFMS REST API Specification

Base URL: `/api`

All protected endpoints require the HTTP header:
`Authorization: Bearer <JWT_TOKEN>`

## 1. System & Health

### `GET /api/health`
Checks API status, live PostgreSQL connectivity, latency, tables, and server timestamp.
- **Auth:** Public
- **Response 200 / 503:**
```json
{
  "status": "UP",
  "database": {
    "status": "CONNECTED",
    "mode": "PostgreSQL (Live Connection)",
    "engine": "PostgreSQL 16.x",
    "latency_ms": 2,
    "tables_count": 6,
    "users_count": 3,
    "roles_count": 3,
    "audit_logs_count": 12,
    "database_url_configured": true
  },
  "server": {
    "timestamp": "2026-11-08T12:00:00.000Z",
    "uptime_seconds": 120,
    "environment": "development",
    "node_version": "v22.23.2"
  }
}
```

## 2. Authentication

### `POST /api/auth/login`
Authenticates user, logs audit record (`LOGIN_SUCCESS` or `LOGIN_FAILED`), and issues JWT.
- **Auth:** Public
- **Request Body:**
```json
{
  "username": "admin",
  "password": "Admin@123"
}
```
- **Response 200:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "8h",
    "user": {
      "id": 1,
      "username": "admin",
      "full_name": "Eslam Samir (System Architect)",
      "is_active": true,
      "roles": ["System Administrator"],
      "permissions": ["dashboard:view", "users:read", "users:create", "..."]
    }
  }
}
```

### `POST /api/auth/logout`
Records logout in audit trail and invalidates client session.
- **Auth:** Protected (Optional token)

### `GET /api/auth/me`
Returns current user's profile, roles, and permissions from PostgreSQL.
- **Auth:** Protected

## 3. Users & Roles Management

### `GET /api/users`
Returns all users with assigned roles.
- **Permission Required:** `users:read`
- **Response 200:** Array of `UserDto` (excludes `password_hash`).

### `POST /api/users`
Creates a new user, hashes password with bcrypt, assigns roles, and records audit log.
- **Permission Required:** `users:create`
- **Request Body:**
```json
{
  "username": "jsmith",
  "password": "SecretPassword123",
  "full_name": "John Smith",
  "roleIds": [2]
}
```

### `PUT /api/users/:id/status`
Activates or deactivates a user account.
- **Permission Required:** `users:update`
- **Request Body:** `{ "is_active": false }`

### `PUT /api/users/:id/roles`
Updates role assignments for a user.
- **Permission Required:** `users:roles`
- **Request Body:** `{ "roleIds": [1, 2] }`

### `GET /api/roles`
Returns all system roles and mapped permission keys.
- **Permission Required:** `roles:read`

## 4. Audit Trail

### `GET /api/audit-logs`
Returns paginated immutable audit log events.
- **Permission Required:** `audit:read`
- **Query Parameters:** `action`, `limit`, `offset`

## 5. Automated Diagnostics

### `GET /api/tests/run`
Runs the complete automated verification test suite against the live database and returns execution metrics.
- **Auth:** Protected

## 6. Production Module (Part 2)

### `GET /api/production/stats`
Returns aggregated overview statistics for the Production Dashboard.
- **Permission Required:** `production:view`

### `GET /api/production/halls`
Returns all production halls with active line counts and associated line previews.
- **Permission Required:** `production:view`

### `POST /api/production/halls`
Creates a new factory production hall.
- **Permission Required:** `production:halls:create`
- **Request Body:** `{ "name": "Hall C", "code": "HALL-C", "description": "Denim Floor" }`

### `PUT /api/production/halls/:id`
Updates details of an existing production hall.
- **Permission Required:** `production:halls:edit`

### `PUT /api/production/halls/:id/status`
Toggles active or inactive status of a hall (permanent delete prohibited to preserve history).
- **Permission Required:** `production:halls:edit`
- **Request Body:** `{ "status": "inactive" }`

### `GET /api/production/lines`
Returns all production lines, optionally filtered by `?hallId=1`.
- **Permission Required:** `production:view`

### `POST /api/production/lines`
Registers a new production line assigned to a hall and supervisor.
- **Permission Required:** `production:lines:manage`
- **Request Body:**
```json
{
  "line_number": "LINE-SEW-05",
  "name": "Sewing Line Epsilon",
  "hall_id": 1,
  "production_type": "Sewing",
  "supervisor_id": 2,
  "capacity_per_day": 750,
  "description": "24-needle chainstitch line"
}
```

### `PUT /api/production/lines/:id`
Updates line configuration, supervisor assignment, or production capacity.
- **Permission Required:** `production:lines:manage`

### `PUT /api/production/lines/:id/status`
Sets line status to `active`, `idle`, `maintenance`, or `inactive`.
- **Permission Required:** `production:lines:manage`
- **Request Body:** `{ "status": "maintenance" }`

### `GET /api/production/stages`
Returns all configurable manufacturing stages and where-used workflow counts.
- **Permission Required:** `production:view`

### `POST /api/production/stages`
Creates a new configurable production stage.
- **Permission Required:** `production:stages:manage`
- **Request Body:**
```json
{
  "name": "Industrial Enzyme Bath",
  "stage_code": "STG-ENZ",
  "stage_type": "STANDARD",
  "is_mandatory_default": false,
  "description": "Fabric chemical wash treatment"
}
```

### `GET /api/production/workflows`
Returns all production workflows with ordered stage sequences.
- **Permission Required:** `production:view`

### `POST /api/production/workflows`
Designs a new multi-stage production workflow.
- **Permission Required:** `production:workflows:manage`

### `PUT /api/production/workflows/:id/steps`
Reorders workflow sequence and updates mandatory/quality gate flags.
- **Permission Required:** `production:workflows:manage`
- **Request Body:**
```json
{
  "steps": [
    { "stage_id": 1, "is_mandatory": true, "quality_gate": false },
    { "stage_id": 2, "is_mandatory": true, "quality_gate": false },
    { "stage_id": 3, "is_mandatory": true, "quality_gate": true, "notes": "Independent QC gate" },
    { "stage_id": 4, "is_mandatory": true, "quality_gate": false }
  ]
}
```

### `GET /api/production/settings` & `PUT /api/production/settings/:key`
Fetches and updates global production bypass policies.
- **Permission Required:** `production:settings:manage`

---

## 7. Department Management Module (Part 3)

### `GET /api/departments/stats`
Returns aggregated overview metrics for the Department Dashboard.
- **Permission Required:** `departments:view`
- **Response Payload:** Total, active, inactive, with manager, without manager counts, and employee distribution per department.

### `GET /api/departments`
Lists all departments, with optional filtering (`?status=active`, `?parent_id=2`, `?search=cut`).
- **Permission Required:** `departments:view`

### `GET /api/departments/tree`
Returns complete hierarchical organizational chart as nested tree nodes with children.
- **Permission Required:** `departments:view`

### `GET /api/departments/:id`
Retrieves single department details including manager info, sub-departments, assigned staff members, and chronological manager tenure history.
- **Permission Required:** `departments:view`

### `POST /api/departments`
Creates a new department or sub-department with unique code validation.
- **Permission Required:** `departments:create`
- **Request Body:**
```json
{
  "dept_code": "DEP-CUT",
  "name": "Cutting Section",
  "description": "Fabric spreading, pattern plotting, and precision cutting",
  "parent_id": 2,
  "manager_id": 3
}
```

### `PUT /api/departments/:id`
Updates department name, description, hierarchy parent, or manager. Enforces circular reference prevention.
- **Permission Required:** `departments:edit`

### `PUT /api/departments/:id/status`
Toggles active / inactive state of a department.
- **Permission Required:** `departments:status`

### `PUT /api/departments/:id/manager`
Appoints or replaces the primary department manager. Automatically closes previous manager tenure with a timestamp and records the new tenure in audit history.
- **Permission Required:** `departments:manage_manager`
- **Request Body:** `{ "manager_id": 2, "notes": "Appointed to lead production expansion" }`

### `POST /api/departments/:id/employees`
Assigns an existing system user/employee to a department with a position title and primary flag.
- **Permission Required:** `departments:manage_employees`
- **Request Body:** `{ "user_id": 3, "position_title": "Senior Cutting Technician", "is_primary": true }`

### `PUT /api/departments/:id/employees/transfer`
Atomically transfers an employee from the current department to a target department.
- **Permission Required:** `departments:manage_employees`
- **Request Body:** `{ "target_department_id": 11, "user_id": 3, "position_title": "Lead Quality Auditor", "is_primary": true }`

### `DELETE /api/departments/:id/employees/:userId`
Removes an employee assignment from a department.
- **Permission Required:** `departments:manage_employees`

### `DELETE /api/departments/:id`
Permanently deletes an empty, unused department. Strictly blocked if the department has assigned employees, sub-departments, or linked production lines (deactivation required instead).
- **Permission Required:** `departments:create`

---

## 7. Warehouse & Inventory Management System (WMS – GFMS v0.3)

All Warehouse, Material Catalog, GRN, QC Inspection, Requisition, Issuing, Return, Transfer, Stock Count, Adjustment, Reorder, Finished Goods Receiving, Valuation, and Notification endpoints (`/api/warehouses/*`, `/api/warehouse/*`, `/api/inventory/*`) are documented in detail in:

- [`docs/WMS_API_SPECIFICATION.md`](./WMS_API_SPECIFICATION.md)
