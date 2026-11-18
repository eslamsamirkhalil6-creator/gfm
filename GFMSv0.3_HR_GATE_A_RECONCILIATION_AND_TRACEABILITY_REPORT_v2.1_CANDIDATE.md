# GFMSv0.3 – HR Gate A Reconciliation & Traceability Report (v2.1 Candidate)

**Document ID:** `GFMSv0.3_HR_GATE_A_RECONCILIATION_AND_TRACEABILITY_REPORT_v2.1_CANDIDATE.md`  
**Companion Addendum:** `/.aistudio/artifacts/brain/f1c889e7-f83c-4612-b6df-e6c812aa338f/GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v2.1_CANDIDATE.md` *(Root copy: `/GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v2.1_CANDIDATE.md`)*  
**Status:** **`DRAFT – FOR OWNER REVIEW (GATE A CONSOLIDATION REPORT v2.1 CANDIDATE)`**  
**Gate A Status:** **`GATE A – OPEN / NOT APPROVED`** *(Approved `OD-A1`–`OD-A4` recorded; final review and formal ratification remain pending.)*  
**Implementation Status:** **`HR IMPLEMENTATION – NOT AUTHORIZED`**  
**Gate B Status (Live PostgreSQL 14+):** **`NOT VERIFIED / PENDING`** *(Container runs `pg-mem v3.0.14`; `pg-mem` never proves PostgreSQL 14+ compatibility.)*  
**Operational Readiness (`OP-01`):** **`PENDING`**  
**Date:** 2026-11-17  

---

## 1. Source Corpus Inventory & Exact Normative Matrix Locations (`AUD-02`, `AUD-03`, `v2.1` Correction `E`)

All pre-existing specifications and audit artifacts (`v0.6`, `v1.0`, `v1.1`, `v1.2`, `v1.2.1`, `v2.0`) remain **100% unmodified on disk**. The table below documents exact canonical file locations and the exact level of traceability provided:

| Document & Exact Canonical Path(s) | Verified Predecessor Footprint | Governance Role in `v2.1` | Exact Normative & Traceability Contents |
|---|---|---|---|
| **`GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v2.1_CANDIDATE.md`** *(Artifact + Root copy)* | `v2.1` Consolidated Candidate | **Priority 1 — Governing Gate A Overlay Candidate** | Consolidates `v1.0` (`42`+`5` perms, `#1–#43`/`#41b`/`#41c`/Legacy routes, `9`-policy matrix, invariants, `GB-01.1–11`, `OP-01`), `v1.1`/`v1.2.1` (`Batches 1–6`, `CONTRADICTION-03–05`), `Decision A–D`, `OD-A1`–`OD-A4` (`APPROVED`), and **Corrections `A–F`**. |
| **`GFMSv0.3_HR_GATE_A_RECONCILIATION_AND_TRACEABILITY_REPORT_v2.1_CANDIDATE.md`** *(Artifact + Root copy)* | `v2.1` Consolidated Report | **Priority 1 — Companion Reconciliation & Traceability Report** | Standalone `ISS-01`–`ISS-11` (`8`/`3`), full **`107`-row `ISS-06-G001`–`G107` table** (Correction `A` applied), **`6`-row grouped-range Batch `1–6` table** covering `109` controls (Correction `E`), `OD-A4` `0/171` raw disclosure, `v2.1` Corrections `A–F`, and 6-category `§8` classification. |
| **`GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v2.0_CANDIDATE.md`** & **`REPORT_v2.0.md`** *(Artifact + Root copies)* | `74,144` B (`384` lines) / `51,109` B (`311` lines) | Preserved Unmodified Prior Milestone (`v2.0`) | Preserved intact; had `Group 4.1` `G005/G009` typo (`§6.2`), `#41b` `'EXPIRED'` ambiguity, and coarse 5-item `§8` list corrected in **`v2.1_CANDIDATE`**. |
| **`GFMSv0.3_HR_DETAILED_ARCHITECTURE_DESIGN_v0.6.md`** *(`/.aistudio/artifacts/.../v0.6.md` & `/...v0.6.md`)* | `132,764` B · `583` (`wc -l`) / `584` lines · `0fb99a789c...d8e1ea` | **Priority 2 — Base Design Specification (Incorporated by Reference)** | `§3` (`37`-table ER/DDL & topological order), `§4.2–§4.4` (2-phase idempotency & DAG), `§7.2` (honest encryption matrix), `§8` (offline sync), `§9` (`HR-DEC-01`–`14`), governed by **`v2.1_CANDIDATE §1.2` Amendment Table** (`AUD-03`: **NOT** marked superseded). |
| **`GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v1.0.md`** *(`/.aistudio/artifacts/.../v1.0.md`)* | `62,586` B · `345` (`wc -l`) / `346` lines · `747a897b51...db1bd58` | Preserved Historical Baseline | Original source of `§4.1`, `§4.2`, `§5`–`§13`; historical `#41b` `403` amended by `Decision A` while `#16d` `403` stays preserved (`AUD-05`). |
| **`GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v1.1_CANDIDATE.md`** *(`/.aistudio/artifacts/.../v1.1_CANDIDATE.md`)* | `62,235` B · `391` (`wc -l`) / `392` lines · `975229e804...78050` | Preserved `ISS-06` Grouped Source (`§7.1`) | **`§7.1` (`l.192–334`):** Original `107`-row `ISS-06-G001`–`G107` table. |
| **`GFMSv0.3_HR_GATE_A_RECONCILIATION_AND_TRACEABILITY_REPORT_v1.1.md`** *(`/.aistudio/artifacts/.../REPORT_v1.1.md`)* | `66,778` B · `361` (`wc -l`) / `362` lines · `1a01f12d75...5ceb1` | Preserved Item-Level Ledger Source (`§2.2`, `§3.2`) | **`§2.2` (`l.78–264`):** Full `171`-row `UNMAPPED` raw slot ledger (`#1–#171`); **`§3.2` (`l.297–306`):** `6`-row grouped control-range traceability table covering `109` Batch `1–6` controls (`B1-01..B6-05`). |
| **`GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v1.2.1_CANDIDATE.md`** & **`REPORT_v1.2.1.md`** | `40,799` B (`222` l.) / `15,855` B (`101` l.) | Preserved Intermediate Overlay & Summary | Consolidated into `v2.0` -> `v2.1`; `v1.2.1 §7 l.180` pointer inaccuracy corrected (`AUD-02`). |

---

## 2. Approved Owner Decision Register

### 2.1 Four Confirmed `OD-A` Owner Decisions (`OD-A1` – `OD-A4`) — **`APPROVED`**
*(Recorded cleanly per Owner confirmation; these approvals resolve `OPEN-SLA-EXT`, policy layer of `ISS-07`, `NUANCE-C`, and `GAP-04`, and do NOT constitute final Gate A ratification.)*

| Decision ID | Topic / Source Issue | Owner Decision Status | Exact Approved Provision & Traceable `v2.1` Effect |
|---|---|---|---|
| **`OD-A1`** | **SLA Extension Conflict Fallback** (`OPEN-SLA-EXT` / `ISS-06 §4.2`) | **`APPROVED` — Fail Closed** | When `'HR Manager'` is conflicted or ineligible to authorize an SLA extension: **(1)** deny the extension; **(2)** retain the approval step as **`PENDING` with its original deadline unchanged**; **(3)** raise an **operational escalation**; **(4)** grant **zero fallback authority** to `'Factory Manager'`, `'Owner Executive'`, delegates, or `'System Administrator'`; **(5)** keep strictly separate from Governance Fallback Cancellation (`#41c`) and from SLA configuration permissions (`hr:sla:manage` / `hr:sla:view` — Correction `D`). **Effect:** Upgrades `G026`, `G027`, `G029` (`PARTIAL -> FULL`). |
| **`OD-A2`** | **`ISS-07 / NUANCE-B` Career-Field Self-Edit Lock & Onboarding Role Handoff** | **`APPROVED`** | **(1)** Employees **cannot self-edit** the eight protected career fields: `employee_code`, `hire_date`, `last_hire_date`, `primary_department_id`, `employment_type`, `rehire_count`, **`user_id`**, **`employment_status`** (`#4`). **(2)** Changes require an **authorized, audited HR workflow**. **(3)** HR may initiate the onboarding/role-assignment request; **`'System Administrator'` executes secondary `'Department User'` assignment via `PUT /api/users/:id/roles` (`users:roles`)**. **(4)** HR must **NOT directly mutate `user_roles`**. **Effect:** Locks exact 8-field rule & `SysAdmin` handoff (`§3.1.1, §3.2, §3.3 #4/#5/#6`); remaining implementation mechanics placed cleanly in Pre-DDL Design (`§8.3 #5`). |
| **`OD-A3`** | **`NUANCE-C` Endpoint `#24` (`GET /api/hr/shifts*`) Permission** | **`APPROVED`** | Apply **`hr:self:attendance:view`** to **`GET` requests ONLY** under `/api/hr/shifts*` (`#24`), with authenticated identity (`hr_employees.user_id = actor.id`) and row-ownership verification. **Do NOT apply this read permission to `POST` or `PUT` operations**; `POST`/`PUT` retain separate **`hr:shifts:manage`** write authorization (Correction `B`). **Effect:** Splits `#24a` (`GET`) vs `#24b` (`POST`/`PUT`) cleanly in `v2.1 §3.3`; closes `ISS-08`. |
| **`OD-A4`** | **`GAP-04 / AUD-01` `ISS-06` Traceability Disposition** | **`APPROVED`** | **(1)** Accept grouped `ISS-06` principles **`G001`–`G107`** as the canonical consolidated baseline. **(2)** Preserve **`109` approved Batch `1–6` controls**. **(3)** Explicitly disclose that raw `ISS-06` decisions `#1`–`#171` have **`0 / 171`** independently verifiable 1:1 mappings because the original raw numbered ledger is unavailable; zero fabricated mappings or 1:1 claims (Correction `E`). |

