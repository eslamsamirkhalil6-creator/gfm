# GFMSv0.3 – HR Gate A Reconciliation & Traceability Report (v2.0)

**Document ID:** `GFMSv0.3_HR_GATE_A_RECONCILIATION_AND_TRACEABILITY_REPORT_v2.0.md`  
**Companion Addendum:** `/.aistudio/artifacts/brain/f1c889e7-f83c-4612-b6df-e6c812aa338f/GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v2.0_CANDIDATE.md` *(Root copy: `/GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v2.0_CANDIDATE.md`)*  
**Status:** **`DRAFT – FOR OWNER REVIEW (GATE A CONSOLIDATION REPORT)`**  
**Gate A Status:** **`GATE A – OPEN / NOT APPROVED`**  
**Implementation Status:** **`HR IMPLEMENTATION – NOT AUTHORIZED`**  
**Gate B Status (Live PostgreSQL 14+):** **`NOT VERIFIED / PENDING`** *(Container runs `pg-mem v3.0.14`; `pg-mem` never proves PostgreSQL 14+ compatibility.)*  
**Operational Readiness (`OP-01`):** **`PENDING`**  
**Date:** 2026-11-17  

---

## 1. Source Corpus Inventory & Exact Normative Matrix Locations (`AUD-02` & `AUD-03`)

All pre-existing specifications and audit artifacts remain **100% unmodified on disk**. The table below documents exact canonical file locations and where every normative matrix resides across the corpus (`AUD-02` fix):

| Document & Exact Canonical Path(s) | Exact Size / Lines / SHA-256 (Verified Pre-Consolidation) | Governance Role in `v2.0` | Complete Normative Matrices Preserved / Referenced |
|---|---|---|---|
| **`GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v2.0_CANDIDATE.md`** *(Artifact + Root copy)* | `v2.0` Consolidated Candidate | **Priority 1 — Governing Gate A Overlay** | Consolidates `v1.0` (`40` + `Decision B` = `42` Phase 08A perms, `#1–#43`/`#41b`/`#41c` routes, `9`-policy matrix, invariants, `GB-01.1–11`, `OP-01`), `v1.1`/`v1.2.1` (`Batches 1–6`, `CONTRADICTION-03–05`), `Decision A–D`, and **`OD-A1`–`OD-A4`**. |
| **`GFMSv0.3_HR_GATE_A_RECONCILIATION_AND_TRACEABILITY_REPORT_v2.0.md`** *(Artifact + Root copy)* | `v2.0` Consolidated Report | **Priority 1 — Companion Reconciliation & Full Traceability** | Standalone `ISS-01`–`ISS-11` (`8`/`3`), full **`107`-row `ISS-06-G001`–`G107` matrix**, full **`109`-control Batch `1–6` matrix**, `OD-A4` raw `#1–#171` disposition, `AUD-02`–`AUD-05` dispositions, and unresolved blockers. |
| **`GFMSv0.3_HR_DETAILED_ARCHITECTURE_DESIGN_v0.6.md`** *(`/.aistudio/artifacts/.../v0.6.md` & `/...v0.6.md`)* | `132,764` bytes · `583` (`wc -l`) / `584` lines · `0fb99a789c...d8e1ea` | **Priority 2 — Base Design Specification (Incorporated by Reference)** | `§3` (`37`-table ER/DDL & topological order), `§4.2–§4.4` (2-phase idempotency & DAG), `§7.2` (honest encryption matrix), `§8` (offline sync), `§9` (`HR-DEC-01`–`14`), governed by **`v2.0_CANDIDATE §1.2` Amendment Table** (`AUD-03`: **NOT** marked superseded). |
| **`GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v1.0.md`** *(`/.aistudio/artifacts/.../v1.0.md`)* | `62,586` bytes · `345` (`wc -l`) / `346` lines · `747a897b51...db1bd58` | Historical Baseline (Normative content preserved verbatim in `v2.0_CANDIDATE`) | Original source of `§4.1` (`40` perms), `§4.2` (zero privilege creep), `§5` (`#1–#43`), `§6` (`ISS-01–11`), `§7` (`9`-policy matrix), `§8–§13` (`GB-01`, `OP-01`); historical `#41b` `403` superseded by `Decision A` while `#16d` `403` stays preserved (`AUD-05`). |
| **`GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v1.1_CANDIDATE.md`** *(`/.aistudio/artifacts/.../v1.1_CANDIDATE.md`)* | `62,235` bytes · `391` (`wc -l`) / `392` lines · `975229e804...78050` | Original `ISS-06` Grouped Source (`§7.1`) | **`§7.1` (`l.192–334`):** Original `107`-row `ISS-06-G001`–`G107` table (preserved and updated with `OD-A1` & `Decision B/C/D` in `REPORT_v2.0 §6.2`). |
| **`GFMSv0.3_HR_GATE_A_RECONCILIATION_AND_TRACEABILITY_REPORT_v1.1.md`** *(`/.aistudio/artifacts/.../REPORT_v1.1.md`)* | `66,778` bytes · `361` (`wc -l`) / `362` lines · `1a01f12d75...5ceb1` | Original Item-Level Traceability Source (`§2.2`, `§3.2`, `§4.6`) | **`§2.2` (`l.78–264`):** Full `171`-slot `#1`–`#171` `UNMAPPED` ledger; **`§3.2` (`l.297–306`):** Full `109`-item `B1-01`–`B6-05` traceability matrix (reproduced & updated in `REPORT_v2.0 §7.2`); **`§4.6` (`l.342–348`):** cross-ref list. |
| **`GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v1.2.1_CANDIDATE.md`** *(Artifact + Root copy)* | `40,799` bytes · `221` (`wc -l`) / `222` lines · `37eecdba19...5052b4` | Intermediate Overlay (`Decision A–D` + `5`-part time terminology) | Consolidated into `v2.0_CANDIDATE`; note `v1.2.1 §7 l.180` had an inaccurate pointer (`AUD-02`), corrected here and in `v2.0_CANDIDATE §7`. |
| **`GFMSv0.3_HR_GATE_A_RECONCILIATION_AND_TRACEABILITY_REPORT_v1.2.1.md`** *(Artifact + Root copy)* | `15,855` bytes · `100` (`wc -l`) / `101` lines · `a8554cc947...f4ee9` | Intermediate Summary Report | Contains `Decision A–D` (`§1`), Contradiction/Gap Register (`§2`), `8`-group `ISS-06` delta summary (`§3.2`), and `6`-batch summary (`§4`) — NOT the full `107`/`171`/`109` tables (`AUD-02`). |

---

## 2. Approved Owner Decision Register

### 2.1 Four Newly Approved Owner Decisions (`OD-A1` – `OD-A4`) — **`APPROVED`**
Read-only verification pre-consolidation confirmed none of `OD-A1`–`OD-A4` had been incorporated as approved prior to `v2.0`. All four are now recorded verbatim:

