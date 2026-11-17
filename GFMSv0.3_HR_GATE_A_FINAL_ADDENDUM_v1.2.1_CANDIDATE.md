# GFMSv0.3 – HR Gate A Final Addendum v1.2.1 (Documentation Candidate)

**Document ID:** `GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v1.2.1_CANDIDATE.md`  
**Status:** **`DRAFT – FOR OWNER REVIEW`**  
**Gate A Status:** **`GATE A – OPEN / NOT APPROVED`**  
**Implementation Status:** **`HR IMPLEMENTATION – NOT AUTHORIZED`**  
**Gate B Status (Live PostgreSQL 14+):** **`NOT VERIFIED / PENDING`** *(Separate verification gate; container runs `pg-mem v3.0.14`, which never constitutes PostgreSQL 14+ proof.)*  
**Operational Readiness (`OP-01`):** **`PENDING`** *(Separate Go-Live operational gate.)*  
**Date:** 2026-11-17  
**Supersedes (Candidate Only):** `GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v1.2_CANDIDATE.md`, `GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v1.1_CANDIDATE.md`, and `GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v1.0.md` *(All prior artifacts `v1.0`, `v1.1_CANDIDATE`, `v1.2_CANDIDATE`, `v0.6`, and all repository files remain completely unmodified.)*

---

## 1. Executive Summary & Strict Governance Boundaries

This `v1.2.1` documentation candidate applies targeted consistency corrections to `v1.2_CANDIDATE` while preserving all substantive `v1.2` content:
1. Recording the **four newly approved System Owner decisions (`Decision A`–`Decision D`)** as **`APPROVED`** and removing them from the pending-confirmation queue;
2. Resolving **`CONTRADICTION-03` (Notification Delivery vs. Audit Durability)**, **`CONTRADICTION-04` (Batch 1 Time Model vs. Bare `TIMESTAMPTZ`)**, and **`CONTRADICTION-05` (Missing SLA Configuration Fail-Closed Rule)** while preserving all Batch 1–6 and HR architecture invariants;
3. Maintaining strict separation between **HR Gate A Architecture**, **Cross-Cutting Security/Governance/Audit/Recovery (`Batches 1–4, 6`)**, **Independent Legal/Compliance Procedures (`Batch 5`)**, **Deferred Implementation Specifications**, **Gate B (`Live PostgreSQL 14+`)**, and **`OP-01` Operational Readiness**;
4. Preserving every genuinely unresolved item (`HR Manager` SLA-extension fallback, `due_at` enforcement details, exact SLA keys/bounds & factory calendar values, `#41b` field-level DTO schema, `ISS-07`/`NUANCE-B`, `NUANCE-C` `#24`, raw `#1`–`#171` `ISS-06` ledger mapping, and final Gate A ratification) explicitly as **`OPEN`** or **`DEFERRED`**; and
5. Applying `v1.2.1` consistency corrections only: correcting the `§3.6` `RESOLVED` `ISS` count from `10` to `8`, standardizing the **five-part conceptual time-and-trust representation** (`Factory Local Time`, `IANA Timezone`, `UTC Offset`, `Resolved Absolute Instant`, `Clock Trust and Event Sequence Provenance`) with **Central Event Sequence** strictly scoped to deterministic event ordering when clock trust is lost, and keeping all `42` Phase 08A and `5` deferred Phase 11 permission counts explicitly conceptual.

### Mandatory Boundaries
- **Gate A remains `OPEN / NOT APPROVED`:** This candidate does not close Gate A.
- **HR implementation remains `NOT AUTHORIZED`:** Zero HR DDL, migrations (`007+`), seeds (`008+`), backend code, frontend code, tests, or `docs/GFMS_DEVELOPMENT_ROADMAP.md` changes are authorized.
- **Raw `ISS-06` `#1`–`#171` Traceability Limitation:** The original raw numbered `#1`–`#171` decision ledger remains unavailable (`0 / 171` raw numeric entries mapped). This document preserves the **`107 / 107`** reconstructed grouped `ISS-06` principles (`ISS-06-G001`–`G107`) and **`6 / 6`** Architecture Batches (`109` control items) without fabricating raw numbers, titles, or option labels.

---

## 2. Verified Repository & Phase 08A Baseline (Unchanged)

Directly verified against workspace files (`database/`, `backend/src/`, `frontend/src/`, `docs/`):
- **Existing Schema & Seeds (`VERIFIED`):** `6` migrations (`001`–`006`, `41` active tables) and `7` seeds (`001`–`007`, `12` canonical roles, `48` permissions).
- **HR Implementation State (`NOT IMPLEMENTED`):** `0` HR tables, `0` HR roles, `0` `hr:*` permissions, `0` HR routes, and `0` HR frontend views.
- **Preserved Workforce & System Invariants (`VERIFIED`):**
  - `DEP-HR` exists in `departments` with `manager_id = NULL` (`003_seed_department_data.sql:26`).
  - `department_employees.user_id` is `NOT NULL REFERENCES users(id) ON DELETE CASCADE` (`003_create_department_tables.sql:22`) and populates `planning_department_ids` (`auth.middleware.ts:131-164`); non-login workforce belongs strictly in `hr_employees`.
  - Existing `users.full_name` values contain operational titles (`001_seed:39-41`, `006_seed:44-45`, `007_seed:35-41`) and **must never be auto-synchronized** from `hr_employees.full_name`.
  - `UserService.createUser` (`user.service.ts:86`) defaults omitted `roleIds` to `[3]` (`'Department User'`).
  - `AuditService.log` (`audit.service.ts:19-53`) writes `audit_logs` (`audit:read` = `'System Administrator'` only, governed by Zero-Sensitive-Payload Rule).
  - Existing `89/89` tests execute strictly on `pg-mem v3.0.14` (`docs/GFMS_PHASE_07_COMPLETION_REPORT.md:6-7, 82`); PL/pgSQL triggers (`migrations.ts:61, 92-116`) are skipped on `pg-mem`.
