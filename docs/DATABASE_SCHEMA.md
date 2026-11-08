# GFMS PostgreSQL Database Schema Specification

## 1. Entity-Relationship Diagram (Conceptual)

```text
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    users     │1       N│  user_roles  │N       1│    roles     │
├──────────────┤─────────├──────────────┤─────────├──────────────┤
│ id (PK)      │         │ user_id (FK) │         │ id (PK)      │
│ username (UQ)│         │ role_id (FK) │         │ role_name(UQ)│
│ password_hash│         └──────────────┘         │ description  │
│ full_name    │                                  └──────────────┘
│ is_active    │                                         1│
│ created_at   │                                          │N
└──────────────┘                                  ┌──────────────┐
       1│                                         │role_permiss..│
        │                                         ├──────────────┤
        │0..N                                     │ role_id (FK) │
┌──────────────┐                                  │ permissi.(FK)│
│  audit_logs  │                                  └──────────────┘
├──────────────┤                                         N│
│ id (PK)      │                                          │1
│ user_id (FK) │                                  ┌──────────────┐
│ action       │                                  │ permissions  │
│ entity_type  │                                  ├──────────────┤
│ entity_id    │                                  │ id (PK)      │
│ details      │                                  │ permissi.(UQ)│
│ ip_address   │                                  │ description  │
│ created_at   │                                  └──────────────┘
└──────────────┘
```

## 2. Table Specifications

### `users`
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Unique user identifier |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | Alphanumeric login identifier |
| `password_hash` | VARCHAR(255) | NOT NULL | Salted bcrypt hash ($2b$10$) |
| `full_name` | VARCHAR(100) | NOT NULL | Operator/User's display name |
| `is_active` | BOOLEAN | DEFAULT TRUE, NOT NULL | Active status switch |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Account creation timestamp |

### `roles`
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Unique role ID |
| `role_name` | VARCHAR(50) | UNIQUE, NOT NULL | Role designation title |
| `description` | TEXT | NULLABLE | Role responsibility summary |

### `permissions`
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Unique permission ID |
| `permission_key` | VARCHAR(100) | UNIQUE, NOT NULL | Machine-readable permission key |
| `description` | TEXT | NULLABLE | Granular capability description |

### `user_roles`
| Column Name | Data Type | Constraints |
|---|---|---|
| `user_id` | INTEGER | FK -> users(id) ON DELETE CASCADE |
| `role_id` | INTEGER | FK -> roles(id) ON DELETE CASCADE |
| **Primary Key** | (user_id, role_id) | Composite Unique Key |

### `role_permissions`
| Column Name | Data Type | Constraints |
|---|---|---|
| `role_id` | INTEGER | FK -> roles(id) ON DELETE CASCADE |
| `permission_id` | INTEGER | FK -> permissions(id) ON DELETE CASCADE |
| **Primary Key** | (role_id, permission_id) | Composite Unique Key |

### `audit_logs`
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Unique audit sequence ID |
| `user_id` | INTEGER | FK -> users(id) ON DELETE SET NULL | Performing actor ID (null for system/anon) |
| `action` | VARCHAR(100) | NOT NULL | Action key (e.g. LOGIN_SUCCESS, USER_CREATE, PROD_HALL_CREATE) |
| `entity_type` | VARCHAR(100) | NOT NULL | Target entity type (e.g. USER, ROLE, PRODUCTION_HALL, WORKFLOW) |
| `entity_id` | VARCHAR(100) | NULLABLE | Target entity ID |
| `details` | TEXT | NULLABLE | Structured event payload / description |
| `ip_address` | VARCHAR(50) | NULLABLE | Client IP address |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Immutable event timestamp |

---

## 3. Production Module Tables (Part 2)

