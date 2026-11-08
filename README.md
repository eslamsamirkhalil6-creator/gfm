# GFMS – Garment Factory Management System (v0.3 - Part 3)

**Garment Factory Management System (GFMS) – Technical Foundation, Production Module & Department Management Module**

This project delivers the architecture, core production setup, and organizational department management for GFMS. It is intentionally structured as a portable, production-grade application intended to validate the core architectural requirements (PostgreSQL, Express REST API, React TypeScript, RBAC, Bcrypt security, and Audit logging) along with **Part 2: Production Module (Setup & Configuration)** and **Part 3: Department Management Module** allowing factory managers and administrators to configure corporate divisions, sub-departments, primary managers, staff allocations, and organizational hierarchies.

---

## 1. Project Architecture

- **Frontend:** React 19 + TypeScript + Vite.
- **Backend:** Node.js 22 LTS + TypeScript + Express 4.x.
- **Database:** PostgreSQL 14+ (relational DDL, foreign keys, unique constraints, and indices).
- **Communication:** REST APIs with JWT Bearer authentication.
- **Security:** Bcrypt password hashing (10 salt rounds), append-only immutable audit logging.
- **Portability:** Exportable and runnable locally on Microsoft Windows (or Linux/macOS) with **zero cloud lock-in** (No Firebase, Firestore, Supabase, or AWS).
- **Dual Mode Database Adapter:** Connects directly via TCP when `DATABASE_URL` is set, or utilizes an in-memory PostgreSQL engine for instant preview and automated testing.

---

## 2. Project Folder Structure

```text
GFMS/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts        # PostgreSQL connection pool, multi-migration loader & health metrics
│   │   │   └── env.ts             # Typed environment variable loader
│   │   ├── modules/
│   │   │   ├── auth/              # JWT issuance, password verification, login/logout
│   │   │   ├── users/             # User provisioning, status, role assignment
│   │   │   ├── production/        # Part 2: Halls, Lines, Stages, Workflows & Settings
│   │   │   ├── departments/       # Part 3: Hierarchy, Managers, Employees & Distribution
│   │   │   ├── audit/             # Append-only security audit trail
│   │   │   └── health/            # GET /api/health with real database ping
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts # JWT verification & requirePermission / requireRole
│   │   │   ├── error.middleware.ts# Centralized error handler
│   │   │   └── validation.middleware.ts # Input validation
│   │   ├── routes/
│   │   │   └── index.ts           # REST API routing
│   │   ├── tests/
│   │   │   └── runner.ts          # 23-part automated verification test suite
│   │   ├── app.ts                 # Express app definition
│   │   └── server.ts              # Standalone backend server entry point (port 5000)
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── database/
│   ├── migrations/
│   │   ├── 001_create_initial_tables.sql    # Users, roles, permissions, audit_logs
│   │   ├── 002_create_production_tables.sql # Halls, lines, stages, workflows, steps, settings
│   │   └── 003_create_department_tables.sql # Departments, department_employees, manager_history
│   ├── seeds/
│   │   ├── 001_seed_initial_data.sql        # Roles, permissions, admin/manager/deptuser
│   │   ├── 002_seed_production_data.sql     # Production permissions, halls, stages, lines, workflows
│   │   └── 003_seed_department_data.sql     # Department permissions, 10 core depts, sub-depts, staff
│   └── migrate.ts                 # Standalone multi-file database migration runner
│
├── docs/
│   ├── ARCHITECTURE.md            # High-level architecture & design decisions
│   ├── API_SPECIFICATION.md       # REST endpoints documentation & schemas
│   ├── DATABASE_SCHEMA.md         # ERD, 15 tables, constraints, foreign keys
│   └── WINDOWS_LOCAL_SETUP.md     # Complete step-by-step Windows setup guide
│
├── frontend/
│   ├── src/
│   │   ├── components/            # Navbar, StatusBanner, Modals
│   │   ├── pages/                 # Login, Dashboard, Users, Audit, Diagnostics, Export
│   │   │   ├── production/        # Halls, Lines, Stages, Workflows, Settings, Dashboard
│   │   │   └── departments/       # Dashboard, Directory, Hierarchy, Modals
│   │   ├── services/              # ApiService REST client
│   │   ├── hooks/                 # useAuth session & RBAC hook
│   │   └── types/                 # TypeScript interfaces
│   └── package.json
│
├── server.ts                      # Full-stack runner uniting Express & Vite (port 3000)
├── .env.example                   # Prototype configuration template
└── README.md                      # Complete system documentation
```