- **Phase 08A vs. Deferred Scope:**
  - **Phase 08A (Steps 2–7A):** `32` Core/Shared tables (`idempotency_keys`, `notifications`, `approval_*`, `hr_employees`, `hr_documents` Mode A metadata-only in Step 2, confidentiality vault, assignments, status/termination/rehire/contracts/standard salary revisions, shifts/attendance/offline sync, leave ledger/holidays, Step 7A non-WMS `hr_asset_custody`).
  - **Deferred Out of Phase 08A:** Step 7B Mode B encrypted binary storage/external purge & Batch 3 Evidence Repository/Destruction Registry implementation; executive-subject Policy `#7` (`OD-01`, `U-01`, `U-02`); self-service department transfer workflow; Phase 11 (`Step 9`: skills, training, evaluations, piece-rate costing, `DEP-TRANS`).

---

## 3. Part A — HR Gate A Architectural Requirements

### 3.1 Consolidated Owner Decisions (`U-01`–`U-07`, `OD-01`–`OD-03`, `§11.2 #2–#5`, `Decision A`–`D`)

#### 3.1.1 Newly Approved Owner Decisions (`Decision A` – `Decision D`) — **`APPROVED`**
| Decision ID | Topic | Approved Resolution & Mandatory Architectural Effect |
|---|---|---|
| **`Decision A`** *(Resolves `CONTRADICTION-01`)* | **`ISS-02 #41b` HTTP Status** | **APPROVED:** Use **unified HTTP `404`** for nonexistent, unauthorized, unassigned/pooled, and finalized (`APPROVED`/`REJECTED`/`CANCELLED`/`EXPIRED`) `GET /api/approvals/:id/context` requests (eliminating ID/status existence oracles). Preserve **HTTP `400`** for invalid `:id` syntax and **HTTP `401`** for unauthenticated requests. Applied consistently across all `#41b` references in this Addendum (`§3.3`, `§3.5`). *(Note: `v1.0` retains historical `403` wording unmodified and is superseded by `v1.2` Decision A.)* |
| **`Decision B`** *(Resolves `GAP-01` / `CONTRADICTION-02`)* | **SLA Configuration RBAC Boundary** | **APPROVED:** Separate SLA configuration permissions from generic `hr:admin:manage`: **(1) `hr:sla:manage`** granted exclusively to `'System Administrator'`; **(2) `hr:sla:view`** granted to `'System Administrator'` and `'HR Manager'` (strictly read-only for `'HR Manager'`); **(3)** existing `hr:admin:manage` stays unchanged for `hr_leave_types` and non-SLA `hr_settings` (barred from mutating SLA/calendar settings). *Architectural permission decision only: zero permissions, seeds, migrations, or code created now.* |
| **`Decision C`** *(Resolves `GAP-02`)* | **`HR Manager` Conflicted Reassignment** | **APPROVED:** When `'HR Manager'` is conflicted or ineligible to reassign a step, reassignment **fails closed**: keep the approval step **`PENDING`** and create an **operational escalation** (`notifications`, PII-free). **Zero implied reassignment fallback authority** for `'Factory Manager'`, `'Owner Executive'`, delegates, or `'System Administrator'`. Kept strictly separate from `'Factory Manager'`'s exceptional Governance Fallback Cancellation authority under `#41c` (`U-04`). |
| **`Decision D`** *(Resolves `GAP-03`)* | **Multi-Cycle Approval Data Model** | **APPROVED (Architectural Requirement):** Linked, immutable multi-cycle approval history is a **mandatory architectural requirement** for policy-permitted reopening (`§4.7`). Existing single `approval_request_id` columns in `v0.6 §3.3` must **not** be represented as sufficient for unlimited reopening cycles. **Exact FK structure, column names, uniqueness constraints, indexes, and migration strategy remain `DEFERRED` to pre-DDL design review** (zero DDL/implementation now). |

