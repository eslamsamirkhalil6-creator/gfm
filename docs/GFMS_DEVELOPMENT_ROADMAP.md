# GFMS Development Roadmap (Post-Phase 06 Master Sequence)

**Project:** Garment Factory Management System (GFMS)  
**Baseline:** Phases 01–06 Complete (Foundation Auth/RBAC, Production Setup, Departments, WMS Backend APIs, RBAC Clarification & Planning Prototype, System-Wide Assessment)  
**Horizon:** Phases 07–12 (From Current Prototype to Integrated Production-Ready ERP/MES Platform)

---

## Roadmap Sequencing Summary

```
[Phase 07: Platform Hardening & WMS Operations Console]   <-- NEXT (Mandatory Prerequisite)
        |
        +---> [Phase 08: Purchasing, Suppliers & Procurement-to-Receiving Loop]
        |             |
        |             v
        +---> [Phase 09: Garment Master Data (Styles/BOM), MRP & Production Execution Engine]
                      |
                      v
              [Phase 10: Quality Control Engine & Production Quality Gates]
                      |
                      v
              [Phase 11: HR, Piece-Rate & Employee Evaluation + Transportation & Costing]
                      |
                      v
              [Phase 12: Live PostgreSQL Staging, Concurrency Load Testing & CI/CD Production Readiness]
```

> **Sequencing Principle:** Existing modules and cross-module security/API seams (`Phase 07`) are stabilized and surfaced to users first. Procurement (`Phase 08`) and Production Execution (`Phase 09`) follow immediately so Planning, Warehouse, QC, HR, and Logistics integrate against shared canonical entities (`Supplier`, `PurchaseOrder`, `Style`, `BOM`, `WorkOrder`, `Bundle`) rather than free-text fields or disconnected CRUD islands.

---

## Phase 07 – Platform Security/API Hardening & Warehouse Operations Console

- **Phase Name:** Phase 07 – Platform Security/API Hardening & Warehouse Operations Console
- **Objective:** Eliminate Critical/High security, RBAC, transaction-boundary, and API-envelope defects; verify live PostgreSQL 14+ trigger/locking parity; and deliver the complete React Warehouse Management UI (`WarehouseModule`) alongside refreshed operational dashboards and UAT accounts.
- **Priority:** **P0 – Critical (Immediate Next Phase)**
- **Dependencies:** Existing Phases 01–05 backend & database (`001`–`006`); access to a live PostgreSQL 14+ instance for DB verification.
- **Expected Outcome:**
  - Hardened production startup checks (`JWT_SECRET`, `CORS_ORIGIN`), login rate limiting, self-deactivation/last-admin guards, and notification IDOR fix (`markNotificationRead`).
  - Transaction-safe `UserService`, `DepartmentService`, and `ProductionService.reorderWorkflowSteps`, plus standardized `AppError` JSON responses across all controllers and `limit`/`offset` pagination on WMS lists.
  - Corrected RBAC role permissions (`Production Manager`, `QC Manager`, `Department Manager` `planning:view`), permission-based warehouse scope replacing `GLOBAL_WAREHOUSE_ROLES`, and seeded UAT credentials.
  - Complete interactive React Warehouse Console wired to all 55+ WMS endpoints and updated v0.3+ Dashboard/Navbar views.
- **Testing Requirements:**
  - Expanded backend integration tests (`85+` cases) covering IDOR rejection, rate limiting, rollback atomicity, standardized errors, and role-scope boundaries.
  - Full migration + trigger (`trg_stock_movements_immutable`) + parallel HTTP `FOR UPDATE` concurrency test run against **live PostgreSQL 14+**.
  - End-to-end browser verification across all roles plus clean `tsc --noEmit` and `npm run build`.
- **Completion Criteria:** Zero Critical/High open platform defects; 100% pass rate in both `pg-mem` and live PostgreSQL suites; every Phase 04 WMS operation executable end-to-end via the React UI.

---

## Phase 08 – Purchasing, Suppliers & Procurement-to-Receiving Integration