### 2.2 Previously Approved Decision Sets Preserved (`APPROVED`)
- **`Decision A`–`Decision D` (`v1.2`, Refined by Corrections `C` & `D`):** **`Decision A`** (unified `404` on `#41b` only; `400`/`401` preserved; `#16d` `403` untouched per `AUD-05`; SLA expiry keeps step `PENDING` with `200` on `#41b` and request vs. step state separation per Correction `C`); **`Decision B`** (`hr:sla:manage` `SysAdmin` only & `hr:sla:view` `SysAdmin` + `HR Mgr` read-only — **config ONLY, zero operational extension rights** per Correction `D`; `hr:admin:manage` untouched -> `42` Phase 08A conceptual keys + `5` deferred Phase 11 = `47` conceptual keys; zero perms/seeds created); **`Decision C`** (fail-closed `HR Manager` reassignment -> `PENDING` + escalation, zero implied fallback); **`Decision D`** (linked immutable multi-cycle approval architecture mandatory; DDL in `§8.3`).
- **`U-01`–`U-07`, `OD-01`–`OD-03`, `v0.6 §11.2 #2–#5`, `Batches 1–6` (`109` controls):** Preserved unchanged in `v2.1_CANDIDATE §3.1.3, §4, §5`.
- **Base `HR-DEC-01`–`HR-DEC-14` (`v0.6 §9`):** Incorporated by reference with `v2.1 §1.2` amendments noted; pending formal Gate A ratification alongside Gate A closure items (`§8.2`).

---

## 3. Audit Findings & `v2.1` Corrections Register (`AUD-02`–`AUD-05` & Corrections `A–F`)

### 3.1 Preserved `AUD-02` Through `AUD-05` Dispositions
| Finding | Summary | Applied Resolution | Location in `v2.1` |
|---|---|---|---|
| **`AUD-02`** | `v1.2.1 §7 l.180` mispointed to `REPORT_v1.2.1` for full tables. | Points accurately to `REPORT_v2.1_CANDIDATE §6–§7` and original sources (`v1.1_CANDIDATE §7.1`, `REPORT_v1.1 §2.2, §3.2`). | `v2.1_CANDIDATE §7`; `REPORT_v2.1 §1, §6, §7` |
| **`AUD-03`** | `v1.2.1 l.10` marked `v1.0`/`v1.1` superseded without full tables. | Reproduces all full matrices (`42`+`5`, `#1–#43`/`#41b`/`#41c`, `9`-policy, `G001–G107`, `B1–B6` grouped ranges, `GB-01`, `OP-01`) and incorporates `v0.6` by reference (`§1.2`). | `v2.1_CANDIDATE §1, §3–§9`; `REPORT_v2.1 §1, §6, §7` |
| **`AUD-04`** | `REPORT_v1.2.1` omitted standalone `ISS-01`–`ISS-11` table. | Standalone `ISS-01`–`ISS-11` status table (`8 RESOLVED` / `3 PARTIAL`) maintained in `REPORT_v2.1 §4`. | `REPORT_v2.1 §4` |
| **`AUD-05`** | Guard against spreading `#41b` `404` to `#16d` `403`. | Strict boundary: `#41b` = unified `404` (post-expiry `PENDING` stays `200`); `#16d` retains `403` baseline. | `v2.1_CANDIDATE §3.3 #16d/#41b`; `REPORT_v2.1 §5` |

### 3.2 Six Mandatory `v2.1` Corrections Applied (`A–F`)
| Correction | Defect Addressed vs. `v2.0` | Exact Fix Verified in `v2.1_CANDIDATE` Package |
|---|---|---|
| **A — Group `4.1` Traceability** | `REPORT_v2.0 §6.2 l.111` listed 8 IDs (`G001, G003–G005, G007–G009, G012`) alongside `6 PARTIAL`, contradicting `G005`/`G009` = `FULL`. | Corrected in `REPORT_v2.1 §6.2 & §6.3`: **`G005` & `G009` are `FULL`**; exact 6 `PARTIAL` IDs are **`G001, G003, G004, G007, G008, G012`**; narrative, `13 FULL · 6 PARTIAL` counts, and 19-row table match `100%`. |
| **B — Endpoint `#24` `GET` vs `POST`/`PUT`** | Merged line `#24` could imply `hr:self:attendance:view` touches writes. | Split cleanly in `v2.1 §3.3` into **`#24a` (`GET /api/hr/shifts*`)** (`hr:self:attendance:view` + identity & ownership check, read-only) and **`#24b` (`POST`/`PUT /api/hr/shifts*`)** (`hr:shifts:manage` only; read perm strictly barred from writes). |
| **C — `#41b` State Semantics & `EXPIRED`** | `v2.0` grouped `EXPIRED` inside finalized states (`l.83`), risking ambiguity with SLA step expiry. | Explicitly separated **approval-request states** (`PENDING`, `IN_PROGRESS`; terminal `APPROVED`, `REJECTED`, `CANCELLED` — prohibiting auto-`EXPIRED` step finalization) from **approval-step states** (`WAITING`, `PENDING`; terminal/closed `APPROVED`, `REJECTED`, `SKIPPED`, or parent cancel). SLA expiry keeps step `PENDING` (`200` on `#41b`); `#41b` `404`/`400`/`401` and `#16d` `403` preserved (`v2.1 §1.2, §3.1.2, §3.3, §3.5, §3.7.1`). |
| **D — SLA Config vs Extension Authority** | Ensure `hr:sla:manage` is never conflated with workflow extension rights. | Documented in `v2.1 §3.1.2, §3.2, §3.5, §8.3`: `hr:sla:manage` (`SysAdmin` only) & `hr:sla:view` (`SysAdmin` + `HR Mgr` read-only) govern SLA **config** only; `HR Mgr`'s extension authority is a separate workflow authorization; `hr:sla:manage` grants ZERO extension rights; any new extension key is flagged strictly as a **proposed pre-DDL design item**; `OD-A1` fail-closed preserved. |
| **E — `ISS-06` Traceability Language** | `REPORT_v2.0 §7.2` title labeled 6 grouped-range rows `"109-Control Matrix"`. | Clarified exact traceability across `v2.1 §7` & `REPORT_v2.1 §6–§7`: **`107` itemized grouped principles (`G001–G107`)**, **`109` approved Batch `1–6` controls mapped via verified grouped control-range references** (`REPORT_v2.1 §7.2` & `REPORT_v1.1 §3.2`), and **`0/171` raw `#1–#171` 1:1 verifiability**. |
| **F — Blocker & Gate Status Separation** | `v2.0 §8` mixed physical DDL/impl items together with Gate A blockers. | Confirmed `OD-A1`–`OD-A4` `APPROVED` while keeping **Gate A `OPEN / NOT APPROVED`**; restructured `§8` into **6 explicit categories** (`8.1` Remaining Owner Decisions -> `8.2` Gate A Design Closure -> `8.3` Pre-DDL Technical Design -> `8.4` `OP-01` Config -> `8.5` Gate B -> `8.6` Deferred Work). |

