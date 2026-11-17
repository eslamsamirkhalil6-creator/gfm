# GFMSv0.3 – HR Gate A Final Addendum v2.0 (Documentation Candidate)

**Document ID:** `GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v2.0_CANDIDATE.md`  
**Status:** **`DRAFT – FOR OWNER REVIEW (GATE A CONSOLIDATION CANDIDATE)`**  
**Gate A Status:** **`GATE A – OPEN / NOT APPROVED`** *(System Owner retains exclusive authority to ratify and close Gate A; remaining technical blockers in Section 8 remain open.)*  
**Implementation Status:** **`HR IMPLEMENTATION – NOT AUTHORIZED`**  
**Gate B Status (Live PostgreSQL 14+):** **`NOT VERIFIED / PENDING`** *(Container runs `pg-mem v3.0.14`; `pg-mem` never proves PostgreSQL 14+ compatibility. Zero HR DDL, migrations, or seeds may run before Gate B passes.)*  
**Operational Readiness (`OP-01`):** **`PENDING`** *(Separate Go-Live gate.)*  
**Date:** 2026-11-17  

---

## 1. Document Governance, Consolidation Scope & Precedence (`AUD-02`, `AUD-03`)

### 1.1 Purpose & Consolidation Relationship
This **v2.0 Documentation Candidate** consolidates the complete GFMSv0.3 HR Gate A architecture into a self-contained Addendum by uniting:
1. **Newly Approved Owner Decisions (`OD-A1`, `OD-A2`, `OD-A3`, `OD-A4`)** supplied for Gate A consolidation;
2. **All Previously Approved Decisions (`Decision A`–`Decision D`, `U-01`–`U-07`, `OD-01`–`OD-03`, `v0.6 §11.2 #2–#5`, and `Batches 1–6` [`109` control items])**;
3. **Complete Normative Matrices Preserved From Earlier Addenda (`AUD-03` Fix):** Full `42`-key Phase 08A conceptual RBAC matrix (`v1.0 §4.1` + `Decision B`), secondary-role privilege analysis (`v1.0 §4.2`), full `#1–#43` + `#41b`/`#41c`/Legacy-Dept endpoint matrix (`v1.0 §5` + `Decision A` + `OD-A2` + `OD-A3` + `AUD-05`), `ISS-01`–`ISS-11` ledger (`v1.0 §6`), `9`-policy routing matrix (`v1.0 §7`), data model/security/API/testing invariants (`v1.0 §8–§11`), `OP-01` (`v1.0 §12`), `GB-01.1`–`GB-01.11` (`v1.0 §13`), and grouped `ISS-06-G001`–`G107` principles (`v1.1_CANDIDATE §7.1` + `v1.2.1 §3.5` + `OD-A1`); and
4. **`GFMSv0.3_HR_DETAILED_ARCHITECTURE_DESIGN_v0.6.md` (`584` lines) — Incorporated by Reference as Base Architecture** for base `37`-table ER/DDL specifications (`§3`), two-phase idempotency & service DAG (`§4.2–§4.4`), AES-256-GCM/isolation honesty (`§7.2`), offline sync (`§8`), and base `HR-DEC-01`–`HR-DEC-14` (`§9`), **except where explicitly amended in Section 1.2**.

> **Precedence & Non-Supersession Rule (`AUD-03`):**  
> - **Priority 1 (Governing Overlay):** This Addendum (`v2.0_CANDIDATE`) + companion `GFMSv0.3_HR_GATE_A_RECONCILIATION_AND_TRACEABILITY_REPORT_v2.0.md`.  
> - **Priority 2 (Base Architecture — Incorporated by Reference):** `GFMSv0.3_HR_DETAILED_ARCHITECTURE_DESIGN_v0.6.md` remains an active authoritative specification for all base DDL/service/protocol details not amended in Section 1.2; `v0.6` is **not** marked superseded.  
> - **Preserved Archival Milestones:** Earlier Addenda (`v1.0`, `v1.1_CANDIDATE`, `v1.2_CANDIDATE`, `v1.2.1_CANDIDATE`) and Reports (`v1.1`, `v1.2`, `v1.2.1`) remain completely unmodified on disk; all their normative matrices and traceability evidence are preserved in this `v2.0` package.

### 1.2 Explicit `v0.6` Amendment & Precedence Table
Wherever `v0.6` differs from the decisions consolidated below, **`v2.0_CANDIDATE` prevails**:

| `v0.6` Section / Line | Original `v0.6` Rule | `v2.0` Amendment Authority | Governing `v2.0` Specification |
|---|---|---|---|
| `§3.3 #5–#6` (`approval_requests` / `approval_steps.due_at`) | Nullable `TIMESTAMPTZ` across time/deadline columns. | `U-04`, `NUANCE-A`, `Batch 1`, `CONTRADICTION-04` | Active `'PENDING'` steps enforce SLA deadline provenance under **five-part conceptual time-and-trust representation** (`§3.4.2`); bare `TIMESTAMPTZ` is insufficient. Physical SQL column layout & `due_at` DDL remain `DEFERRED` pre-DDL design (`§8 #1`). |
| `§3.3 #8` (`hr_settings`) & `§5.2` (`hr:admin:manage`) | No policy SLA keys; `hr:admin:manage` shared by `HR Manager` and `SysAdmin`. | `Decision B` (`GAP-01`), `CONTRADICTION-05`, `G008/G013/G014` | Cycle/step creation fails closed without active policy SLA config (`CONTRADICTION-05`). Decouple conceptual `hr:sla:manage` (`SysAdmin` only) & `hr:sla:view` (`SysAdmin` + `HR Mgr` read-only) from `hr:admin:manage` (`§3.2`). Schema keys/bounds `DEFERRED`/`OP-01` (`§8 #2`). |
| `§3.3 #15–#18, #24, #28` (`approval_request_id`) | Single `approval_request_id` FK per workflow entity. | `Decision D` (`GAP-03`), `G081/G082/G090` | Linked, immutable multi-cycle approval history is a mandatory architectural requirement; single pointers are insufficient for policy-permitted reopening (`§3.5`). Physical FK/index DDL `DEFERRED` pre-DDL (`§6`). |
| `§4.1 #2`, `#4`, `#6`, `#5d` | Optional `Idempotency-Key`, no self-bootstrap lock, auto-syncs `hr_employees.full_name` -> `users.full_name`. | `OD-02`, `§11.2 #5`, `ISS-05`, **`OD-A2`** | Single-use `HR Manager` self-bootstrap on `#2`; `#4` self-edit blocked on 8 career fields (`OD-A2`); zero automatic `users.full_name` overwrite (`§5`, `§9`). |
| `§4.1 #5a` (`POST .../terminations`) | Permits `Factory Manager` via generic `hr:employees:status`. | `U-06 #4` (`ISS-08`) | `Factory Manager` termination initiation restricted strictly to `subject = HR Manager` under Policy `#8` (`§5 #5a`). |
| `§4.1 #16a–#16d` & `§6.2 #7` (`HR_SALARY_REVISION`) | `'Alternate Executive'` approves executive salary revisions; `#16d` `403` post-decision. | `OD-01`, `U-01`, `U-02`, **`AUD-05`** | Role renamed `'Owner Executive'` (aggregate `#16c` only); `initiate_executive` omitted (`U-02`); Exec Policy `#7b` dormant (`409`); Standard Policy `#7a` (`#16d`) stays `Factory Manager` ONLY with **`403` baseline preserved (`AUD-05`)**. |
| `§4.1 #19`, `#24`, `#25`, `#30`, `#35` | `#19`/`#35` omit `hr:self:view`; `#24`/`#25`/`#30` use `hr:self` shorthand. | `U-06 #1–#3`, **`OD-A3`** | `#19` & `#35` add `hr:self:view` + self-ownership; **`#24` (`OD-A3`) & `#25` use `hr:self:attendance:view`**; `#30` uses granular `hr:self:*` keys (`§5`). |
| `§4.1 #41` (`Approval Routes`) & Legacy Dept APIs | Lacks `#41b`/`#41c`; transfer only `USE_HR_TRANSFER_WORKFLOW`. | `ISS-02`/`06`/`10`, `Decision A`/`C`, **`OD-A1`** | Adds `#41b` (unified **`404`**, separate from `#16d` `403`) & `#41c` (`U-04` cancel); reassignment (`Decision C`) & SLA extension (**`OD-A1`**) fail closed when `HR Mgr` conflicted; all 3 Legacy Dept routes return `409 USE_HR_WORKFLOW` inside TX. |
| `§5.1–§5.2` (Roles & `46` Permissions) | `'Alternate Executive'`, `'Employee Self-Service'`, `hr:self:*` on operational roles, `46` perms. | `OD-03`, `U-02`, `U-03`, `U-05`, `ISS-09`, `Decision B` | Canonical `roles.role_name` strings; reuse `'Department User'` (`2nd-Role`) via `SysAdmin` `PUT /api/users/:id/roles` (`OD-A2`); **`42` conceptual Phase 08A keys + `5` deferred Phase 11 keys = `47` conceptual keys** (`§4.1`). |
| `§10.1` (Steps `1–9`) | Step 7 bundles custody + Mode B binary upload/purge. | `§11.2 #2`, `ISS-11`, `Batch 3` | Phase 08A stops at **Step 7A** (`hr_asset_custody` + Mode A metadata `hr_documents` in Step 2); **Step 7B** (Mode B binary storage/purge & Batch 3 Execution) explicitly deferred (`§2`). |

---

## 2. Verified Repository & Phase 08A Baseline

Directly verified against workspace files (`database/`, `backend/src/`, `frontend/src/`, `docs/`):
- **Existing Schema & Seeds (`VERIFIED`):** `6` migrations (`001`–`006`, `41` active tables) and `7` seeds (`001`–`007`, `12` canonical roles, `48` existing permissions).
- **HR Implementation State (`NOT IMPLEMENTED`):** `0` HR tables, `0` HR roles, `0` `hr:*` permissions, `0` HR API routes, and `0` HR UI views.
- **Preserved Workforce & System Invariants (`VERIFIED`):**
  - `DEP-HR` exists in `departments` with `manager_id = NULL` (`003_seed_department_data.sql:26`).
  - `department_employees.user_id` is `NOT NULL REFERENCES users(id) ON DELETE CASCADE` (`003_create_department_tables.sql:22`) and populates `planning_department_ids` (`auth.middleware.ts:131-164`); non-login workforce belongs strictly in `hr_employees`.
  - Existing `users.full_name` values contain operational titles (`001_seed:39-41`, `006_seed:44-45`, `007_seed:35-41`) and **must never be auto-synchronized** from `hr_employees.full_name`.
  - `UserService.createUser` (`user.service.ts:86`) defaults omitted `roleIds` to `[3]` (`'Department User'`).
  - `UserService.updateUserRoles` (`backend/src/routes/index.ts:58-63`, `user.service.ts:250-340`) is strictly restricted to `users:roles` (`'System Administrator'` only).
  - `AuditService.log` (`audit.service.ts:19-53`) writes `audit_logs` (`audit:read` = `'System Administrator'` only, governed by Zero-Sensitive-Payload Rule).
  - Existing `89/89` tests execute strictly on `pg-mem v3.0.14` (`docs/GFMS_PHASE_07_COMPLETION_REPORT.md:6-7, 82`); PL/pgSQL triggers (`migrations.ts:61, 92-116`) are skipped on `pg-mem` and remain **unverified on live PostgreSQL 14+**.