| Decision ID | Topic / Source Issue | Owner Decision Status | Exact Approved Provision & Traceable Effect in `v2.0` |
|---|---|---|---|
| **`OD-A1`** | **SLA Extension Conflict Fallback** (`OPEN-SLA-EXT` / `ISS-06 §4.2`) | **`APPROVED` — Option A (Fail Closed)** | When `'HR Manager'` is conflicted or ineligible to authorize an SLA extension: **(1)** deny the extension; **(2)** keep the approval step **`PENDING`** with its **original deadline unchanged**; **(3)** create an **operational escalation**; **(4)** grant **zero fallback extension authority** to `'Factory Manager'`, `'Owner Executive'`, delegates, or `'System Administrator'`; **(5)** keep strictly separate from Governance Fallback Cancellation (`#41c`). **Effect:** Upgrades `ISS-06-G026`, `G027`, `G029` (`PARTIAL -> FULL`); closes `OPEN-SLA-EXT` (`v2.0 §3.1.1, §3.2, §3.5, §3.7`). |
| **`OD-A2`** | **`ISS-07 / NUANCE-B` Career-Field Self-Edit Lock & Onboarding Role Handoff** | **`APPROVED`** | **(1)** Employees **cannot self-edit**: `employee_code`, `hire_date`, `last_hire_date`, `primary_department_id`, `employment_type`, `rehire_count`, **`user_id`**, **`employment_status`**. **(2)** Changes to those fields require an **authorized, audited HR workflow**. **(3)** During HR onboarding, HR **requests** the secondary `'Department User'` role, and **`'System Administrator'` executes role assignment via `PUT /api/users/:id/roles`**. **(4)** HR must **NOT directly mutate `user_roles`**. **Effect:** Locks exact 8-field list & role boundary in `v2.0 §3.1.1, §3.2, §3.3 #4/#5/#6`; leaves remaining non-`OD-A2` onboarding/self-edit implementation mechanics in `§8` (`ISS-07` stays `PARTIAL`). |
| **`OD-A3`** | **`NUANCE-C` Endpoint `#24` (`GET /api/hr/shifts*`) Permission** | **`APPROVED`** | Replace generic `hr:self` on `GET /api/hr/shifts*` (`#24`) with **`hr:self:attendance:view`**; mandatory employee identity (`hr_employees.user_id = actor.id`) and row-ownership checks remain required. **Effect:** Aligns `#24` parity with `#25`; closes `OPEN-NUANCE-C` and transitions **`ISS-08`** cleanly without qualification (`v2.0 §1.2, §3.1.1, §3.3 #24`). |
| **`OD-A4`** | **`GAP-04 / AUD-01` `ISS-06` Traceability Disposition** | **`APPROVED`** | **(1)** Accept **`107` grouped principles (`ISS-06-G001`–`G107`)** as the canonical `ISS-06` baseline for Gate A. **(2)** Preserve **`109` approved Batch `1–6` controls**. **(3)** Explicitly disclose that individual raw mapping of `ISS-06` decisions `#1`–`#171` is **`0 / 171` independently verifiable** because the original raw numbered ledger is unavailable; zero fabricated mappings or 1:1 traceability claims. **Effect:** Disposes `GAP-04 / AUD-01` formally (`v2.0 §3.1.1, §7`; `REPORT_v2.0 §6.1`). |

### 2.2 Previously Approved Decision Sets Preserved (`APPROVED`)
- **`Decision A`–`Decision D` (`v1.2`):** **`Decision A`** (unified `404` on `#41b` only; `400`/`401` preserved; `#16d` `403` untouched per `AUD-05`); **`Decision B`** (`hr:sla:manage` `SysAdmin` only, `hr:sla:view` `SysAdmin` + `HR Mgr` read-only, `hr:admin:manage` unchanged -> `42` Phase 08A conceptual keys + `5` deferred Phase 11 = `47` conceptual keys; zero perms/seeds created); **`Decision C`** (fail-closed `HR Manager` reassignment -> `PENDING` + escalation, zero implied fallback); **`Decision D`** (linked immutable multi-cycle approval architecture mandatory; DDL `DEFERRED`).
- **`U-01`–`U-07`, `OD-01`–`OD-03`, `v0.6 §11.2 #2–#5`, `Batches 1–6` (`109` controls):** Preserved unchanged in `v2.0_CANDIDATE §3.1.3, §4, §5`.
- **Base `HR-DEC-01`–`HR-DEC-14` (`v0.6 §9`):** Incorporated by reference with `v2.0 §1.2` amendments noted; pending final Gate A ratification alongside remaining technical blockers (`§8`).

---

## 3. Audit Findings `AUD-02` Through `AUD-05` Explicit Disposition Register

| Audit Finding | Finding Summary | Mandatory Disposition Applied in `v2.0` Package | Verified Evidence Location |
|---|---|---|---|
| **`AUD-02`** | `v1.2.1 §7 l.180` inaccurately claimed complete per-item `ISS-06-G001–G107`, raw `#1–#171`, and `Batch 1–6` matrices lived in `REPORT_v1.2.1` (which contained summaries only). | **FIXED:** `v2.0_CANDIDATE §7` & `REPORT_v2.0 §1, §6, §7` accurately point both to the full consolidated tables inside `REPORT_v2.0` AND to the exact original milestone locations (`v1.1_CANDIDATE §7.1 l.192–334`; `REPORT_v1.1 §2.2 l.78–264`; `REPORT_v1.1 §3.2 l.297–306`), never misstating `REPORT_v1.2.1`. | `v2.0_CANDIDATE §7`; `REPORT_v2.0 §1, §6, §7` |
| **`AUD-03`** | `v1.2.1 l.10` claimed to `"Supersede"` `v1.0` & `v1.1_CANDIDATE` while omitting full `v1.0` RBAC/route/policy/`GB-01` tables and `v1.1` `G001–G107`/`B1–B6` tables. | **FIXED:** `v2.0_CANDIDATE` reproduces in full all normative `v1.0` matrices (`42`+`5` perms, `#1–#43`/`#41b`/`#41c`/Legacy routes, `9`-policy routing, `ISS-01–11`, invariants, `Tests 44/45/77–89`, `OP-01`, `GB-01.1–11`) and `v1.2.1` `Batches 1–6`; `REPORT_v2.0` reproduces full `107` `G001–G107` & `109` `B1–B6` tables; **`v0.6` is explicitly Incorporated by Reference with Section `1.2` Amendment & Precedence Table** (never marked superseded). | `v2.0_CANDIDATE §1, §3–§9`; `REPORT_v2.0 §1, §6, §7` |
| **`AUD-04`** | `REPORT_v1.2.1` omitted a standalone `ISS-01`–`ISS-11` status table mirroring `Addendum §3.6` (`8` resolved / `3` partial). | **FIXED:** Standalone `ISS-01`–`ISS-11` status table added directly in `REPORT_v2.0 §4` showing **`8 RESOLVED`** (`ISS-01`, `03`, `04`, `05`, `08`, `09`, `10`, `11`) and **`3 PARTIAL/OPEN`** (`ISS-02`, `ISS-06`, `ISS-07`). | `REPORT_v2.0 §4` (`1:1` w/ `v2.0_CANDIDATE §3.6`) |
| **`AUD-05`** | Risk of silently generalizing `Decision A` unified `404` from `#41b` to `#16d` (`v1.0 §5 #16d` `403` baseline). | **FIXED:** `v2.0_CANDIDATE §3.1.2, §3.3 (#16d vs #41b), §3.7.1–§3.7.2` and `REPORT_v2.0 §5` enforce a strict boundary: **`#41b` (`GET /api/approvals/:id/context`) uses unified `404`**; **`#16d` (`GET /api/hr/compensation-revisions/:id/approval-context`) preserves its `v1.0 §5 #16d` `403` baseline** unless an explicit new Owner decision changes `#16d`. | `v2.0_CANDIDATE §1.2, §3.3 #16d & #41b`; `REPORT_v2.0 §5` |