---

## 4. Standalone `ISS-01`–`ISS-11` Reconciliation Status Table (`AUD-04`)

| Issue ID | Issue Scope | Final `v2.1` Status | Governing Decisions Applied | Resolved Elements & Section `8` Classification |
|---|---|---|---|---|
| **`ISS-01`** | `'Owner Executive'` permissions & Policy `#7` split | **`RESOLVED`** | `OD-01`, `U-01`, `U-02`, `AUD-05` | Aggregate `#16c` only; `#16d` `403` barred; `initiate_executive` omitted (`U-02`); Exec Policy `#7b` dormant (`§8.6`). |
| **`ISS-02`** | Unified policy-redacted `#41b` approval context | **`PARTIAL / OPEN`** | `OD-01`, `U-01`, `Decision A`, `AUD-05`, Corr. `C` | Unified `404` (`400`/`401` preserved), request/step state separation, post-expiry `200`, free-text/PII exclusion, audit approved; **Gate A Closure (`§8.2 #1`): `#41b` per-policy field-level DTO schemas/types remain `OPEN`**. |
| **`ISS-03`** | Secondary `'Department User'` & `runner.ts` Test `77` | **`RESOLVED`** | `OD-03`, `U-03`, `U-05`, `OD-A2` | Reuses `'Department User'`; zero `hr:self:*` on operational roles; Test `77` & `79` preserved. |
| **`ISS-04`** | Deferred identity staffing & mid-flight pool exhaustion | **`RESOLVED`** | `ISS-04` Pool Guard | Atomic TX `assertEligibleApproverPoolExists` (`409 WORKFLOW_APPROVER_UNASSIGNED`) at submission & step transition. |
| **`ISS-05`** | Preserving existing titled `users.full_name` | **`RESOLVED`** | `§11.2 #5` | Zero `users.full_name` sync across `#4`, `#5d`, `#6`; read-only snapshot stored in link history. |
| **`ISS-06`** | Governance cancel (`#41c`) & `ISS-06` SLA/extension/reopen/outbox rules | **`PARTIAL / OPEN`** | `U-04`, `Decision B/C/D`, `CONTRADICTION-03/04/05`, `OD-A1`, `OD-A4`, Corr. `A/C/D/E` | `OD-A1` (`G026/027/029`), `OD-A4` (`G001–G107` baseline, `0/171` raw disclosed), `Decision B/C/D` & Corr. `C/D` approved; **remaining `28` `PARTIAL` rows span Pre-DDL Design (`§8.3 #1–#4`: `due_at` SQL, SLA/calendar tables, `Decision D` DDL, extension/outbox/DLQ contracts), `OP-01` values (`§8.4`), Gate B (`§8.5`), & Deferred (`§8.6`)**. |
| **`ISS-07`** | `HR Manager` self-bootstrap, self-edit locks & onboarding handoff | **`PARTIAL / OPEN`** | `OD-02`, `U-03`, `U-05`, **`OD-A2`** | `OD-A2` locks 8 career fields & mandates HR-initiated request / `SysAdmin` `PUT /api/users/:id/roles` onboarding handoff; **Pre-DDL Design (`§8.3 #5`): remaining `#2` self-bootstrap DTO/validation, `HR Officer` review, & 8-field enforcement mechanics**. |
| **`ISS-08`** | `#35`/`#19` `hr:self:view`, `hr:self` cleanup (`#24/#25/#30`), `#5a` | **`RESOLVED`** | `U-06 #1–#4`, **`OD-A3`**, Corr. `B` | `OD-A3` + Corr. `B` apply `hr:self:attendance:view` to `#24` **`GET` ONLY** while writes retain `hr:shifts:manage`; `#35`/`#19`/`#25`/`#30`/`#5a` aligned. |
| **`ISS-09`** | Canonical `roles.role_name` standardization | **`RESOLVED`** | `OD-03`, `001`–`007` seeds | Retired aliases eliminated; exact canonical `roles.role_name` strings used everywhere. |
| **`ISS-10`** | Legacy Dept API `409 USE_HR_WORKFLOW` & TX safety | **`RESOLVED`** | `§11.2 #4` | Unified `409 USE_HR_WORKFLOW` inside `withTransaction` (`FOR UPDATE`) on assign/transfer/remove. |
| **`ISS-11`** | Step 7A/7B split, Seed `008` order, Tests `44`/`45` | **`RESOLVED`** | `§11.2 #2`, `U-07` | Mode A Step 2 + Step 7A in Phase 08A; Step 7B deferred (`§8.6`); Tests `44`/`45` updated post-Gate B only. |

**Standalone Summary Count (`AUD-04`):** **`8 RESOLVED`** (`ISS-01`, `ISS-03`, `ISS-04`, `ISS-05`, `ISS-08`, `ISS-09`, `ISS-10`, `ISS-11`) · **`3 PARTIAL / OPEN`** (`ISS-02`, `ISS-06`, `ISS-07`).

---

## 5. Updated Contradiction, Gap & Nuance Register (`v2.1`)

| ID | Topic | Final Status in `v2.1` | Resolution Basis & Preserved Boundaries |
|---|---|---|---|
| **`CONTRADICTION-01`** | `#41b` Status Code (`404` vs `403`) & Step State Semantics | **`RESOLVED` (`Decision A` + `AUD-05` + Corr. `C`)** | **`#41b` returns unified `404`** (`400`/`401` preserved; overdue `PENDING` steps stay `PENDING` and return `200`; no ambiguous `'EXPIRED'` step terminal state). **`#16d` strictly retains `v1.0 §5` `403` baseline (`AUD-05`).** |
| **`CONTRADICTION-02` / `GAP-01`** | SLA Config RBAC vs Extension Auth (`hr:admin:manage`) | **`RESOLVED` (`Decision B` + Corr. `D`)** | Conceptual `hr:sla:manage` (`SysAdmin` only) & `hr:sla:view` (`SysAdmin` + `HR Mgr` read-only) govern SLA **config** only and confer ZERO extension rights; `HR Mgr` ordinary extension is a separate workflow auth; `hr:admin:manage` untouched (`42`+`5`=`47` keys). |
| **`CONTRADICTION-03`** | Notification Delivery vs Audit Durability | **`RECONCILED`** | Outbox write atomic with business TX; async post-commit delivery retries -> DLQ without rollback; audit durability fail closed; dual primary + Emergency Journal failure = fail closed. |
| **`CONTRADICTION-04`** | `v0.6` Bare `TIMESTAMPTZ` vs Batch 1 | **`RECONCILED`** | Five-part conceptual representation (`Factory Local Time`, `IANA Timezone`, `UTC Offset`, `Resolved Absolute Instant`, `Clock Trust and Event Sequence Provenance`); **Central Event Sequence** scoped to deterministic ordering on clock trust loss. Physical SQL representation in `§8.3 #1`. |
| **`CONTRADICTION-05`** | Missing SLA Config Fail Closed | **`RECONCILED`** | Zero silent defaults; cycle/step creation blocked without active policy SLA & calendar. Key schema/bounds in `§8.3 #2`; `OP-01` values in `§8.4`. |
| **`GAP-02`** | `HR Manager` Conflicted Reassignment | **`RESOLVED` (`Decision C`)** | Fail closed (`PENDING` + operational escalation); zero implied fallback; separate from `#41c`. |
| **`GAP-03`** | Multi-Cycle Approval Model | **`RESOLVED` (Arch `Decision D`) / Pre-DDL (`§8.3 #3`)** | Linked immutable cycles mandatory; exact FK/column/index DDL in Pre-DDL technical design (`§8.3 #3`). |
| **`GAP-04` / `AUD-01`** | Raw `ISS-06 #1–#171` Missing Ledger | **`DISPOSED` (`OD-A4` + Corr. `E`)** | **`OD-A4`:** `G001–G107` accepted as canonical Gate A baseline; `109` Batch controls preserved; `0/171` raw independently verifiable disclosed; zero fabrication. |
| **`OPEN-SLA-EXT`** | `HR Manager` SLA Extension Fallback | **`RESOLVED` (`OD-A1`)** | **`OD-A1` (Fail Closed):** Deny extension, retain step `PENDING` with original deadline unchanged, operational escalation; zero fallback to `Factory Mgr`/`Owner Exec`/delegates/`SysAdmin`; separate from `#41c`. |
| **`ISS-07 / NUANCE-B`** | Self-Edit Career Lock & `users:roles` Handoff | **`POLICY RESOLVED` (`OD-A2`) / Pre-DDL (`§8.3 #5`)** | `OD-A2` locks 8 fields; HR requests & `SysAdmin` executes `'Department User'` via `PUT /api/users/:id/roles`; remaining `#2`/`#4` & enforcement mechanics in `§8.3 #5`. |
| **`OPEN-NUANCE-C`** | Endpoint `#24` `hr:self` Shorthand | **`RESOLVED` (`OD-A3` + Corr. `B`)** | `#24a` (`GET /api/hr/shifts*`) uses `hr:self:attendance:view` + identity & ownership checks; `#24b` (`POST`/`PUT`) retains `hr:shifts:manage`. |
| **`NUANCE-A`** | Active `PENDING` `approval_steps.due_at` | **`ARCH RECONCILED` / Pre-DDL (`§8.3 #1`)** | Snapshot-at-step-creation & fail-closed SLA rules preserved; physical SQL representation & enforcement DDL in `§8.3 #1` (not reopened as Owner Decision). |
| **`LABEL-AMB-01`** | `U-03`/`U-04` Option Letter Drift | **`DISCLOSED & PRESERVED`** | `Paste §3` (`Option B`) vs `v1.0` (`OD-03 Option A` / unlabeled `U-04`); approved semantics 100% identical. |