#### 3.1.2 Previously Approved Owner Decisions (`U-01`–`U-07`, `OD-01`–`OD-03`, `§11.2 #2–#5`) — **Preserved Unchanged**
- **`U-01` (`APPROVED`):** `'Owner Executive'` receives `dashboard:view` only (no `dashboard:factory`), aggregate compensation summary (`#16c`) only, zero individual salary visibility (`#16d` barred), and executive-subject salary revisions remain dormant outside Phase 08A.
- **`U-02` (`APPROVED`):** Omit `hr:confidential:compensation:initiate_executive` completely from future Seed `008` (`42` conceptual Phase 08A keys + `5` deferred conceptual Phase 11 keys = `47` total conceptual HR permissions including `Decision B`; zero permissions or seeds have been created).
- **`U-03` (`APPROVED`):** Reuse existing `'Department User'` (`role_id = 3`) as a secondary role during HR onboarding; preserve employee's operational role; never grant `hr:self:*` directly to operational roles; enforce JWT + `hr_employees.user_id` + row ownership + `TERMINATION_PENDING` checks. *(Label note preserved: Candidate `§3` labeled `Option B`, `v1.0`/`OD-03` labeled `Option A`; meaning is identical.)*
- **`U-04` (`APPROVED`):** Governance Fallback Cancellation (`#41c`) requires **BOTH** SLA expiry **AND** verified absence of any eligible active approver/delegate; `HR Manager` primary; `Factory Manager` exceptional only under objectively verifiable `HR Manager` ineligibility; delegates, requester, and `System Administrator` barred; atomic eligibility re-check + concurrency locks + immutable audit.
- **`U-05` (`APPROVED`):** `'System Administrator'` receives zero `hr:self:*` permissions (`'Department User'` secondary role only via HR onboarding if admin is an employee).
- **`U-06` (`APPROVED`):** `#35` Asset Custody & `#19` Contracts add `hr:self:view` + ownership check; `#25` & `#30` (plus `#24` via `NUANCE-C`) replace `hr:self` shorthand with granular keys; `#5a` Termination Initiation restricts `Factory Manager` strictly to `HR Manager` subject under Policy `#8`.
- **`U-07` (`APPROVED`):** Post-Gate-A roadmap update records Phase 07 completed on `pg-mem` evidence only, Phase 08A planned (not implemented), and Gate B live PostgreSQL 14+ mandatory before DDL/migrations/seeds.
- **`OD-01`, `OD-02`, `OD-03`, `§11.2 #2–#5`:** `OD-01` aggregate-only `Owner Executive`; `OD-02` single-use audited `HR Manager` baseline profile self-bootstrap (no self-approval); `OD-03` `'Department User'` reuse; Step 7A Mode A initial (Step 7B deferred); `409 USE_HR_WORKFLOW` inside `withTransaction` on all 3 legacy Dept APIs; Seed `008` zero auto-backfill (`'admin'` legal onboarding manual); existing `users.full_name` preserved.

### 3.2 Canonical Role, Separation-of-Duty & Conceptual Permission Architecture (`42` Conceptual Phase 08A Keys + `5` Deferred Conceptual Phase 11 Keys)

Canonical `roles.role_name` values (`ISS-09`): `'System Administrator'`, `'Factory Manager'`, `'Department Manager'`, `'Department User'`, `'HR Manager'`, `'HR Officer'`, `'Owner Executive'`, plus Batch 4 independent custodial functions (`Audit Custodian`, `Security Custodian`, `Governance Authority`).

| Role / Function | Permitted Scope (Updated with `Decision B` & `Decision C`) | Strictly Barred Scope |
|---|---|---|
| **`System Administrator`** | Technical RBAC/admin, **`hr:sla:manage` + `hr:sla:view` (exclusive SLA & business calendar management — `Decision B`)**, `hr:admin:manage` (`hr_leave_types` & non-SLA `hr_settings`), `users:roles`, audited transport-only DLQ notification replay (`§3.5`). | **Zero** HR operational data, `hr:self:*`, HR/non-system approvals, `#41b`/`#41c`, step reassignment (`Decision C`), SLA extension, `hr_confidential_audit_logs`, `HR`/`PAYROLL` content, automatic Emergency Journal content, or sensitive Governance records. |
| **`HR Manager`** | Core HR & confidential vault (`pii`, `compensation:view|manage`, `medical`, `confidential:documents`, `legal_hold`, `purge`, `confidential:audit:view`), **`hr:sla:view` (strictly read-only SLA visibility — `Decision B`)**, `hr:admin:manage` (strictly `hr_leave_types` & non-SLA `hr_settings` — **barred from SLA/calendar config**), primary actor for `#41c` cancel, reassignment (`Decision C`), cycle reopening, ordinary SLA extension, audited self-bootstrap (`OD-02`). | **Zero** self-approval (`#1`–`#9`), **zero** SLA configuration writes (`Decision B`), **zero** self-extension/reassignment/reopening when conflicted (`Decision C` fails closed on reassignment), **zero** unilateral override of Audit/Security Custodians or Governance Authority. |
| **`Factory Manager`** | Operational HR (`hr:view`, `attendance:view|approve`, `leave:view|approve`, `contracts:approve`, `employees:status`), Policy `#7a` standard salary revision approval (`#16d`, `#16c` summary), `#5a` termination initiation strictly for `HR Manager` subject (`U-06 #4`), exceptional `#41c` cancel & cycle reopening **only** with documented objective `HR Manager` ineligibility. | **Zero** individual bulk salary/history/PII/medical/confidential-audit access, **zero** executive Policy `#7` initiation (`U-02`), **zero implied reassignment authority (`Decision C`)**, **zero assumed SLA-extension fallback**, governance operational summaries only (`Batch 4 #18`). |
| **`Owner Executive`** | `dashboard:view` only, `#16c` aggregate compensation summary, `#41b` redacted non-confidential context (`404` once finalized/unauthorized — `Decision A`), executive approvals (`hr:leave:approve:executive`, `hr:employees:approve:executive`, `hr:contracts:approve`) on Policies `#4`, `#6`, `#8`, `#9`. | **Zero** `dashboard:factory`, `hr:view`, `leave:view`, `attendance:view`, `reports:view`, `compensation:approve`, `#16d`, individual salary visibility, or **reassignment fallback authority (`Decision C`)**. |
| **`HR Officer`** | Operational HR drafts/submissions (`employees:manage`, `contracts:manage`, non-conf `documents:manage`, `custody:manage`, `leave:manage`). | **Zero** `confidential:*`, `legal_hold`, `purge`, `contracts:approve`, final `leave:approve`, final `employees:status`, or SLA write/manage. |
| **`Department Manager`** | Strictly `S`-scoped (`managed_department_ids`) via `hr:scoped:*` (`view`, `leave:review`, `attendance`, `custody:view`). | Cross-department data, PII, confidential domains, executive policies. |
| **`Department User` (`2nd-Role`)** | Self-service (`hr:self:view`, `hr:self:attendance:view`, `hr:self:leave:request`) strictly when linked (`hr_employees.user_id = actor.id`) and within `TERMINATION_PENDING` allowlist. | Cross-employee records, unlinked `hr:self:*` (`403 HR_PROFILE_NOT_LINKED`). |
| **`Audit Custodian` / `Security Custodian` / `Governance Authority` (`Batch 4`)** | Independent Emergency Journal read/export oversight, Destruction Registry recovery dual-approval (`Batch 3`, `Batch 6`), Legal Disclosure evidence/scope verification (`Batch 5`), Governance Charter quorum decisions, Security Hold dual release (`Batch 5`), Residual Risk independent acceptance. | Structurally independent of unilateral `System Administrator` and `Factory Manager` control; one person cannot fill both Audit and Security independent functions (`Batch 4 #6`); conflicted members excluded. |