---

## 4. Standalone `ISS-01`–`ISS-11` Reconciliation Status Table (`AUD-04`)

| Issue ID | Issue Scope | Final `v2.0` Status | Governing Decisions Applied | Resolved Elements & Remaining Open Technical Blocker (If Any) |
|---|---|---|---|---|
| **`ISS-01`** | `'Owner Executive'` permissions & Policy `#7` split | **`RESOLVED`** | `OD-01`, `U-01`, `U-02`, `AUD-05` | Aggregate `#16c` only; `#16d` `403` barred; `initiate_executive` omitted (`U-02`); Exec Policy `#7b` dormant (`409`). |
| **`ISS-02`** | Unified policy-redacted `#41b` approval context | **`PARTIAL / OPEN`** | `OD-01`, `U-01`, `Decision A`, `AUD-05` | Unified `404` (`400`/`401` preserved), free-text/PII/history exclusion, pool/reassignment/pre-return audit rules approved; **Blocker #3: `#41b` per-policy field-level DTO schemas & types remain `OPEN`**. |
| **`ISS-03`** | Secondary `'Department User'` & `runner.ts` Test `77` | **`RESOLVED`** | `OD-03`, `U-03`, `U-05`, `OD-A2` | Reuses `'Department User'`; zero `hr:self:*` on operational roles; Test `77` & `79` preserved. |
| **`ISS-04`** | Deferred identity staffing & mid-flight pool exhaustion | **`RESOLVED`** | `ISS-04` Pool Guard | Atomic TX `assertEligibleApproverPoolExists` (`409 WORKFLOW_APPROVER_UNASSIGNED`) at submission & step transition. |
| **`ISS-05`** | Preserving existing titled `users.full_name` | **`RESOLVED`** | `§11.2 #5` | Zero `users.full_name` sync across `#4`, `#5d`, `#6`; read-only snapshot stored in link history. |
| **`ISS-06`** | Governance cancel (`#41c`) & `171` SLA/extension/reopen/outbox rules | **`PARTIAL / OPEN`** | `U-04`, `Decision B/C/D`, `CONTRADICTION-03/04/05`, **`OD-A1`**, **`OD-A4`** | `OD-A1` (fail-closed SLA extension fallback) & `OD-A4` (`G001–G107` baseline, `0/171` raw disclosed) approved; **Blockers #1–#2: physical `due_at` SQL design & concrete SLA key schema/validation bounds/versioned calendar design remain pre-DDL / `OP-01`**. |
| **`ISS-07`** | `HR Manager` self-bootstrap, self-edit locks & onboarding handoff | **`PARTIAL / OPEN`** | `OD-02`, `U-03`, `U-05`, **`OD-A2`** | `OD-A2` locks 8 career fields & mandates `SysAdmin` `PUT /api/users/:id/roles` onboarding handoff; **Blocker #4: remaining self-bootstrap `#2` DTO/validation, `HR Officer` review, & pre-DDL enforcement mechanics remain `OPEN`**. |
| **`ISS-08`** | `#35`/`#19` `hr:self:view`, `hr:self` cleanup (`#24/#25/#30`), `#5a` | **`RESOLVED`** | `U-06 #1–#4`, **`OD-A3`** | `OD-A3` formally replaces `hr:self` on `#24` with `hr:self:attendance:view`; `#35`/`#19`/`#25`/`#30`/`#5a` aligned. |
| **`ISS-09`** | Canonical `roles.role_name` standardization | **`RESOLVED`** | `OD-03`, `001`–`007` seeds | Retired aliases eliminated; exact canonical `roles.role_name` strings used everywhere. |
| **`ISS-10`** | Legacy Dept API `409 USE_HR_WORKFLOW` & TX safety | **`RESOLVED`** | `§11.2 #4` | Unified `409 USE_HR_WORKFLOW` inside `withTransaction` (`FOR UPDATE`) on assign/transfer/remove. |
| **`ISS-11`** | Step 7A/7B split, Seed `008` order, Tests `44`/`45` | **`RESOLVED`** | `§11.2 #2`, `U-07` | Mode A Step 2 + Step 7A in Phase 08A; Step 7B deferred; Tests `44`/`45` updated post-Gate B only. |

**Standalone Summary Count (`AUD-04`):** **`8 RESOLVED`** (`ISS-01`, `ISS-03`, `ISS-04`, `ISS-05`, `ISS-08`, `ISS-09`, `ISS-10`, `ISS-11`) · **`3 PARTIAL / OPEN`** (`ISS-02`, `ISS-06`, `ISS-07`).

---

## 5. Updated Contradiction, Gap & Nuance Register

| ID | Topic | Final Status in `v2.0` | Resolution Basis & Preserved Boundaries |
|---|---|---|---|
| **`CONTRADICTION-01`** | `#41b` Status Code (`404` vs `403`) | **`RESOLVED` (`Decision A` + `AUD-05`)** | **`#41b` returns unified `404`** (`400`/`401` preserved). **`#16d` strictly retains `v1.0 §5` `403` baseline (`AUD-05`).** |
| **`CONTRADICTION-02` / `GAP-01`** | SLA Config RBAC (`hr:admin:manage`) | **`RESOLVED` (`Decision B`)** | Conceptual `hr:sla:manage` (`SysAdmin` only) & `hr:sla:view` (`SysAdmin` + `HR Mgr` read-only); `hr:admin:manage` untouched (`42`+`5`=`47` conceptual keys; zero perms/seeds created). |
| **`CONTRADICTION-03`** | Notification Delivery vs Audit Durability | **`RECONCILED`** | Outbox write atomic with business TX; async post-commit delivery retries -> DLQ without rollback; audit durability fail closed; dual primary + Emergency Journal failure = fail closed. |
| **`CONTRADICTION-04`** | `v0.6` Bare `TIMESTAMPTZ` vs Batch 1 | **`RECONCILED`** | Five-part conceptual representation (`Factory Local Time`, `IANA Timezone`, `UTC Offset`, `Resolved Absolute Instant`, `Clock Trust and Event Sequence Provenance`); **Central Event Sequence** strictly scoped to deterministic ordering on clock trust loss. Physical SQL representation in `§8 #1`. |
| **`CONTRADICTION-05`** | Missing SLA Config Fail Closed | **`RECONCILED`** | Zero silent defaults; cycle/step creation blocked without active policy SLA & calendar. Key schema/bounds/OP-01 values in `§8 #2`. |
| **`GAP-02`** | `HR Manager` Conflicted Reassignment | **`RESOLVED` (`Decision C`)** | Fail closed (`PENDING` + operational escalation); zero implied fallback; separate from `#41c`. |
| **`GAP-03`** | Multi-Cycle Approval Model | **`RESOLVED` (Arch `Decision D`) / `DEFERRED` (DDL)** | Linked immutable cycles mandatory; exact FK/column/index DDL in pre-DDL design review. |
| **`GAP-04` / `AUD-01`** | Raw `ISS-06 #1–#171` Missing Ledger | **`DISPOSED` (`OD-A4`)** | **`OD-A4`:** `G001–G107` accepted as canonical Gate A baseline; `109` Batch controls preserved; `0/171` raw independently verifiable explicitly disclosed; zero fabrication. |
| **`OPEN-SLA-EXT`** | `HR Manager` SLA Extension Fallback | **`RESOLVED` (`OD-A1`)** | **`OD-A1` (Option A Fail Closed):** Deny extension, keep `PENDING` with original deadline unchanged, operational escalation; zero fallback to `Factory Mgr`/`Owner Exec`/delegates/`SysAdmin`; separate from `#41c`. |
| **`ISS-07 / NUANCE-B`** | Self-Edit Career Lock & `users:roles` Handoff | **`POLICY RESOLVED` (`OD-A2`) / `IMPL OPEN`** | `OD-A2` locks 8 fields & assigns secondary `'Department User'` solely via `SysAdmin` `PUT /api/users/:id/roles`; remaining `#2`/`#4` & handoff implementation details in `§8 #4`. |
| **`OPEN-NUANCE-C`** | Endpoint `#24` `hr:self` Shorthand | **`RESOLVED` (`OD-A3`)** | `#24` (`GET /api/hr/shifts*`) updated to `hr:self:attendance:view` + mandatory employee identity & row-ownership checks. |
| **`NUANCE-A`** | Active `PENDING` `approval_steps.due_at` | **`ARCH RECONCILED` / `SQL DEFERRED`** | Snapshot-at-step-creation & fail-closed SLA rules preserved; physical SQL representation & enforcement DDL in `§8 #1` (not reopened as Owner Decision). |
| **`LABEL-AMB-01`** | `U-03`/`U-04` Option Letter Drift | **`DISCLOSED & PRESERVED`** | `Paste §3` (`Option B`) vs `v1.0` (`OD-03 Option A` / unlabeled `U-04`); approved semantics 100% identical. |