---

## 6. Complete `ISS-06` Traceability Report (`Raw #1–#171` & `Grouped G001–G107`)

### 6.1 Raw `#1`–`#171` Mapping Limitation & `OD-A4` Owner Acceptance (Correction `E`)
- **Verified Fact (`0 / 171` Independently Verifiable):** Neither the repository nor any specification document (`v0.6`, `v1.0`, `Paste_November_17__2026_-_1_09PM_1c3d6963`) contains the original raw numbered list `#1`–`#171` (individual decision IDs, pre-consolidation titles, or `Option A/B/...` labels). All `171` raw decisions `#1`–`#171` remain **`0 / 171` independently verifiable (`171 / 171 UNMAPPED`)**.
- **Authoritative Pointer (`AUD-02`):** The full `171`-row enumerated `UNMAPPED` raw slot ledger resides unaltered at `/.aistudio/artifacts/brain/f1c889e7-f83c-4612-b6df-e6c812aa338f/GFMSv0.3_HR_GATE_A_RECONCILIATION_AND_TRACEABILITY_REPORT_v1.1.md §2.2` (`lines 78–264`).
- **Approved Traceability Baseline (`OD-A4`):** The System Owner explicitly **accepted the `107` grouped principles (`ISS-06-G001`–`G107`) as the canonical consolidated Gate A `ISS-06` baseline**, preserved the `109` approved Batch `1–6` controls, mandated explicit `0/171` raw-mapping disclosure, and prohibited fabricated mappings or 1:1 claims.

### 6.2 Grouped `ISS-06` Group Summary (`v2.1` — Correction `A` & `OD-A1` Verified)
| Group (`Paste`) | Principle IDs | Count | `v1.2.1` Status | `v2.1` Status (`OD-A1` + Corr. `A`) | Exact `PARTIAL` IDs & Remaining Pre-DDL / `OP-01` / Deferred Dependencies |
|---|---|---|---|---|---|
| **`4.1` SLA & Business Calendar** | `G001`–`G019` | `19` | `13 FULL · 6 PARTIAL` | **`13 FULL · 6 PARTIAL · 0 CONFLICTING`** | **`6 PARTIAL`: `G001, G003, G004, G007, G008, G012`** *(Correction `A`: **`G005` & `G009` are `FULL`**; reflects Pre-DDL `§8.3 #1–#2` & `OP-01` `§8.4`).* |
| `4.2` SLA Extensions | `G020`–`G029` | `10` | `6 FULL · 4 PARTIAL` | **`9 FULL · 1 PARTIAL · 0 CONFLICTING`** | **`1 PARTIAL`: `G025`** (`§8.3 #2` / `§8.4` calendar); `OD-A1` upgraded `G026, G027, G029` -> `FULL`. |
| `4.3` Governance Fallback Cancel | `G030`–`G042` | `13` | `10 FULL · 3 PARTIAL` | **`10 FULL · 3 PARTIAL · 0 CONFLICTING`** | **`3 PARTIAL`: `G035, G037, G039`** (Pre-DDL retry/evidence schema & `OP-01` review SOP). |
| `4.4` Expiry & Late Decisions | `G043`–`G056` | `14` | `12 FULL · 2 PARTIAL` | **`12 FULL · 2 PARTIAL · 0 CONFLICTING`** | **`2 PARTIAL`: `G049, G050`** (`§8.3 #1–#2` 5-part SQL/calendar & scheduler design; `G043–G048` step-state separation verified per Corr. `C`). |
| `4.5` Reassignment & Notifications | `G057`–`G069` | `13` | `11 FULL · 2 PARTIAL` | **`11 FULL · 2 PARTIAL · 0 CONFLICTING`** | **`2 PARTIAL`: `G065, G066`** (`§8.3 #4` outbox retry config & DLQ schema/UI). |
| `4.6` Escalation | `G070`–`G082` | `13` | `8 FULL · 5 PARTIAL` | **`8 FULL · 5 PARTIAL · 0 CONFLICTING`** | **`5 PARTIAL`: `G070, G072, G073, G075, G081`** (Pre-DDL scheduler, policy escalation rules, reminder limits, `Decision D` DDL). |
| `4.7` Reopening Approval Cycles | `G083`–`G100` | `18` | `11 FULL · 7 PARTIAL` | **`11 FULL · 7 PARTIAL · 0 CONFLICTING`** | **`7 PARTIAL`: `G085, G090, G091, G095, G096, G099, G100`** (`Decision D` DDL, policy reopen rules, alert config, `Gate B` `FOR UPDATE`). |
| `4.8` Policy Versioning | `G101`–`G107` | `7` | `5 FULL · 2 PARTIAL` | **`5 FULL · 2 PARTIAL · 0 CONFLICTING`** | **`2 PARTIAL`: `G101, G106`** (Pre-DDL policy version table & `OP-01` alert SOP). |
| **Total Canonical (`OD-A4`)** | **`ISS-06-G001`–`G107`** | **`107`** | `76 FULL · 31 PARTIAL` | **`79 FULL · 28 PARTIAL · 0 CONFLICTING · 0 MISSING`** | **`13+9+10+12+11+8+11+5 = 79 FULL` · `6+1+3+2+2+5+7+2 = 28 PARTIAL` (`100%` match w/ `§6.3`).** |

### 6.3 Complete `107`-Row `ISS-06` Grouped Principle Coverage Matrix (`ISS-06-G001` – `ISS-06-G107`)
*(Preserved in full from `v1.1_CANDIDATE §7.1` [`l.192–334`] and aligned with `OD-A1`, `Decision B/C/D`, `CONTRADICTION-03–05`, and Corrections `A`, `C`, `D`, `F`.)*

Classification Codes: **`ARCH`** = HR Gate A Architectural · **`PRE-DDL`** = Pre-DDL / Pre-Impl Technical Design (`§8.3`) · **`OPS`** = Operational Readiness (`OP-01` `§8.4`) · **`GATE-B`** = Live PG Verification (`§8.5`) · **`DEFER`** = Deferred Later-Phase Work (`§8.6`).