*(Conceptual HR Permission Count Updated for `Decision B`: `40` prior conceptual Phase 08A keys + `2` new conceptual architectural keys [`hr:sla:manage`, `hr:sla:view`] = **`42` conceptual Phase 08A keys** + `5` deferred conceptual Phase 11 keys = **`47` total conceptual HR permissions**. These counts are strictly conceptual; zero HR permissions, Seed `008` entries, or SQL files have been created or modified.)*

### 3.3 `ISS-02` — Endpoint `#41b` (`GET /api/approvals/:id/context`) Final Security Contract (`Decision A` Applied)

- **Endpoint & Applicable Policies:** `GET /api/approvals/:id/context` for Policies `#4`, `#6`, `#8`, `#9` (and `#1`–`#3`, `#5` where applicable; Policy `#7` strictly excluded and served only via `#16d` barring `Owner Executive`).
- **DTO & Redaction Rules:**
  1. Dedicated per-policy DTO (never a general employee DTO) with **explicit field allowlists** per policy.
  2. Free-text **`reason`**, **`notes`**, and **`decision_notes` MUST BE EXCLUDED**.
  3. Zero individual compensation/salary, National ID/banking PII, medical data, disciplinary records, confidential audit data, or employee history fields.
  4. **Concrete field names, data types, and nullability per policy remain `OPEN – OWNER DECISION REQUIRED`.**
- **HTTP Status & Authorization Rules (`Decision A` Applied):**
  1. **HTTP `400 VALIDATION_ERROR`:** Invalid `:id` syntax (`parsePositiveInt`).
  2. **HTTP `401 UNAUTHORIZED`:** Unauthenticated requests.
  3. **Unified HTTP `404 NOT_FOUND` (`Decision A — APPROVED`):** Returned uniformly for **nonexistent** `:id`, **unauthorized** callers (missing step permission, `'System Administrator'`, non-assignee/non-delegate, requester/subject, out-of-department manager, inactive/terminated/`TERMINATION_PENDING` actor, Policy `#7` calls), **role-pooled unassigned steps (`assigned_user_id IS NULL`)**, and **finalized requests (`status NOT IN ('PENDING', 'IN_PROGRESS')`)**.
  4. **Expired steps (`NOW() > due_at` while `PENDING`):** Remain accessible (`200 OK`) to the current eligible approver and valid active delegate.
  5. **Reassignment & Delegation:** Reassignment immediately revokes previous approver access (subsequent `#41b` returns unified `404`); delegation is revalidated on every request.
  6. **Read-Only & Fail-Closed Pre-Return Audit:** `GET` never mutates workflow state; audit event must be durably recorded **before** returning data (audit failure = fail closed), and audit records **must never store DTO payloads or employee PII**.

### 3.4 Cross-Cutting Architectural Reconciliations (`CONTRADICTION-03`, `04`, `05`)

#### 3.4.1 `CONTRADICTION-03` — Notification Delivery Failure vs. Audit & Outbox Durability
The four operational/persistence layers are strictly distinct and must never be conflated:

| Layer | Transaction & Failure Rule | Architectural Authority |
|---|---|---|
| **1. Business State + Transactional Outbox Persistence** | Executed inside **one atomic DB transaction (`withTransaction`)**. Failure to persist the required transactional outbox record **prevents the business transaction from committing** (rolls back completely). | `§3.5`, `Paste §4.5`, `§4.7` |
| **2. Post-Commit External Channel Delivery** | Executes asynchronously **after** the DB transaction commits. External provider/channel delivery failure moves messages through bounded exponential backoff to Dead Letter (`DLQ`) and **must NEVER roll back** a valid committed business operation (e.g., reassignment or reopening). `SysAdmin` manual DLQ replay is audited and exposes transport metadata only. | `Paste §4.5` (`G063–G069`) |
| **3. Required Audit-Event Durability** | Required audit records must satisfy the approved durable-persistence architecture before sensitive operations or confidential reads are considered valid/completed (`audit failure = fail closed`). | `Batch 2 #2, #21–#22`, `§3.3` |
| **4. Emergency Journal Fallback & Dual-Persistence Failure** | If primary DB audit persistence fails or is untrusted, required events fall back to the independent **Emergency Journal** (outside primary PostgreSQL). **If neither primary persistence nor the Emergency Journal can durably persist required audit evidence, affected sensitive operations MUST fail closed** and the system must never claim audit evidence was persisted. | `Batch 2 #1–#4, #21–#22`, `Batch 6 §10.1–§10.2` |