---

## 6. Complete `ISS-06` Traceability Report (`Raw #1–#171` & `Grouped G001–G107`)

### 6.1 Raw `#1`–`#171` Mapping Limitation & `OD-A4` Owner Acceptance
- **Verified Fact (`0 / 171` Independently Verifiable):** Neither the repository nor any specification document (`v0.6`, `v1.0`, `Paste_November_17__2026_-_1_09PM_1c3d6963`) contains the original raw numbered list `#1`–`#171` (individual decision IDs, pre-consolidation titles, or `Option A/B/...` labels). All `171` slots `#1`–`#171` remain explicitly **`0 / 171` independently verifiable (`171 / 171 UNMAPPED`)**.
- **Authoritative Pointer (`AUD-02`):** The full `171`-row enumerated `UNMAPPED` ledger resides unaltered at `/.aistudio/artifacts/brain/f1c889e7-f83c-4612-b6df-e6c812aa338f/GFMSv0.3_HR_GATE_A_RECONCILIATION_AND_TRACEABILITY_REPORT_v1.1.md §2.2` (`lines 78–264`).
- **Owner Disposition (`OD-A4`):** The System Owner explicitly **accepted the `107` grouped principles (`ISS-06-G001`–`G107`) as the canonical `ISS-06` baseline for Gate A**, preserved the `109` Batch `1–6` controls, required explicit `0/171` disclosure, and prohibited any fabricated raw numbers or 1:1 claims.

### 6.2 Grouped `ISS-06` Group Summary (`v2.0` Delta After `OD-A1`)
| Group (`Paste`) | Principle IDs | Count | `v1.2.1` Status | `v2.0` Status (`OD-A1` Applied) | Delta & Remaining Blockers / Deferred Dependencies |
|---|---|---|---|---|---|
| `4.1` SLA & Business Calendar | `G001`–`G019` | `19` | `13 FULL · 6 PARTIAL` | **`13 FULL · 6 PARTIAL · 0 CONFLICTING`** | `G013`, `G014` (`Decision B` `FULL`); `6 PARTIAL` (`G001, G003–G005, G007–G009, G012` scope -> `Blocker #1` `due_at` SQL & `Blocker #2` SLA keys/bounds/calendar/`OP-01`). |
| `4.2` SLA Extensions | `G020`–`G029` | `10` | `6 FULL · 4 PARTIAL` | **`9 FULL · 1 PARTIAL · 0 CONFLICTING`** | **`+3 FULL` (`OD-A1` resolves `G026`, `G027`, `G029`)**; `G025` stays `PARTIAL` (`Blocker #2` calendar). |
| `4.3` Governance Fallback Cancel | `G030`–`G042` | `13` | `10 FULL · 3 PARTIAL` | **`10 FULL · 3 PARTIAL · 0 CONFLICTING`** | Unchanged (`G035`, `G037`, `G039` reflect `DEFER` retry/evidence design & `OP-01`). |
| `4.4` Expiry & Late Decisions | `G043`–`G056` | `14` | `12 FULL · 2 PARTIAL` | **`12 FULL · 2 PARTIAL · 0 CONFLICTING`** | `G053` `FULL` (`Decision C`); `G049` (`calendar`/5-part DDL), `G050` (`DEFER` scheduler) stay `PARTIAL`. |
| `4.5` Reassignment & Notifications | `G057`–`G069` | `13` | `11 FULL · 2 PARTIAL` | **`11 FULL · 2 PARTIAL · 0 CONFLICTING`** | `G064` `FULL` (`CONTRADICTION-03`); `G065`, `G066` (`DEFER` retry/DLQ schema) stay `PARTIAL`. |
| `4.6` Escalation | `G070`–`G082` | `13` | `8 FULL · 5 PARTIAL` | **`8 FULL · 5 PARTIAL · 0 CONFLICTING`** | `G081`/`G082` (`Decision D` DDL `DEFER`); scheduler/policy escalation rules (`DEFER`). |
| `4.7` Reopening Approval Cycles | `G083`–`G100` | `18` | `11 FULL · 7 PARTIAL` | **`11 FULL · 7 PARTIAL · 0 CONFLICTING`** | `G090` (`Decision D` DDL `DEFER`); policy reopen flags/thresholds (`DEFER`). |
| `4.8` Policy Versioning | `G101`–`G107` | `7` | `5 FULL · 2 PARTIAL` | **`5 FULL · 2 PARTIAL · 0 CONFLICTING`** | `G101` (policy version DDL `DEFER`), `G106` (`OP-01` unmapped alert SOP). |
| **Total Canonical (`OD-A4`)** | **`ISS-06-G001`–`G107`** | **`107`** | `76 FULL · 31 PARTIAL` | **`79 FULL · 28 PARTIAL · 0 CONFLICTING · 0 MISSING`** | **Net `+3 FULL` in `v2.0` (`OD-A1`); `0` unresolved conflicts; accepted Gate A baseline (`OD-A4`).** |

### 6.3 Complete `107`-Row `ISS-06` Grouped Principle Coverage Matrix (`ISS-06-G001` – `ISS-06-G107`)
*(Preserved in full from `v1.1_CANDIDATE §7.1` [`l.192–334`] and updated with `Decision B/C/D`, `CONTRADICTION-03–05`, and **`OD-A1`**.)*

Classification Codes: **`ARCH`** = HR Gate A Architectural · **`XCUT`** = Cross-Cutting Security/Gov/Audit/Recovery · **`DEFER`** = Deferred Design/Pre-DDL · **`OPS`** = Operational Readiness (`OP-01`).