- **Phase Name:** Phase 08 – Purchasing, Suppliers & Procurement-to-Receiving Integration
- **Objective:** Replace WMS free-text `po_reference` and stubbed `DEP-PUR` workflows with a full Supplier Master, Purchase Requisition / RFQ workflow, Purchase Order (PO) lifecycle, and strict PO-to-GRN fulfillment tracking.
- **Priority:** **P1 – High**
- **Dependencies:** Phase 07 complete (standardized APIs, live WMS Receiving UI, `Purchasing Manager` operational login & scoped notifications).
- **Expected Outcome:**
  - Relational tables (`suppliers`, `supplier_materials`, `purchase_orders`, `purchase_order_items`) with vendor lead times, MOQ, currency, and payment terms.
  - Complete PO workflow (`DRAFT` -> `SUBMITTED` -> `APPROVED` -> `PARTIALLY_RECEIVED` -> `CLOSED` / `CANCELLED`) enforcing Factory Manager / Purchasing Manager approval thresholds.
  - Live integration closing the Phase 04 `reorder_requests` loop via a formal `LINKED_TO_PO` API endpoint and converting approved reorder requests into PO lines.
  - WMS GRN validation enforcing cumulative received quantity across multiple GRNs against linked PO quantities (`grn_over_delivery_tolerance_pct`).
  - React Purchasing & Suppliers UI workspace (`PurchasingModule`).
- **Testing Requirements:**
  - Integration tests validating reorder -> PO conversion (`LINKED_TO_PO`), split GRN cumulative over-delivery blocking (0% tolerance), PO price -> WAC valuation propagation, and Purchasing vs Warehouse segregation of duties.
  - Browser E2E tests for Supplier creation, PO approval, and PO-backed GRN receiving.
- **Completion Criteria:** Zero unvalidated free-text-only PO dependencies for active procurement; automated 3-way quantity/price consistency from Reorder Request -> PO -> GRN -> WAC Inventory Ledger.

---

## Phase 09 – Garment Master Data (Styles/BOM), MRP Planning & Production Execution Engine

- **Phase Name:** Phase 09 – Garment Master Data (Styles/BOM), MRP Planning & Production Execution Engine
- **Objective:** Transform the setup-only `production` and prototype `planning` modules into a real garment factory execution engine supporting Sales/Buyer Orders, Style & Bill of Materials (BOM) definitions, MRP stock checks, Production Work Orders, Cutting lays/bundles, Sewing WIP/daily line output, and Packing-to-WMS Finished Goods handover.
- **Priority:** **P1 – High**
- **Dependencies:** Phase 07 (WMS Frontend/API baseline) and Phase 08 (Purchasing POs so MRP shortages can trigger Procurement Requisitions/Reorders).
- **Expected Outcome:**
  - Buyer Order & Garment Technical Master schema (`buyers`, `sales_orders`, `garment_styles`, `style_boms`, `style_operations_smv`).
  - Real MRP engine inside `Planning` (`DEP-PLAN`) exploding active schedules/orders against BOMs and live `inventory_balances` (`available_qty`) to detect fabric/trim shortages and generate draft WMS requisitions or reorder requests.
  - Production Work Order engine (`production_orders`, `cutting_lays`, `cut_bundles`, `bundle_stage_movements`, `daily_line_outputs`, `packing_cartons`) bound to Phase 02 `production_workflows` and `production_lines`.
  - Automated Packing Carton finalization invoking `WarehouseInboundService.receiveFinishedGoods` into `WH-FG`.
  - Dedicated React workspaces for `Cutting`, `Sewing Line Tracking`, `Packing`, and enhanced `MRP Planning` (plus `Production Manager` & `Line Supervisor` dashboards).
- **Testing Requirements:**
  - Integration tests covering BOM explosion math, MRP shortage calculation, Work Order stage sequence enforcement (`allow_stage_bypass`), Cutting bundle yield vs issued fabric weight/length, and Packing -> `WH-FG` inventory ledger posting inside atomic transactions.
  - Concurrency tests for parallel bundle movement scans and daily line output posting.
- **Completion Criteria:** Complete digital thread from Buyer Order -> MRP Plan -> WMS Issue -> Cutting -> Sewing -> Packing -> Finished Goods Warehouse Stock (`WH-FG`), with live order progress visible on Factory & Department dashboards.

---

## Phase 10 – Quality Control Engine & Production Quality Gates

- **Phase Name:** Phase 10 – Quality Control Engine & Production Quality Gates
- **Objective:** Expand QC beyond WMS incoming quarantine (`WH-QUAR`) into full shop-floor Quality Assurance covering Fabric 4-Point inspection, Cut-Panel audits, Inline/Endline Sewing defect capture, AQL 2.5 final carton audits, rework routing, and runtime enforcement of `production_workflow_steps.quality_gate` & bypass approvals.
- **Priority:** **P1 – High**
- **Dependencies:** Phase 09 complete (Work Orders, Bundles, and Workflow execution state machine exist to attach QC gates onto).
- **Expected Outcome:**
  - Shop-floor QC tables (`qc_defect_codes`, `fabric_4point_inspections`, `inline_qc_audits`, `aql_sampling_plans`, `rework_orders`, `stage_bypass_approvals`).
  - Distinct RBAC authority differentiating `QC Manager` (approve AQL waivers, manage defect taxonomy, sign off `require_qc_signoff_to_bypass` overrides) from `QC Inspector` (execute scoped inspections & log defects).
  - Hard blocking of `quality_gate = TRUE` workflow transitions until a passing QC audit is recorded, and enforcement of `production_settings` (`allow_stage_bypass`, `require_qc_signoff_to_bypass`).
  - React QC Workbench consolidating WMS Quarantine Inspection UI and Shop-Floor Inline/AQL Inspection dashboards with DHU (Defects Per Hundred Units) metrics.
