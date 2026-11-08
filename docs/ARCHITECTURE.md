# GFMS Technical Foundation Prototype v0.1 – Architecture Document

## 1. System Overview

The Garment Factory Management System (GFMS) is an enterprise web application designed for industrial garment manufacturing facilities. This technical foundation prototype (v0.1) establishes the architectural blueprint, data persistence layer, authorization boundary, and security controls before specialized factory floor modules are built.

## 2. Technology Stack & Rationale

- **Frontend:** React 19 + TypeScript. Component-based architecture with clean separation into presentation components, containers, service clients, and state hooks.
- **Backend Framework:** Node.js 22 LTS + Express 4.x + TypeScript. Layered architecture:
  - `controllers/`: HTTP protocol adapters, status codes, query parsing.
  - `services/`: Business logic, password hashing, transaction boundaries.
  - `middleware/`: JWT verification, RBAC authorization, centralized error handling, validation.
  - `config/`: PostgreSQL connection pool, typed environment settings.
- **Database:** PostgreSQL 14+ (relational DDL with foreign keys, ON DELETE CASCADE/SET NULL, unique constraints, and indices).
- **Communication:** RESTful JSON APIs over HTTP/HTTPS with JWT Bearer authentication.
- **Testing:** Automated test harness validating 8 key architectural requirements.

## 3. High-Fidelity Preview & Portability Strategy

To satisfy two critical user requirements:
1. **Zero Cloud Lock-in / Exportable to Windows Local Environment:** The codebase contains no cloud dependencies (no Firebase, Firestore, Supabase, AWS DynamoDB, etc.). Standard `pg` client connections are utilized.
2. **Instant Preview in Web Environments:** When run without an external PostgreSQL instance (or during initial startup), the application utilizes an in-memory PostgreSQL engine (`pg-mem`) that executes the exact same migration SQL scripts (`001_create_initial_tables.sql`) and seed SQL scripts (`001_seed_initial_data.sql`). When `DATABASE_URL` is configured, it connects directly via TCP to live PostgreSQL.

## 4. Role-Based Access Control (RBAC) Architecture

GFMS enforces authorization exclusively at the backend:

```text
User ──── (N:M) ────> Roles ──── (N:M) ────> Permissions
```

Every incoming protected request undergoes two-layer verification:
1. `authenticateJWT`: Validates token signature, expiration, and queries PostgreSQL to ensure user account `is_active` has not been revoked.
2. `requirePermission(...)`: Compares required permissions against the user's role-permission matrix.

### Prototype Roles Matrix:

| Role Name | Description | Key Backend Permissions |
|---|---|---|
| **System Administrator** | Full platform management | `users:read`, `users:create`, `users:update`, `users:roles`, `roles:read`, `audit:read`, `dashboard:view`, `dashboard:factory` |
| **Factory Manager** | Floor oversight & staff viewing | `dashboard:view`, `dashboard:factory`, `users:read` |
| **Department User** | Workstation basic operations | `dashboard:view` |

## 5. Security & Audit Logging Principles

- **Password Storage:** Passwords are never stored in plaintext. Passwords are encrypted using `bcryptjs` with 10 salt rounds ($2b$ algorithm).
- **Audit Logging:** An immutable append-only table `audit_logs` records critical events (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `USER_CREATE`, `USER_STATUS_UPDATE`, `ROLE_ASSIGN`, `USER_ROLES_UPDATE`). Audit logs can only be created by backend services and inspected by authorized administrators; ordinary users cannot alter or purge records.
- **Data Credential Exposure:** Database credentials and JWT secrets are stored in environment variables, never sent to the browser.

## 6. Production Module Architecture (Part 2)

The Production Module introduces the physical and logical configuration foundation for factory manufacturing operations:

```text
Production Halls (Physical complex)
       │
       ▼ (1:N)
Production Lines (Workstations, capacity, supervisor)
       ▲
       │
Production Stages (Independent operations: Cutting, Sewing, Quality Gates, Packing)
       │
       ▼ (N:M Ordered Sequence)
Production Workflows (Order-specific routing pipelines with mandatory flags & QC barriers)
```

### Key Architectural Tenets:
1. **Dynamic Expansion:** Production lines and halls are not hardcoded. The factory can register new lines, relocate lines across halls, and set individual production capacities.
2. **Supervisor Multi-Line Allocation:** One floor supervisor can manage multiple lines concurrently (e.g. Sarah Jenkins managing multiple sewing lines). The system supports 1-to-N supervisor mapping and will support 1-to-1 dedicated line supervision.
3. **Independent Quality Gates:** Quality inspection (`stage_type = 'QUALITY'`) is modeled as an autonomous compliance function, rather than an operational manufacturing step.
4. **Order-Specific Workflows:** Workflows define ordered stage pipelines. Stages can be reordered, flagged as mandatory or optional, and assigned quality checkpoints.
5. **No Silent Stage Bypasses:** Production policies (`production_settings`) prevent skipping mandatory stages without explicit authorization.

## 7. Department Management Architecture (Part 3)

The Department Management Module organizes the factory's organizational hierarchy, connecting departments with system users and roles, while remaining cleanly decoupled from physical machinery and production halls:

```text
Corporate Divisions (Top-Level Departments: HR, Production, QC, Planning, IT, etc.)
       │
       ▼ (1:N Hierarchical Parent-Child Relationship)
Sub-Departments & Specialized Sections (e.g., Production -> Cutting, Sewing, Packing)
       │
       ├──► Appointed Manager (1:1 with users table + historical tenure log in department_manager_history)
       │
       ├──► Assigned Employees (M:N with department_employees, position titles, primary/secondary flags)
       │
       └──► Production Linkage (Optional responsible department reference on production_lines)
```

### Key Architectural Tenets:
1. **Organizational vs. Physical Separation:** Organizational departments (`departments`) are decoupled from physical buildings (`production_halls`) and machine conveyors (`production_lines`). A department represents managerial and functional authority.
2. **Circular Hierarchy Prevention:** Self-referential parent-child relationships are guarded against cycles (e.g., A -> B -> C -> A) and self-parenting (A -> A) through recursive ancestor traversal before database updates.
3. **Historical Manager Tenure Audit:** Manager reassignments preserve historical tenure records in `department_manager_history` with commencement timestamps, relinquishing timestamps, and appointment context.
4. **Integration with Existing Users & Roles:** Department assignments reuse the existing `users` table without duplicating accounts. The conceptual separation between user accounts and employee records prepares GFMS for future HR module integration.
5. **Deletion Safety Guarantees:** Departments with assigned employees, sub-departments, or linked production lines cannot be deleted. Deactivation (`status = 'inactive'`) must be used instead to ensure complete historical traceability.

## 8. Known Limitations & Technical Risks

1. **Token Invalidation on Password Change:** Currently, JWT tokens remain valid until expiration (8h) unless the account status `is_active` is toggled to `false` in the database (which blocks requests immediately).
2. **Rate Limiting:** In prototype, input validation prevents malformed requests; production deployment on Windows will benefit from `express-rate-limit` for DDoS / brute-force protection.
3. **Scope Boundary:** Full HR workflows (attendance, payroll, contracts, disciplinary actions) and runtime piece-rate tracking remain scheduled for subsequent phases.