#### Group 4.1 — Approval SLA & Business Calendar (`ISS-06-G001` – `ISS-06-G019` — `13 FULL · 6 PARTIAL`)
| ID | Decision Principle Title | Approved Choice | `v2.0` Location | Class | Coverage Status & Remaining Dependency |
|---|---|---|---|---|---|
| `ISS-06-G001` | Step-creation SLA calculation & snapshot | Calculate & snapshot SLA at step creation | `§3.5`, `§3.7` | `ARCH` | **`PARTIAL`** — SLA keys/schema (`§8 #2`) |
| `ISS-06-G002` | Config change forward-only scope | Later SLA changes affect new steps only | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G003` | Business-hours SLA unit | Measure SLA in approved business hours, not calendar hours | `§3.5` | `ARCH` | **`PARTIAL`** — Calendar config (`§8 #2` / `OP-01`) |
| `ISS-06-G004` | Centralized versioned factory calendar | Versioned calendar governs workdays, hours, breaks, holidays | `§3.5` | `ARCH` | **`PARTIAL`** — Schema & `OP-01` values (`§8 #2`) |
| `ISS-06-G005` | Step retains calendar version | Persist calendar version on every approval step | `§3.5` | `ARCH` | **`FULL`** *(Arch snapshot contract approved; DDL `DEFER`)* |
| `ISS-06-G006` | Calendar edits preserve existing deadlines | Calendar updates do not recalculate existing deadlines | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G007` | Active `PENDING` step deadline required | Active `PENDING` steps must hold a valid `due_at` deadline | `§3.4.3`, `§3.5` | `ARCH` | **`PARTIAL`** — Physical SQL representation pre-DDL (`§8 #1`) |
| `ISS-06-G008` | Fail-closed on missing/invalid SLA config | Block new cycle/step creation if policy SLA invalid/missing | `§3.4.3`, `§3.5` | `ARCH` | **`PARTIAL`** — Policy SLA keys schema (`§8 #2`) |
| `ISS-06-G009` | Positive decimal SLA hours | SLA values must be positive decimal business hours | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G010` | Two-decimal precision cap | SLA decimal precision limited to 2 decimal places | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G011` | Exact conversion to seconds | Exact decimal-to-seconds conversion without silent rounding | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G012` | Per-policy min/max SLA bounds | Each policy defines explicit min and max SLA bounds | `§3.5` | `ARCH` | **`PARTIAL`** — Numeric min/max bounds (`§8 #2` / `OP-01`) |
| `ISS-06-G013` | `System Administrator` SLA management | `System Administrator` exclusively manages SLA (`hr:sla:manage`) | `§3.1.2`, `§3.2`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by `Decision B`; Seed `008` creation `DEFER`)* |
| `ISS-06-G014` | `HR Manager` read-only SLA access | `HR Manager` holds strictly read-only SLA access (`hr:sla:view`) | `§3.1.2`, `§3.2`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by `Decision B`; Seed `008` creation `DEFER`)* |
| `ISS-06-G015` | Published SLA versions immutable | SLA configuration versions immutable once published | `§3.5` | `ARCH` | **`FULL`** *(DDL `DEFER`)* |
| `ISS-06-G016` | Scheduled version activation | New SLA versions activate at scheduled effective timestamps | `§3.4.2`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G017` | No overlapping SLA versions | Overlapping effective SLA versions prohibited | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G018` | Forward-only withdrawal + replacement | Withdrawal forward-only and requires valid replacement | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G019` | Existing steps retain SLA snapshot | Existing approval steps retain original SLA snapshots | `§3.5` | `ARCH` | **`FULL`** |

#### Group 4.2 — SLA Extensions (`ISS-06-G020` – `ISS-06-G029` — `9 FULL · 1 PARTIAL`, Updated with `OD-A1`)
| ID | Decision Principle Title | Approved Choice | `v2.0` Location | Class | Coverage Status & Remaining Dependency |
|---|---|---|---|---|---|
| `ISS-06-G020` | Formal extension action | Extension requires formal explicit workflow action | `§3.5` | `ARCH` | **`FULL`** *(Endpoint/DDL contract `DEFER`)* |
| `ISS-06-G021` | Mandatory reason & audit evidence | Extension mandates reason and immutable audit evidence | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G022` | One extension per step limit | Maximum 1 SLA extension allowed per approval step | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G023` | Pre-deadline extension window | Extension permitted only before original deadline | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G024` | Max extension duration cap | Extension duration `<=` original SLA duration | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G025` | Business-hours extension unit | Extension measured in approved business hours | `§3.5` | `ARCH` | **`PARTIAL`** — Factory calendar schema & values (`§8 #2`) |
| `ISS-06-G026` | `HR Manager` primary extension authority | `HR Manager` is primary authority; conflicted/ineligible fails closed (`OD-A1`) | `§3.1.1`, `§3.2`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by **`OD-A1`**)* |
| `ISS-06-G027` | `HR Manager` extension self-conflict ban | `HR Manager` barred on own request/subject/step; conflicted fails closed (`OD-A1`) | `§3.1.1`, `§3.2`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by **`OD-A1`**)* |
| `ISS-06-G028` | `System Administrator` extension exclusion | `SysAdmin` receives zero extension authority | `§3.1.1`, `§3.2`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G029` | Single-actor ordinary extension | Non-conflicted extension single-actor; conflicted fails closed without fallback (`OD-A1`) | `§3.1.1`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by **`OD-A1`**)* |

#### Group 4.3 — Governance Fallback Cancellation (`ISS-06-G030` – `ISS-06-G042` — `10 FULL · 3 PARTIAL`)
| ID | Decision Principle Title | Approved Choice | `v2.0` Location | Class | Coverage Status & Remaining Dependency |
|---|---|---|---|---|---|
| `ISS-06-G030` | SLA expiry alone insufficient | SLA expiry alone cannot trigger `#41c` | `§3.1.3`, `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G031` | Verified `0` eligible approver/delegate pool | Verify `0` eligible active approvers and active delegates exist | `§3.1.3`, `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G032` | Just-in-time eligibility recheck | Recheck eligibility immediately before cancellation | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G033` | Atomic eligibility check + cancellation | Execute check and cancellation inside one atomic TX | `§3.5` | `ARCH` | **`FULL`** *(Gate B PG TX verification)* |
| `ISS-06-G034` | Concurrency locking on step & eligibility | Lock step and eligibility-affecting state against races | `§3.5` | `ARCH` | **`FULL`** *(Gate B `FOR UPDATE`)* |
| `ISS-06-G035` | Bounded retry with recheck | Retry bounded and re-evaluates eligibility every attempt | `§3.5` | `ARCH` | **`PARTIAL`** — Exact retry bound (`DEFER`) |
| `ISS-06-G036` | Abort on retry exhaustion | If retries fail, cancellation does not occur | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G037` | Operational review on failed cancel | Failed cancel triggers operational review | `§3.5` | `OPS` | **`PARTIAL`** — Review SOP (`OP-01`) |
| `ISS-06-G038` | `HR Manager` primary fallback actor | `HR Manager` is primary `#41c` actor (non-subject) | `§3.2`, `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G039` | `Factory Manager` objective exception | `Factory Manager` only on verifiable objective `HR Mgr` ineligibility | `§3.2`, `§3.3`, `§3.5` | `ARCH` | **`PARTIAL`** — Objective evidence schema (`DEFER`) |
| `ISS-06-G040` | Delegates barred from fallback cancel | Delegates cannot execute `#41c` | `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G041` | `SysAdmin` & requester exclusion | `SysAdmin` and requester excluded from `#41c` | `§3.2`, `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G042` | Escalate if both managers ineligible | Remains pending & escalates for operational resolution | `§3.5` | `ARCH`/`OPS` | **`FULL`** |