#### Group 4.1 — Approval SLA & Business Calendar (`ISS-06-G001` – `ISS-06-G019` — `13 FULL · 6 PARTIAL: G001, G003, G004, G007, G008, G012`)
| ID | Decision Principle Title | Approved Choice | `v2.1` Location | Class | Coverage Status & Remaining Section `8` Dependency |
|---|---|---|---|---|---|
| `ISS-06-G001` | Step-creation SLA calculation & snapshot | Calculate & snapshot SLA at step creation | `§3.5`, `§3.7` | `PRE-DDL` | **`PARTIAL`** — Concrete SLA key schema (`§8.3 #2`) |
| `ISS-06-G002` | Config change forward-only scope | Later SLA changes affect new steps only | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G003` | Business-hours SLA unit | Measure SLA in approved business hours, not calendar hours | `§3.5` | `OPS` | **`PARTIAL`** — Factory calendar & hours config (`§8.3 #2`, `§8.4`) |
| `ISS-06-G004` | Centralized versioned factory calendar | Versioned calendar governs workdays, hours, breaks, holidays | `§3.5` | `PRE-DDL` / `OPS` | **`PARTIAL`** — Calendar DDL (`§8.3 #2`) & `OP-01` values (`§8.4`) |
| **`ISS-06-G005`** | **Step retains calendar version** | Persist calendar version on every approval step | `§3.5` | `ARCH` | **`FULL`** *(Arch snapshot contract approved; physical DDL `§8.3 #2`)* |
| `ISS-06-G006` | Calendar edits preserve existing deadlines | Calendar updates do not recalculate existing deadlines | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G007` | Active `PENDING` step deadline required | Active `PENDING` steps must hold a valid `due_at` deadline | `§3.4.3`, `§3.5` | `PRE-DDL` | **`PARTIAL`** — Physical `due_at` & 5-part SQL DDL (`§8.3 #1`) |
| `ISS-06-G008` | Fail-closed on missing/invalid SLA config | Block new cycle/step creation if policy SLA invalid/missing | `§3.4.3`, `§3.5` | `PRE-DDL` | **`PARTIAL`** — Policy SLA key schema (`§8.3 #2`) |
| **`ISS-06-G009`** | **Positive decimal SLA hours** | SLA values must be positive decimal business hours | `§3.5` | `ARCH` | **`FULL`** *(Architectural validation rule approved)* |
| `ISS-06-G010` | Two-decimal precision cap | SLA decimal precision limited to 2 decimal places | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G011` | Exact conversion to seconds | Exact decimal-to-seconds conversion without silent rounding | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G012` | Per-policy min/max SLA bounds | Each policy defines explicit min and max SLA bounds | `§3.5` | `PRE-DDL` / `OPS` | **`PARTIAL`** — Programmatic bounds (`§8.3 #2`) & `OP-01` values (`§8.4`) |
| `ISS-06-G013` | `System Administrator` SLA config management | `SysAdmin` exclusively manages SLA config (`hr:sla:manage`; zero extension rights) | `§3.1.2`, `§3.2`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by `Decision B` & Correction `D`; Seed `008` in `§8.3 #6`)* |
| `ISS-06-G014` | `HR Manager` read-only SLA config access | `HR Manager` holds strictly read-only SLA config access (`hr:sla:view`) | `§3.1.2`, `§3.2`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by `Decision B` & Correction `D`; Seed `008` in `§8.3 #6`)* |
| `ISS-06-G015` | Published SLA versions immutable | SLA configuration versions immutable once published | `§3.5` | `ARCH` | **`FULL`** *(Physical DDL `§8.3 #2`)* |
| `ISS-06-G016` | Scheduled version activation | New SLA versions activate at scheduled effective timestamps | `§3.4.2`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G017` | No overlapping SLA versions | Overlapping effective SLA versions prohibited | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G018` | Forward-only withdrawal + replacement | Withdrawal forward-only and requires valid replacement | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G019` | Existing steps retain SLA snapshot | Existing approval steps retain original SLA snapshots | `§3.5` | `ARCH` | **`FULL`** |

#### Group 4.2 — SLA Extensions (`ISS-06-G020` – `ISS-06-G029` — `9 FULL · 1 PARTIAL: G025`, `OD-A1` + Correction `D`)
| ID | Decision Principle Title | Approved Choice | `v2.1` Location | Class | Coverage Status & Remaining Section `8` Dependency |
|---|---|---|---|---|---|
| `ISS-06-G020` | Formal extension action | Extension requires formal explicit workflow action | `§3.5` | `ARCH` | **`FULL`** *(Endpoint/DDL & proposed guard `§8.3 #4`)* |
| `ISS-06-G021` | Mandatory reason & audit evidence | Extension mandates reason and immutable audit evidence | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G022` | One extension per step limit | Maximum 1 SLA extension allowed per approval step | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G023` | Pre-deadline extension window | Extension permitted only before original deadline | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G024` | Max extension duration cap | Extension duration `<=` original SLA duration | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G025` | Business-hours extension unit | Extension measured in approved business hours | `§3.5` | `PRE-DDL` / `OPS` | **`PARTIAL`** — Factory calendar DDL (`§8.3 #2`) & `OP-01` (`§8.4`) |
| `ISS-06-G026` | `HR Manager` primary extension authority | Separate ordinary workflow auth; conflicted/ineligible fails closed (`OD-A1`, Corr. `D`) | `§3.1.1`, `§3.2`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by **`OD-A1`** + Correction `D`)* |
| `ISS-06-G027` | `HR Manager` extension self-conflict ban | `HR Manager` barred on own request/subject/step; conflicted fails closed (`OD-A1`) | `§3.1.1`, `§3.2`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by **`OD-A1`**)* |
| `ISS-06-G028` | `System Administrator` extension exclusion | `SysAdmin` receives zero extension authority (even with `hr:sla:manage`) | `§3.1.1`, `§3.2`, `§3.5` | `ARCH` | **`FULL`** *(Reinforced by Correction `D`)* |
| `ISS-06-G029` | Single-actor ordinary extension | Non-conflicted extension single-actor; conflicted fails closed without fallback (`OD-A1`) | `§3.1.1`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by **`OD-A1`**)* |

#### Group 4.3 — Governance Fallback Cancellation (`ISS-06-G030` – `ISS-06-G042` — `10 FULL · 3 PARTIAL: G035, G037, G039`)
| ID | Decision Principle Title | Approved Choice | `v2.1` Location | Class | Coverage Status & Remaining Section `8` Dependency |
|---|---|---|---|---|---|
| `ISS-06-G030` | SLA expiry alone insufficient | SLA expiry alone cannot trigger `#41c` | `§3.1.3`, `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G031` | Verified `0` eligible approver/delegate pool | Verify `0` eligible active approvers and active delegates exist | `§3.1.3`, `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G032` | Just-in-time eligibility recheck | Recheck eligibility immediately before cancellation | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G033` | Atomic eligibility check + cancellation | Execute check and cancellation inside one atomic TX | `§3.5` | `ARCH` | **`FULL`** *(Gate B PG TX verification `§8.5`)* |
| `ISS-06-G034` | Concurrency locking on step & eligibility | Lock step and eligibility-affecting state against races | `§3.5` | `ARCH` | **`FULL`** *(Gate B `FOR UPDATE` `§8.5`)* |
| `ISS-06-G035` | Bounded retry with recheck | Retry bounded and re-evaluates eligibility every attempt | `§3.5` | `PRE-DDL` | **`PARTIAL`** — Exact retry bound (`§8.3 #4`) |
| `ISS-06-G036` | Abort on retry exhaustion | If retries fail, cancellation does not occur | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G037` | Operational review on failed cancel | Failed cancel triggers operational review | `§3.5` | `OPS` | **`PARTIAL`** — Review SOP (`§8.4`) |
| `ISS-06-G038` | `HR Manager` primary fallback actor | `HR Manager` is primary `#41c` actor (non-subject) | `§3.2`, `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G039` | `Factory Manager` objective exception | `Factory Manager` only on verifiable objective `HR Mgr` ineligibility | `§3.2`, `§3.3`, `§3.5` | `PRE-DDL` | **`PARTIAL`** — Objective evidence schema (`§8.3 #4`) |
| `ISS-06-G040` | Delegates barred from fallback cancel | Delegates cannot execute `#41c` | `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G041` | `SysAdmin` & requester exclusion | `SysAdmin` and requester excluded from `#41c` | `§3.2`, `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G042` | Escalate if both managers ineligible | Remains pending & escalates for operational resolution | `§3.5` | `ARCH` | **`FULL`** |