- **Phase 08A vs. Deferred Scope (`v1.0 §2.3` + `Batch 3`):**
  - **Phase 08A In Scope (`Steps 2–7A`, `32` Core/Shared tables):** Platform extensions (`idempotency_keys`, `notifications`, `approval_*`), `hr_employees`, `hr_settings`, `hr_documents` (Mode A metadata-only in Step 2), confidentiality vault, department assignments, status/termination/rehire/contracts/standard Policy `#7a` salary revisions, shifts/attendance/offline sync, leave ledger/holidays, and **Step 7A** non-WMS `hr_asset_custody`.
  - **Explicitly Deferred Out of Phase 08A:**
    1. **Step 7B:** Mode B encrypted disk file upload (`POST /api/hr/documents/:id/attach-file`), binary streaming (`#36a`), external `deleteObject` `PURGE_PENDING -> PURGED` I/O worker (`#36c2`), and Batch 3 Evidence Repository / Destruction Registry physical implementation.
    2. **Executive Salary Governance (`OD-01`, `U-01`, `U-02`):** Policy `#7b` for `HR Manager` and `Factory Manager` subjects (`409 EXECUTIVE_COMPENSATION_WORKFLOW_DORMANT`) + omitted `hr:confidential:compensation:initiate_executive`.
    3. **Self-Service Department Transfer Request Workflow:** Executed only by `HR Manager`/`HR Officer` via `#11`.
    4. **Phase 11 (`Step 9`):** `hr_skills`, `hr_employee_skills`, `hr_training_records`, `hr_evaluations`, `hr_evaluation_history`, Piece-Rate Costing (`DEP-FIN`), and Shuttle Integration (`DEP-TRANS`).

---

## 3. Part A — HR Gate A Architectural Requirements

### 3.1 Consolidated Owner Decisions (`OD-A1`–`OD-A4`, `Decision A`–`D`, `U-01`–`U-07`, `OD-01`–`OD-03`, `§11.2 #2–#5`, `HR-DEC-01`–`14`)