#### Group 4.4 — Approval Expiry & Late Decisions (`ISS-06-G043` – `ISS-06-G056` — `12 FULL · 2 PARTIAL`)
| ID | Decision Principle Title | Approved Choice | `v2.0` Location | Class | Coverage Status & Remaining Dependency |
|---|---|---|---|---|---|
| `ISS-06-G043` | Expired step stays `PENDING` | Persisted status stays `PENDING` past deadline | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G044` | Dynamic overdue calculation | Overdue derived dynamically from trusted Resolved Instant vs deadline | `§3.4.2`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G045` | Expiry escalates without revoking rights | Expiry triggers escalation, not approval revocation | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G046` | Post-expiry decision authority retained | Eligible approvers/delegates keep decision authority (`200` on `#41b`) | `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G047` | Normal processing of late decisions | Late decisions proceed normally | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G048` | Late decision marking & audit | Mark and audit late decisions explicitly | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G049` | Record timestamp & business lateness | Persist decision timestamp (5-part) and business-time lateness | `§3.4.2`, `§3.5` | `ARCH` | **`PARTIAL`** — 5-part SQL DDL (`§8 #1`) & calendar (`§8 #2`) |
| `ISS-06-G050` | Decision stops future escalations | Successful decision halts future escalation tasks/alerts | `§3.5` | `ARCH` | **`PARTIAL`** — Outbox/scheduler (`DEFER`) |
| `ISS-06-G051` | Reassignment keeps original deadline | Reassignment preserves original deadline | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G052` | Reassignment preserves overdue state | Reassignment preserves overdue state | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G053` | `HR Manager` exclusive reassignment | Only `HR Manager` may reassign (COI-checked); conflicted fails closed (`Decision C`) | `§3.1.2`, `§3.2`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by `Decision C`)* |
| `ISS-06-G054` | Live target eligibility validation | Reassignment target must pass live eligibility validation | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G055` | Fail-closed when no eligible target | Fail closed & stay `PENDING` if no eligible target exists | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G056` | Unlimited audited reassignment | Repeated reassignment permitted with immutable audit | `§3.5` | `ARCH` | **`FULL`** |

#### Group 4.5 — Reassignment & Outbox Notifications (`ISS-06-G057` – `ISS-06-G069` — `11 FULL · 2 PARTIAL`)
| ID | Decision Principle Title | Approved Choice | `v2.0` Location | Class | Coverage Status & Remaining Dependency |
|---|---|---|---|---|---|
| `ISS-06-G057` | Reassignment audit fields | Record previous/new approver, actor, reason, timestamp | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G058` | Immediate prior approver revocation | Revoke prior approver immediately (`404` on `#41b`) | `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G059` | Notify previous approver of revocation | Notify revoked approver | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G060` | Notify new approver with deadline/overdue | Notify new approver including original deadline & overdue state | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G061` | Notify `HR Manager` on reassignment | Notify `HR Manager` of reassignment | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G062` | Transactional outbox pattern | Notifications use transactional outbox | `§3.4.1`, `§3.5` | `ARCH` | **`FULL`** *(Step 8/outbox DDL `DEFER`)* |
| `ISS-06-G063` | Atomic reassignment + outbox insert | Single TX writes reassignment and outbox record | `§3.4.1`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G064` | Notification failure non-blocking | Post-commit delivery failure retries -> DLQ without rollback (distinct from fail-closed audit) | `§3.4.1`, `§3.5` | `ARCH` | **`FULL`** *(Resolved by `CONTRADICTION-03`)* |
| `ISS-06-G065` | Bounded exponential backoff retries | Retries use configurable exponential backoff | `§3.4.1`, `§3.5` | `DEFER` | **`PARTIAL`** — Retry config values (`DEFER`) |
| `ISS-06-G066` | Dead Letter queue on exhausted retries | Exhausted retries move messages to Dead Letter | `§3.4.1`, `§3.5` | `DEFER` | **`PARTIAL`** — DLQ schema/UI (`DEFER`) |
| `ISS-06-G067` | `SysAdmin` audited manual DLQ replay | `SysAdmin` replays DLQ post-fix (audited, transport-only) | `§3.2`, `§3.4.1`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G068` | Replay grants zero HR/approval rights | Replay gives zero HR content or approval authority | `§3.2`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G069` | Delivery != human read proof | Delivery success = transport acceptance only | `§3.5` | `ARCH` | **`FULL`** |

#### Group 4.6 — Escalation (`ISS-06-G070` – `ISS-06-G082` — `8 FULL · 5 PARTIAL`)
| ID | Decision Principle Title | Approved Choice | `v2.0` Location | Class | Coverage Status & Remaining Dependency |
|---|---|---|---|---|---|
| `ISS-06-G070` | Immediate escalation at SLA expiry | Escalate immediately upon SLA expiry | `§3.5` | `ARCH` | **`PARTIAL`** — Escalation scheduler (`DEFER`) |
| `ISS-06-G071` | Baseline escalation recipients | Current eligible approver + `HR Manager` are baseline | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G072` | Policy-specific extra recipients | Extra recipients driven by policy escalation rules | `§3.5` | `ARCH` | **`PARTIAL`** — Per-policy escalation rules (`DEFER`) |
| `ISS-06-G073` | Conditional `Factory Manager` escalation | `Factory Manager` included only under explicit policy conditions | `§3.2`, `§3.5` | `ARCH` | **`PARTIAL`** — Explicit policy conditions (`DEFER`) |
| `ISS-06-G074` | Escalation grants zero extra authority | Escalation confers zero approval/reassign/cancel/data rights | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G075` | Configurable recurring reminders | Recurring reminders use policy intervals & attempt caps | `§3.5` | `DEFER` | **`PARTIAL`** — Interval/limit config (`DEFER`) |
| `ISS-06-G076` | Minimal metadata + secure context link | Send minimal metadata and secure `#41b` context link only | `§3.3`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G077` | Strict PII redaction in escalation notices | Zero employee names, salary, contracts, sensitive reasons | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G078` | No mandatory acknowledgement | Escalation acknowledgement optional | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G079` | Ack does not alter SLA/authority | Acknowledgement leaves SLA & approval rights unchanged | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G080` | Terminal states close escalations | Valid terminal state halts future escalation tasks | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G081` | Reopen starts new cycle + SLA snapshot | Reopening creates new cycle with fresh SLA snapshot | `§3.1.2`, `§3.5` | `ARCH` | **`PARTIAL`** — `Decision D` multi-cycle DDL (`DEFER`) |
| `ISS-06-G082` | Prior cycles remain immutable | Past cycles, deadlines, decisions, audits remain immutable | `§3.1.2`, `§3.5` | `ARCH` | **`FULL`** *(Arch rule `Decision D` approved; DDL `DEFER`)* |