```text
┌────────────────────────┐         ┌────────────────────────┐
│    production_halls    │1       N│    production_lines    │
├────────────────────────┤─────────├────────────────────────┤
│ id (PK)                │         │ id (PK)                │
│ hall_code (UQ)         │         │ hall_id (FK)           │
│ name                   │         │ supervisor_id (FK->usr)│
│ description            │         │ line_code (UQ)         │
│ is_active              │         │ name                   │
│ created_at, updated_at │         │ status, target_capacity│
└────────────────────────┘         └────────────────────────┘

┌────────────────────────┐         ┌────────────────────────┐         ┌────────────────────────┐
│  production_workflows  │1       N│production_workflow_step│N       1│   production_stages    │
├────────────────────────┤─────────├────────────────────────┤─────────├────────────────────────┤
│ id (PK)                │         │ id (PK)                │         │ id (PK)                │
│ workflow_code (UQ)     │         │ workflow_id (FK)       │         │ stage_code (UQ)        │
│ name                   │         │ stage_id (FK)          │         │ name                   │
│ description            │         │ step_order             │         │ stage_type             │
│ is_active              │         │ is_mandatory           │         │ is_mandatory_by_default│
│ created_at, updated_at │         │ quality_gate           │         │ is_active              │
└────────────────────────┘         └────────────────────────┘         └────────────────────────┘
```

### `production_halls`
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Unique production hall ID |
| `hall_code` | VARCHAR(50) | UNIQUE, NOT NULL | Alphanumeric unique code (e.g., `HALL-A`) |
| `name` | VARCHAR(100) | NOT NULL | Human-readable building/hall name |
| `description` | TEXT | NULLABLE | Hall details, location, square footage |
| `is_active` | BOOLEAN | DEFAULT TRUE, NOT NULL | Operational status |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Last modification timestamp |

### `production_lines`
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Unique production line ID |
| `hall_id` | INTEGER | FK -> production_halls(id) ON DELETE RESTRICT | Associated factory hall |
| `supervisor_id` | INTEGER | FK -> users(id) ON DELETE SET NULL | Assigned supervisor (1 supervisor may supervise N lines) |
| `line_code` | VARCHAR(50) | UNIQUE, NOT NULL | Line code (e.g., `LINE-01`) |
| `name` | VARCHAR(100) | NOT NULL | Human-readable line designation |
| `status` | VARCHAR(30) | DEFAULT 'ACTIVE', NOT NULL | Status: `ACTIVE`, `INACTIVE`, `MAINTENANCE` |
| `target_capacity_per_hour` | INTEGER | DEFAULT 100, NOT NULL | Hourly piece target capacity |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Last modification timestamp |

### `production_stages`
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Unique stage master ID |
| `stage_code` | VARCHAR(50) | UNIQUE, NOT NULL | Alphanumeric stage identifier (e.g., `STG-CUT`) |
| `name` | VARCHAR(100) | NOT NULL | Stage name (e.g., "Sewing", "Cutting") |
| `stage_type` | VARCHAR(50) | NOT NULL | Classification: `CUTTING`, `SEWING`, `QUALITY`, `PACKING`, `CUSTOM` |
| `description` | TEXT | NULLABLE | Operational specifications |
| `is_mandatory_by_default` | BOOLEAN | DEFAULT TRUE, NOT NULL | Default inclusion requirement |
| `is_active` | BOOLEAN | DEFAULT TRUE, NOT NULL | Master stage active toggle |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Last modification timestamp |

### `production_workflows`
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Unique workflow template ID |
| `workflow_code` | VARCHAR(50) | UNIQUE, NOT NULL | Workflow code (e.g., `WF-STD-SHIRT`) |
| `name` | VARCHAR(100) | NOT NULL | Routing name (e.g., "Standard Woven Shirts Routing") |
| `description` | TEXT | NULLABLE | Description of target garment type or brand specifications |
| `is_active` | BOOLEAN | DEFAULT TRUE, NOT NULL | Workflow routing active toggle |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Last modification timestamp |

### `production_workflow_steps`
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Step record ID |
| `workflow_id` | INTEGER | FK -> production_workflows(id) ON DELETE CASCADE | Parent workflow template |
| `stage_id` | INTEGER | FK -> production_stages(id) ON DELETE RESTRICT | Target manufacturing stage |
| `step_order` | INTEGER | NOT NULL | Sequential 1-based order index |
| `is_mandatory` | BOOLEAN | DEFAULT TRUE, NOT NULL | Whether step is compulsory |
| `quality_gate` | BOOLEAN | DEFAULT FALSE, NOT NULL | Independent quality checkpoint requirement |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Step creation timestamp |
| **Unique Constraint** | (workflow_id, step_order) | Unique step order per workflow | Prevents duplicate sequence positions |