#### Group 4.4 — Approval Expiry & Late Decisions (`ISS-06-G043` – `ISS-06-G056` — `12 FULL · 2 PARTIAL: G049, G050`)
| ID | Decision Principle Title | Approved Choice | `v2.1` Location | Class | Coverage Status & Remaining Section `8` Dependency |
|---|---|---|---|---|---|
| `ISS-06-G043` | Expired step stays `PENDING` | Persisted step status stays `PENDING` past SLA deadline (no ambiguous `EXPIRED` step state — Corr. `C`) | `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G044` | Dynamic overdue calculation | Overdue derived dynamically from trusted Resolved Instant vs deadline | `§3.4.2`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G045` | Expiry escalates without revoking rights | Expiry triggers escalation, not approval revocation | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G046` | Post-expiry decision authority retained | Eligible approvers/delegates keep decision authority (`200` on `#41b`) | `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G047` | Normal processing of late decisions | Late decisions proceed normally | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G048` | Late decision marking & audit | Mark and audit late decisions explicitly | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G049` | Record timestamp & business lateness | Persist decision timestamp (5-part) and business-time lateness | `§3.4.2`, `§3.5` | `PRE-DDL` / `OPS` | **`PARTIAL`** — 5-part SQL DDL (`§8.3 #1`) & calendar (`§8.4`) |
| `ISS-06-G050` | Decision stops future escalations | Successful decision halts future escalation tasks/alerts | `§3.5` | `PRE-DDL` | **`PARTIAL`** — Outbox/scheduler design (`§8.3 #4`) |
| `ISS-06-G051` | Reassignment keeps original deadline | Reassignment preserves original deadline | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G052` | Reassignment preserves overdue state | Reassignment preserves overdue state | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G053` | `HR Manager` exclusive reassignment | Only `HR Manager` may reassign (COI-checked); conflicted fails closed (`Decision C`) | `§3.1.2`, `§3.2`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by `Decision C`)* |
| `ISS-06-G054` | Live target eligibility validation | Reassignment target must pass live eligibility validation | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G055` | Fail-closed when no eligible target | Fail closed & stay `PENDING` if no eligible target exists | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G056` | Unlimited audited reassignment | Repeated reassignment permitted with immutable audit | `§3.5` | `ARCH` | **`FULL`** |

#### Group 4.5 — Reassignment & Outbox Notifications (`ISS-06-G057` – `ISS-06-G069` — `11 FULL · 2 PARTIAL: G065, G066`)
| ID | Decision Principle Title | Approved Choice | `v2.1` Location | Class | Coverage Status & Remaining Section `8` Dependency |
|---|---|---|---|---|---|
| `ISS-06-G057` | Reassignment audit fields | Record previous/new approver, actor, reason, timestamp | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G058` | Immediate prior approver revocation | Revoke prior approver immediately (`404` on `#41b`) | `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G059` | Notify previous approver of revocation | Notify revoked approver | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G060` | Notify new approver with deadline/overdue | Notify new approver including original deadline & overdue state | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G061` | Notify `HR Manager` on reassignment | Notify `HR Manager` of reassignment | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G062` | Transactional outbox pattern | Notifications use transactional outbox | `§3.4.1`, `§3.5` | `ARCH` | **`FULL`** *(Outbox DDL `§8.3 #4`)* |
| `ISS-06-G063` | Atomic reassignment + outbox insert | Single TX writes reassignment and outbox record | `§3.4.1`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G064` | Notification failure non-blocking | Post-commit delivery failure retries -> DLQ without rollback (distinct from fail-closed audit) | `§3.4.1`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by `CONTRADICTION-03`)* |
| `ISS-06-G065` | Bounded exponential backoff retries | Retries use configurable exponential backoff | `§3.4.1`, `§3.5` | `PRE-DDL` | **`PARTIAL`** — Retry config structure (`§8.3 #4`) |
| `ISS-06-G066` | Dead Letter queue on exhausted retries | Exhausted retries move messages to Dead Letter | `§3.4.1`, `§3.5` | `PRE-DDL` | **`PARTIAL`** — DLQ schema/UI (`§8.3 #4`) |
| `ISS-06-G067` | `SysAdmin` audited manual DLQ replay | `SysAdmin` replays DLQ post-fix (audited, transport-only) | `§3.2`, `§3.4.1`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G068` | Replay grants zero HR/approval rights | Replay gives zero HR content or approval authority | `§3.2`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G069` | Delivery != human read proof | Delivery success = transport acceptance only | `§3.5` | `ARCH` | **`FULL`** |

#### Group 4.6 — Escalation (`ISS-06-G070` – `ISS-06-G082` — `8 FULL · 5 PARTIAL: G070, G072, G073, G075, G081`)
| ID | Decision Principle Title | Approved Choice | `v2.1` Location | Class | Coverage Status & Remaining Section `8` Dependency |
|---|---|---|---|---|---|
| `ISS-06-G070` | Immediate escalation at SLA expiry | Escalate immediately upon SLA expiry | `§3.5` | `PRE-DDL` | **`PARTIAL`** — Escalation scheduler (`§8.3 #4`) |
| `ISS-06-G071` | Baseline escalation recipients | Current eligible approver + `HR Manager` are baseline | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G072` | Policy-specific extra recipients | Extra recipients driven by policy escalation rules | `§3.5` | `PRE-DDL` | **`PARTIAL`** — Per-policy escalation rules (`§8.3 #4`) |
| `ISS-06-G073` | Conditional `Factory Manager` escalation | `Factory Manager` included only under explicit policy conditions | `§3.2`, `§3.5` | `PRE-DDL` | **`PARTIAL`** — Explicit policy conditions (`§8.3 #4`) |
| `ISS-06-G074` | Escalation grants zero extra authority | Escalation confers zero approval/reassign/cancel/data rights | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G075` | Configurable recurring reminders | Recurring reminders use policy intervals & attempt caps | `§3.5` | `PRE-DDL` / `OPS` | **`PARTIAL`** — Interval/limit schema & config (`§8.3 #4`, `§8.4`) |
| `ISS-06-G076` | Minimal metadata + secure context link | Send minimal metadata and secure `#41b` context link only | `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G077` | Strict PII redaction in escalation notices | Zero employee names, salary, contracts, sensitive reasons | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G078` | No mandatory acknowledgement | Escalation acknowledgement optional | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G079` | Ack does not alter SLA/authority | Acknowledgement leaves SLA & approval rights unchanged | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G080` | Terminal states close escalations | Valid terminal state halts future escalation tasks | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G081` | Reopen starts new cycle + SLA snapshot | Reopening creates new cycle with fresh SLA snapshot | `§3.1.2`, `§3.5` | `PRE-DDL` | **`PARTIAL`** — `Decision D` multi-cycle DDL (`§8.3 #3`) |
| `ISS-06-G082` | Prior cycles remain immutable | Past cycles, deadlines, decisions, audits remain immutable | `§3.1.2`, `§3.5` | `ARCH` | **`FULL`** *(Arch rule `Decision D` approved; DDL `§8.3 #3`)* |

#### Group 4.7 — Reopening Approval Cycles (`ISS-06-G083` – `ISS-06-G100` — `11 FULL · 7 PARTIAL: G085, G090, G091, G095, G096, G099, G100`)
| ID | Decision Principle Title | Approved Choice | `v2.1` Location | Class | Coverage Status & Remaining Section `8` Dependency |
|---|---|---|---|---|---|
| `ISS-06-G083` | `HR Manager` controls reopening | `HR Manager` is primary reopening authority | `§3.2`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G084` | Mandatory reopening reason | Reopening requires mandatory reason | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G085` | Policy/type eligibility required | Request type & policy must allow reopening | `§3.5` | `PRE-DDL` | **`PARTIAL`** — Per-policy reopen flags (`§8.3 #3–#4`) |
| `ISS-06-G086` | `HR Manager` reopening COI check | `HR Manager` must pass COI checks | `§3.2`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G087` | `Factory Manager` objective exception | `Factory Manager` only on documented objective HR Mgr ineligibility | `§3.2`, `§3.5` | `ARCH` | **`FULL`** *(Objective evidence schema `§8.3 #4`)* |
| `ISS-06-G088` | `Factory Manager` live validation | `Factory Manager` must pass live eligibility validation | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G089` | Fail closed when both ineligible | Deny reopening; stay in prior terminal state | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G090` | Linked cycle chain | Each reopening creates linked cycle (`Decision D`) | `§3.1.2`, `§3.5` | `PRE-DDL` | **`PARTIAL`** — `Decision D` FK/index DDL (`§8.3 #3`) |
| `ISS-06-G091` | Live policy/SLA/calendar snapshots | New cycle snapshots currently effective policy, SLA, calendar | `§3.5` | `PRE-DDL` | **`PARTIAL`** — SLA/calendar DDL (`§8.3 #2`) |
| `ISS-06-G092` | Cycle-level policy version immutability | Policy versions immutable per cycle | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G093` | Retired policy scope | Retired policies block new cycles only; open cycles finish | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G094` | Forward-only policy replacement | Replacement policies apply forward-only | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G095` | Policy-gated reopening count | Unlimited only where policy allows; full governance every cycle | `§3.5` | `PRE-DDL` | **`PARTIAL`** — Per-policy reopen rules (`§8.3 #3–#4`) |
| `ISS-06-G096` | Anomaly alert on repeated reopenings | Alert on repeated reopenings without blocking valid ones | `§3.5` | `PRE-DDL` / `OPS` | **`PARTIAL`** — Alert threshold schema/config (`§8.3 #4`, `§8.4`) |
| `ISS-06-G097` | No direct cancellation bypass on reopen | Reopened cycle follows normal cancel rules only | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G098` | Atomic cycle + audit + outbox TX | Cycle creation, audit, and outbox occur atomically | `§3.4.1`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G099` | Idempotency & DB uniqueness | Idempotency key & DB uniqueness prevent duplicate cycles | `§3.5` | `PRE-DDL` / `GATE-B` | **`PARTIAL`** — Multi-cycle unique DDL (`§8.3 #3`) & `Gate B` (`§8.5`) |
| `ISS-06-G100` | Row locks & state revalidation | Protect concurrent reopens via `FOR UPDATE` + state check | `§3.5` | `GATE-B` | **`PARTIAL`** — `Gate B` live PG locking (`§8.5`) |