- **Testing Requirements:**
  - Integration tests verifying `quality_gate` transition blocking, `QC Inspector` vs `QC Manager` segregation on bypass overrides, AQL 2.5 pass/fail thresholds, and rework bundle re-entry flows.
  - Role-based browser walkthroughs for `QC Inspector` and `QC Manager`.
- **Completion Criteria:** 100% runtime enforcement of configured `production_settings` and `production_workflow_steps.quality_gate`; real-time defect/DHU reporting across sewing and packing lines.

---

## Phase 11 – HR, Workforce Evaluation, Transportation & Financial Costing Integration

- **Phase Name:** Phase 11 – HR, Workforce Evaluation, Transportation & Financial Costing Integration
- **Objective:** Operationalize the remaining seeded factory departments (`DEP-HR`, `DEP-TRANS`, `DEP-FIN`, and `DEP-SALES` dispatch closure) by delivering HR Workforce & Employee Evaluation, Logistics/Gate-Pass Dispatch, and Production Order Cost Accounting.
- **Priority:** **P2 – Medium**
- **Dependencies:** Phase 09 (Production line output & Work Orders for piece-rate/efficiency & order costing) and Phase 10 (QC defect metrics for operator quality scoring).
- **Expected Outcome:**
  - **HR & Employee Evaluation:** Dedicated `HR Manager` / `HR Officer` roles, employee HR profiles (hire date, skill grades, shift, wage/piece-rate model), daily attendance logs, and periodic Employee Evaluation reviews linking line output efficiency & QC defect rates to operator appraisals.
  - **Transportation & Dispatch:** Gate passes, vehicle/carrier manifests, inter-warehouse transit tracking (`warehouse_transfers` linked to physical trip logs), and Finished Goods export shipment dispatch out of `WH-FG`.
  - **Factory Cost Accounting (`Finance`):** Automated job-costing ledger aggregating WMS issued material WAC costs + labor SMV/piece-rate + variance write-offs per Production Order, accessible to `Finance Viewer` / Finance roles.
- **Testing Requirements:**
  - Unit & integration tests for piece-rate/SMV efficiency calculation, HR PII field-level RBAC isolation, FG dispatch stock deduction vs export manifest balancing, and order cost variance reconciliation (`StockMovements` WAC == Cost Ledger).
- **Completion Criteria:** All 10 seeded GFMS organizational departments backed by active schemas, RBAC roles, APIs, and UI modules with zero orphaned stub departments.

---

## Phase 12 – Live PostgreSQL Staging, Load/Concurrency Verification & CI/CD Production Readiness

- **Phase Name:** Phase 12 – Live PostgreSQL Staging, Load/Concurrency Verification & CI/CD Production Readiness
- **Objective:** Certify GFMS for live factory deployment with automated CI/CD pipelines, modularized unit/integration/E2E test suites, security penetration checks, backup/recovery drills, and multi-user PostgreSQL stress testing.
- **Priority:** **P2 – Medium (Mandatory Gate Before Production Go-Live)**
- **Dependencies:** Phases 07–11 functionally complete (or executed iteratively alongside Milestones 08–11 before go-live).
- **Expected Outcome:**
  - Refactor monolithic `backend/src/tests/runner.ts` into modular automated test suites (`Vitest` / `Playwright`) integrated into CI running against a real PostgreSQL 14+ service container.
  - Automated multi-worker concurrency & deadlock stress tests (simultaneous GRNs, stock issues, transfers, bundle scans, and cycle count locks).
  - Security & compliance verification: OWASP API top-10 audit, dependency vulnerability scanning, TLS/reverse-proxy configuration, automated `pg_dump` backup/restore runbooks, and structured JSON logging + metrics observability.
  - Production deployment runbook (`ARCHITECTURE.md` / deployment guide update).
- **Testing Requirements:**
  - 100% automated CI pass across Unit, Live-PG Integration, Frontend Component, and Playwright E2E suites.
  - Zero unresolved Critical/High findings in pre-release security scan and documented load-test benchmarks under peak simulated shift activity.
- **Completion Criteria:** Signed-off staging validation on live PostgreSQL 14+; reproducible backup/restore verification; green production readiness checklist.