### `production_settings`
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `key` | VARCHAR(100) | PRIMARY KEY | Configuration parameter identifier |
| `value` | TEXT | NOT NULL | JSON or primitive string representation |
| `description` | TEXT | NULLABLE | Setting human explanation |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Modification timestamp |

---

## 4. Department Management Tables (Part 3)

```text
┌────────────────────────┐         ┌────────────────────────┐         ┌────────────────────────┐
│      departments       │1       N│  department_employees │N       1│         users          │
├────────────────────────┤─────────├────────────────────────┤─────────├────────────────────────┤
│ id (PK)                │         │ id (PK)                │         │ id (PK)                │
│ dept_code (UQ)         │         │ department_id (FK)     │         │ username               │
│ name                   │         │ user_id (FK)           │         │ full_name              │
│ description            │         │ position_title         │         │ is_active              │
│ parent_id (FK->self)   │         │ is_primary             │         └────────────────────────┘
│ manager_id (FK->users) │         │ assigned_at            │                      ▲
│ status                 │         │ notes                  │                      │
│ created_at, updated_at │         └────────────────────────┘                      │
└────────────────────────┘                                                         │
       │1                                                                          │
       │                                                                           │
       ▼0..N                                                                       │
┌────────────────────────┐                                                         │
│dept_manager_history    │                                                         │
├────────────────────────┤                                                         │
│ id (PK)                │                                                         │
│ department_id (FK)     │                                                         │
│ manager_id (FK->users) ├─────────────────────────────────────────────────────────┘
│ assigned_by (FK->users)│
│ assigned_at            │
│ relinquished_at        │
│ notes                  │
└────────────────────────┘
```

### `departments`
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Unique department identifier |
| `dept_code` | VARCHAR(50) | UNIQUE, NOT NULL | Alphanumeric unique code (e.g. `DEP-HR`, `DEP-PROD`, `DEP-CUT`) |
| `name` | VARCHAR(100) | NOT NULL | Human-readable department name |
| `description` | TEXT | NULLABLE | Functional scope and floor responsibilities |
| `parent_id` | INTEGER | FK -> departments(id) ON DELETE RESTRICT | Optional parent for hierarchical sub-departments |
| `manager_id` | INTEGER | FK -> users(id) ON DELETE SET NULL | Appointed primary department manager |
| `status` | VARCHAR(20) | DEFAULT 'active', NOT NULL | Status: `active`, `inactive` |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Last modification timestamp |

### `department_employees`
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Unique assignment record ID |
| `department_id` | INTEGER | FK -> departments(id) ON DELETE CASCADE | Associated department |
| `user_id` | INTEGER | FK -> users(id) ON DELETE CASCADE | Linked system user/staff account |
| `position_title` | VARCHAR(100) | DEFAULT 'Staff', NOT NULL | Role or job title (e.g. "Cutting Specialist") |
| `is_primary` | BOOLEAN | DEFAULT TRUE, NOT NULL | Whether this is the staff member's primary department |
| `assigned_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Staff allocation timestamp |
| `notes` | TEXT | NULLABLE | Assignment background notes |
| **Unique Constraint** | (department_id, user_id) | Unique staff assignment per department | Prevents duplicate assignments |

### `department_manager_history`
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Unique tenure log ID |
| `department_id` | INTEGER | FK -> departments(id) ON DELETE CASCADE | Department where tenure occurred |
| `manager_id` | INTEGER | FK -> users(id) ON DELETE SET NULL | Appointed manager user |
| `assigned_by` | INTEGER | FK -> users(id) ON DELETE SET NULL | Administrator who authorized appointment |
| `assigned_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Appointment commencement timestamp |
| `relinquished_at` | TIMESTAMPTZ | NULLABLE | Concluding timestamp when manager was replaced/relinquished |
| `notes` | TEXT | NULLABLE | Appointment context or reason for transition |