#### Group 4.8 — Policy Versioning (`ISS-06-G101` – `ISS-06-G107` — `5 FULL · 2 PARTIAL: G101, G106`)
| ID | Decision Principle Title | Approved Choice | `v2.1` Location | Class | Coverage Status & Remaining Section `8` Dependency |
|---|---|---|---|---|---|
| `ISS-06-G101` | Immutable cycle policy version | Every cycle retains immutable policy version | `§3.5` | `PRE-DDL` | **`PARTIAL`** — Policy version table DDL (`§8.3 #3`) |
| `ISS-06-G102` | Retirement blocks new cycles only | Retired version blocks new cycles | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G103` | Existing cycles finish on original version | Open cycles continue under original policy version | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G104` | Forward-only replacement activation | Replacement version activates forward-only | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G105` | Resolution at cycle creation | Resolve active policy version at cycle creation | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G106` | Fail-closed + alert if unmapped policy | Fail closed + operational alert when no valid policy mapped | `§3.5` | `OPS` | **`PARTIAL`** — Alert SOP (`§8.4`) |
| `ISS-06-G107` | No silent policy migration | Silent migration between policy versions prohibited | `§3.5` | `ARCH` | **`FULL`** |

---

## 7. Six-Batch Approved Control Traceability (`Batch 1` – `Batch 6`: `109` Controls Preserved — Correction `E`)

### 7.1 Six-Batch Summary Matrix
| Batch | Approved Batch Controls (`109` Total) | `v2.1_CANDIDATE` Section(s) | Status & Reconciliation Notes |
|---|---|---|---|
| **Batch 1 – Clock Integrity & Time Trust** | `16` (`B1-01`–`B1-16`) | `§3.4.2`, `§4`, `§6`, `§7`, `§8.3 #1–#2`, `§8.4`, `§8.6` | **`FULL` (Architectural Principles).** `CONTRADICTION-04` standardizes the **five-part conceptual time-and-trust representation**, with **Central Event Sequence** providing deterministic ordering on clock trust loss; physical SQL (`§8.3`), factory tz/calendar (`§8.4`), & drift/NTP SOPs (`§8.6`). |
| **Batch 2 – Emergency Journal & Cryptographic Recovery** | `22` (`B2-01`–`B2-22`) | `§3.4.1`, `§4`, `§6`, `§7`, `§9.3` | **`FULL` (Architectural Principles).** `CONTRADICTION-03` preserves dual-persistence fail closed & non-conflation with notification delivery; binary format/crypto/DPAPI (`§8.6`) & custodian drills (`§8.4`). |
| **Batch 3 – Evidence Repository & Destruction Registry** | `17` (`B3-01`–`B3-17`) | `§2`, `§4`, `§6`, `§7`, `§8.6` | **`FULL` (Architectural Principles).** Step 7B binary evidence & external purge remain explicitly out of Phase 08A (`§8.6`). |
| **Batch 4 – Governance & Custodian Independence** | `21` (`B4-01`–`B4-21`) | `§3.2`, `§4`, `§6`, `§7`, `§9.3` | **`FULL` (Architectural Principles).** Reinforced by `Decision B`, `Decision C`, `OD-A1`, `OD-A2`, Correction `D`; Charter ratios (`§8.6`) & appointments (`§8.4`). |
| **Batch 5 – Legal Disclosure & Incident Management** | `28` (`B5-01`–`B5-28`) | `§5`, `§6`, `§7`, `§8.6` | **`FULL` (Independent Legal/Incident Principles).** Kept isolated as independent legal/compliance procedures; jurisdiction SOPs/channels (`§8.6`). |
| **Batch 6 – Residual Risk & Recovery Controls** | `5` (`B6-01`–`B6-05`) | `§3.4.3`, `§4`, `§7`, `§8.4`, `§9` | **`FULL` (5 Approved Principles).** Unified Fail-Closed, Scoped Suspension, Recovery Beyond Files, Residual Risk states, Operational Readiness separation from Gate A & Gate B. |

### 7.2 Grouped Control-Range Traceability Table (`B1-01`–`B6-05` Across `109` Batch Controls — Correction `E`)
> **Level-of-Traceability Statement (Correction `E`):** The source corpus (`Paste §5–§10` `l.286–519`, `v1.1_CANDIDATE §4–§5`, `REPORT_v1.1 §3.2` `l.297–306`) tracks these `109` approved Batch `1–6` controls at the **grouped control-range level** (`B1-01..03`, `B2-01..04`, etc., with `B6-01`–`B6-05` itemized individually). Accordingly, this table preserves **verified grouped control-range mappings across all `109` controls** without misrepresenting those 6 grouped rows as 109 separate row-by-row source table entries.

| Batch & Total Count | Verified Grouped Control-Range Mapping (`Paste` / `REPORT_v1.1 §3.2` -> `v2.1_CANDIDATE`) | Traceability Level & Status | Remaining `§8` Dependencies |
|---|---|---|---|
| **Batch 1 (`16` controls: `B1-01`–`B1-16`)** | `B1-01..03` (**Five-part conceptual time-and-trust model**: `Factory Local Time` + `IANA Timezone` + `UTC Offset` + `Resolved Absolute Instant` + `Clock Trust & Event Sequence Provenance` -> `§3.4.2`, `§4`), `B1-04..05` (`Central Event Sequence` deterministic ordering on clock trust loss + `tzdb` deadline immutability -> `§3.4.2`, `§4`), `B1-06..10` (configurable/versioned NTP & drift thresholds, bounded offline window -> `§4`), `B1-11..14` (post-recovery sync/drift/stability validation; untrusted observation w/ unique event ID never relabeled + separate trusted recovery evidence -> `§3.4.2`, `§4`), `B1-15..16` (durable sequence survival + fail-closed on persistence failure -> `§4`). | **`FULL` (`16` controls preserved via 5 grouped ranges)** | Physical SQL (`§8.3 #1`); factory tz/calendar (`§8.4`); drift/NTP SOPs (`§8.6`). |
| **Batch 2 (`22` controls: `B2-01`–`B2-22`)** | `B2-01..04, 21..22` (independent durable sequence outside primary PG, append-before-persisted, append-only + hash chaining, **dual persistence failure = fail closed** -> `§3.4.1`, `§4`), `B2-05..15` (key isolation, minimal payload/references, DPAPI/Cert Store post-design, dedicated service identity, `SysAdmin` barred from content, versioned forward-only rotation, retired key preservation, compromise containment + offline encrypted key backup -> `§3.2`, `§4`), `B2-16..20` (2-person recovery, quarterly isolated drills where failure = Critical Incident, Audit/Security Custodian read + audited/redacted/encrypted export -> `§4`, `§9.3`). | **`FULL` (`22` controls preserved via 3 grouped ranges)** | Journal binary/`fsync`/crypto SOPs (`§8.6`); custodian staffing & drills (`§8.4`). |
| **Batch 3 (`17` controls: `B3-01`–`B3-17`)** | `B3-01..04` (separate Destruction Registry, immutable event lifecycle, independent storage/backup -> `§4`), `B3-05..08` (atomic concurrency-protected JIT hold/incident/preservation validation across primary/replicas/quarantined unexpired backups -> `§4`), `B3-09..14` (Registry-first DR + reapplied destructions + Audit/Security Custodian approval; corruption/missing sequence/conflicts block destruction -> `§4`), `B3-15..17` (residual uncertainty documented + expiry auto-suspends destruction + **Phase 08A non-authorization of binary storage/external purge** -> `§2`, `§4`). | **`FULL` (`17` controls preserved via 4 grouped ranges)** | Step 7B binary evidence storage & external purge (`§8.6`). |
| **Batch 4 (`21` controls: `B4-01`–`B4-21`)** | `B4-01..08` (structural independence from `SysAdmin`/`Factory Mgr`, Audit/Security/Gov split, live COI/eligibility, pre-appointed primary + alternate custodians, dual-person where 1 person != both Audit & Security, suspension on COI, immutable appointment log -> `§3.2`, `§4`), `B4-09..15, 21` (formal Governance Charter, quorum/majority, COI exclusion, alternates, **zero emergency quorum bypass** -> `§4`), `B4-16..20` (cryptographically verifiable append-only gov records, `Factory Mgr` summaries only, `SysAdmin` zero auto access, exception purpose-limited auth -> `§3.2`, `§4`). | **`FULL` (`21` controls preserved via 3 grouped ranges)** | Charter ratios/cadence (`§8.6`); custodian/alternate staffing (`§8.4`). |
| **Batch 5 (`28` controls: `B5-01`–`B5-28`)** | `B5-01..07, 22..25` (legal authority/jurisdiction/scope validation, data minimization, originals kept, Legal + Audit Custodian + 2nd independent verifier, JIT recipient/channel check, scope change re-review, automated + human redaction, Legal Holds controlling, reject/log invalid -> `§5`), `B5-08..14, 28` (manifests/hashes, 6 delivery states, anti-resend, transport vs human ack, post-delivery/onward, closure, chain of custody -> `§5`), `B5-15..21, 26..27` (linked workflows, containment/hold suspension, dual hold release, RCA/reopen, legal notices, unauthorized disclosure = Critical Incident, disclosure during incident = legal exception + dual control -> `§5`). | **`FULL` (`28` controls preserved via 3 grouped ranges)** | Jurisdiction SOPs, reviewer IDs, approved channels (`§8.6`). |
| **Batch 6 (`5` controls: `B6-01`–`B6-05`)** | `B6-01` Unified Fail-Closed Policy (`§4`), `B6-02` Scoped Suspension (`§4`), `B6-03` Recovery Validation Beyond File Restore (`§4`), `B6-04` Residual Risk Governance (`§4`), `B6-05` Operational Readiness Separation (`§4`, `§9.3`). | **`FULL` (`5` individually listed controls)** | Operational SOPs/custodians (`§8.4`); Live PostgreSQL 14+ verification (`§8.5`). |

