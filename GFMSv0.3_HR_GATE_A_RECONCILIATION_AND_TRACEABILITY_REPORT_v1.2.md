# GFMSv0.3 – HR Gate A Reconciliation & Traceability Report (v1.2)

**Document ID:** `GFMSv0.3_HR_GATE_A_RECONCILIATION_AND_TRACEABILITY_REPORT_v1.2.md`  
**Companion Addendum:** `/.aistudio/artifacts/brain/f1c889e7-f83c-4612-b6df-e6c812aa338f/GFMSv0.3_HR_GATE_A_FINAL_ADDENDUM_v1.2_CANDIDATE.md`  
**Status:** **`DRAFT – FOR OWNER REVIEW`**  
**Gate A Status:** **`GATE A – OPEN / NOT APPROVED`**  
**Implementation Status:** **`HR IMPLEMENTATION – NOT AUTHORIZED`**  
**Gate B Status (Live PostgreSQL 14+):** **`NOT VERIFIED / PENDING`** *(Container runs `pg-mem v3.0.14`; `pg-mem` never constitutes PostgreSQL 14+ proof.)*  
**Operational Readiness (`OP-01`):** **`PENDING`**  
**Date:** 2026-11-17  

---

## 1. Approved Owner Decision Register (`Decision A` – `Decision D` — **`APPROVED`**)

The System Owner explicitly **APPROVED** all four proposed resolutions from `v1.1`. All four are recorded in `v1.2_CANDIDATE` and removed from the pending-confirmation queue:

| Decision ID | Source Issue | Owner Status | Approved Resolution & Traceable Effect in `v1.2_CANDIDATE` |
|---|---|---|---|
| **`Decision A`** | `CONTRADICTION-01` (`ISS-02 #41b` HTTP Status) | **`APPROVED`** | Unified **HTTP `404`** for nonexistent, unauthorized, unassigned/pooled, and finalized `#41b` requests; preserve **`400`** (invalid `:id`) and **`401`** (unauthenticated). Reflected in `v1.2_CANDIDATE §3.1.1, §3.3, §3.6`. *(Historical `v1.0` `403` wording left untouched and superseded by `v1.2` Decision A.)* |
| **`Decision B`** | `GAP-01` (`CONTRADICTION-02` SLA Config RBAC) | **`APPROVED`** | Architectural permission split: **`hr:sla:manage`** (`System Administrator` only), **`hr:sla:view`** (`System Administrator` + `HR Manager` strictly read-only), keeping **`hr:admin:manage`** unchanged for `hr_leave_types` and non-SLA `hr_settings`. Reflected in `v1.2_CANDIDATE §3.1.1, §3.2, §3.5, §7`. *(Zero permissions, seeds, migrations, or code created.)* |
| **`Decision C`** | `GAP-02` (`HR Manager` Conflicted Reassignment) | **`APPROVED`** | Fail closed when `HR Manager` is conflicted or ineligible; keep step **`PENDING`** and create operational escalation; zero implied fallback authority for `Factory Manager`, `Owner Executive`, delegates, or `System Administrator`; kept strictly separate from `#41c` exceptional `Factory Manager` Governance Fallback Cancellation. Reflected in `v1.2_CANDIDATE §3.1.1, §3.2, §3.5`. |
| **`Decision D`** | `GAP-03` (Multi-Cycle Approval Data Model) | **`APPROVED` (Arch) / `DEFERRED` (DDL)** | Linked, immutable multi-cycle approval history is a mandatory architectural requirement; `v0.6` single `approval_request_id` pointers are not sufficient for unlimited reopenings; exact FK structure, column names, uniqueness constraints, indexes, and migrations remain `DEFERRED` to pre-DDL design review. Reflected in `v1.2_CANDIDATE §3.1.1, §3.5, §6`. |

---

## 2. Updated Contradiction, Gap & Cross-Reference Register

