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

> **DDL Alignment Note (`002_create_production_tables.sql`)**: The original conceptual summary below used early draft column names (`hall_code`, `is_active`, `target_capacity_per_hour`). Actual deployed DDL columns in `002_create_production_tables.sql` are `production_halls(id, name, code, description, status)`, `production_lines(id, line_number, name, hall_id, production_type, supervisor_id, capacity_per_day, description, status, department_id)`, `production_stages(..., status)`, `production_workflows(..., product_category, status)`, and `production_settings(id, setting_key, setting_value, description, updated_at)`.

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

---

## 5. Migration Tracking (`schema_migrations`)

Managed automatically by `backend/src/config/migrations.ts` during server startup (`initDatabase()`) and standalone CLI (`database/migrate.ts`).

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Sequential tracking row ID |
| `migration_id` | VARCHAR(50) | NOT NULL | Numeric filename prefix (e.g. `005`) |
| `name` | VARCHAR(255) | NOT NULL | SQL filename (e.g. `005_create_warehouse_tables.sql`) |
| `migration_type` | VARCHAR(20) | DEFAULT `'migration'`, CHECK IN (`'migration'`, `'seed'`) | Distinguishes schema DDL vs seed files |
| `checksum` | VARCHAR(64) | NOT NULL | SHA-256 hex digest of SQL file content |
| `execution_ms` | INTEGER | DEFAULT `0`, NOT NULL | Execution duration in milliseconds (`0` for bootstrapped legacy baseline) |
| `applied_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP, NOT NULL | Application timestamp |
| **Unique Constraint** | `(migration_type, name)` | Unique tracked entry | Guarantees idempotent re-execution |

---

## 6. Independent Warehouse Management System Tables (`005_create_warehouse_tables.sql`)

Adds 24 relational tables supporting Phase 02 approved decisions (`DEC-01`..`DEC-12`, `PARAM-01`..`PARAM-04`). Total GFMS table count: `15 (legacy 001–004) + 1 (schema_migrations) + 24 (WMS 005) = 40 tables`.

### 6.1 Conceptual Module Map

```text
warehouses ──1:N── warehouse_locations (composite PK/UQ: (warehouse_id, id))
    │  └──1:N── warehouse_staff ──N:1── users
    │
    ├── goods_receipts ──1:N── goods_receipt_items ──0..N── qc_inspections
    ├── material_requisitions ──1:N── material_requisition_items ──1:N── stock_issues / stock_issue_items
    ├── material_returns
    ├── warehouse_transfers ──1:N── warehouse_transfer_items
    ├── stock_counts ──1:N── stock_count_items ──0..N── stock_adjustments
    ├── reorder_requests
    ├── warehouse_notifications
    │
    └── inventory_balances (UNIQUE: warehouse_id, location_id, material_id, lot_key, stock_status)
            ▲
            │ (append-only operational ledger; UPDATE/DELETE/TRUNCATE blocked at DB boundary)
    stock_movements (self-FK: linked_movement_id, reversed_movement_id)

material_categories ──1:N── materials (Global WAC: weighted_avg_cost, total_valued_qty, total_inventory_value)
                                └──1:N── inventory_lots (UNIQUE: material_id, lot_number, roll_number)