#### Group 4.7 — Reopening Approval Cycles (`ISS-06-G083` – `ISS-06-G100` — `11 FULL · 7 PARTIAL`)
| ID | Decision Principle Title | Approved Choice | `v2.0` Location | Class | Coverage Status & Remaining Dependency |
|---|---|---|---|---|---|
| `ISS-06-G083` | `HR Manager` controls reopening | `HR Manager` is primary reopening authority | `§3.2`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G084` | Mandatory reopening reason | Reopening requires mandatory reason | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G085` | Policy/type eligibility required | Request type & policy must allow reopening | `§3.5` | `ARCH` | **`PARTIAL`** — Per-policy reopen flags (`DEFER`) |
| `ISS-06-G086` | `HR Manager` reopening COI check | `HR Manager` must pass COI checks | `§3.2`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G087` | `Factory Manager` objective exception | `Factory Manager` only on documented objective HR Mgr ineligibility | `§3.2`, `§3.5` | `ARCH` | **`FULL`** *(Objective evidence schema `DEFER`)* |
| `ISS-06-G088` | `Factory Manager` live validation | `Factory Manager` must pass live eligibility validation | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G089` | Fail closed when both ineligible | Deny reopening; stay in prior terminal state | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G090` | Linked cycle chain | Each reopening creates linked cycle (`Decision D`) | `§3.1.2`, `§3.5` | `ARCH` | **`PARTIAL`** — `Decision D` FK/index DDL (`DEFER`) |
| `ISS-06-G091` | Live policy/SLA/calendar snapshots | New cycle snapshots currently effective policy, SLA, calendar | `§3.5` | `ARCH` | **`PARTIAL`** — SLA/calendar DDL (`§8 #2`) |
| `ISS-06-G092` | Cycle-level policy version immutability | Policy versions immutable per cycle | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G093` | Retired policy scope | Retired policies block new cycles only; open cycles finish | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G094` | Forward-only policy replacement | Replacement policies apply forward-only | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G095` | Policy-gated reopening count | Unlimited only where policy allows; full governance every cycle | `§3.5` | `ARCH` | **`PARTIAL`** — Per-policy reopen rules (`DEFER`) |
| `ISS-06-G096` | Anomaly alert on repeated reopenings | Alert on repeated reopenings without blocking valid ones | `§3.5` | `ARCH`/`OPS` | **`PARTIAL`** — Alert threshold config (`DEFER`) |
| `ISS-06-G097` | No direct cancellation bypass on reopen | Reopened cycle follows normal cancel rules only | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G098` | Atomic cycle + audit + outbox TX | Cycle creation, audit, and outbox occur atomically | `§3.4.1`, `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G099` | Idempotency & DB uniqueness | Idempotency key & DB uniqueness prevent duplicate cycles | `§3.5` | `ARCH` | **`PARTIAL`** — Multi-cycle unique DDL (`DEFER`) + `Gate B` |
| `ISS-06-G100` | Row locks & state revalidation | Protect concurrent reopens via `FOR UPDATE` + state check | `§3.5` | `ARCH` | **`PARTIAL`** — `Gate B` live PG locking |

#### Group 4.8 — Policy Versioning (`ISS-06-G101` – `ISS-06-G107` — `5 FULL · 2 PARTIAL`)
| ID | Decision Principle Title | Approved Choice | `v2.0` Location | Class | Coverage Status & Remaining Dependency |
|---|---|---|---|---|---|
| `ISS-06-G101` | Immutable cycle policy version | Every cycle retains immutable policy version | `§3.5` | `ARCH` | **`PARTIAL`** — Policy version table DDL (`DEFER`) |
| `ISS-06-G102` | Retirement blocks new cycles only | Retired version blocks new cycles | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G103` | Existing cycles finish on original version | Open cycles continue under original policy version | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G104` | Forward-only replacement activation | Replacement version activates forward-only | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G105` | Resolution at cycle creation | Resolve active policy version at cycle creation | `§3.5` | `ARCH` | **`FULL`** |
| `ISS-06-G106` | Fail-closed + alert if unmapped policy | Fail closed + operational alert when no valid policy mapped | `§3.5` | `ARCH` | **`PARTIAL`** — Alert SOP (`OP-01`) |
| `ISS-06-G107` | No silent policy migration | Silent migration between policy versions prohibited | `§3.5` | `ARCH` | **`FULL`** |

---

## 7. Complete Six-Batch Control Traceability Matrix (`Batch 1` – `Batch 6`: `109 / 109` Preserved)

### 7.1 Six-Batch Summary Matrix
| Batch | Controls (`109` Total) | `v2.0_CANDIDATE` Section(s) | Status & Reconciliation Notes |
|---|---|---|---|
| **Batch 1 – Clock Integrity & Time Trust** | `16` (`B1-01`–`B1-16`) | `§3.4.2`, `§4`, `§6`, `§7`, `§8 #1–#2` | **`FULL` (Architectural Principles).** `CONTRADICTION-04` reconciles bare `TIMESTAMPTZ` insufficiency & standardizes the **five-part conceptual time-and-trust representation**, with **Central Event Sequence** providing deterministic ordering on clock trust loss; physical SQL columns & calendar/NTP parameters `DEFER`/`§8`/`OP-01`. |
| **Batch 2 – Emergency Journal & Cryptographic Recovery** | `22` (`B2-01`–`B2-22`) | `§3.4.1`, `§4`, `§6`, `§7`, `§9.3` | **`FULL` (Architectural Principles).** `CONTRADICTION-03` preserves dual-persistence fail closed & non-conflation with notification delivery; binary format/crypto/DPAPI/drills `DEFER`/`OP-01`. |
| **Batch 3 – Evidence Repository & Destruction Registry** | `17` (`B3-01`–`B3-17`) | `§2`, `§4`, `§6`, `§7` | **`FULL` (Architectural Principles).** Step 7B binary evidence & external purge remain explicitly out of Phase 08A (`DEFERRED`). |
| **Batch 4 – Governance & Custodian Independence** | `21` (`B4-01`–`B4-21`) | `§3.2`, `§4`, `§6`, `§7`, `§9.3` | **`FULL` (Architectural Principles).** Reinforced by `Decision B`, `Decision C`, `OD-A1`, `OD-A2`; Charter ratios/identities `DEFER`/`OP-01`. |
| **Batch 5 – Legal Disclosure & Incident Management** | `28` (`B5-01`–`B5-28`) | `§5`, `§6`, `§7` | **`FULL` (Independent Legal/Incident Principles).** Kept isolated as independent legal/compliance procedures; jurisdiction SOPs/channels `DEFER`. |
| **Batch 6 – Residual Risk & Recovery Controls** | `5` (`B6-01`–`B6-05`) | `§3.4.3`, `§4`, `§7`, `§9` | **`FULL` (5 Approved Principles).** Unified Fail-Closed, Scoped Suspension, Recovery Beyond Files, Residual Risk states, Operational Readiness separation from Gate A & Gate B. |