| ID | Category | Finding Description | Resolution / Current Status in `v1.2` | Remaining Dependency |
|---|---|---|---|---|
| **`CONTRADICTION-01`** | Error Status Conflict | `Paste §11` unified `404` vs `v1.0` (`lines 169, 181, 331`) `403` on `#41b`. | **`RESOLVED / APPROVED` (`Decision A`)** — Unified `404` (`400`/`401` preserved) across `v1.2_CANDIDATE`. | Field-level DTO schema (`OPEN`) |
| **`CONTRADICTION-02` / `GAP-01`** | RBAC Conflict | `v0.6 §5.2` / `v1.0 §4.1 #37` dual `hr:admin:manage` vs `Paste §4.1 #13–#14` exclusive `SysAdmin` SLA management. | **`RESOLVED / APPROVED` (`Decision B`)** — Conceptual `hr:sla:manage` (`SysAdmin` only) & `hr:sla:view` (`SysAdmin` + `HR Mgr` read-only); `hr:admin:manage` unchanged. | Pre-DDL / Seed `008` design (`DEFERRED`) |
| **`CONTRADICTION-03`** | Transaction vs. Audit Durability | `Paste §4.5` notification delivery non-rollback vs `Batch 2 #21–#22` audit/journal fail-closed. | **`RECONCILED` (`v1.2_CANDIDATE §3.4.1`)** — (1) Outbox persistence is atomic with business TX (failure prevents commit); (2) Post-commit channel delivery failure retries -> DLQ without rollback; (3) Audit durability is mandatory; (4) Dual persistence failure (primary + Emergency Journal) fails closed. | Outbox/DLQ & Emergency Journal pre-DDL/design (`DEFERRED`) |
| **`CONTRADICTION-04`** | Time Data Model | `Batch 1 #1–#3` (Factory Local Time + IANA tz + UTC offset + resolved instant + sequence) vs `v0.6` bare `TIMESTAMPTZ`. | **`RECONCILED` (`v1.2_CANDIDATE §3.4.2`)** — Explicitly establishes why bare `TIMESTAMPTZ` is insufficient (discards local wall-clock, IANA zone, offset, and clock-trust/sequence provenance) and defines the 5-part conceptual representation without inventing SQL columns. | Factory IANA tz, exact `due_at` design (`OPEN`), pre-DDL columns (`DEFERRED`) |
| **`CONTRADICTION-05`** | SLA Seed / Fail-Closed | `v0.6 §3.3 #8` lacks policy SLA keys vs `Paste §4.1 #8` fail-closed cycle creation. | **`RECONCILED` (`v1.2_CANDIDATE §3.4.3`)** — Cycle/step creation blocked without active validated policy SLA config; zero silent defaults or `due_at`-less `PENDING` steps; deployment/`OP-01` requires validated SLA configs before activation. | Policy SLA keys, min/max bounds, calendar values (`OPEN`) |
| **`GAP-02`** | Workflow Conflict | `Paste §4.4` conflicted `HR Manager` reassignment fallback unspecified. | **`RESOLVED / APPROVED` (`Decision C`)** — Fail closed, keep `PENDING`, operational escalation, zero implied fallback, separate from `#41c`. | Escalation SOP (`OP-01`) |
| **`GAP-03`** | Data Model Limitation | `v0.6 §3.3` single `approval_request_id` pointers vs `Paste §4.7` unlimited linked reopening cycles. | **`RESOLVED / APPROVED` (Arch `Decision D`) / `DEFERRED` (Schema)** — Mandatory immutable multi-cycle requirement established; detailed FK/column/index DDL deferred. | Pre-DDL Step-3/4 schema review (`DEFERRED`) |
| **`GAP-04`** | Raw Traceability | Raw `#1`–`#171` `ISS-06` numbered ledger missing from workspace/artifacts/`Paste`. | **`OPEN` (`UNMAPPED 0 / 171`)** — Zero fabricated mappings; tracked via `107` grouped `ISS-06-G001`–`G107`. | Owner supplies raw `#1`–`#171` ledger (`OPEN`) |
| **`LABEL-AMB-01`** | Option Label Drift | `Paste §3 U-03`/`U-04` labeled `Option B` vs `v1.0 OD-03` (`Option A`) / `U-04` (unlabeled). | **Disclosed & Preserved (`v1.2_CANDIDATE §3.1.2`)** — Approved semantics are 100% consistent and preserved. | None |
| **`OPEN-SLA-EXT`** | Extension Conflict | `HR Manager` conflicted/unavailable for SLA extension (`Paste §4.2`). | **`OPEN – OWNER DECISION REQUIRED`** (`Factory Manager` NOT assumed). | Owner decision (`OPEN`) |
| **`OPEN-NUANCE-C`** | Endpoint `#24` Parity | `v0.6 §4.1 #24` `GET /api/hr/shifts*` generic `hr:self` vs `hr:self:attendance:view`. | **Included in `v1.2_CANDIDATE §3.1.2`, pending formal Owner ratification (`OPEN`)**. | Formal confirmation (`OPEN`) |

---

## 3. `ISS-06` Traceability Report (`Raw #1–#171` vs. `Grouped ISS-06-G001–G107`)