#### 3.4.2 `CONTRADICTION-04` — Approved Time Model vs. `v0.6` Bare `TIMESTAMPTZ`
- **Why Bare `TIMESTAMPTZ` in `v0.6` Is Insufficient:** PostgreSQL `TIMESTAMPTZ` stores only an absolute UTC instant (`8`-byte microsecond offset) and **discards**: (a) **Factory Local Time**, (b) **IANA Timezone** (e.g., `Africa/Cairo`), and (c) **UTC Offset** active when the deadline/event was recorded. Relying solely on bare `TIMESTAMPTZ` cannot reconstruct original local wall-clock context after IANA `tzdb` legislative DST rule updates (`Batch 1 #5`), cannot disambiguate DST fall-back repeated local times independently of server session timezone settings, and omits Batch 1 **Clock Trust and Event Sequence Provenance** (`Batch 1 #4, #12–#15`).
- **Standardized Five-Part Conceptual Time-and-Trust Representation *(Zero DDL / No Final SQL Column Names Invented)*:** Time-sensitive HR/approval timestamps conceptually retain the first four time elements (`Batch 1 #1–#3`), paired operationally with **Clock Trust and Event Sequence Provenance** (`Batch 1 #4, #12–#15`):
  1. **Factory Local Time:** Unambiguously preserved local wall-clock representation for operational display and factory-calendar reference (`Batch 1 #1`).
  2. **IANA Timezone:** Explicit zone provenance active at creation/observation (`Batch 1 #2`).
  3. **UTC Offset:** Exact offset active at creation/observation to disambiguate local times across DST/`tzdb` shifts (`Batch 1 #2`).
  4. **Resolved Absolute Instant:** Deterministic UTC instant used strictly for chronological comparison, expiry detection (`NOW() > deadline`), and ordering—never recalculated retroactively for existing deadlines when `tzdb` rules change (`Batch 1 #3, #5`).
  5. **Clock Trust and Event Sequence Provenance:** Explicit trust handling (`TRUSTED` vs. `UNTRUSTED` local observation with unique event identity during clock failure, separate post-recovery trusted evidence, and never retrospectively relabeling untrusted observations as trusted per `Batch 1 #12–#14`), supported by the durable **Central Event Sequence**, which **provides deterministic event ordering when clock trust is lost** (`Batch 1 #4, #15`). *Batch 1 does not establish a blanket rule that every timestamp must independently store a sequence field; exact physical linkage and SQL representation remain `DEFERRED` pre-DDL.*