### 7.2 Complete `109`-Control Traceability Matrix (`B1-01` – `B6-05`, Preserved From `REPORT_v1.1 §3.2`)
| Batch & Control Range | Individual Control Traceability (`Paste` -> `v2.0_CANDIDATE`) | Status | Remaining `DEFER` / `OP-01` Dependencies |
|---|---|---|---|
| **Batch 1 (`B1-01`–`B1-16`)** | `B1-01..03` (**Five-part conceptual time-and-trust model**: `Factory Local Time` + `IANA Timezone` + `UTC Offset` + `Resolved Absolute Instant` + `Clock Trust & Event Sequence Provenance` -> `§3.4.2`, `§4`), `B1-04..05` (`Central Event Sequence` deterministic ordering on clock trust loss + `tzdb` deadline immutability -> `§3.4.2`, `§4`), `B1-06..10` (configurable/versioned NTP & drift thresholds, bounded offline window -> `§4`), `B1-11..14` (post-recovery sync/drift/stability validation; untrusted observation w/ unique event ID never relabeled + separate trusted recovery evidence -> `§3.4.2`, `§4`), `B1-15..16` (durable sequence survival + fail-closed on persistence failure -> `§4`). | **`FULL` (`16/16`)** | Physical SQL columns & `due_at` design (`§8 #1`); factory tz/calendar (`§8 #2`/`OP-01`); drift/NTP thresholds (`§6`). |
| **Batch 2 (`B2-01`–`B2-22`)** | `B2-01..04, 21..22` (independent durable sequence outside primary PG, append-before-persisted, append-only + hash chaining, **dual persistence failure = fail closed** -> `§3.4.1`, `§4`), `B2-05..15` (key isolation, minimal payload/references, DPAPI/Cert Store post-design, dedicated service identity, `SysAdmin` barred from content, versioned forward-only rotation, retired key preservation, compromise containment + offline encrypted key backup -> `§3.2`, `§4`), `B2-16..20` (2-person recovery, quarterly isolated drills where failure = Critical Incident, Audit/Security Custodian read + audited/redacted/encrypted export -> `§4`, `§9.3`). | **`FULL` (`22/22`)** | Journal binary format/`fsync`/crypto algs (`§6`); custodian staffing & quarterly drills (`OP-01`). |
| **Batch 3 (`B3-01`–`B3-17`)** | `B3-01..04` (separate Destruction Registry, immutable event lifecycle, independent storage/backup -> `§4`), `B3-05..08` (atomic concurrency-protected JIT hold/incident/preservation validation across primary/replicas/quarantined unexpired backups -> `§4`), `B3-09..14` (Registry-first DR + reapplied destructions + Audit/Security Custodian approval; corruption/missing sequence/conflicts block destruction -> `§4`), `B3-15..17` (residual uncertainty documented + expiry auto-suspends destruction + **Phase 08A non-authorization of binary storage/external purge** -> `§2`, `§4`). | **`FULL` (`17/17`)** | Binary Evidence storage & external purge (`Step 7B` explicitly `DEFERRED` out of Phase 08A). |
| **Batch 4 (`B4-01`–`B4-21`)** | `B4-01..08` (structural independence from `SysAdmin`/`Factory Mgr`, Audit/Security/Gov split, live COI/eligibility, pre-appointed primary + alternate custodians, dual-person where 1 person != both Audit & Security, suspension on COI, immutable appointment log -> `§3.2`, `§4`), `B4-09..15, 21` (formal Governance Charter, quorum/majority, COI exclusion, alternates, **zero emergency quorum bypass** -> `§4`), `B4-16..20` (cryptographically verifiable append-only gov records, `Factory Mgr` summaries only, `SysAdmin` zero auto access, exception purpose-limited auth -> `§3.2`, `§4`). | **`FULL` (`21/21`)** | Charter ratios/cadence (`§6`); custodian/alternate staffing (`OP-01`). |
| **Batch 5 (`B5-01`–`B5-28`)** | `B5-01..07, 22..25` (legal authority/jurisdiction/scope validation, data minimization, originals kept, Legal + Audit Custodian + 2nd independent verifier, JIT recipient/channel check, scope change re-review, automated + human redaction, Legal Holds controlling, reject/log invalid -> `§5`), `B5-08..14, 28` (manifests/hashes, 6 delivery states, anti-resend, transport vs human ack, post-delivery/onward, closure, chain of custody -> `§5`), `B5-15..21, 26..27` (linked workflows, containment/hold suspension, dual hold release, RCA/reopen, legal notices, unauthorized disclosure = Critical Incident, disclosure during incident = legal exception + dual control -> `§5`). | **`FULL` (`28/28`)** | Jurisdiction procedures, reviewer IDs, approved transfer channels, regulatory timelines (`§6`). |
| **Batch 6 (`B6-01`–`B6-05`)** | `B6-01` Unified Fail-Closed Policy (`§4`), `B6-02` Scoped Suspension (`§4`), `B6-03` Recovery Validation Beyond File Restore (`§4`), `B6-04` Residual Risk Governance (`§4`), `B6-05` Operational Readiness Separation (`§4`, `§9.3`). | **`FULL` (`5/5`)** | Operational SOPs, training, custodians (`OP-01`); Live PostgreSQL 14+ verification (`Gate B`). |

---

## 8. Unresolved Technical & Documentation Blockers (Explicitly Preserved)

These items remain intentionally **unresolved** in `v2.0_CANDIDATE` and **must not be closed silently**:
1. **`due_at` Enforcement & Physical Data Representation (`Blocker #1`):** Snapshot-at-step-creation & fail-closed SLA rules are preserved; physical SQL representation for `approval_steps.due_at`, the **five-part conceptual time-and-trust representation**, and `Central Event Sequence` linkage remain a **pre-DDL technical design blocker** (not reopened as an Owner Decision).
2. **Policy-Specific SLA Key Schema, Validation Bounds & Versioned Calendar (`Blocker #2`):** Explicit per-policy keys, versioning, no global fallback, and fail-closed architecture are required; concrete schema key/table structure & validation bounds remain pre-DDL design, while actual timezone, workdays, hours, breaks, holidays, and numeric SLA values remain **`OP-01` operational configuration**.
3. **`#41b` Policy-Specific DTO Field-Level Schemas & Types (`Blocker #3`):** Exact per-policy DTO field names, types, and nullability for Policies `#4`, `#6`, `#8`, `#9` (and `#1`–`#3`, `#5`) under `Decision A` (`404`) and strict free-text/PII exclusion (`#16d` preserves `403` per `AUD-05`).
4. **`ISS-07` Remaining Onboarding & Career-Field Implementation Details (`Blocker #4`):** Implementation details not covered by `OD-A2` (`#2` self-bootstrap payload/anti-placeholder DTO details, `HR Officer` post-bootstrap review workflow, HR-to-`SysAdmin` request/audit mechanism, pre-DDL enforcement triggers/checks).
5. **Remaining Deferred Technical Design & Formal Final Ratification (`Blocker #5`):** Multi-cycle DDL (`Decision D`), `ISS-06` extension/reassignment/outbox/DLQ endpoint & DDL contracts, `Batch 1–5` detailed SOPs/formats, Step 7B binary storage & purge, Phase 11 (`Step 9`), and final Owner ratification authorizing post-Gate-A roadmap alignment (`U-07`).

---

## 9. Strict Read-Only Confirmation & Final Status

- **Repository Modification Check:** **ZERO** application source code, SQL, migrations (`001`–`006`), seeds (`001`–`007`), tests (`runner.ts` `89/89`), package manifests, or `docs/GFMS_DEVELOPMENT_ROADMAP.md` were modified; **ZERO** DB operations or tests executed; **ZERO** permissions or roles created in the system.
- **Prior Documents Preserved Unmodified:** `v0.6`, `v1.0`, `v1.1_CANDIDATE`, `REPORT_v1.1`, `v1.2_CANDIDATE`, `REPORT_v1.2`, `v1.2.1_CANDIDATE`, and `REPORT_v1.2.1` remain 100% unmodified.
- **Final Governance Status:**
  - **Gate A:** **`OPEN / NOT APPROVED`**
  - **Gate B (Live PostgreSQL 14+):** **`NOT VERIFIED / PENDING`**
  - **HR Implementation:** **`NOT AUTHORIZED`**
  - **Operational Readiness (`OP-01`):** **`PENDING`**