### 3.1 Raw `#1`–`#171` Traceability Limitation
- **Raw `#1`–`#171` Mapping Count:** **`0 / 171` mapped (`171 / 171 UNMAPPED`)**.
- **Missing Source Material:** The original numbered `ISS-06` decision ledger (`#1`–`#171` with individual decision numbers, titles, and `Option A/B/...` labels) remains unavailable in this environment (`v0.6`, `v1.0`, `Paste_November_17__2026_-_1_09PM_1c3d6963`, and repository directories). No raw `#1`–`#171` titles, option labels, or numeric mappings have been fabricated. The complete 171-slot `UNMAPPED` ledger from `RECONCILIATION_AND_TRACEABILITY_REPORT_v1.1.md §2.2` remains intact and unchanged.

### 3.2 Updated Grouped `ISS-06` Coverage (`ISS-06-G001` – `ISS-06-G107`)

Changes from `v1.1` to `v1.2` based strictly on **newly approved Owner Decisions (`B`, `C`, `D`)** and **reconciled `CONTRADICTION-03`/`04`/`05`**:
- **`ISS-06-G013` & `ISS-06-G014`** (`SysAdmin` exclusive SLA management / `HR Manager` read-only SLA): Upgraded **`CONFLICTING` -> `FULL`** (resolved by **`Decision B`**; pre-DDL Seed `008` creation remains `DEFERRED`).
- **`ISS-06-G053`** (`HR Manager` exclusive reassignment subject to COI): Upgraded **`PARTIAL` -> `FULL`** (conflicted fallback resolved by **`Decision C`**).
- **`ISS-06-G064`** (`Notification delivery failure non-blocking`): Upgraded **`PARTIAL` -> `FULL`** (atomic outbox vs async delivery vs durable audit boundary reconciled by **`CONTRADICTION-03`**).
- **`ISS-06-G081`, `G082`, `G090`** (Multi-cycle reopening & immutable prior cycles): Architectural requirement approved (**`Decision D`**), while physical FK/index/constraint schema remains **`DEFERRED`** — honestly retained as **`PARTIAL`** until pre-DDL schema design is completed.

| Group (`Paste`) | Principle IDs | Count | `v1.2` Status Counts | Delta vs. `v1.1` & Remaining Open/Deferred Dependencies |
|---|---|---|---|---|
| `4.1` SLA & Business Calendar | `G001`–`G019` | `19` | **`13 FULL` · `6 PARTIAL` · `0 CONFLICTING`** | `G013`, `G014` upgraded to **`FULL`** (`Decision B`); `6 PARTIAL` reflect `OPEN` tz/calendar/bounds/keys/`due_at` details. |
| `4.2` SLA Extensions | `G020`–`G029` | `10` | **`6 FULL` · `4 PARTIAL` · `0 CONFLICTING`** | Unchanged; `HR Manager` SLA-extension conflict fallback (`G026`/`G027`/`G029`) & calendar (`G025`) stay `OPEN`. |
| `4.3` Governance Fallback Cancel | `G030`–`G042` | `13` | **`10 FULL` · `3 PARTIAL` · `0 CONFLICTING`** | Unchanged (`G035`, `G037`, `G039` reflect `DEFER` retry/evidence design & `OP-01`). |
| `4.4` Expiry & Late Decisions | `G043`–`G056` | `14` | **`12 FULL` · `2 PARTIAL` · `0 CONFLICTING`** | `G053` upgraded **`PARTIAL` -> `FULL`** (`Decision C`); `G049` (calendar), `G050` (`DEFER` scheduler) stay `PARTIAL`. |
| `4.5` Reassignment & Notifications | `G057`–`G069` | `13` | **`11 FULL` · `2 PARTIAL` · `0 CONFLICTING`** | `G064` upgraded **`PARTIAL` -> `FULL`** (`CONTRADICTION-03`); `G065`, `G066` (`DEFER` retry/DLQ schema) stay `PARTIAL`. |
| `4.6` Escalation | `G070`–`G082` | `13` | **`8 FULL` · `5 PARTIAL` · `0 CONFLICTING`** | Unchanged (`G081`/`G082` `Decision D` schema `DEFERRED`; scheduler/policy escalation rules `DEFER`). |
| `4.7` Reopening Approval Cycles | `G083`–`G100` | `18` | **`11 FULL` · `7 PARTIAL` · `0 CONFLICTING`** | Unchanged (`Decision D` resolves arch requirement for `G090`, DDL `DEFERRED`; policy reopen flags `DEFER`). |
| `4.8` Policy Versioning | `G101`–`G107` | `7` | **`5 FULL` · `2 PARTIAL` · `0 CONFLICTING`** | Unchanged (`G101` DDL `DEFER`, `G106` `OP-01` alert SOP). |
| **Grouped Total** | **`ISS-06-G001`–`G107`** | **`107`** | **`76 FULL` · `31 PARTIAL` · `0 CONFLICTING` · `0 MISSING`** | **Net `+4 FULL` (`-2 CONFLICTING`, `-2 PARTIAL`); `0` unresolved conflicts.** |