---

## 8. Separated Outstanding Items & Blocker Classification (`v2.1` Correction `F`)

All remaining open items are explicitly separated into the six governance categories below so Pre-DDL details, `OP-01` configuration values, Gate B verification, and deferred later phases are never conflated with Gate A approval blockers:

1. **Remaining Owner Decisions (`0` Open Architecture Conflicts):** All escalated policy decisions (`OD-A1`–`OD-A4`, `Decision A`–`D`, `U-01`–`U-07`, `OD-01`–`OD-03`) are **`APPROVED`**. Only **Formal Final Gate A Ratification Sign-Off** (once `#41b` DTO schemas below are confirmed) remains.
2. **Gate A Architectural / Design Closure Items:**
   - **`#1` — `ISS-02 #41b` Policy-Specific Redacted DTO Schemas & Types (`OPEN`):** Exact field names, data types, and nullability per policy (`#4`, `#6`, `#8`, `#9`, plus `#1`–`#3`, `#5`) under `Decision A` (`404`), Correction `C` state separation, and strict free-text/PII exclusion (`#16d` `403` preserved per `AUD-05`).
   - **`#2` — Legacy `v0.6` `'EXPIRED'` Request-State Alignment & Formal Ratification:** Confirm alignment of `v0.6 §3.3 #5` `'EXPIRED'` check wording under Correction `C` and record formal System Owner Gate A ratification of `v2.1` + `HR-DEC-01`–`14`.
3. **Pre-DDL / Pre-Implementation Technical Design Items *(Out of Owner Policy Scope / Required Prior to SQL or Code)*:**
   - `due_at` physical SQL DDL + **five-part conceptual time-and-trust representation** linkage + `Central Event Sequence` storage (`CONTRADICTION-04`).
   - Policy-specific SLA/Calendar version table/key schema and programmatic min/max validation structures (`CONTRADICTION-05`).
   - Linked immutable multi-cycle `approval_requests` FK/column/uniqueness/index DDL (`Decision D`).
   - `ISS-06` operational workflow endpoints, DDL, and proposed workflow SLA-extension permission/guard mapping (strictly separate from `hr:sla:*` per Correction `D`), step reassignment, transactional outbox, DLQ, and `SysAdmin` transport-only DLQ replay.
   - `ISS-07` remaining `#2` self-bootstrap payload/anti-placeholder validation, `HR Officer` review workflow, HR-to-`SysAdmin` `PUT /api/users/:id/roles` request/audit ticket mechanics, and service/DDL triggers enforcing the `OD-A2` 8-field lock.
   - Future Seed `008` conceptual RBAC seed definitions (`42` Phase 08A keys incl. `hr:sla:manage` / `hr:sla:view`; zero seeds created).
4. **`OP-01` Operational Configuration Values *(Go-Live Readiness — NOT Gate A Blockers)*:** Factory IANA timezone, workdays, working hours, breaks, holidays, actual numeric SLA durations and bounds, human appointments (`HR Manager`, `HR Officer`, `Owner Executive`, primary/alternate `Audit Custodian` & `Security Custodian`, `Governance Authority`), `DEP-HR` `manager_id`, `'admin'` legal onboarding, secondary `'Department User'` assignments, AES-256-GCM / HMAC / Emergency Journal keys & offline backups, quarterly drills, initial leave balances, TLS + host disk encryption, and operational/legal SOPs.
5. **Gate B Live PostgreSQL 14+ Verification *(Engineering Gate — NOT Gate A)*:** Mandatory `GB-01.1`–`GB-01.11` verification against live PostgreSQL 14+ (`driver.kind === 'pg'`) prior to any HR DDL, migrations (`007+`), or seeds (`008+`); `pg-mem` never proves PG compatibility.
6. **Deferred Later-Phase Work *(Out of Phase 08A)*:** Step 7B (Mode B encrypted binary upload/streaming/`PURGE_PENDING -> PURGED` + physical Batch 3 implementation), Executive Compensation Policy `#7b` (`409` dormant) + omitted `initiate_executive`, Batch `1–5` detailed binary/crypto/Charter/legal SOPs, and Phase 11 (`Step 9`).

---

## 9. Strict Read-Only Confirmation & Final Status

- **Repository Modification Check:** **ZERO** application source code, SQL, migrations (`001`–`006`), seeds (`001`–`007`), tests (`runner.ts` `89/89`), package manifests, or `docs/GFMS_DEVELOPMENT_ROADMAP.md` were modified; **ZERO** DB operations, migrations, seeds, or tests executed; **ZERO** permissions or roles created in the system.
- **Prior Documents Preserved Unmodified:** `v0.6`, `v1.0`, `v1.1_CANDIDATE`, `REPORT_v1.1`, `v1.2_CANDIDATE`, `REPORT_v1.2`, `v1.2.1_CANDIDATE`, `REPORT_v1.2.1`, `v2.0_CANDIDATE`, and `REPORT_v2.0` remain 100% unmodified.
- **Remaining Open Contradictions / Ambiguities:** **ZERO** unresolved architectural contradictions (`CONTRADICTION-01`–`05` and `GAP-01`–`04` are all reconciled/disposed; `OPEN-SLA-EXT` and `OPEN-NUANCE-C` are closed); remaining unresolved items are cleanly isolated into `§8.2` Gate A design closures (`#41b` policy-specific DTO field schemas + legacy `v0.6` `'EXPIRED'` request-state wording cleanup + formal final Gate A ratification) and `§8.3–§8.6` pre-DDL, `OP-01`, `Gate B`, and deferred items.
- **Final Governance Status:**
  - **`OD-A1`–`OD-A4`:** **`APPROVED`** *(Does not constitute final HR Gate A ratification)*
  - **HR Gate A:** **`OPEN / NOT APPROVED`** *(Pending final review and formal System Owner ratification)*
  - **Gate B (Live PostgreSQL 14+):** **`NOT VERIFIED / PENDING`**
  - **Operational Readiness (`OP-01`):** **`PENDING`**
  - **HR Implementation:** **`NOT AUTHORIZED`**