```

### 6.2 Configuration, Topology & Staff Assignment

1. **`warehouse_settings`**: Global WMS policy key-value store (`id`, `setting_key UQ`, `setting_value`, `description`, `updated_by -> users(id) ON DELETE SET NULL`, `updated_at`). Defaults (`005` seed):
   - `adjustment_approval_threshold = 'UNCONFIGURED'` (`PARAM-01`: forces Factory Manager approval until explicitly configured)
   - `write_off_requires_factory_manager = 'true'` (`DEC-08`)
   - `grn_over_delivery_tolerance_pct = '0'` (`PARAM-03`)
   - `fifo_override_requires_reason = 'true'` (`DEC-04`)
2. **`warehouses`**: Independent warehouse master (`id`, `warehouse_code UQ`, `name`, `warehouse_type CHECK IN ('RAW_MATERIAL','FABRIC','TRIMS_ACCESSORIES','WIP','FINISHED_GOODS','QUARANTINE','GENERAL')`, `department_id -> departments(id) ON DELETE RESTRICT`, `manager_id -> users(id) ON DELETE SET NULL`, `require_bin_tracking BOOLEAN DEFAULT TRUE`, `description`, `status CHECK ('active'|'inactive')`, `created_at`, `updated_at`).
3. **`warehouse_locations`**: Bins/zones/holding bays (`id`, `warehouse_id -> warehouses(id) ON DELETE RESTRICT`, `location_code`, `name`, `location_type CHECK ('DEFAULT','RECEIVING','STORAGE','STAGING','QC_HOLD','DISPATCH','DAMAGED')`, `zone`, `aisle`, `rack`, `bin`, `is_default`, `status`, timestamps).
   - **Uniqueness**: `UNIQUE (warehouse_id, location_code)` and `UNIQUE (warehouse_id, id)` enabling cross-warehouse composite foreign keys on all child operational tables.
4. **`warehouse_staff`** (`PARAM-04`): Explicit warehouse-to-user authorization mapping (`id`, `warehouse_id -> warehouses(id) ON DELETE RESTRICT`, `user_id -> users(id) ON DELETE CASCADE`, `staff_role CHECK ('WAREHOUSE_MANAGER','WAREHOUSE_KEEPER','QC_INSPECTOR','VIEWER')`, `is_primary`, `status`, `assigned_at`, `effective_from`, `effective_to`, `assigned_by -> users(id)`, `notes`, timestamps).
   - **Constraints**: `UNIQUE (warehouse_id, user_id)`, `CHECK (effective_to IS NULL OR effective_to >= effective_from)`.

### 6.3 Material Catalog, Lots/Rolls & Real-Time Balances

5. **`material_categories`**: (`id`, `category_code UQ`, `name UQ`, `category_type CHECK ('FABRIC','TRIM_ACCESSORY','PACKAGING','FINISHED_GOOD','CONSUMABLE')`, `requires_qc_default`, `is_lot_tracked_default`, `is_roll_tracked_default`, `description`, `status`, timestamps).
6. **`materials`**: (`id`, `sku UQ`, `name`, `category_id -> material_categories(id) ON DELETE RESTRICT`, `base_uom CHECK ('meter','yard','kg','pcs','roll','cone','carton','set','box')`, `color`, `size`, `attributes_json TEXT DEFAULT '{}'`, `is_lot_tracked`, `is_roll_tracked`, `requires_qc_on_receipt`, `min_stock_level >= 0`, `reorder_level >= 0`, **Global WAC fields** `weighted_avg_cost >= 0`, `total_valued_qty >= 0`, `total_inventory_value >= 0`, `last_cost_updated_at`, `status`, timestamps).
   - *Design Note (`PARAM-02`)*: Valuation columns reside **exclusively** on `materials` (global per material, not per warehouse) and are calculated deterministically inside Phase 04 application services rather than database triggers.
7. **`inventory_lots`**: Physical dye-lot / fabric roll records (`id`, `material_id -> materials(id) ON DELETE RESTRICT`, `lot_number`, `roll_number DEFAULT ''`, `shade_code`, `supplier_name`, `supplier_batch_ref`, `initial_qty > 0`, `remaining_qty >= 0`, `qc_status CHECK ('PENDING','PASSED','PARTIALLY_PASSED','REJECTED')`, `received_at`, `expiry_date`, `notes`, timestamps).
   - **Uniqueness**: `UNIQUE (material_id, lot_number, roll_number)` (normalized non-null `''` roll ensures standard PostgreSQL and `pg-mem` enforce uniqueness identically for both roll-free and roll-tracked lots).
8. **`inventory_balances`**: Real-time quantity snapshot per warehouse, bin, material, optional lot, and stock state (`id`, `warehouse_id`, `location_id`, `material_id`, `lot_id`, `lot_key VARCHAR(64) DEFAULT 'NONE'`, `stock_status CHECK ('AVAILABLE','QUARANTINE','HOLD','DAMAGED','SCRAP','IN_TRANSIT')`, `qty_on_hand >= 0`, `qty_reserved >= 0`, `qty_available NUMERIC(14,4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED`, `updated_at`).
   - **Constraints**:
     - `CHECK (qty_reserved <= qty_on_hand)`
     - `CHECK ((lot_id IS NULL AND lot_key = 'NONE') OR (lot_id IS NOT NULL AND lot_key <> 'NONE'))`
     - `FOREIGN KEY (warehouse_id, location_id) REFERENCES warehouse_locations(warehouse_id, id) ON DELETE RESTRICT`
     - `UNIQUE (warehouse_id, location_id, material_id, lot_key, stock_status)`

### 6.4 Receiving & Quality Control

9. **`goods_receipts`**: Inbound GRN headers (`id`, `grn_number UQ`, `warehouse_id`, `supplier_name`, `delivery_note_no`, `po_reference`, `received_date`, `status CHECK ('DRAFT','POSTED','CANCELLED')`, `notes`, `received_by`, `posted_by`, `posted_at`, timestamps).
10. **`goods_receipt_items`**: GRN line items (`id`, `grn_id`, `warehouse_id`, `target_location_id`, `material_id`, `lot_id`, `expected_qty >= 0`, `received_qty > 0`, `accepted_qty >= 0`, `rejected_qty >= 0`, `damaged_qty >= 0`, `pending_inspection_qty >= 0`, `unit_cost >= 0`, `qc_status`, `discrepancy_notes`, `created_at`).
    - **Constraints**: `CHECK (received_qty = accepted_qty + rejected_qty + damaged_qty + pending_inspection_qty)` and composite FK `(warehouse_id, target_location_id) -> warehouse_locations(warehouse_id, id)`.
11. **`qc_inspections`**: Supports partial and multiple QC outcomes per GRN line or lot (`id`, `inspection_number UQ`, `grn_item_id`, `lot_id`, `warehouse_id`, `location_id`, `material_id`, `inspected_qty > 0`, `passed_qty >= 0`, `rejected_qty >= 0`, `damaged_qty >= 0`, `outcome_status`, `inspector_id`, `inspected_at`, `notes`).
    - **Constraints**: `CHECK (inspected_qty = passed_qty + rejected_qty + damaged_qty)` and composite FK `(warehouse_id, location_id) -> warehouse_locations(warehouse_id, id)`.

### 6.5 Requisitions, Issuing, Returns & Transfers

12. **`material_requisitions`**: Production/department material requests (`id`, `requisition_number UQ`, `department_id -> departments(id)`, `production_line_id -> production_lines(id)`, `warehouse_id`, `reference_type`, `reference_code`, `required_date`, `status CHECK ('DRAFT','SUBMITTED','APPROVED','PARTIALLY_ISSUED','FULFILLED','REJECTED','CANCELLED')`, `requested_by`, `approved_by`, `approved_at`, `notes`, timestamps).
13. **`material_requisition_items`**: (`id`, `requisition_id`, `material_id`, `preferred_lot_id`, `requested_qty > 0`, `reserved_qty >= 0`, `issued_qty >= 0`, `notes`) with `CHECK (issued_qty <= requested_qty)`.
14. **`stock_issues`**: Issue dispatch headers against approved requisitions (`id`, `issue_number UQ`, `requisition_id`, `warehouse_id`, `department_id`, `production_line_id`, `status CHECK ('DRAFT','POSTED','CANCELLED')`, `issued_by`, `received_by`, `posted_at`, `notes`, `created_at`).
15. **`stock_issue_items`**: Issued line items (`id`, `issue_id`, `requisition_item_id`, `warehouse_id`, `location_id`, `material_id`, `lot_id`, `issued_qty > 0`, `unit_cost >= 0`, `fifo_overridden`, `fifo_override_reason`).
    - **Constraints**: `CHECK (fifo_overridden = FALSE OR (fifo_override_reason IS NOT NULL AND fifo_override_reason <> ''))`, composite FK `(warehouse_id, location_id)`.
16. **`material_returns`**: Surplus, damaged, or scrap returns from production (`id`, `return_number UQ`, `department_id`, `production_line_id`, `stock_issue_id`, `warehouse_id`, `target_location_id`, `material_id`, `lot_id`, `returned_qty > 0`, `return_condition CHECK ('USABLE_SURPLUS','DAMAGED','WASTE_SCRAP')`, `target_stock_status CHECK ('AVAILABLE','HOLD','DAMAGED','SCRAP')`, `unit_cost >= 0`, `status CHECK ('DRAFT','SUBMITTED','POSTED','REJECTED')`, `returned_by`, `received_by`, `posted_at`, `notes`, `created_at`) with composite FK `(warehouse_id, target_location_id)`.
17. **`warehouse_transfers`**: Internal bin and 2-step inter-warehouse transfers (`id`, `transfer_number UQ`, `transfer_type CHECK ('INTERNAL_BIN','INTER_WAREHOUSE')`, `source_warehouse_id`, `target_warehouse_id`, `status CHECK ('DRAFT','DISPATCHED','IN_TRANSIT','RECEIVED','RECEIVED_WITH_DISCREPANCY','CANCELLED')`, `dispatched_by`, `dispatched_at`, `received_by`, `received_at`, `notes`, `created_by`, timestamps).
18. **`warehouse_transfer_items`**: (`id`, `transfer_id`, `source_warehouse_id`, `source_location_id`, `target_warehouse_id`, `target_location_id`, `material_id`, `lot_id`, `dispatched_qty > 0`, `received_qty >= 0`, `damaged_qty >= 0`, `discrepancy_qty >= 0`, `unit_cost >= 0`, `notes`).
    - **Constraints**: Source & target composite FKs to `warehouse_locations(warehouse_id, id)` and `CHECK (received_qty + damaged_qty + discrepancy_qty <= dispatched_qty)`.

### 6.6 Physical Counts, Adjustments, Reorder & Notifications

19. **`stock_counts`**: Cycle/full physical counts (`id`, `count_number UQ`, `warehouse_id`, `count_type CHECK ('CYCLE','FULL')`, `status CHECK ('PLANNED','IN_PROGRESS','SUBMITTED_FOR_REVIEW','APPROVED_AND_POSTED','CANCELLED')`, `created_by`, `approved_by`, `approved_at`, `notes`, timestamps).
20. **`stock_count_items`**: Count sheets per location/lot/status (`id`, `count_id`, `warehouse_id`, `location_id`, `material_id`, `lot_id`, `stock_status`, `system_qty >= 0`, `counted_qty >= 0`, `variance_qty`, `counted_by`, `notes`) with composite FK `(warehouse_id, location_id)`.
21. **`stock_adjustments`**: Reason-coded threshold-approved adjustments (`id`, `adjustment_number UQ`, `warehouse_id`, `location_id`, `material_id`, `lot_id`, `stock_status`, `stock_count_id`, `direction CHECK ('IN','OUT')`, `quantity > 0`, `unit_cost >= 0`, `reason_code`, `requires_factory_manager BOOLEAN DEFAULT TRUE`, `status`, `submitted_by`, `approved_by`, `approved_at`, `notes`, timestamps).
    - **Constraints**:
      - `CHECK (reason_code <> 'WRITE_OFF' OR requires_factory_manager = TRUE)` (`DEC-08`)
      - `CHECK (approved_by IS NULL OR approved_by <> submitted_by)` (DB-level maker-checker)
      - Composite FK `(warehouse_id, location_id) -> warehouse_locations(warehouse_id, id)`
22. **`reorder_requests`**: Multi-stage reorder workflow (`id`, `request_number UQ`, `material_id`, `warehouse_id`, `available_qty_at_request >= 0`, `reorder_level_snapshot >= 0`, `requested_qty > 0`, `priority CHECK ('NORMAL','URGENT')`, `required_date`, `po_reference`, `supplier_note`, `status CHECK ('OPEN','SUBMITTED','PURCHASING_REVIEWED','APPROVED','LINKED_TO_PO','CLOSED','REJECTED','CANCELLED')`, `requested_by`, `submitted_by`, `purchasing_reviewed_by`, `purchasing_reviewed_at`, `approved_by`, `approved_at`, `justification`, timestamps).
23. **`warehouse_notifications`**: In-app alert inbox (`id`, `recipient_user_id -> users(id) ON DELETE CASCADE`, `target_role_name`, `warehouse_id -> warehouses(id) ON DELETE CASCADE`, `notification_type CHECK ('LOW_STOCK','QC_PENDING','APPROVAL_REQUIRED','TRANSFER_DELAYED','RECEIPT_DISCREPANCY','GENERAL')`, `severity CHECK ('INFO','WARNING','CRITICAL')`, `title`, `message`, `entity_type`, `entity_id`, `is_read`, `read_at`, `created_at`).

### 6.7 Immutable Stock Movement Ledger

24. **`stock_movements`**: Append-only operational stock ledger (`id`, `movement_ref UQ`, `material_id`, `lot_id`, `warehouse_id`, `location_id`, `stock_status`, `direction CHECK ('IN','OUT')`, `movement_type CHECK ('RECEIPT','QC_RELEASE','QC_REJECT','ISSUE','RETURN','TRANSFER_OUT','TRANSFER_IN_TRANSIT','TRANSFER_IN','ADJUSTMENT_IN','ADJUSTMENT_OUT','WRITE_OFF','FG_RECEIPT','REVERSAL')`, `quantity > 0`, `balance_before >= 0`, `balance_after >= 0`, `unit_cost >= 0`, `total_cost >= 0`, `source_warehouse_id`, `source_location_id`, `destination_warehouse_id`, `destination_location_id`, `source_document_type`, `source_document_id`, `source_document_ref`, `linked_movement_id -> stock_movements(id) ON DELETE RESTRICT`, `reversed_movement_id -> stock_movements(id) ON DELETE RESTRICT`, `is_immutable BOOLEAN DEFAULT TRUE CHECK (is_immutable = TRUE)`, `actor_id -> users(id) ON DELETE RESTRICT`, `notes`, `created_at`).
    - **Database-Boundary Immutability**:
      - Live PostgreSQL: `trg_stock_movements_immutable` (`BEFORE UPDATE OR DELETE FOR EACH ROW`) raises `IMMUTABLE_LEDGER`.
      - `pg-mem`: `attachPgMemImmutabilityGuards` intercepts `onBeforeChange('all')` (update/delete) and `onTruncate` raising `IMMUTABLE_LEDGER`.
    - **Correction Policy**: Posted mistakes must be offset with a `REVERSAL` movement referencing `reversed_movement_id` (`ON DELETE RESTRICT`).

### 6.8 WMS Performance Indexes (`005_create_warehouse_tables.sql`)
- Topology & Staff: `idx_warehouses_department`, `idx_wh_locations_warehouse`, `idx_wh_staff_user`, `idx_wh_staff_warehouse`
- Materials & Lots: `idx_materials_category`, `idx_materials_status`, `idx_lots_material_received`, `idx_lots_qc_status`
- Balances: `idx_balances_wh_mat_status`, `idx_balances_material`, `idx_balances_lot`
- Documents & Ledger: `idx_grn_warehouse_status`, `idx_grn_items_grn`, `idx_qc_inspections_lot`, `idx_req_dept_status`, `idx_req_wh_status`, `idx_issues_req`, `idx_transfers_status`, `idx_counts_wh_status`, `idx_adjustments_wh_status`, `idx_reorders_status`, `idx_movements_material_created`, `idx_movements_warehouse_created`, `idx_movements_doc`, `idx_movements_linked`, `idx_movements_reversed`, `idx_wh_notif_recipient`