---

## 4. Six-Batch Traceability Matrix (`Batch 1` – `Batch 6` — Preserved `100%`)

| Batch | Rules (`B1`–`B6`) | `v1.2_CANDIDATE` Section(s) | Status & Reconciliation Notes |
|---|---|---|---|
| **Batch 1 – Clock Integrity & Time Trust** | `16` (`B1-01`–`B1-16`) | `§3.4.2`, `§4`, `§6`, `§7` | **`FULL` (Architectural Principles).** `CONTRADICTION-04` explicitly reconciles bare `TIMESTAMPTZ` insufficiency & 5-part conceptual model; tz/calendar/bounds/inventory `OPEN`/`DEFER`. |
| **Batch 2 – Emergency Journal & Cryptographic Recovery** | `22` (`B2-01`–`B2-22`) | `§3.4.1`, `§4`, `§6`, `§7`, `§9` | **`FULL` (Architectural Principles).** `CONTRADICTION-03` explicitly preserves dual-persistence fail-closed & non-conflation with notification delivery; detailed formats/DPAPI/drills `DEFER`/`OP-01`. |
| **Batch 3 – Evidence Repository & Destruction Registry** | `17` (`B3-01`–`B3-17`) | `§2`, `§4`, `§6`, `§7` | **`FULL` (Architectural Principles).** Step 7B binary evidence & external purge explicitly kept out of Phase 08A (`DEFERRED`). |
| **Batch 4 – Governance & Custodian Independence** | `21` (`B4-01`–`B4-21`) | `§3.2`, `§4`, `§6`, `§7`, `§9` | **`FULL` (Architectural Principles).** Reinforced by `Decision B` & `Decision C` strict separation of duties; Charter ratios/identities `DEFER`/`OP-01`. |
| **Batch 5 – Legal Disclosure & Incident Management** | `28` (`B5-01`–`B5-28`) | `§5`, `§6`, `§7` | **`FULL` (Independent Legal/Incident Principles).** Kept isolated as independent legal/compliance procedures; jurisdiction SOPs/channels `DEFER`. |
| **Batch 6 – Residual Risk & Recovery Controls** | `5` (`B6-01`–`B6-05`) | `§3.4.3`, `§4`, `§7`, `§9` | **`FULL` (5 Approved Principles).** Unified Fail-Closed, Scoped Suspension, Recovery Beyond Files, Residual Risk states, Operational Readiness separation from Gate A & Gate B. |

---

## 5. Remaining `OPEN` / `DEFERRED` Items & Final Confirmation

- **Remaining `OPEN` Gate A Items:**
  1. `HR Manager` SLA-extension conflict fallback (`Factory Manager` not assumed).
  2. Exact active `PENDING` `approval_steps.due_at` enforcement & conceptual time-column bundle integration.
  3. Policy-specific SLA keys, numeric min/max bounds, factory IANA timezone, working days/hours, breaks, and official holidays (`CONTRADICTION-05`).
  4. `ISS-02 #41b` concrete field-level DTO schema (names, types, nullability).
  5. `ISS-07 / NUANCE-B` post-bootstrap `#4` career-field self-edit locks and `System Administrator` `users:roles` secondary `'Department User'` onboarding handoff.
  6. `NUANCE-C` endpoint `#24` granular `hr:self:attendance:view` parity formal confirmation.
  7. Raw `ISS-06` `#1`–`#171` numbered source ledger (`0 / 171` mapped).
  8. Formal final Gate A ratification (`HR-DEC-01`–`14`, `OD-01`–`03`, `U-01`–`07`, `§11.2 #2–#5`, `Decision A`–`D`, `Batches 1–6`, final Addendum).
- **Remaining `DEFERRED` Pre-DDL / Design Items:** Multi-cycle approval DDL (`Decision D`), Batch 1–3 physical schemas, SLA/Calendar/Extension/Reassignment/Outbox/DLQ DDL, Seed `008` `hr:sla:*` keys (`Decision B`), Step 7B binary storage & purge, Batch 4 Charter details, Batch 5 legal/channel SOPs, Phase 11 (`Step 9`).
- **Separate Engineering & Operational Gates:** **Gate B** (Live PostgreSQL 14+ verification — `NOT VERIFIED / PENDING`; `pg-mem` never proves PG compatibility) and **`OP-01`** (Operational Readiness — `PENDING`).
- **Read-Only Confirmation:** Zero repository files, application code, SQL, migrations (`001`–`006`), seeds (`001`–`007`), tests, development roadmap, production configs, `v1.0`, `v1.1_CANDIDATE`, or `RECONCILIATION_REPORT_v1.1` were modified.