- *(Exact SQL representation and active `PENDING` `due_at` enforcement details remain `OPEN` / `DEFERRED` pre-DDL per Section 8 #2–#3.)*

#### 3.4.3 `CONTRADICTION-05` — Missing SLA Configuration Fail-Closed Rule
- **Fail-Closed Runtime Invariant (`Paste §4.1 #7–#8`):** A new approval cycle or step **cannot** be created without a valid, active, published policy-specific SLA configuration (and effective factory business calendar).
- **Prohibitions:** **Zero silent fallback defaults** and **zero temporary `PENDING` steps without a valid `due_at`**.
- **Readiness Gate:** Pre-deployment / `OP-01` readiness must require all active policy-specific SLA configurations (matching `HR_LEAVE_*`, `HR_ATTENDANCE_CORRECTION`, `HR_CONTRACT_RENEWAL`, `HR_SALARY_REVISION`, `HR_TERMINATION`, `HR_EMPLOYEE_REHIRE`) and the factory business calendar to be configured by `'System Administrator'` (`hr:sla:manage`) and validated before live approval workflows run.
- **Open Specifics:** Exact SLA key names (`hr_settings` vs dedicated versioned SLA table), numeric min/max business-hour bounds, and factory calendar parameters remain **`OPEN`** / **`DEFERRED`** until Owner approval.

### 3.5 `ISS-06` Approval Lifecycle (`§4.1`–`§4.8`, Updated for `Decision B`, `Decision C`, `Decision D` & `CONTRADICTION-03/04/05`)

- **SLA & Business Calendar (`ISS-06-G001`–`G019`):** Step-creation snapshot in approved business hours (2 decimal places, exact conversion to seconds, per-policy min/max bounds, centralized versioned calendar, immutable published SLA versions, scheduled non-overlapping activation, forward-only withdrawal with replacement). Missing/invalid SLA config fails closed (`CONTRADICTION-05`). **`System Administrator` exclusively manages SLA config (`hr:sla:manage`); `HR Manager` holds read-only `hr:sla:view` (`Decision B`).**
- **SLA Extensions (`ISS-06-G020`–`G029`):** Formal audited action with mandatory reason; max 1 extension per step before original deadline; max duration <= original SLA duration in business hours; `'HR Manager'` primary (barred on own request/subject/step; single-actor in ordinary non-conflicted case); `'System Administrator'` barred. **`HR Manager` SLA-extension conflict fallback remains `OPEN – OWNER DECISION REQUIRED` (`Factory Manager` NOT assumed).**
- **Governance Fallback Cancellation (`ISS-06-G030`–`G042`, `#41c`, `U-04`):** Dual mandatory conditions (SLA expiry + verified `0` eligible active approvers/delegates), JIT recheck + atomic TX + concurrency locks + bounded retries (abort to operational review on failure). `'HR Manager'` primary; `'Factory Manager'` exceptional ONLY with documented objective `'HR Manager'` ineligibility (mere delay insufficient); delegates, requester, `'System Administrator'` excluded; escalates for operational resolution if both ineligible.
- **Approval Expiry & Late Decisions (`ISS-06-G043`–`G056`):** Expired steps stay persisted as `PENDING`; overdue derived from **Resolved Absolute Instant** vs deadline (`CONTRADICTION-04`); expiry triggers escalation without revoking approver/delegate decision rights; late decisions processed normally with explicit marking + business-time lateness audit, halting future escalations. **Reassignment (`Decision C`):** preserves original deadline and overdue state; `'HR Manager'` exclusive reassignor (subject to COI checks) to live-validated eligible targets (fails closed if none; repeated audited); **if `'HR Manager'` is conflicted or ineligible, reassignment fails closed, step remains `PENDING`, and operational escalation is created — zero implied fallback to `Factory Manager`, `Owner Executive`, delegates, or `SysAdmin` (`Decision C`).**
- **Reassignment & Outbox Notifications (`ISS-06-G057`–`G069`):** Atomic TX writes reassignment + outbox rows (`CONTRADICTION-03`), immediately revokes previous approver (`404` on `#41b`), notifies revoked approver, new approver (with deadline/overdue), and `HR Manager`. Post-commit delivery failure retries via exponential backoff -> DLQ without rolling back reassignment; `'System Administrator'` manual DLQ replay is audited & transport-only; delivery != human read proof.
- **Escalation (`ISS-06-G070`–`G082`):** Immediate at SLA expiry; current eligible approver + `HR Manager` baseline (`Factory Manager` only per explicit policy); grants zero extra authority; minimal PII-free metadata + secure `#41b` context link; optional ack changes nothing; terminal state halts future escalations.
- **Reopening & Policy Versioning (`ISS-06-G083`–`G107`, `Decision D`):** Policy/type-eligible reopening with mandatory reason by `'HR Manager'` (COI-checked) or `'Factory Manager'` (documented objective `'HR Manager'` ineligibility + live validation; else denied). **Multi-cycle history and immutable linkage between prior and reopened cycles is a mandatory architectural requirement (`Decision D`); `v0.6` single `approval_request_id` columns are insufficient (`DEFERRED` pre-DDL schema design).** Every cycle snapshots active policy/SLA/calendar immutably; retired policies block new cycles only; forward-only replacement; anomaly alerts on repeat reopenings without blocking valid ones; atomic + idempotent + row-locked; fail closed + alert if unmapped policy; no silent policy migration.

### 3.6 `ISS-01`–`ISS-11` Consolidated Status

- **`RESOLVED` (`8`):** `ISS-01`, `ISS-03`, `ISS-04`, `ISS-05`, `ISS-08`, `ISS-09`, `ISS-10`, `ISS-11` *(unchanged — `8` resolved + `3` partially resolved/open below = `11` total `ISS-01`–`ISS-11`)*. *(Separately from the `ISS` count, architectural contradictions/gaps resolved or reconciled in `v1.2`/`v1.2.1` are `CONTRADICTION-01` via `Decision A`, `GAP-01` via `Decision B`, `GAP-02` via `Decision C`, `GAP-03` via `Decision D` architectural requirement, and `CONTRADICTION-03`/`04`/`05`.)*
- **Partially Resolved / Still `OPEN` (`3`: `ISS-02`, `ISS-06`, `ISS-07`):**
  - `ISS-02`: `#41b` HTTP status resolved (`Decision A` unified `404`), free-text/pool/expiry/reassignment/audit security rules approved; **field-level DTO names, types, and nullability remain `OPEN`**.
  - `ISS-06`: `Decision B`, `Decision C`, `Decision D` (arch), and `CONTRADICTION-03/04/05` reconciled; **`HR Manager` SLA-extension fallback, `due_at` exact enforcement/representation, policy SLA keys/bounds/calendar values, and raw `#1`–`#171` ledger mapping remain `OPEN` / `DEFERRED`**.
  - `ISS-07`: `OD-02` self-bootstrap baseline preserved; **post-bootstrap career-field self-edit lock & `System Administrator` `users:roles` secondary `'Department User'` onboarding handoff (`NUANCE-B`) remain `OPEN`**.

---

## 4. Part B — Cross-Cutting Security, Governance, Audit, Evidence & Recovery Architecture (`Batches 1–4 & 6`)

> *Scope Preservation:* All principles below remain **`OWNER APPROVED`** architectural requirements without expanding Phase 08A coding scope or authorizing deferred Step 7B / Batch 1–5 detailed implementations.

- **Batch 1 – Clock Integrity & Time Trust (`16` rules):** Five-part conceptual time-and-trust representation (**`Factory Local Time`**, **`IANA Timezone`**, **`UTC Offset`**, **`Resolved Absolute Instant`**, and **`Clock Trust and Event Sequence Provenance`** per `CONTRADICTION-04` and `Batch 1 #1–#4, #12–#15`), central authoritative clock, **Central Event Sequence** providing deterministic event ordering when clock trust is lost, immutable historical deadlines across `tzdb` edits, configurable/versioned NTP & drift thresholds, bounded offline NTP window, untrusted local observations with unique event identity never retrospectively relabeled, separate post-recovery trusted evidence, surviving durable sequence, fail closed on sequence persistence failure.
- **Batch 2 – Emergency Journal & Cryptographic Recovery (`22` rules):** Independent durable event sequence **outside** primary PostgreSQL; append-before-persisted; append-only + hash chaining; minimal payload/references; keys isolated from app code & plain config; dedicated least-privilege service identity (`SysAdmin` barred from journal content); DPAPI/Cert Store permitted post-design; tracked key versions & forward-only rotation; compromise containment + offline encrypted key backup; 2-person recovery; quarterly isolated drills (failure = Critical Incident); Audit/Security Custodian read + audited/redacted/encrypted export; **dual persistence failure = fail closed (`CONTRADICTION-03`)**.
- **Batch 3 – Evidence Repository & Destruction Registry (`17` rules):** Evidence content & immutable event-based Destruction Registry kept separate with independent storage/backups; atomic concurrency-protected JIT validation of Legal Holds, Incidents, Preservation Orders; covers primary, replicas, quarantined unexpired backups; Registry restored **before** Evidence Repository on DR with prior destructions reapplied + Audit/Security Custodian approval; corruption/missing sequence/conflicts block destruction; residual uncertainty documented & expiry auto-suspends destruction. **Phase 08A non-authorization boundary intact (Step 7B deferred).**
- **Batch 4 – Governance & Custodian Independence (`21` rules):** Structural independence from unilateral `System Administrator` and `Factory Manager` control; Audit, Security, and Governance separated; live eligibility/COI checks; pre-appointed primary & alternate custodians; mandatory dual-person controls (one person cannot fill both independent functions); COI/ineligibility suspends authority; immutable appointment/suspension log; formal Governance Charter (no emergency quorum bypass, conflicted members excluded, pre-approved alternates); verifiable append-only governance logs (`Factory Manager` summaries only; `SysAdmin` no automatic sensitive access).
- **Batch 6 – Residual Risk & Recovery Controls (`5` principles):** (1) **Unified Fail-Closed Policy** (never guess authz, trust missing evidence, bypass dual control, assume failed verification passed, or use stale eligibility); (2) **Scoped Suspension** (target affected sensitive operations only when independent workflows remain valid—no unwarranted factory shutdown); (3) **Recovery Beyond File Restore** (verify keys, Emergency Journal, event sequence, Destruction Registry, reapplied destructions, Legal Holds, quarantine, Audit + Security Custodian approvals); (4) **Residual Risk Governance** (`Accepted | Under Review | Expired | Suspended | Rejected`, auto-suspend on expiry); (5) **Operational Readiness Separation** (pre-activation readiness never replaces Gate A or Gate B).

---

## 5. Part C — Independent Legal & Compliance Procedures (`Batch 5` — `OWNER APPROVED` Principles)

1. **Legal Disclosure Authorization (`#1–#7`, `#22–#25`):** Validate legal authority, jurisdiction, and scope; minimize material; preserve originals; require independent legal review + Audit Custodian evidence verification + second independent release verifier; JIT verify recipient identity, legal capacity, and secure channel; fresh review on material scope change; automated + human-verified third-party redaction; Legal Holds/Preservation Orders controlling until independent release; invalid requests rejected & documented.
2. **Packaging, Delivery & Closure (`#8–#14`, `#28`):** Immutable manifests + cryptographic hashes; 6 distinct delivery states (`prepared | transmitting | partially delivered | delivered | failed | unknown`); no uncontrolled resend on ambiguous transmission; transport acceptance != verified human ack; document post-delivery conditions & lawful onward notices; closure confirmation or explicit unresolved status; full chain of custody.
3. **Security Incidents (`#15–#21`, `#26–#27`):** Distinct linked workflows; immediate containment, preservation, suspension of affected destruction; dual independent approval to release security hold; RCA + remediation + independent review to close (reopenable on new evidence); independent legal assessment for employee/regulatory notices; unauthorized disclosure = Critical Security Incident; disclosure during open incident requires legal exception review + dual control.

---

## 6. Part D — Deferred Implementation Specifications

1. **Pre-DDL Multi-Cycle & Time Schema Design (`DEFERRED` until Gate A & Gate B):** Exact multi-cycle FK/column/uniqueness/index/migration design (`Decision D` / `GAP-03`), exact SQL representation of the **five-part conceptual time-and-trust representation** (`Factory Local Time`, `IANA Timezone`, `UTC Offset`, `Resolved Absolute Instant`, `Clock Trust and Event Sequence Provenance`) & `due_at` columns (`CONTRADICTION-04`), SLA/Calendar version tables, extension/reassignment/outbox/DLQ tables, and future conceptual `hr:sla:manage`/`hr:sla:view` Seed `008` entries (`Decision B`; zero permissions or seeds currently created).
2. **Batch 1–5 Detailed Technical/Legal SOPs (`DEFERRED`):** Factory calendar specifics (`OPEN`), drift/NTP thresholds/operation inventory, Emergency Journal binary format/`fsync`/algorithms/DPAPI vs Cert Store/retention, Step 7B Mode B encrypted storage & external purge (`Batch 3`), Charter ratios/identities/cadence (`Batch 4`), jurisdiction legal/channel/deadline procedures (`Batch 5`), and Phase 11 (`Step 9`) modules.

---

## 7. Part E — Decision Traceability Summary (`ISS-06` Grouped `107` & Six Batches `109`)

*(Full per-item matrix `ISS-06-G001`–`G107`, raw `#1`–`#171` unmapped table, and `Batch 1`–`Batch 6` matrix maintained in companion `GFMSv0.3_HR_GATE_A_RECONCILIATION_AND_TRACEABILITY_REPORT_v1.2.1.md`.)*

| Traceability Scope | Total Items | Coverage Breakdown | Notes |
|---|---|---|---|
| **Raw `ISS-06` Decisions (`#1`–`#171`)** | `171` | **`0 / 171` Mapped (`171 UNMAPPED`)** | Original raw numbered `#1`–`#171` ledger unavailable; zero titles/options fabricated. |
| **Grouped `ISS-06` Principles (`§4.1`–`§4.8`)** | `107` (`G001`–`G107`) | **`76 FULL` · `31 PARTIAL` · `0 CONFLICTING` · `0 MISSING`** | `G013`, `G014` (`Decision B`), `G053` (`Decision C`), and `G064` (`CONTRADICTION-03`) upgraded to `FULL`; `0` unresolved conflicts remain (`31 PARTIAL` reflect explicitly `OPEN` params / `DEFERRED` pre-DDL specs). |
| **Six Approved Batches (`B1`–`B6`)** | `109` | **`109 / 109` Represented (`100%` principles)** | Separated cleanly into `XCUT`, `LEGAL`, `DEFER`, and `OPS`. |

---

## 8. Part F — Remaining Open & Deferred Items (`DO NOT CLOSE GATE A`)

### Open Owner Decisions & Confirmations Required (`OPEN`)
1. **`HR Manager` SLA-Extension Conflict Fallback (`ISS-06`):** Establish fallback authority when `HR Manager` is conflicted or unavailable (`Factory Manager` must not be silently assumed).
2. **Exact Active `PENDING` `approval_steps.due_at` Enforcement & Data Representation (`ISS-06` / `NUANCE-A` / `CONTRADICTION-04`):** Confirm `NOT NULL` enforcement design and integration with the **five-part conceptual time-and-trust representation** (`Factory Local Time`, `IANA Timezone`, `UTC Offset`, `Resolved Absolute Instant`, `Clock Trust and Event Sequence Provenance`) prior to Step-3 DDL.
3. **Policy-Specific SLA Keys, Bounds & Factory Calendar Values (`ISS-06` / `CONTRADICTION-05`):** Confirm exact SLA config keys, numeric min/max business-hour bounds per policy, factory IANA timezone, working days/hours, breaks, and official holidays.
4. **`ISS-02 #41b` Concrete Field-Level DTO Definitions (`ISS-02`):** Confirm exact field names, data types, and nullability per applicable policy (`#4`, `#6`, `#8`, `#9`, plus `#1`–`#3`, `#5`).
5. **`ISS-07 / NUANCE-B` Self-Edit Lock & Onboarding Handoff (`ISS-07`):** Confirm post-bootstrap `#4` career-field self-edit locks (`OD-02`) and explicit `System Administrator` `users:roles` secondary `'Department User'` onboarding handoff (`U-03`, `U-05`).
6. **`NUANCE-C` Endpoint `#24` Permission Parity:** Formal confirmation updating `GET /api/hr/shifts*` (`#24`) from `hr:self` to `hr:self:attendance:view`.
7. **Raw `ISS-06` `#1`–`#171` Source Ledger (`GAP-04`):** Supply original numbered `#1`–`#171` ledger if strict numeric audit pairing is required alongside `G001`–`G107`.
8. **Formal Final Gate A Ratification:** Owner sign-off on `HR-DEC-01`–`HR-DEC-14`, `OD-01`–`OD-03`, `U-01`–`U-07`, `§11.2 #2–#5`, `Decision A`–`Decision D`, `Batches 1–6`, and the final ratified Gate A Addendum (authorizing post-Gate-A roadmap alignment per `U-07`).

### Deferred Technical Design Items (`DEFERRED`)
- Multi-cycle immutable approval DDL (`Decision D`), Batch 1–3 physical schemas, SLA/Calendar/Extension/Reassignment/Outbox/DLQ DDL, Step 7B binary storage & purge, Batch 4 Charter thresholds/identities, Batch 5 jurisdiction/channel SOPs, and Phase 11 (`Step 9`).

---

## 9. Part G — Three-Gate Governance Separation (`Gate A` · `Gate B` · `OP-01`)

- **Gate A — Architecture & Owner Ratification (`GATE A – OPEN / NOT APPROVED`):** Closes only upon Owner resolution/confirmation of Section 8 items #1–#8 and formal ratification.
- **Gate B — Live PostgreSQL 14+ Verification (`NOT VERIFIED / PENDING`):** Separate mandatory **engineering verification gate** (not an owner architectural decision) against a live PostgreSQL 14+ instance (`driver.kind === 'pg'`), verifying all `11` `GB-01.1`–`GB-01.11` checks (`001`–`006` migrations, `001`–`007` seeds, triggers, `GENERATED ALWAYS`, parallel `FOR UPDATE`, two-phase `idempotency_keys`, SQLSTATE translation, `warehouse_notifications` hygiene, `89/89` + E2E). **`pg-mem` never proves PostgreSQL compatibility.** Zero HR DDL, migrations, or seeds before Gate B passes.
- **`OP-01` — Operational Readiness (`PENDING`):** Separate Go-Live gate covering HR/Executive appointments, primary & alternate Audit/Security Custodians, Governance Authority members, secondary `'Department User'` roles, `'admin'` legal onboarding, `DEP-HR` `manager_id`, cryptographic key custody & offline backups, policy SLA & calendar provisioning (`CONTRADICTION-05`), leave balance initialization, quarterly recovery drills, SOPs, training, and independent security/legal review.

---

## 10. Final Status

- **`DRAFT – FOR OWNER REVIEW`**
- **`GATE A – OPEN / NOT APPROVED`**
- **`HR IMPLEMENTATION – NOT AUTHORIZED`**
- **`GATE B (LIVE POSTGRESQL 14+) – NOT VERIFIED / PENDING`**
- **`OP-01 (OPERATIONAL READINESS) – PENDING`**