---

## 3. Quick Start (Windows Local Execution)

### Step 1: Install Prerequisites
Install Node.js 18+ and PostgreSQL 14+ (e.g. via Windows Package Manager):
```powershell
winget install OpenJS.NodeJS.LTS
winget install PostgreSQL.PostgreSQL.16
```

### Step 2: Create PostgreSQL Database
In Command Prompt:
```cmd
psql -U postgres -c "CREATE DATABASE gfms_db;"
```

### Step 3: Configure Environment
Copy `.env.example` to `.env`:
```cmd
copy .env.example .env
```
Edit `.env` to include your PostgreSQL credentials:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/gfms_db
JWT_SECRET=gfms_secure_secret_key_change_in_production_2026
NODE_ENV=development
```

### Step 4: Install Dependencies & Run Automated Tests
```cmd
npm install
npm run test
```

### Step 5: Start Development Server
```cmd
npm run dev
```
Open **http://localhost:3000** in your browser.

---

## 4. Default Credentials (Seeded Roles)

| Role | Username | Password | Permitted Scope |
|---|---|---|---|
| **System Administrator** | `admin` | `Admin@123` | Full administrative authority: user provisioning, role assignments, audit ledger, all production & department configurations |
| **Factory Manager** | `manager` | `Manager@123` | Factory floor overview, production halls, lines, workflows, department directory, manager appointments, and employee assignments |
| **Department User** | `deptuser` | `Dept@123` | Constrained basic operational workstation dashboard |

---

## 5. Automated Tests Suite (23 Comprehensive Verification Tests)

GFMS includes an automated test runner verifying all architecture requirements across Parts 1, 2, and 3:

```cmd
npm run test
```

1. **API Health Check:** Verifies `/api/health` response structure, uptime, and database metrics.
2. **PostgreSQL Connectivity:** Tests actual `SELECT NOW()` query execution and record count.
3. **Successful Login:** Validates authentication, bcrypt hash comparison, and JWT generation.
4. **Failed Login:** Validates 401 rejection for invalid passwords and non-existent users, along with audit logging.
5. **Unauthorized API Access:** Confirms forged or missing JWT tokens cannot access protected endpoints.
6. **Role-Based Permission Enforcement:** Validates backend permission boundaries between Administrator, Manager, and Department User.
7. **User Creation & Password Hashing:** Provisions a new user and confirms in PostgreSQL that the password is encrypted with bcrypt ($2b$) and never stored in plaintext.
8. **Audit Log Creation:** Verifies that administrative actions and logins generate immutable audit records.
9. **Production Halls & Deletion Safety:** Tests hall creation, listing, and verifies database integrity constraint prevents deleting halls with assigned lines.
10. **Production Lines & Multi-Line Supervisors:** Validates production line provisioning and tests 1-to-N supervisor allocation (assigning same supervisor to multiple lines).
11. **Production Stages & Quality Gates:** Tests stage registration, custom stage creation, and independent quality gate validation.
12. **Production Workflows & Sequence Reordering:** Validates routing creation, step association, and drag-and-drop / atomic step reordering.
13. **Production Module RBAC Protection:** Confirms unpermitted users (Department Users) are blocked from mutating production configurations with 403 Forbidden.
14. **Production Configuration Audit Ledger:** Verifies audit trail entries are generated for hall creation, line updates, workflow reordering, and settings changes.
15. **Incremental PostgreSQL Migration Integrity:** Verifies all 15 PostgreSQL tables exist in the public schema.
16. **Department Creation & Unique Code Enforcement:** Tests department provisioning and ensures duplicate department codes are rejected.
17. **Department Hierarchy & Circular Reference Prevention:** Verifies multi-level parent-child hierarchy and ensures cycles (e.g. A -> B -> C -> A) and self-parenting are rejected.
18. **Department Manager Assignment & Historical Tenure:** Tests manager appointment and verifies closing of previous tenure timestamps in `department_manager_history`.
19. **Employee Assignment, Multi-Dept & Transfer:** Tests employee assignment with position titles, primary department flags, and atomic department transfers.
20. **Department Deactivation & Deletion Safety:** Confirms safety constraint blocking permanent deletion of departments with assigned staff; verifies active/inactive status toggle.
21. **Department Module RBAC Enforcement:** Verifies RBAC boundaries between Administrator (8 department permissions), Manager (operational permissions), and Department User (0).
22. **Department Configuration Audit Trail Ledger:** Verifies append-only audit trail logging for department creation, status toggle, manager appointments, and employee assignments.
23. **Complete Schema Integrity (15 Tables across Parts 1-3):** Verifies all 15 PostgreSQL tables across Foundation, Production, and Department modules.

---

## 6. Implemented Features (Parts 1, 2 & 3)

- [x] Separate frontend (React + TS) and backend (Node.js + Express + TS) architecture.
- [x] Normalized PostgreSQL database schema with multi-file migration engine (`001_...`, `002_...`, `003_...`).
- [x] Secure password encryption via bcrypt (10 salt rounds).
- [x] JWT token-based authentication with expiration handling.
- [x] Granular Role-Based Access Control (RBAC) enforced on backend API routes.
- [x] Health check endpoint (`GET /api/health`) querying real database status and latency.
- [x] User management: listing, creation, role assignment, and active status toggling.
- [x] Append-only audit logging for logins, user changes, production, and department events.
- [x] **Production Module Setup & Configuration (Part 2):**
  - [x] **Production Dashboard:** Factory layout overview, total halls, lines, stages, workflows, hourly capacity.
  - [x] **Production Halls:** Building code, floor space, active toggle, deletion protection constraint.
  - [x] **Production Lines:** Line code, capacity per hour, hall allocation, status filter, multi-line supervisor support.
  - [x] **Production Stages:** Cutting, Sewing, Quality, Packing, Custom stages, mandatory defaults, where-used tracker.
  - [x] **Production Workflows:** Multi-routing definitions, interactive visual sequence reordering, mandatory/optional flags, quality gate enforcement.
  - [x] **Production Settings:** Strict sequence enforcement, quality gate bypass policies, QC supervisor signoff requirements.
- [x] **Department Management Module (Part 3):**
  - [x] **10 Initial Core Departments:** HR, Production, Inventory, Purchasing, QC, Finance, Sales, Transportation, Planning, IT & Administration.
  - [x] **Production Hierarchy:** Cutting, Sewing, Packing sub-departments under Production.
  - [x] **Department Dashboard:** KPI overview, managed vs unmanaged counts, live employee distribution breakdown.
  - [x] **Department Directory:** Search by code/name, status filter, hierarchy filter, detailed department profiles.
  - [x] **Interactive Organizational Chart:** Recursive visual tree with expand/collapse and sub-department creation.
  - [x] **Department Manager Assignment:** Primary manager appointments with chronological tenure tracking and audit history.
  - [x] **Employee Department Allocation:** Staff assignments with position titles, primary/secondary flags, and atomic department transfers.
  - [x] **Deletion Safety Restriction:** Prevents accidental deletion of departments with active staff or sub-departments.
- [x] Local Cairo Timezone Conversion (`Africa/Cairo`) for audit timestamps.
- [x] Interactive browser test suite runner and CLI test runner (`npm run test` - 23/23 tests passing).
- [x] Project export package (.ZIP) for Windows deployment including all Parts 1, 2, and 3 code and migrations.

---

## 7. Unimplemented Features (Reserved for Subsequent Phases)

- [ ] Complete HR employee personal files, contracts, and employment history.
- [ ] Shift attendance, biometric clock-in, and leave management.
- [ ] Operator piece-rate payroll calculation engine.
- [ ] Runtime garment order execution and shop-floor tracking.
- [ ] Barcode / QR-code scanning at physical workstations.
- [ ] Physical defect logging and garment repair workflow.


---

## 8. Known Limitations & Technical Risks

1. **Session Invalidation on Password Reset:** Tokens remain valid until their 8-hour expiry unless the user account is explicitly deactivated in PostgreSQL via `is_active = FALSE`. Phase 3 can implement token revocation blacklists or token version counters.
2. **Rate Limiting:** Input validation prevents malformed payloads; production deployments should install `express-rate-limit` to mitigate brute-force password guessing.
3. **Database Connection Pool Sizing:** Configured with a default pool size for prototype testing. For multi-thousand worker factory shifts, connection pooling (e.g. PgBouncer) should be deployed.