#### 3.1.1 Newly Approved Owner Decisions (`OD-A1` – `OD-A4`) — **`APPROVED`**
| Decision ID | Topic | Approved Resolution & Mandatory Architectural Effect |
|---|---|---|
| **`OD-A1`** *(Resolves `OPEN-SLA-EXT`)* | **SLA Extension Conflict Fallback** | **APPROVED — Option A (Fail Closed):** If `'HR Manager'` is conflicted (requester, subject, active step approver, or otherwise COI-disqualified) or ineligible to authorize an SLA extension (`§3.5 / §4.2`), **deny the extension**, keep the approval step **`PENDING` with its original deadline unchanged**, and create an **operational escalation** (PII-free notification/alert). **Zero fallback extension authority** is granted to `'Factory Manager'`, `'Owner Executive'`, delegates, or `'System Administrator'`. Kept strictly separate from Governance Fallback Cancellation (`#41c`, `U-04`). |
| **`OD-A2`** *(Resolves Policy Layer of `ISS-07 / NUANCE-B`)* | **Career-Field Self-Edit Lock & `SysAdmin` Onboarding Role Handoff** | **APPROVED:** Employees **cannot self-edit**: `employee_code`, `hire_date`, `last_hire_date`, `primary_department_id`, `employment_type`, `rehire_count`, **`user_id`**, **`employment_status`** (`#4`). Any changes to those fields must flow through an **authorized, audited HR workflow**. During HR onboarding, **HR requests the secondary `'Department User'` role**, and **`'System Administrator'` executes role assignment via `PUT /api/users/:id/roles`** (`users:roles`). **HR must NOT directly mutate `user_roles`.** *(Remaining technical/implementation mechanics stay in Section 8 #4.)* |
| **`OD-A3`** *(Resolves `NUANCE-C`)* | **Endpoint `#24` (`GET /api/hr/shifts*`) Permission Parity** | **APPROVED:** For `GET /api/hr/shifts*` (`#24`), replace generic `hr:self` shorthand with **`hr:self:attendance:view`** (matching `#25`). Mandatory employee identity verification (`hr_employees.user_id = actor.id`) and row-ownership checks remain required. |
| **`OD-A4`** *(Resolves `GAP-04 / AUD-01`)* | **`ISS-06` Traceability Disposition** | **APPROVED:** Accept the **`107` grouped principles (`ISS-06-G001`–`G107`)** as the canonical `ISS-06` baseline for Gate A and preserve the **`109` approved Batch `1–6` controls**. Explicitly disclose that individual raw mapping of `ISS-06` decisions `#1`–`#171` is **`0 / 171` independently verifiable** because the original raw numbered ledger is unavailable; **zero fabricated mappings or 1:1 traceability claims**. |

#### 3.1.2 Previously Approved Owner Decisions (`Decision A` – `Decision D`) — **`APPROVED`**
| Decision ID | Source Issue | Approved Resolution & Architectural Effect |
|---|---|---|
| **`Decision A`** *(Resolves `CONTRADICTION-01`)* | **`ISS-02 #41b` HTTP Status (`AUD-05` Bounded)** | **Unified HTTP `404`** for nonexistent, unauthorized, unassigned/pooled (`assigned_user_id IS NULL`), and finalized (`APPROVED`/`REJECTED`/`CANCELLED`/`EXPIRED`) `GET /api/approvals/:id/context` (`#41b`) requests. Preserve **`400`** (invalid `:id`) and **`401`** (unauthenticated). **Explicitly scoped to `#41b` only; `#16d` preserves its `v1.0 §5` `403` baseline (`AUD-05`).** |
| **`Decision B`** *(Resolves `GAP-01` / `CONTRADICTION-02`)* | **SLA Configuration RBAC Boundary** | Conceptual permission split: **`hr:sla:manage`** (`'System Administrator'` only), **`hr:sla:view`** (`'System Administrator'` + `'HR Manager'` strictly read-only), keeping **`hr:admin:manage`** unchanged for `hr_leave_types` & non-SLA `hr_settings` (barred from mutating SLA/calendar settings). *Architectural decision only: zero permissions, seeds, or SQL created.* |
| **`Decision C`** *(Resolves `GAP-02`)* | **`HR Manager` Conflicted Reassignment** | When `'HR Manager'` is conflicted or ineligible to reassign a step, reassignment **fails closed**: step remains **`PENDING`** with operational escalation; zero implied fallback authority for `'Factory Manager'`, `'Owner Executive'`, delegates, or `'System Administrator'`; separate from `#41c`. |
| **`Decision D`** *(Resolves `GAP-03`)* | **Multi-Cycle Approval Data Model** | **Mandatory architectural requirement:** linked, immutable multi-cycle approval history for policy-permitted reopening (`§3.5`). Existing `v0.6 §3.3` single `approval_request_id` columns are insufficient for unlimited cycles. Exact FK/column/index DDL remains **`DEFERRED`** to pre-DDL review. |

#### 3.1.3 Previously Approved Decisions (`U-01`–`U-07`, `OD-01`–`OD-03`, `§11.2 #2–#5`, Base `HR-DEC-01`–`14`)
- **`U-01` (`APPROVED`):** `'Owner Executive'` receives `dashboard:view` only (no `dashboard:factory`), aggregate compensation summary (`#16c`) only, zero individual salary visibility (`#16d` `403` barred), Policy `#7b` executive salary revisions dormant outside Phase 08A.
- **`U-02` (`APPROVED`):** Completely omit `hr:confidential:compensation:initiate_executive` from future Seed `008`.
- **`U-03` (`APPROVED`):** Reuse existing `'Department User'` (`role_id = 3`) as a secondary role during HR onboarding; preserve employee's operational role; never grant `hr:self:*` directly to operational roles; enforce JWT + `hr_employees.user_id` + row ownership + `TERMINATION_PENDING` allowlist. *(Label note preserved: Candidate `§3` labeled `Option B`, `v1.0`/`OD-03` labeled `Option A`; semantics identical.)*
- **`U-04` (`APPROVED`):** Governance Fallback Cancellation (`#41c`) requires **BOTH** SLA expiry **AND** verified `0` eligible active approvers/delegates; `HR Manager` primary; `Factory Manager` exceptional only under objectively verifiable `HR Manager` ineligibility; delegates, requester, and `System Administrator` barred; atomic TX + concurrency locks + immutable audit.
- **`U-05` (`APPROVED`):** `'System Administrator'` receives zero `hr:self:*` permissions (`'Department User'` secondary role only via `SysAdmin`-executed `PUT /api/users/:id/roles` per `OD-A2`).
- **`U-06` (`APPROVED`):** `#35` Asset Custody & `#19` Contracts add `hr:self:view` + ownership check; `#25`, `#30`, and **`#24` (`OD-A3`)** use granular `hr:self:*` keys; `#5a` Termination Initiation restricts `Factory Manager` strictly to `HR Manager` subject under Policy `#8`.
- **`U-07` (`APPROVED`):** Post-Gate-A roadmap alignment records Phase 07 completed on `pg-mem` evidence only, Phase 08A planned (not implemented), and Gate B live PostgreSQL 14+ verification mandatory before any DDL/migrations/seeds.
- **`OD-01`, `OD-02`, `OD-03`, `§11.2 #2–#5`:** `OD-01` aggregate-only `Owner Executive`; `OD-02` single-use audited `HR Manager` baseline profile self-bootstrap (zero self-approval + `OD-A2` 8-field career self-edit lock); `OD-03` reuse `'Department User'`; Step 7A Mode A initially (Step 7B deferred); `409 USE_HR_WORKFLOW` inside `withTransaction` across all 3 legacy Dept APIs; Seed `008` zero auto-backfill (`'admin'` legal onboarding manual); existing `users.full_name` preserved verbatim.
- **Base `HR-DEC-01`–`HR-DEC-14` (`v0.6 §9`):** Incorporated by reference and amended cleanly by `OD-01`–`03`, `U-01`–`07`, `Decision A`–`D`, `OD-A1`–`A4` (specifically: `HR-DEC-01` Dept bridge/Mode A Step 2; `HR-DEC-02` Phase 08A/11 split; `HR-DEC-03` termination 12-source guard; `HR-DEC-04` unified `notifications`; `HR-DEC-05` shared engine + 9 policies amended by `#7b` dormant, `Decision C`/`D`, `OD-A1`; `HR-DEC-06` Step 7A/7B split; `HR-DEC-07` 2-phase idempotency & PG SQLSTATE; `HR-DEC-08` amended to `42`+`5`=`47` conceptual keys via `U-02`/`OD-03`/`Decision B`/`OD-A3`; `HR-DEC-09` & `HR-DEC-14` AES-256-GCM/DB-isolation honesty + `#41b` `404` & `#16d` `403`; `HR-DEC-10` append-only leave ledger; `HR-DEC-11` `?tab=&sub=&id=` UI sync; `HR-DEC-12` `deactivation_source` & `TERMINATION_PENDING` allowlist; `HR-DEC-13` offline attendance batches & `CONFLICT_PENDING`). **Pending final formal Gate A ratification sign-off (`§8 #5`).**

### 3.2 Canonical Role, Separation-of-Duty & Conceptual Permission Matrix (`42` Phase 08A Keys + `5` Deferred Phase 11 Keys)

> **Canonical Naming Rule (`ISS-09`):** Exact case-sensitive `roles.role_name` strings: `'System Administrator'`, `'Factory Manager'`, `'Department Manager'`, `'Department User'`, `'HR Manager'`, `'HR Officer'`, `'Owner Executive'`, plus Batch 4 independent custodial functions (`Audit Custodian`, `Security Custodian`, `Governance Authority`). Retired strings (`'Alternate Executive'`, `'Employee Self-Service'`, `'HR Mgr'`, `'Factory Mgr'`, `'Dept Mgr'`, `'SysAdmin'`) must never appear in specs or future SQL.  
> **Conceptual Notice:** All `42` Phase 08A + `5` Phase 11 = `47` permissions below are architectural specifications only; **zero permissions or Seed `008` files have been created**.

#### 3.2.1 Separation-of-Duty Summary (Updated with `Decision B`, `Decision C`, `OD-A1`, `OD-A2`)
| Role / Function | Permitted Scope | Strictly Barred Scope |
|---|---|---|
| **`System Administrator`** | Technical RBAC, **`hr:sla:manage` + `hr:sla:view`** (`Decision B`), `hr:admin:manage` (`hr_leave_types` & non-SLA `hr_settings`), **`users:roles` (`PUT /api/users/:id/roles` incl. HR-requested `'Department User'` onboarding handoff per `OD-A2`)**, audited transport-only DLQ notification replay (`§3.5`). | **Zero** HR operational data, `hr:self:*`, HR approvals, `#41b`/`#41c`, step reassignment (`Decision C`), SLA extension (`OD-A1`), `hr_confidential_audit_logs`, `HR`/`PAYROLL` content, Emergency Journal content, or sensitive Governance records. |
| **`HR Manager`** | Core HR & confidential vault (`pii`, `compensation:view|manage`, `medical`, `confidential:documents`, `legal_hold`, `purge`, `confidential:audit:view`), **`hr:sla:view`** (strictly read-only — `Decision B`), `hr:admin:manage` (`hr_leave_types` & non-SLA `hr_settings` only), primary `#41c` cancel, reassignment (`Decision C`), reopening, ordinary SLA extension (`OD-A1`), audited self-bootstrap (`OD-02` + `OD-A2` locks). | **Zero** self-approval (`#1`–`#9`), **zero** SLA configuration writes (`Decision B`), **zero** `user_roles` direct mutation (`OD-A2`), **zero** self-edit on 8 career fields (`OD-A2`), **zero** self/conflicted SLA extension (`OD-A1` fails closed), **zero** conflicted reassignment (`Decision C` fails closed), **zero** conflicted reopening, **zero** override of Audit/Security Custodians or Governance Authority. |
| **`Factory Manager`** | Operational HR (`hr:view`, `attendance:view|approve`, `leave:view|approve`, `contracts:approve`, `employees:status`), Policy `#7a` (`#16d` `PENDING` `403` baseline, `#16c` summary), `#5a` termination initiation strictly for `HR Manager` subject (`U-06 #4`), exceptional `#41c` cancel & cycle reopening **only** with documented objective `HR Manager` ineligibility. | **Zero** individual bulk salary/history/PII/medical/confidential-audit access, **zero** Exec Policy `#7b` (`U-02`), **zero implied reassignment (`Decision C`)**, **zero SLA-extension fallback (`OD-A1`)**, governance summaries only (`Batch 4 #18`). |
| **`Owner Executive`** | `dashboard:view` only, `#16c` aggregate compensation summary, `#41b` redacted non-confidential context (`404` when unauthorized/finalized — `Decision A`), executive approvals (`hr:leave:approve:executive`, `hr:employees:approve:executive`, `hr:contracts:approve`) on Policies `#4`, `#6`, `#8`, `#9`. | **Zero** `dashboard:factory`, `hr:view`, `leave:view`, `attendance:view`, `reports:view`, `compensation:approve`, `#16d` (`403` — `AUD-05`), individual salary visibility, **reassignment (`Decision C`)**, or **SLA extension (`OD-A1`)**. |
| **`HR Officer`** | Operational HR drafts/submissions (`employees:manage`, `contracts:manage`, non-conf `documents:manage`, `custody:manage`, `leave:manage`). | **Zero** `confidential:*`, `legal_hold`, `purge`, `contracts:approve`, final `leave:approve`, final `employees:status`, `hr:sla:*`, `user_roles` mutation. |
| **`Department Manager`** | Strictly `S`-scoped (`managed_department_ids`) via `hr:scoped:*` (`view`, `leave:review`, `attendance`, `custody:view`). | Cross-department data, PII, confidential domains, executive policies. |
| **`Department User` (`2nd-Role`)** | Self-service (`hr:self:view`, `hr:self:attendance:view`, `hr:self:leave:request`) strictly when linked (`hr_employees.user_id = actor.id`) and within `TERMINATION_PENDING` allowlist; **cannot self-edit 8 career fields (`OD-A2`)**. | Cross-employee records, unlinked `hr:self:*` (`403 HR_PROFILE_NOT_LINKED`), career-field self-mutation (`OD-A2`). |
| **`Audit Custodian` / `Security Custodian` / `Governance Authority` (`Batch 4`)** | Independent Emergency Journal read/export oversight, Destruction Registry recovery dual-approval (`Batch 3`, `Batch 6`), Legal Disclosure verification (`Batch 5`), Governance Charter quorum decisions, Security Hold dual release (`Batch 5`), Residual Risk acceptance. | Structurally independent of unilateral `System Administrator` and `Factory Manager` control; one person cannot fill both Audit and Security functions (`Batch 4 #6`); conflicted members excluded. |

#### 3.2.2 Complete HR Conceptual Permission Matrix (`42` Phase 08A Keys + `5` Deferred Phase 11 Keys — Preserved from `v1.0 §4.1` + `Decision B`)
Legend: **`✓`** = Granted globally · **`S`** = Scoped to `managed_department_ids` · **`Self`** = Strictly `hr_employees.user_id === actor.id` · **`—`** = Denied · **`2nd-Role`** = Obtained ONLY if `System Administrator` assigns secondary `'Department User'` via `PUT /api/users/:id/roles` (`U-03`, `U-05`, `OD-A2`).

| # | Conceptual Permission Key | HR Manager | HR Officer | Department Manager | Factory Manager | Owner Executive | Department User | System Administrator |
|---|---|---|---|---|---|---|---|---|
| 1 | `hr:view` | ✓ | ✓ | — | ✓ | **—** (`OD-01`) | — | — |
| 2 | `hr:scoped:view` | — | — | **S** | — | — | — | — |
| 3 | `hr:employees:manage` | ✓ | ✓ | — | — | — | — | — |
| 4 | `hr:employees:status` | ✓ | — | — | ✓ *(Mgrs/Rehire/Term; `#5a` HR Mgr only)* | — | — | — |
| 5 | `hr:employees:approve:executive` | — | — | — | — | **✓** *(Policy `#6`/`#8`/`#9` Exec)* | — | — |
| 6 | `hr:contracts:manage` | ✓ | ✓ *(draft/submit)* | — | — | — | — | — |
| 7 | `hr:contracts:approve` | ✓ *(Std `HR Officer`)* | — | — | ✓ *(`HR Mgr`-init & Dept Mgrs)* | **✓** *(HR/Factory Mgr subj)* | — | — |
| 8 | `hr:shifts:manage` | ✓ | ✓ | — | — | — | — | — |
| 9 | `hr:attendance:view` | ✓ | ✓ | — | ✓ | **—** (`OD-01`) | — | — |
| 10 | `hr:attendance:manage` | ✓ | ✓ | — | — | — | — | — |
| 11 | `hr:scoped:attendance` | — | — | **S** | — | — | — | — |
| 12 | `hr:attendance:approve` | ✓ | — | — | ✓ *(Escalation & HR Mgr subj)* | — | — | — |
| 13 | `hr:leave:view` | ✓ | ✓ | — | ✓ | **—** (`OD-01`) | — | — |
| 14 | `hr:leave:manage` | ✓ | ✓ | — | — | — | — | — |
| 15 | `hr:scoped:leave:review` | — | — | **S** | — | — | — | — |
| 16 | `hr:leave:approve` | ✓ | — | — | ✓ *(Dept/HR Mgr leaves)* | — | — | — |
| 17 | `hr:leave:approve:executive` | — | — | — | — | **✓** *(Policy `#4` Factory Mgr)* | — | — |
| 18 | `hr:custody:manage` | ✓ | ✓ | — | — | — | — | — |
| 19 | `hr:scoped:custody:view` | — | — | **S** | — | — | — | — |
| 20 | `hr:documents:view` *(non-conf)* | ✓ | ✓ | — | — | — | — | — |
| 21 | `hr:documents:manage` *(non-conf)* | ✓ | ✓ | — | — | — | — | — |
| 22 | `hr:documents:legal_hold` | ✓ | — | — | — | — | — | — |
| 23 | `hr:documents:purge` *(Mode A)* | ✓ | — | — | — | — | — | — |
| 24 | `hr:reports:view` *(non-conf agg)* | ✓ | ✓ | — | ✓ | **—** (`OD-01`) | — | — |
| 25 | `hr:confidential:pii:view` | ✓ | — | — | — | — | — | — |
| 26 | `hr:confidential:pii:manage` | ✓ | — | — | — | — | — | — |
| 27 | `hr:confidential:compensation:view` | ✓ | — | — | — | — | — | — |
| 28 | `hr:confidential:compensation:manage` | ✓ | — | — | — | — | — | — |
| 29 | `hr:confidential:compensation:summary` | ✓ | — | — | ✓ *(`#16c` aggregates)* | **✓** *(`#16c` aggregates ONLY)* | — | — |
| 30 | `hr:confidential:compensation:approve` | — | — | — | ✓ *(Std `#7a` `#16d` PENDING)* | **—** (`OD-01`) | — | — |
| — | ~~`hr:confidential:compensation:initiate_executive`~~ | **OMITTED** | **OMITTED** | **OMITTED** | **OMITTED (`U-02`)** | **OMITTED** | **OMITTED** | **OMITTED** |
| 31 | `hr:confidential:medical:view` | ✓ | — | — | — | — | — | — |
| 32 | `hr:confidential:medical:manage` | ✓ | — | — | — | — | — | — |
| 33 | `hr:confidential:documents:view` | ✓ | — | — | — | — | — | — |
| 34 | `hr:confidential:documents:manage` | ✓ | — | — | — | — | — | — |
| 35 | `hr:confidential:audit:view` | ✓ | — | — | — | — | — | — |
| 36 | `hr:reports:confidential:export` | ✓ | — | — | — | — | — | — |
| 37 | `hr:admin:manage` *(`hr_leave_types` & non-SLA `hr_settings` ONLY)* | ✓ | — | — | — | — | — | ✓ *(non-SLA config only)* |
| 38 | `hr:self:view` | **—** *(`2nd-Role`)* | **—** *(`2nd-Role`)* | **—** *(`2nd-Role`)* | **—** *(`2nd-Role`)* | **—** *(`2nd-Role`)* | **Self** *(if linked)* | **—** *(`2nd-Role` `U-05`)* |
| 39 | `hr:self:attendance:view` | **—** *(`2nd-Role`)* | **—** *(`2nd-Role`)* | **—** *(`2nd-Role`)* | **—** *(`2nd-Role`)* | **—** *(`2nd-Role`)* | **Self** *(if linked)* | **—** *(`2nd-Role` `U-05`)* |
| 40 | `hr:self:leave:request` | **—** *(`2nd-Role`)* | **—** *(`2nd-Role`)* | **—** *(`2nd-Role`)* | **—** *(`2nd-Role`)* | **—** *(`2nd-Role`)* | **Self** *(if linked)* | **—** *(`2nd-Role` `U-05`)* |
| **41** | **`hr:sla:manage`** *(`Decision B`)* | **—** | **—** | **—** | **—** | **—** | **—** | **✓ (Exclusive)** |
| **42** | **`hr:sla:view`** *(`Decision B`)* | **✓ (Read-Only)** | **—** | **—** | **—** | **—** | **—** | **✓** |

*(Existing Roles & Deferred Phase 11: Future Seed `008` grants `dashboard:view` to `'HR Manager'`, `'HR Officer'`, `'Owner Executive'` [`U-01`: zero `dashboard:factory`]; existing `12` roles keep `001`–`007` permissions unchanged; Phase 11's `5` deferred keys `hr:skills:manage`, `hr:evaluations:view|create|approve`, `hr:scoped:evaluations:create` remain out of Phase 08A. **`42` Phase 08A + `5` Phase 11 = `47` conceptual HR keys.**)*

#### 3.2.3 Secondary Role Assignment & Zero Privilege Creep Proof (`v1.0 §4.2` + `OD-A2`)
Verified against `backend/src/middleware/auth.middleware.ts:115-169`, `backend/src/modules/auth/auth.service.ts:137-186`, `frontend/src/pages/DashboardPage.tsx:45-46`:
- Adding secondary `'Department User'` grants ONLY `dashboard:view` + `hr:self:view`, `hr:self:attendance:view`, `hr:self:leave:request`.
- `isAuthorizedDeptManager` requires `'Department Manager'` + `departments:scoped:*` (`OR hr:scoped:*`), excluding `Factory Manager` & `System Administrator`; `planning_department_ids` requires `planning:view|manage`; `managed_warehouse_ids` reads `warehouse_staff`/`warehouses.manager_id`. Zero privilege or scope creep occurs.
- **Onboarding Handoff (`OD-A2`):** HR requests secondary `'Department User'` during onboarding; `'System Administrator'` executes `PUT /api/users/:id/roles` (`users:roles`); HR never mutates `user_roles` directly.

### 3.3 Final Endpoint Permission Matrix (`v1.0 §5` Preserved + `Decision A` + `OD-A2` + `OD-A3` + `AUD-05`)

*(Phase 11 `#37–#38` deferred to Step 9; Step 7B `#36c2`, `#36d`, and `#36a` binary streaming deferred (`409 FEATURE_DEFERRED_STEP_7B`); concrete SLA/extension/reassignment/reopen/DLQ-replay endpoint specs tracked in Section 6 & Section 8.)*

| Route # | Method & Path | Authorized Permission(s) & Exact Runtime Scope Conditions | Governing Delta vs `v0.6` / `v1.0` |
|---|---|---|---|
| `#1` | `GET /api/hr/employees` | `hr:view` OR (`hr:scoped:view` filtered by `managed_department_ids`). PII stripped unless `hr:employees:manage`. **Denied `Owner Executive`.** | `OD-01` |
| `#2` | `POST /api/hr/employees` | `hr:employees:manage`. **If `user_id === actor.id` or `self_bootstrap === true`:** allowed ONLY for `'HR Manager'` with `0` existing linked row (`OD-02`); mandatory `Idempotency-Key`; anti-placeholder validation; `employment_status IN ('ACTIVE','PROBATION')`. | `OD-02`, `ISS-07` |
| `#3` | `GET /api/hr/employees/:id` | `hr:view` OR (`hr:scoped:view` + dept assignee) OR (`hr:self:view` + `linkedEmployee.id === id`). | `U-03` |
| `#4` | `PUT /api/hr/employees/:id` | `hr:employees:manage`. **Career-Field Self-Edit Lock (`OD-A2` / `OD-02`):** When `target.user_id === actor.id`, strictly **blocks edits to `employee_code`, `hire_date`, `last_hire_date`, `primary_department_id`, `employment_type`, `rehire_count`, `user_id`, `employment_status`** — changes require an authorized, audited HR workflow. **Zero `users.full_name` mutation.** | **`OD-A2` (8 locked fields)**, `ISS-05`, `ISS-07` |
| `#5` | `PUT /api/hr/employees/:id/status` | `hr:employees:status` (non-self only; blocked on self per `OD-A2`). `TERMINATED` & `TERMINATION_PENDING` forbidden (`409 USE_TERMINATION_APPROVAL_WORKFLOW`). `users.deactivation_source` preserved (`C-08`). | `OD-A2`, non-self guard |
| `#5a` | `POST /api/hr/employees/:id/terminations` | `hr:employees:manage` (`HR Officer`/`HR Mgr` non-exec non-self) OR `hr:employees:status` (`HR Mgr` non-self, **OR `Factory Manager` STRICTLY when `subject_employee.user_id` holds `'HR Manager'` role** per `U-06 #4`). | `U-06 #4`, `ISS-08` |
| `#5b` | `POST /api/hr/terminations/:id/approve\|reject\|cancel` | Step 1/Final: `hr:scoped:view` / `hr:employees:status` / `hr:employees:approve:executive` (`Owner Executive` for HR/Factory Mgr subjects); `cancel` = requester or `#41c` (`U-04`). | `ISS-04`, `ISS-09` |
| `#5c` | `POST /api/hr/employees/:id/rehire` | `hr:employees:manage` (non-self; target `TERMINATED`). `409 WORKFLOW_APPROVER_UNASSIGNED` pool guard. | `ISS-04` |
| `#5d` | `POST /api/hr/rehire-requests/:id/approve\|reject\|cancel` | Step 1 `hr:employees:manage` (`HR Mgr`); Final `hr:employees:status` (`Factory Mgr`) OR `hr:employees:approve:executive` (`Owner Executive` if former Factory Mgr). **Zero `users.full_name` sync.** | `ISS-05` |
| `#6` | `PUT /api/hr/employees/:id/link-user` | `hr:employees:manage`. Stores read-only `users.full_name` snapshot in `hr_employee_user_link_history`; **zero `users.full_name` overwrite**; `user_id` locked against self-edit (`OD-A2`). | `ISS-05`, `OD-A2` |
| `#7`–`#12` | `unlink-user`, `termination-check`, `assignments*` | Unchanged from `v0.6 §4.1` (`#9` permits `hr:view \| hr:scoped:view \| (hr:self:view + linkedEmployee.id === id)`). | `U-03` |
| `#13`–`#15`, `#17`–`#18b` | Confidential Identity, Comp View, Medical, Conf Audit | **`HR Manager` ONLY** (`hr:confidential:pii:*`, `compensation:view`, `medical:*`, `confidential:audit:view`). Fail-closed pre-return dual audit. | Confirmed |
| `#16a`–`#16b` | `POST .../compensation-revisions` & `.../submit\|approve\|reject\|cancel` | `create/submit`: `hr:confidential:compensation:manage` (`HR Manager` ONLY — **Exec subjects `HR Mgr` & `Factory Mgr` BLOCKED `409 EXECUTIVE_COMPENSATION_WORKFLOW_DORMANT`** per `OD-01`/`U-01`/`U-02`). `approve/reject`: `hr:confidential:compensation:approve` (`Factory Manager` ONLY). | `OD-01`, `U-01`, `U-02`, `ISS-01` |
| `#16c` | `GET /api/hr/reports/compensation-summary` | `hr:confidential:compensation:summary` (`Factory Manager`, `Owner Executive`) OR `hr:confidential:compensation:view` (`HR Manager`). Aggregates only; zero employee rows. | `U-01` |
| **`#16d`** | **`GET /api/hr/compensation-revisions/:id/approval-context`** | **`Factory Manager` ONLY** (`hr:confidential:compensation:approve` + active `'PENDING'` assignee) OR `hr:confidential:compensation:view`. **PRESERVED `403` BASELINE (`AUD-05`):** **`403`** for `'Owner Executive'` (`OD-01`) and **`403`** once decided (`status <> 'PENDING'`). **Do NOT apply `#41b`'s `404` rule here.** | **`AUD-05` (`v1.0 §5 #16d` `403` preserved)** |
| `#19` | `GET /api/hr/contracts` | `hr:view` OR (`hr:scoped:view` filtered) OR **(`hr:self:view` forced `employee_id = linkedEmployee.id`, compensation omitted)** (`U-06 #2`). | `U-06 #2`, `ISS-08` |
| `#20`–`#23` | `POST/PUT /api/hr/contracts*` & `/renew*` | `#20`–`#22`: `hr:contracts:manage`; `#23`: `hr:contracts:manage` / `hr:scoped:view` / `hr:contracts:approve` (`HR Mgr`, `Factory Mgr`, `Owner Executive` + `hr:employees:approve:executive`). Uses `#41b` context for exec approvers. | `U-01`, `ISS-02` |
| **`#24`** | **`GET/POST/PUT /api/hr/shifts*`** | **`GET` (`OD-A3`):** `hr:view` OR `hr:scoped:view` OR **`hr:self:attendance:view`** (replacing generic `hr:self`; read-only; employee identity & ownership checks mandatory). `C/U`: `hr:shifts:manage`. | **`OD-A3` (`NUANCE-C`)** |
| `#25` | `GET/POST /api/hr/shift-assignments` | `GET`: `hr:view` OR `hr:scoped:view` OR **`hr:self:attendance:view`** (forced `employee_id = linkedEmployee.id`). `POST`: `hr:shifts:manage` \| `hr:scoped:attendance`. | `U-06 #3`, `ISS-08` |
| `#26`–`#29` | Attendance records, sync-batch, conflicts, corrections | `#26`: `hr:attendance:view \| hr:scoped:attendance \| (hr:self:attendance:view + own)`; `#27a`/`#27b`: `hr:attendance:manage` (`#27a` also `scoped:attendance`); `#27c`: `view\|scoped` / `approve`; `#28`: `manage \| scoped \| (hr:self:attendance:view + own)`; `#29`: `scoped` / `approve`. | `U-03` |
| `#30` | `GET/POST/PUT /api/hr/leave-types*`, `/holidays*` | `GET`: `hr:view \| hr:leave:view \| hr:scoped:view \| hr:scoped:leave:review \| hr:self:view \| hr:self:leave:request \| hr:self:attendance:view`. `C/U`: `hr:admin:manage` (`leave-types` only — **not SLA**), `hr:leave:manage` (`holidays`). | `U-06 #3`, `Decision B` |
| `#31a`–`#34b` | Leave balances, ledger, requests, submit, decide, revoke | `#31a`: `leave:view \| scoped \| (self:view + own)`; `#31b`: `leave:manage`; `#32`: `leave:view \| scoped:leave:review \| (self:leave:request + own)`; `#33`: creator/`manage \| scoped \| (self:leave:request + own)`; `#34a`: Step 1/Final + `#41b` context (`#4`); `#34b`: `leave:approve`. | `U-03`, `ISS-04` |
| `#35` | `GET/POST /api/hr/asset-custody*`, `.../return\|report-*` | `GET`: `hr:view \| hr:scoped:custody:view \| (hr:self:view + own, TERMINATION_PENDING allowed)`. `POST`: `hr:custody:manage`. *(Step 7A)* | `U-06 #1`, `ISS-08` |
| `#36a`–`#36c1` | `GET/POST /api/hr/documents*`, `PUT .../status\|legal-hold`, `POST .../purge` *(Mode A)* | Step 2 Mode A metadata: `hr:documents:view\|manage` + `hr:confidential:documents:*` if confidential; `legal-hold` & Mode A `purge`: **`HR Manager` ONLY**. Binary `/download` deferred to Step 7B (`409 FEATURE_DEFERRED_STEP_7B`). | `ISS-11` |
| `#36c2`, `#36d` | `POST .../purge-retry`, `POST .../attach-file` | **DEFERRED TO STEP 7B** (`409 FEATURE_DEFERRED_STEP_7B` / unmounted until separate authorization). | `ISS-11` |
| `#39` | `GET /api/hr/reports/*` | `hr:reports:view \| hr:scoped:view`; confidential export: `hr:reports:confidential:export` (`HR Manager` ONLY). **Denied `Owner Executive`.** | `OD-01`, `U-01` |
| `#40` | `GET/PUT /api/notifications*` | Any active JWT user (`canActorAccessNotification`), incl. `TERMINATION_PENDING` allowlist; `System Administrator` barred from `HR`/`PAYROLL` content. | Confirmed |
| `#41a` | `GET /api/approvals*` & `POST .../approve\|reject\|cancel\|delegate\|escalate` | Non-`System Administrator` active requester/assigned eligible approver (`assertActorOperationallyActive`). Checks Maker-Checker & `409 WORKFLOW_APPROVER_UNASSIGNED`. | `ISS-04` |
| **`#41b`** | **`GET /api/approvals/:id/context`** | **Unified HTTP `404` Security Contract (`Decision A` & `AUD-05`):** Returns `200` redacted per-policy DTO for `#4`, `#6`, `#8`, `#9` (`#1`–`#3`, `#5` if scoped; Policy `#7` excluded -> `#16d` `403`) ONLY to non-`SysAdmin` assigned active `'PENDING'` approver/delegate (`assigned_user_id IS NOT NULL`) with step `required_permission_key`. **Returns unified `404` for nonexistent, unauthorized, unassigned/pooled, Policy `#7`, reassigned, or finalized (`status NOT IN ('PENDING','IN_PROGRESS')`) requests** (`400` bad `:id`, `401` unauth). Free-text `reason`/`notes`/`decision_notes`, salary, PII, medical, and history strictly excluded; **concrete DTO field schemas remain `OPEN` (`§8 #3`)**. Read-only + fail-closed pre-return PII-free audit. | **`Decision A` (Unified `404` on `#41b` ONLY)** |
| **`#41c`** | **`POST /api/approvals/:id/governance-cancel`** | **`HR Manager`** (primary, non-subject) OR **`Factory Manager`** (exceptional only when HR Mgr is subject or `0` eligible HR Mgrs exist, non-subject). **Denied Requester & `System Administrator` & Delegates.** Requires **BOTH** SLA expiry AND verified `0` eligible active approvers/delegates (`U-04`), atomic TX, concurrency locks, `expected_version`, `Idempotency-Key`. Strictly separate from `OD-A1` SLA extension fail-closed & `Decision C` reassignment fail-closed. | `U-04`, `ISS-06` |
| `#42`–`#43` | `PUT /api/warehouses/.../status`, `PUT /api/production/lines/:id/supervisor` | Step 1 prerequisites unchanged from `v0.6 §4.1`. | Confirmed |
| **Legacy Dept** | `POST /api/departments/:id/employees`, `PUT .../transfer`, `DELETE .../employees/:userId` | Inside `withTransaction`: lock/query `hr_employees WHERE user_id = $1 FOR UPDATE`. Linked -> **`409 USE_HR_WORKFLOW`** across all 3 endpoints; unlinked -> legacy behavior intact. | `§11.2 #4`, `ISS-10` |

### 3.4 Cross-Cutting Architectural Reconciliations (`CONTRADICTION-03`, `04`, `05`)

#### 3.4.1 `CONTRADICTION-03` — Notification Delivery Failure vs. Audit & Outbox Durability
| Layer | Transaction & Failure Rule | Architectural Authority |
|---|---|---|
| **1. Business State + Transactional Outbox Persistence** | Executed inside **one atomic DB transaction (`withTransaction`)**. Outbox insertion failure rolls back the business transaction cleanly. | `§3.5`, `G062–G063`, `G098` |
| **2. Post-Commit External Channel Delivery** | Executes asynchronously **after** DB commit. External channel failure retries with bounded exponential backoff -> Dead Letter (`DLQ`) and **MUST NEVER roll back** a valid committed operation (`#41c`, reassignment, reopening). `SysAdmin` manual DLQ replay is audited & transport-only. | `G064–G069` |
| **3. Required Audit-Event Durability** | Required audit records must satisfy durable persistence before sensitive operations/reads complete (`audit failure = fail closed`). | `Batch 2 #2, #21–#22`, `§3.3` |
| **4. Emergency Journal Fallback & Dual-Persistence Failure** | If primary DB audit fails/is untrusted, fall back to the independent **Emergency Journal** (outside PostgreSQL). **If neither can durably persist required audit evidence, sensitive operations fail closed** and never claim audit persistence succeeded. | `Batch 2 #1–#4, #21–#22`, `Batch 6 §10.1–§10.2` |

#### 3.4.2 `CONTRADICTION-04` — Approved Five-Part Conceptual Time-and-Trust Model vs. Bare `TIMESTAMPTZ`
- **Why Bare `TIMESTAMPTZ` Is Insufficient:** PostgreSQL `TIMESTAMPTZ` retains only a UTC microsecond instant and discards original **Factory Local Time**, **IANA Timezone**, **UTC Offset**, and **Clock Trust / Event Sequence Provenance**, preventing `tzdb`-safe wall-clock reconstruction and untrusted-clock disambiguation.
- **Standardized Five-Part Conceptual Time-and-Trust Representation *(Physical SQL Columns `DEFERRED` Pre-DDL per `§8 #1`)*:**
  1. **Factory Local Time:** Operational wall-clock representation for display and factory calendar reference (`Batch 1 #1`).
  2. **IANA Timezone:** Explicit zone provenance active at observation/creation (`Batch 1 #2`).
  3. **UTC Offset:** Exact offset active at observation/creation (`Batch 1 #2`).
  4. **Resolved Absolute Instant:** Deterministic UTC instant for chronological comparison and `NOW() > deadline` checks; historical deadlines never recalculate when `tzdb` updates (`Batch 1 #3, #5`).
  5. **Clock Trust and Event Sequence Provenance:** Explicit trust handling (`TRUSTED` vs. `UNTRUSTED` local observation with unique event identity during clock loss, separate post-recovery trusted evidence, never retrospectively relabeled per `Batch 1 #12–#14`), backed by the durable **Central Event Sequence**, which **provides deterministic event ordering when clock trust is lost** (`Batch 1 #4, #15`). *Batch 1 does not impose a blanket rule that every timestamp independently stores a sequence field; physical SQL linkage remains pre-DDL design.*

#### 3.4.3 `CONTRADICTION-05` — Missing SLA Configuration Fail-Closed Rule
- New approval cycles or steps **cannot** be created without an active, published policy-specific SLA configuration and effective factory business calendar. **Zero silent defaults** and **zero active `PENDING` steps lacking a valid `due_at`**.
- Architecture supports explicit per-policy keys, versioning, no global fallback, and fail-closed checks; actual timezone, workdays, hours, breaks, holidays, and numeric SLA values remain **`OP-01` operational configuration** (`§8 #2`).

### 3.5 `ISS-06` Approval Lifecycle (`§4.1`–`§4.8` Consolidated — Updated with `OD-A1`, `Decision B/C/D`, `CONTRADICTION-03/04/05`)
- **SLA & Business Calendar (`G001`–`G019`):** Step-creation snapshot in approved business hours (2 decimals, exact second conversion, per-policy bounds, centralized versioned calendar, immutable published SLA versions, scheduled non-overlapping activation, forward-only withdrawal + replacement). Missing config fails closed (`CONTRADICTION-05`). **`SysAdmin` manages (`hr:sla:manage`); `HR Manager` read-only (`hr:sla:view`) (`Decision B`).**
- **SLA Extensions (`G020`–`G029`, **`OD-A1` Applied**):** Formal audited action with mandatory reason; max 1 extension per step before original deadline; max `<=` original SLA in business hours; `'HR Manager'` primary non-conflicted authority (single actor in non-conflicted case); `'System Administrator'` barred. **Per `OD-A1` (Option A Fail Closed):** when `'HR Manager'` is conflicted or ineligible, deny the extension, keep step **`PENDING`** with original deadline unchanged, create operational escalation, and grant **zero fallback extension authority** to `Factory Manager`, `Owner Executive`, delegates, or `SysAdmin` (separate from `#41c`).
- **Governance Fallback Cancellation (`G030`–`G042`, `#41c`, `U-04`):** Dual conditions (SLA expiry + JIT verified `0` eligible approvers/delegates), atomic TX + locks + bounded retries; `HR Manager` primary; `Factory Manager` exceptional ONLY on verifiable objective `HR Manager` ineligibility; delegates, requester, `SysAdmin` barred; escalates if both ineligible.
- **Approval Expiry, Late Decisions & Reassignment (`G043`–`G056`, `Decision C`):** Expired steps stay persisted as `PENDING`; overdue derived dynamically from trusted Resolved Absolute Instant vs deadline; expiry escalates without revoking rights; late decisions processed normally with lateness audit, halting future escalations. Reassignment preserves original deadline & overdue state, performed by `'HR Manager'` (COI-checked) to live-validated targets (fails closed if none; repeated audited); per **`Decision C`**, conflicted/ineligible `HR Manager` reassignment fails closed, stays `PENDING`, escalates operationally, zero implied fallback.
- **Outbox Notifications (`G057`–`G069`, `CONTRADICTION-03`):** Atomic TX writes reassignment + outbox rows, revokes prior approver (`404` on `#41b`), notifies prior/new/HR Mgr. Post-commit failure retries -> DLQ without rollback; `SysAdmin` DLQ replay audited & transport-only; delivery != human read proof.
- **Escalation (`G070`–`G082`):** Immediate on expiry; eligible approver + `HR Manager` baseline (`Factory Mgr` only per explicit policy); grants zero extra authority; PII-free metadata + `#41b` link; optional ack; terminal states halt reminders.
- **Reopening & Policy Versioning (`G083`–`G107`, `Decision D`):** Policy-gated reopening with mandatory reason (`HR Manager` non-conflicted; `Factory Manager` only on documented objective `HR Manager` ineligibility). Linked, immutable multi-cycle history mandatory (`Decision D`; pre-DDL FK design deferred). Live policy/SLA/calendar snapshot per cycle; retired policies block new cycles only; forward-only replacement; fail closed if unmapped; no silent migration.

### 3.6 `ISS-01`–`ISS-11` Reconciliation Ledger (`v1.0 §6` Preserved & Updated — `8 RESOLVED` / `3 PARTIAL`)

| Issue ID | Problem Summary | Decisions Applied | Final Status in `v2.0_CANDIDATE` & Remaining Open Blocker |
|---|---|---|---|
| **`ISS-01`** | `v0.6` over-privileged `'Alternate Executive'` vs `OD-01`. | `OD-01`, `U-01`, `U-02` | **`RESOLVED`** — Renamed `'Owner Executive'`, aggregate `#16c` only, `#16d` `403`, `initiate_executive` omitted, `#7b` dormant. |
| **`ISS-02`** | `'Owner Executive'` lacked redacted context for `#4`, `#6`, `#8`, `#9`. | `OD-01`, `U-01`, `Decision A`, `AUD-05` | **`PARTIAL / OPEN`** — `#41b` unified `404` + free-text/PII exclusion/audit rules approved (`#16d` `403` preserved); **field-level DTO schemas/types remain `OPEN` (`§8 #3`)**. |
| **`ISS-03`** | `'Employee Self-Service'` & direct `hr:self:*` broke Test `77`. | `OD-03`, `U-03` | **`RESOLVED`** — Secondary `'Department User'` reuse + 4-layer runtime check; Test `77` & `79` preserved. |
| **`ISS-04`** | Unstaffed approver pools mid-flight (`DEP-HR manager_id = NULL`). | Deferred Identity Gov. | **`RESOLVED`** — Pre-flight + step-transition pool guards (`409 WORKFLOW_APPROVER_UNASSIGNED`). |
| **`ISS-05`** | `v0.6` auto-synced `hr_employees.full_name` -> `users.full_name`. | `§11.2 #5` | **`RESOLVED`** — Automatic `users.full_name` sync eliminated; read-only snapshot in link history. |
| **`ISS-06`** | Missing FBC (`#41c`) & `171` SLA/extension/reopen/outbox rules. | `U-04`, `Decision B/C/D`, `CONTRADICTION-03/04/05`, **`OD-A1`**, **`OD-A4`** | **`PARTIAL / OPEN`** — `OD-A1` fail-closed extension & `OD-A4` `G001–G107` baseline approved; **`due_at` physical SQL design & SLA key schema/bounds/versioned calendar design remain pre-DDL / `OP-01` (`§8 #1–#2`)**. |
| **`ISS-07`** | Self-bootstrap controls, career lock & `users:roles` handoff. | `OD-02`, `U-03`, `U-05`, **`OD-A2`** | **`PARTIAL / OPEN`** — `OD-A2` locks 8 career fields & requires `SysAdmin` `PUT /api/users/:id/roles` onboarding handoff; **remaining self-bootstrap/handoff implementation details stay `OPEN` (`§8 #4`)**. |
| **`ISS-08`** | `#35`/`#19` missing `hr:self:view`, `hr:self` shorthand (`#24/#25/#30`), `#5a` over-privilege. | `U-06 #1–#4`, **`OD-A3`** | **`RESOLVED`** — `OD-A3` formally confirms `#24` (`hr:self:attendance:view`), completing `NUANCE-C` parity. |
| **`ISS-09`** | Non-canonical role strings in `v0.6`. | `OD-03`, Canonical `roles` | **`RESOLVED`** — Strict canonical `roles.role_name` strings enforced throughout. |
| **`ISS-10`** | Legacy Dept routes `409` parity & pre-TX reads. | `§11.2 #4` | **`RESOLVED`** — `409 USE_HR_WORKFLOW` inside `withTransaction` across all 3 legacy Dept endpoints. |
| **`ISS-11`** | Step 7 bundling & `runner.ts` Tests `44`/`45` count assertions. | `§11.2 #2`, `U-07` | **`RESOLVED`** — Step 7A/7B split; Seed `008` sequencing; Phase 08A test alignment scheduled post-Gate B. |

### 3.7 Approval Engine Rules & Reconciled 9-Policy Routing Matrix (`v1.0 §7` Preserved + `Decision C`/`D` + `OD-A1`)

#### 3.7.1 Mandatory Engine & Guard Rules (`#1`–`#9`)
1. **Maker-Checker (`v0.6 §6.1` + Triggers):** `decided_by_user_id <> requester_user_id`; `subject_user_id IS NULL OR decided_by_user_id <> subject_user_id`; `System Administrator` barred; single actor barred from approving both Step 1 and Step 2 (`403 DUAL_STEP_SELF_CONFLICT`); `assertActorOperationallyActive` (`403` on `TERMINATED`/`SUSPENDED`/`TERMINATION_PENDING`/inactive).
2. **Pool Pre-Flight & Step-Transition Guard (`ISS-04`):** Submission and `WAITING -> PENDING` advancement abort cleanly with `409 WORKFLOW_APPROVER_UNASSIGNED` if `0` eligible operational approvers/delegates exist.
3. **Active Step SLA (`U-04` / `CONTRADICTION-05`):** Active `'PENDING'` steps fail closed at creation if active policy SLA/calendar is unavailable; `due_at` snapshot preserves original deadline across calendar/SLA edits (`due_at` SQL DDL pre-DDL `#1`).
4. **Governance Controls (`#41c`, Reassignment, SLA Extension, Reopening):**
   - `#41c` Cancel (`U-04`): Dual condition (SLA expiry + `0` eligible approvers/delegates); `HR Mgr` primary; `Factory Mgr` strictly objective exception.
   - Reassignment (`Decision C`): `HR Mgr` exclusive COI-checked; conflicted/ineligible fails closed -> `PENDING` + operational escalation.
   - SLA Extension (**`OD-A1`**): Max 1 pre-deadline `<=` original SLA; conflicted/ineligible `HR Mgr` fails closed -> `PENDING` with original deadline unchanged + operational escalation.
   - Reopening (`Decision D` + `§4.7`): Linked immutable cycle history (`DEFERRED` DDL).
5. **Context Endpoint Boundary (`AUD-05`):** `#41b` uses unified `404` (`#4`, `#6`, `#8`, `#9`); `#16d` retains `403` baseline for standard Policy `#7a`.

#### 3.7.2 Complete 9-Policy Routing Matrix (Phase 08A)
| # | Policy Code & Entity | Initiator | Step 1 Reviewer | Final Approver | Phase 08A Status & Reconciliation Rules |
|---|---|---|---|---|---|
| **1** | `HR_LEAVE_STANDARD` (`hr_leave_requests`) | Self (`hr:self:leave:request` / `2nd-Role`), `Department Manager`, `HR Officer` | `Department Manager` (`hr:scoped:leave:review`) *(auto-`SKIPPED` if null/requester)* | `HR Manager` (`hr:leave:approve`) | Active. Reserves pending balance (`FOR UPDATE`, `0` advance `409`); `/revoke` restores unstarted leave (`start_date > CURRENT_DATE`). |
| **2** | `HR_LEAVE_DEPT_MGR` (`hr_leave_requests`) | `Department Manager` (self), `HR Officer`, `HR Manager` | `HR Manager` (`hr:leave:approve`) *(auto-`SKIPPED` if `Requester = HR Mgr`)* | `Factory Manager` (`hr:leave:approve`) | Active. Single-`HR Manager`-safe; `Department Manager` barred. |
| **3** | `HR_LEAVE_HR_MGR` (`hr_leave_requests`) | `HR Manager` (self), `HR Officer` | `DEP-HR` `Department Manager` *(if assigned & `<>` req/subj, else auto-`SKIPPED`)* | `Factory Manager` (`hr:leave:approve`) | Active. `HR Manager` self-bootstrapped profile (`OD-02`) strictly barred from approving. |
| **4** | `HR_LEAVE_FACTORY_MGR` (`hr_leave_requests`) | `Factory Manager` (self), `HR Manager` | `HR Manager` (`hr:leave:approve`) *(auto-`SKIPPED` if `Requester = HR Mgr`)* | **`Owner Executive`** (`hr:leave:approve:executive`) | Active (requires staffed `'Owner Executive'`, else `409 WORKFLOW_APPROVER_UNASSIGNED`). Uses `#41b` redacted DTO (`404` boundary). |
| **5** | `HR_ATTENDANCE_CORRECTION` (`hr_attendance_corrections`) | Self (`hr:self:attendance:view` / `2nd-Role`), `Department Manager`, `HR Officer` | `Department Manager` (`hr:scoped:attendance`) *(auto-`SKIPPED` if null/requester/HR)* | `HR Manager` (`hr:attendance:approve`), or `Factory Manager` (`> escalation_days` / HR Mgr subj); `HR Mgr` for Factory Mgr subj | Active. Raw punch telemetry immutable; updates `effective_*`, `is_corrected = TRUE`. |
| **6** | `HR_CONTRACT_RENEWAL` (`hr_contracts`) | `HR Officer` / `HR Manager` (`hr:contracts:manage`); `Factory Manager` (`HR Mgr` subj) | **Std (`HR Officer`):** `Dept Mgr` (or skip) · **Dept Mgr (`HR Officer`):** `HR Mgr` · **HR/Factory Mgr (`HR Officer`):** `Factory Mgr`/`HR Mgr` · **HR/Factory Mgr init:** Step 1 `SKIPPED` | **Std (`HR Officer`):** `HR Mgr` (`hr:contracts:approve`) · **Std (`HR Mgr` init)/Dept Mgr:** `Factory Mgr` · **HR/Factory Mgr Subj:** **`Owner Executive`** (`contracts:approve` + `employees:approve:executive`) | Active. `#41b` redacted DTO omits salary/PII (`404` boundary); SQL enforces `created_by <> approved_by`. |
| **7a** | `HR_SALARY_REVISION` — **Standard Workers** (`hr_compensation_revisions`) | `HR Manager` (`hr:confidential:compensation:manage`) | Auto-`SKIPPED` (`SINGLE_EXECUTIVE_SIGNOFF`) | **`Factory Manager`** (`hr:confidential:compensation:approve`) | Active. Reads `#16d` **`403`-baseline** single `PENDING` revision DTO ONLY (`AUD-05`); `Owner Executive` strictly barred. |
| **7b** | `HR_SALARY_REVISION` — **Exec Subjects (`HR Mgr` / `Factory Mgr`)** | **BLOCKED (`409 EXECUTIVE_COMPENSATION_WORKFLOW_DORMANT`)** | N/A | **Removed (`OD-01`, `U-01`, `U-02`)** | **DORMANT / OUT OF PHASE 08A.** `initiate_executive` omitted (`U-02`). |
| **8** | `HR_TERMINATION` (`hr_termination_requests`) | Floor: `HR Officer`/`HR Mgr` · Mgrs: `HR Mgr`/`HR Officer` · **`HR Mgr` Subject:** `Factory Manager` ONLY (`U-06 #4`) · **`Factory Mgr` Subject:** `HR Manager` | Floor (`HR Officer`): `Dept Mgr` (or skip); Mgrs (`HR Officer`): `HR Mgr`; HR/Factory Mgr init: Step 1 `SKIPPED` | Floor (`HR Officer`): `HR Mgr` · Floor (`HR Mgr` init)/Mgrs: `Factory Manager` (`employees:status`) · **HR/Factory Mgr Subj:** **`Owner Executive`** (`hr:employees:approve:executive`) | Active. Sets `TERMINATION_PENDING` (7-route allowlist); atomic 12-source re-check before `TERMINATED` + `users.is_active = FALSE` (`HR_TERMINATION`). Uses `#41b` DTO. |
| **9** | `HR_EMPLOYEE_REHIRE` (`hr_rehire_requests`) | `HR Officer` or `HR Manager` (`hr:employees:manage`) | `HR Manager` (`HR Officer` init); `SKIPPED` if `HR Mgr` init | Standard/Mgr: `Factory Manager` (`hr:employees:status`) · Former `Factory Mgr`: **`Owner Executive`** (`hr:employees:approve:executive`) | Active (`TERMINATED` subjects only). Zero `users.full_name` mutation (`ISS-05`). Uses `#41b` DTO. |

### 3.8 Preserved Data Model, Security, API & Testing Invariants (`v1.0 §8–§11`)
- **Data Invariants (`v1.0 §8`):** Baseline `001`–`006` / `001`–`007` untouched; `department_employees.user_id NOT NULL` preserved; `hr_employees` (`user_id` nullable + `uq_hr_employees_user_id` + `ON DELETE RESTRICT` + `BEFORE DELETE` trigger); `hr_employee_department_assignments` + `DepartmentMembershipRepo`; `users.deactivation_source` (`ADMIN_MANUAL | IT_SECURITY_LOCK | HR_SUSPENDED_FLAG -> HR_SUSPENSION | HR_TERMINATION`); Steps `1–7A` topological order (`Step 1` prep -> `Step 2` core/Mode A/`hr_settings` -> `Step 3` `notifications` cutover + `approval_*` -> `Step 4` status/term/rehire/comp/contracts -> `Step 5` attendance/sync -> `Step 6` leaves -> `Step 7A` custody).
- **Security & Privacy Controls (`v1.0 §9`):** Dual-log isolation (`AuditService.log` Zero-Sensitive-Payload for `audit:read`, vs `hr_confidential_audit_logs` gated to `hr:confidential:audit:view` `HR Manager` only, pre-return fail-closed); **Honest Encryption Matrix (`v0.6 §7.2`):** AES-256-GCM + HMAC-SHA256 blind index on `national_id_encrypted`/`bank_account_encrypted`, DB-isolated + RBAC-gated (not app-encrypted) on `wage_model`, `base_salary`, `currency`, `medical_notes`, `disciplinary_summary` (requiring TLS + host disk encryption); `TERMINATION_PENDING` 7-route deny-by-default allowlist; append-only `hr_leave_balance_ledger`; `hr_attendance_sync_batches` (`ON CONFLICT (device_id, external_punch_id) DO NOTHING`, `CONFLICT_PENDING`); Two-Phase `idempotency_keys` (`60s` crash lease) + PG SQLSTATE mapping (`23505`, `23503`, `23514`, `40P01`, `40001`, `P0001`).
- **API & Cross-Module Contracts (`v1.0 §10`):** Plural `/api/hr/*`, `/api/notifications*`, `/api/approvals*`; zero `PATCH`; `{ success, data, pagination }` / error envelopes; `WarehouseMasterService` migrates from `warehouse_notifications` -> `notifications WHERE module = 'WMS'` in Step 3; `ProductionService` & `WarehouseMasterService` reject `TERMINATION_PENDING`/`SUSPENDED`/`TERMINATED` replacements.
- **Testing & Regression Baseline (`v1.0 §11` — Executed Only Post-Gate A & Gate B):** Preserves `runner.ts` Tests `77` (`'planner'`), `78` (`'deptuser'`), `79` (`'deptstaff'`), and `80`–`89`; deliberate Phase 08A update of Tests `44`/`45` only when `007+`/`008+` deploy; Phase 08A test suite adds `OD-A1` (extension fail closed), `OD-A2` (8-field self-edit block + `SysAdmin` role handoff), `OD-A3` (`#24` `hr:self:attendance:view`), `Decision A`/`AUD-05` (`#41b` unified `404` vs `#16d` `403`), `Decision B` (`hr:sla:*`), `Decision C` (reassignment fail closed), `OD-01`/`U-01`/`U-02`, `U-04` (`#41c`), and `409 USE_HR_WORKFLOW` TX concurrency tests.

---

## 4. Part B — Cross-Cutting Security, Governance, Audit, Evidence & Recovery (`Batches 1–4 & 6`)

> *All `Batches 1–4 & 6` principles below are **`OWNER APPROVED`** architectural requirements (`109` total controls across `Batches 1–6`); detailed binary formats, SOPs, and Step 7B binary purge remain deferred (`§6`) without expanding Phase 08A coding scope.*

- **Batch 1 – Clock Integrity & Time Trust (`16` controls `B1-01`–`B1-16`):** **Five-part conceptual time-and-trust representation** (`Factory Local Time`, `IANA Timezone`, `UTC Offset`, `Resolved Absolute Instant`, and `Clock Trust and Event Sequence Provenance` per `CONTRADICTION-04`), central authoritative server clock, **Central Event Sequence** providing deterministic ordering when clock trust is lost (`B1-04`, `B1-15`), immutable deadlines across `tzdb` updates (`B1-05`), configurable/versioned NTP & drift thresholds (`B1-06`–`B1-10`), bounded offline NTP trust window, untrusted observations with unique event identity never retrospectively relabeled (`B1-12`–`B1-14`), separate post-recovery trusted evidence, surviving durable sequence, fail closed on persistence failure (`B1-16`).
- **Batch 2 – Emergency Journal & Cryptographic Recovery (`22` controls `B2-01`–`B2-22`):** Independent durable event sequence **outside** primary PostgreSQL; append-before-persisted; append-only + cryptographic hash chaining; minimal reference payload; cryptographic keys isolated from code & plain config; dedicated least-privilege service identity (`System Administrator` barred from journal content); DPAPI / Certificate Store permitted post-design; tracked key versions & forward-only rotation; compromise containment + offline encrypted key backup; 2-person recovery; quarterly isolated drills (failure = Critical Incident); Audit/Security Custodian reads + audited/redacted/encrypted exports; **dual persistence failure = fail closed (`CONTRADICTION-03`)**.
- **Batch 3 – Evidence Repository & Destruction Registry (`17` controls `B3-01`–`B3-17`):** Evidence content & immutable event-based Destruction Registry separated with independent storage/backups; atomic concurrency-protected JIT validation of Legal Holds, Incidents, Preservation Orders across primary, replicas, quarantined unexpired backups; Registry restored **before** Evidence Repository on DR with prior destructions reapplied + Audit/Security Custodian approval; corruption/missing sequence/conflicts block destruction; residual uncertainty documented & expiry auto-suspends destruction. **Phase 08A boundary intact (Step 7B deferred).**
- **Batch 4 – Governance & Custodian Independence (`21` controls `B4-01`–`B4-21`):** Structural independence from unilateral `System Administrator` and `Factory Manager` control; Audit, Security, and Governance separated; live eligibility/COI checks; pre-appointed primary & alternate custodians; mandatory dual-person controls (one person cannot fill both Audit and Security functions); COI/ineligibility suspends authority; immutable appointment/suspension records; formal Governance Charter (no emergency quorum bypass, conflicted members excluded, pre-approved alternates); cryptographically verifiable append-only governance logs (`Factory Manager` summaries only; `SysAdmin` zero automatic sensitive access).
- **Batch 6 – Residual Risk & Recovery Controls (`5` controls `B6-01`–`B6-05`):** (1) Unified Fail-Closed Policy; (2) Scoped Suspension (target affected sensitive ops only—no unwarranted factory shutdown); (3) Recovery Validation Beyond File Restore; (4) Residual Risk Governance (`Accepted | Under Review | Expired | Suspended | Rejected`, auto-suspend on expiry); (5) Operational Readiness Separation from Gate A and Gate B.

---

## 5. Part C — Independent Legal & Compliance Procedures (`Batch 5` — `28` Controls `B5-01`–`B5-28`)

1. **Legal Disclosure Authorization (`#1–#7`, `#22–#25`):** Validate legal authority, jurisdiction, and scope; minimize material; preserve originals; require independent legal review + Audit Custodian verification + second independent release verifier; JIT verify recipient identity, capacity, and secure channel; fresh review on material scope change; automated + human-verified third-party redaction; Legal Holds/Preservation Orders controlling until independent release; reject & document invalid requests.
2. **Packaging, Delivery & Closure (`#8–#14`, `#28`):** Immutable manifests + cryptographic hashes; 6 distinct delivery states (`prepared | transmitting | partially delivered | delivered | failed | unknown`); bar uncontrolled resend on ambiguous transmission; receipt distinguishes transport acceptance from human ack; document post-delivery conditions & onward notices; documented closure or explicit unresolved status; full chain of custody.
3. **Security Incidents (`#15–#21`, `#26–#27`):** Linked yet distinct workflows; immediate containment, preservation, suspension of affected destruction; dual independent approval to release security hold; RCA + remediation + review to close (reopenable on new evidence); independent legal assessment for notices; unauthorized disclosure = Critical Security Incident; disclosure during open incident requires legal exception review + dual control.

---

## 6. Part D — Deferred Implementation Specifications

1. **Pre-DDL Design Items (`DEFERRED` until Gate A closure & Pre-DDL Engineering Review):** Exact multi-cycle FK/column/uniqueness/index/migration design (`Decision D`), physical SQL representation for active `PENDING` `approval_steps.due_at` & **five-part conceptual time-and-trust representation** (`§8 #1`), SLA/Calendar version table/key structure & validation bounds (`§8 #2`), `ISS-06` extension/reassignment/outbox/DLQ tables & endpoints, Step 2/4 career-field self-edit enforcement DDL & `#2`/`#4` `ISS-07` engineering details (`§8 #4`), and future conceptual `hr:sla:manage`/`hr:sla:view` Seed `008` entries (`Decision B`; zero seeds created).
2. **Detailed Technical/Legal SOPs & Step 7B / Phase 11 (`DEFERRED`):** Drift/NTP thresholds & time-sensitive operation inventory (`Batch 1`), Emergency Journal binary format/`fsync`/crypto algorithms/DPAPI-Cert-Store/retention (`Batch 2`), Step 7B Mode B encrypted binary upload/download & external `PURGE_PENDING -> PURGED` (`Batch 3`), Charter ratios/identities/cadence (`Batch 4`), jurisdiction legal/channel SOPs (`Batch 5`), and Phase 11 (`Step 9`).

---

## 7. Part E — Decision Traceability Summary & Normative Matrix Pointers (`AUD-02` Corrected)

> **Exact Matrix Locations (`AUD-02` Corrected):**  
> - **All Consolidated `v2.0` Matrices:** Complete `ISS-01`–`ISS-11` status table, complete `107`-row `ISS-06-G001`–`G107` table, complete `109`-item `Batch 1`–`6` control table, and raw `#1`–`#171` disposition are compiled in companion **`GFMSv0.3_HR_GATE_A_RECONCILIATION_AND_TRACEABILITY_REPORT_v2.0.md`**.  
> - **Original Unmodified Milestone Locations:** `ISS-06-G001`–`G107` originated in `v1.1_CANDIDATE §7.1` (`l.192–334`); the full `171`-slot `UNMAPPED` raw ledger resides in `REPORT_v1.1 §2.2` (`l.78–264`); and the original `109`-item `B1–B6` breakdown resides in `REPORT_v1.1 §3.2` (`l.297–306`). `REPORT_v1.2.1` holds delta/group summaries only.

| Traceability Scope | Total Items | `v2.0` Coverage Breakdown | Reconciliation Basis |
|---|---|---|---|
| **Raw `ISS-06` Decisions (`#1`–`#171`)** | `171` | **`0 / 171` Independently Verifiable (`171 UNMAPPED`) — `OD-A4` ACCEPTED** | Original raw numbered `#1`–`#171` ledger unavailable; per **`OD-A4`**, `G001`–`G107` accepted as canonical Gate A baseline with zero fabricated mappings. |
| **Grouped `ISS-06` Principles (`§4.1`–`§4.8`)** | `107` (`G001`–`G107`) | **`79 FULL` · `28 PARTIAL` · `0 CONFLICTING` · `0 MISSING`** | **`OD-A1`** upgrades `G026`, `G027`, `G029` (`+3 FULL`, `-3 PARTIAL` from `v1.2.1`'s `76/31`); remaining `28 PARTIAL` reflect unresolved pre-DDL/technical blockers (`§8`) and deferred SOPs/DDL (`§6`). |
| **Six Approved Batches (`B1`–`B6`)** | `109` | **`109 / 109` (`100%`) Preserved** | Cleanly separated across `XCUT`, `LEGAL`, `DEFER`, and `OPS` (`OD-A4`). |

---

## 8. Part F — Remaining Unresolved Technical & Specification Blockers

These items are **explicitly preserved as `OPEN` / `DEFERRED`** and must **not** be silently resolved:

1. **`due_at` Enforcement & Physical Data Representation (`ISS-06` / `NUANCE-A` / `CONTRADICTION-04`):** Preserve approved snapshot-at-step-creation, fail-closed SLA rules (`CONTRADICTION-05`), and the conceptual five-part time-and-trust representation (`§3.4.2`). Physical SQL column design for active `PENDING` `approval_steps.due_at` (`NOT NULL`), five-part representation linkage, and `Central Event Sequence` storage remains a **pre-DDL technical design blocker** (do not reopen the approved time/SLA architecture as a new Owner Decision).
2. **Policy-Specific SLA Key Schema, Validation Bounds & Versioned Calendar Design (`ISS-06` / `CONTRADICTION-05`):** Architecture must support explicit per-policy keys, versioned calendar/SLA tables, zero global fallback, and fail-closed checks. Concrete schema key/table naming, programmatic min/max validation bounds, and actual factory IANA timezone, workdays, working hours, breaks, official holidays, and numeric SLA values remain **pre-DDL design + `OP-01` operational configuration**.
3. **`ISS-02 #41b` Policy-Specific DTO Field-Level Schemas & Types (`OPEN`):** Concrete field names, data types, and nullability per applicable policy (`#4`, `#6`, `#8`, `#9`, plus `#1`–`#3`, `#5`) under `Decision A` (`404`) and strict free-text/PII exclusion (`#16d` `403` preserved separately per `AUD-05`).
4. **`ISS-07` Remaining Onboarding & Career-Field Implementation Details (`OPEN`):** Technical/workflow details not settled by `OD-A2`, including `#2` self-bootstrap payload/anti-placeholder schema details, `HR Officer` post-bootstrap non-destructive review mechanics, HR-to-`SysAdmin` (`PUT /api/users/:id/roles`) request/audit ticket mechanics, and pre-DDL/service validation mechanics enforcing the 8-field lock.
5. **Remaining Deferred Design & Evidence Gaps (`DEFERRED`):** Multi-cycle FK/index/uniqueness DDL (`Decision D`), SLA extension/reassignment/outbox/DLQ endpoint & DDL contracts, Batch `1–5` binary/crypto/Charter/legal SOPs (`§6`), Step 7B binary storage & external purge, and Phase 11 (`Step 9`), plus **Formal Final Gate A Ratification** once technical blockers #1–#4 are closed for ratification.

---

## 9. Part G — Three-Gate Governance Separation (`Gate A` · `Gate B` · `OP-01`)

### 9.1 Gate A — Architecture & Owner Ratification (`GATE A – OPEN / NOT APPROVED`)
Closes only upon resolution/confirmation of Section 8 open items (#1–#4 engineering/Owner closures as required) and formal System Owner ratification consolidating `HR-DEC-01`–`HR-DEC-14`, `OD-01`–`OD-03`, `U-01`–`U-07`, `§11.2 #2–#5`, `Decision A`–`D`, `OD-A1`–`OD-A4`, and `Batches 1–6`. Post-Gate-A work is strictly limited to roadmap alignment (`U-07`) and Pre-DDL design/Gate B; zero coding before Gate B passes.

### 9.2 Gate B — Live PostgreSQL 14+ Verification (`NOT VERIFIED / PENDING` — `v1.0 §13` `GB-01` Preserved)
> **`pg-mem v3.0` (`89/89` tests) NEVER proves PostgreSQL 14+ compatibility.** Zero HR DDL, migrations (`007+`), or seeds (`008+`) are authorized until **all `11` checks below** pass against live PostgreSQL 14+ (`driver.kind === 'pg'`):

- [ ] **GB-01.1 Live Instance Provisioned:** PostgreSQL 14+ reachable over TCP (`GET /api/health` confirms `mode: "PostgreSQL (Live Connection)"`, NOT `pg-mem`).
- [ ] **GB-01.2 Baseline Migrations `001`–`006`:** Clean execution from empty schema via `runPendingMigrations(createPgDriver(pool))` + idempotent restart (`0` applied, `6` skipped).
- [ ] **GB-01.3 Baseline Seeds `001`–`007`:** Clean execution (`12` roles, `48` permissions, `41` tables) with zero `setval` / `pg_get_serial_sequence` drift.
- [ ] **GB-01.4 Constraints & Foreign Keys:** Verify `GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED` (`005:172`), `CHECK` constraints, `ON DELETE RESTRICT`/`CASCADE`, and partial unique indexes (`004:6,9`, `006:27`).
- [ ] **GB-01.5 Transactions & Rollback Parity:** Real `BEGIN` / `COMMIT` / `ROLLBACK` multi-table rollback verification.
- [ ] **GB-01.6 Triggers & PL/pgSQL:** Verify `trg_stock_movements_immutable` (`migrations.ts:92-116`) raises `P0001` on `UPDATE`/`DELETE` and `sqlEqInt`/`sqlEqText`/`sqlInInt` (`database.ts:65-85`) execute SARGable plans (`EXPLAIN (ANALYZE, BUFFERS)`).
- [ ] **GB-01.7 SQLSTATE Error Mapping:** Validate real PG SQLSTATE codes (`23505`, `23503`, `23514`, `40P01`, `40001`, `P0001`) map cleanly through `errorHandler`.
- [ ] **GB-01.8 Parallel Concurrency & Locking:** Multi-connection `READ COMMITTED` HTTP tests verifying `SELECT ... FOR UPDATE` serialization without deadlocks.
- [ ] **GB-01.9 Two-Phase Idempotency Simulation:** Validate live PG visibility of `'IN_PROGRESS'` rows, `409 IDEMPOTENCY_IN_PROGRESS`, `409 IDEMPOTENCY_PAYLOAD_MISMATCH`, and `60s` stale-lease recovery.
- [ ] **GB-01.10 Legacy Data Hygiene (`warehouse_notifications`):** Confirm `0` orphaned `user_id` rows prior to Step-3 `notifications` cutover (`ON DELETE RESTRICT`).
- [ ] **GB-01.11 Full Regression Pass on Live PostgreSQL:** `100%` pass (`89/89`) + Playwright E2E smoke check on live PostgreSQL 14+.

### 9.3 `OP-01` — Operational Readiness (`PENDING` — `v1.0 §12` + `Batch 6 §10.5` Preserved)
1. **Human Appointments & Provisioning (`POST /api/users` with explicit `roleIds`):** Appoint distinct individuals for `HR Manager`, `HR Officer`, `Owner Executive`, primary & alternate `Audit Custodian` and `Security Custodian`, and `Governance Authority` members.
2. **Secondary `'Department User'` Onboarding Coordination (`U-03`, `U-05`, `OD-A2`):** HR requests secondary `'Department User'` on HR onboarding; `'System Administrator'` executes `PUT /api/users/:id/roles`.
3. **Administrator Legal Onboarding (`'admin'`):** `'admin'` in `DEP-IT` manually onboarded to `hr_employees` post-launch without altering `users.full_name` (`'Eslam Samir (System Architect)'`).
4. **`DEP-HR` Manager Assignment:** Populate `departments.manager_id` for `DEP-HR` (`003_seed_department_data.sql:26`) upon human designation.
5. **Cryptographic Keys, SLA/Calendar & Leave Initialization:** Provision PII/bank AES-256-GCM keys, HMAC blind-index secret, Emergency Journal keys & offline encrypted backups, quarterly recovery drills, active policy SLA configs & factory calendar (`CONTRADICTION-05`), TLS + host disk encryption, initial `hr_leave_balances`, and independent security/legal/SOP readiness.

---

## 10. Final Status

- **`DRAFT – FOR OWNER REVIEW (GATE A CONSOLIDATION CANDIDATE)`**
- **`GATE A – OPEN / NOT APPROVED`**
- **`HR IMPLEMENTATION – NOT AUTHORIZED`**
- **`GATE B (LIVE POSTGRESQL 14+) – NOT VERIFIED / PENDING`**
- **`OP-01 (OPERATIONAL READINESS) – PENDING`**
