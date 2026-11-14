import React from 'react';
import {
  User,
  CheckCircle2,
  Factory,
  Users,
  FileText,
  Activity,
  Layers,
  Building2,
  Clock,
  ArrowRight,
  Database,
  ClipboardList,
  Boxes,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';
import { HealthCheckData } from '../types/index.ts';
import { ActiveTab } from '../components/Navbar.tsx';

interface DashboardPageProps {
  health: HealthCheckData | null;
  setActiveTab: (tab: ActiveTab) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ health, setActiveTab }) => {
  const { user, hasPermission, hasRole } = useAuth();

  const isDbConnected = health?.database?.status === 'CONNECTED';
  const isSysAdmin = hasRole('System Administrator');
  const isFactoryManager = hasRole('Factory Manager');
  const isDeptUser = hasRole('Department User');
  const canViewPlanning = hasPermission('planning:view') || hasPermission('planning:manage');
  const canViewWarehouse =
    hasPermission('warehouse:view') ||
    hasPermission('inventory:requisition:create') ||
    hasPermission('inventory:qc_inspect') ||
    hasPermission('inventory:return');
  const isDeptManager =
    hasRole('Department Manager') &&
    !isFactoryManager &&
    !isSysAdmin &&
    (hasPermission('departments:scoped:view') || hasPermission('departments:scoped:manage')) &&
    Boolean(user?.managed_department_ids && user.managed_department_ids.length > 0);
  const isPureDeptUser =
    isDeptUser && !isSysAdmin && !isFactoryManager && !isDeptManager && !canViewPlanning && !canViewWarehouse;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 font-mono font-semibold border border-indigo-900">
                Active Session • GFMS v0.3
              </span>
              <span className="text-xs text-slate-400">Garment Factory Management System</span>
            </div>
            <h1 className="text-xl font-bold text-white mt-1">
              Welcome, {user?.full_name}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Logged in as <span className="text-slate-200 font-mono font-medium">@{user?.username}</span> with roles:{' '}
              {user?.roles.map((r) => (
                <span
                  key={r}
                  className="inline-block px-1.5 py-0.2 mx-0.5 rounded bg-slate-800 text-indigo-300 font-medium text-[11px] border border-slate-700"
                >
                  {r}
                </span>
              ))}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canViewWarehouse && (
              <button
                onClick={() => setActiveTab('warehouse')}
                className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Warehouse &amp; Inventory</span>
              </button>
            )}

            {isDeptManager && (
              <button
                onClick={() => setActiveTab('my-department')}
                className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>My Department</span>
              </button>
            )}

            {canViewPlanning && (
              <button
                onClick={() => setActiveTab('planning')}
                className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Planning</span>
              </button>
            )}

            {hasPermission('production:view') && (
              <button
                onClick={() => setActiveTab('production')}
                className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Production</span>
              </button>
            )}

            {hasPermission('departments:view') && (
              <button
                onClick={() => setActiveTab('departments')}
                className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-indigo-300 border border-slate-700 transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Departments</span>
              </button>
            )}

            {hasPermission('users:read') && (
              <button
                onClick={() => setActiveTab('users')}
                className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Users &amp; Roles</span>
              </button>
            )}

            {hasPermission('audit:read') && (
              <button
                onClick={() => setActiveTab('audit')}
                className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Audit Trail</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Warehouse & Inventory Dedicated Workspace Banner */}
      {canViewWarehouse && !isSysAdmin && (
        <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded bg-indigo-900/50 text-indigo-300 border border-indigo-700/50">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-indigo-200">
                  Warehouse &amp; Inventory Operations Console Ready
                </h2>
                <p className="text-xs text-indigo-300/80 mt-1 leading-relaxed">
                  {user?.managed_warehouse_ids && user.managed_warehouse_ids.length > 0
                    ? `You are scoped to ${user.managed_warehouse_ids.length} warehouse(s) [${user.managed_warehouse_ids.join(', ')}]. Manage GRN receiving, QC quarantine inspection, FIFO material issuing, transfers, stock counts, adjustments, and valuation within your RBAC authorization.`
                    : 'Access material catalog, GRN receiving, QC quarantine queue, material requisitions, inter-warehouse transfers, stock counts, reorders, and immutable stock ledger reports.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('warehouse')}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
            >
              <span>Open Warehouse &amp; Inventory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Department Manager Dedicated Banner */}
      {isDeptManager && (
        <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded bg-indigo-900/50 text-indigo-400 border border-indigo-700/50">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-indigo-200">
                  Department Manager Workspace Available
                </h2>
                <p className="text-xs text-indigo-300/80 mt-1 leading-relaxed">
                  You are the appointed manager for {user?.managed_department_ids?.length} department(s). You have authority over your assigned department&apos;s staff allocations, linked production line status, and operational details.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('my-department')}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
            >
              <span>Open My Department</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Department Planner Dedicated Banner */}
      {canViewPlanning && !isSysAdmin && !isFactoryManager && (
        <div className="bg-amber-950/25 border border-amber-800/40 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded bg-amber-900/40 text-amber-400 border border-amber-700/50">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-amber-200">
                  Department Planning Workspace Available
                </h2>
                <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
                  You have explicit planning access across {user?.planning_department_ids?.length || 0} assigned department(s).
                  Planning authority is scoped solely to capacity planning schedules and does not grant department management privileges.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('planning')}
              className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
            >
              <span>Open Planning Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Role-Specific Content Area */}
      {isPureDeptUser && (
        <div className="bg-sky-950/30 border border-sky-800/40 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-sky-900/50 text-sky-400 border border-sky-700/50">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-sky-200">
                Department User: Basic Station Access Only
              </h2>
              <p className="text-xs text-sky-300/80 mt-1 leading-relaxed">
                You are authenticated with generic Department User privileges. Department membership alone does not grant
                department dashboard access, staff allocation authority, or department management permissions. All restricted
                department and administrative APIs are blocked at the backend layer.
              </p>
              <div className="mt-3 p-3 bg-slate-900/80 rounded border border-slate-800 inline-block text-xs">
                <span className="text-slate-400">Granted Backend Permissions: </span>
                <span className="font-mono text-emerald-400">
                  {user?.permissions.join(', ') || 'dashboard:view'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isFactoryManager && !isSysAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                <Factory className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-white">Factory Floor Overview (Manager Access)</h2>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
              Permitted Role: Factory Manager
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Floor Lines Configured</p>
              <p className="text-xl font-bold text-slate-100 mt-1">Production Ready</p>
              <p className="text-[10px] text-slate-500 mt-1">Halls, lines, workflows &amp; scoped planning</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Registered Workforce</p>
              <p className="text-xl font-bold text-slate-100 mt-1">{health?.database.users_count ?? 0} Accounts</p>
              <p className="text-[10px] text-slate-500 mt-1">Multi-role RBAC &amp; warehouse scope enforced</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Platform Health</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">Operational (v0.3)</p>
              <p className="text-[10px] text-slate-500 mt-1">WMS, Production, Departments &amp; REST API synced</p>
            </div>
          </div>
        </div>
      )}

      {/* Grid: User Profile & Security Details + Database Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-slate-800">
            <User className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Security Profile &amp; Credentials
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">User ID:</span>
              <span className="font-mono text-slate-200">{user?.id}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Username:</span>
              <span className="font-mono text-indigo-300">{user?.username}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Full Name:</span>
              <span className="text-slate-200">{user?.full_name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Account Status:</span>
              <span className="flex items-center space-x-1 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Active</span>
              </span>
            </div>
            <div className="py-1">
              <span className="text-slate-400 block mb-1.5">Assigned Roles:</span>
              <div className="flex flex-wrap gap-1.5">
                {user?.roles.map((r) => (
                  <span
                    key={r}
                    className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-medium text-[11px]"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <span className="text-slate-400 block mb-1.5">Enforced Backend Permissions:</span>
              <div className="flex flex-wrap gap-1">
                {user?.permissions.map((p) => (
                  <span
                    key={p}
                    className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Database & System Connectivity */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-slate-800">
            <Database className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              PostgreSQL Data Layer
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Connection State:</span>
              <span className={`font-semibold ${isDbConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                {health?.database.status || 'Checking...'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Engine / Adapter:</span>
              <span className="text-slate-200 text-right truncate max-w-[170px]" title={health?.database.engine}>
                {health?.database.engine || 'PostgreSQL'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Runtime Mode:</span>
              <span className="text-indigo-300">{health?.database.mode || 'In-Memory Engine'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Ping Query Latency:</span>
              <span className="font-mono text-emerald-400 font-semibold">{health?.database.latency_ms ?? 0} ms</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Database Tables:</span>
              <span className="font-mono text-slate-200">{health?.database.tables_count ?? 41} Schema Tables</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Audit Trail Records:</span>
              <span className="font-mono text-slate-200">{health?.database.audit_logs_count ?? 0} Events Logged</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">External PostgreSQL:</span>
              <span className="text-slate-300">Set DATABASE_URL</span>
            </div>
          </div>
        </div>

        {/* Quick Diagnostics & Test Runner Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-slate-800">
              <Activity className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Automated Verification
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Full-stack integration suite covering security hardening, rate limiting, ACID transactions, RBAC role &amp; warehouse scope enforcement,
              and end-to-end WMS receiving, QC, FIFO issuing, transfers, stock counts, and ledger reconciliation.
            </p>

            <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">CLI Test Command:</span>
                <span className="font-mono text-indigo-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                  npm test
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Release Target:</span>
                <span className="text-emerald-400 font-medium">GFMS v0.3 (Phase 07 Suite)</span>
              </div>
            </div>
          </div>

          {isSysAdmin ? (
            <button
              onClick={() => setActiveTab('diagnostics')}
              className="mt-5 w-full py-2 px-3 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Open Automated Test Suite</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="mt-5 p-2 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400 text-center">
              Automated integration testing restricted to System Administrators
            </div>
          )}
        </div>
      </div>

      {/* Implemented GFMS v0.3 Modules vs Phase 08+ Roadmap */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-1">
          GFMS v0.3 Operational Scope &amp; Roadmap Boundaries
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Phase 07 delivers security/API hardening and the full Warehouse &amp; Inventory Management Console on top of GFMS Foundation, Production Setup, and Departments.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Active Features */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Implemented Modules (GFMS v0.3)</span>
            </h3>

            <div className="space-y-2">
              {[
                { title: 'Security, Auth & Granular RBAC', desc: 'Hardened JWT/CORS guards, login rate limiting, permission & scope middleware, immutable audit logs' },
                { title: 'Warehouse & Bin Directory', desc: 'Warehouses, configurable bin tracking with DEFAULT bin lock, staff assignments & policy settings' },
                { title: 'Inbound Receiving (GRN & FG) + QC', desc: 'Material catalog, GRN posting, roll/shade lot tracking, quarantine queue, QC inspection & senior override' },
                { title: 'Outbound Issuing, Transfers & Control', desc: 'Requisitions, advisory FIFO issuing, returns, 2-step transfers, cycle counts, adjustments, 3-tier reorders & WAC ledger' },
                { title: 'Production Setup & Department Architecture', desc: 'Factory halls, production lines, stage workflows, department hierarchy & scoped capacity planning' },
              ].map((item) => (
                <div key={item.title} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                      Active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Phase 08+ Modules */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Upcoming Roadmap Modules (Phase 08+)</span>
            </h3>

            <div className="space-y-2">
              {[
                { title: 'Purchasing, Suppliers & PO Fulfillment', desc: 'Vendor master, RFQs, Purchase Orders & PO-to-GRN tolerance loop', phase: 'Phase 08' },
                { title: 'Garment Styles, BOM & MRP Explosion', desc: 'Buyer sales orders, technical BOMs, automated MRP material shortages', phase: 'Phase 09' },
                { title: 'Cutting, Sewing WIP & Packing Execution', desc: 'Work orders, cut bundles, line output tracking & carton handover', phase: 'Phase 09' },
                { title: 'Shop-Floor Quality Gates & AQL Audits', desc: 'Fabric 4-point checks, inline sewing defects, AQL 2.5 & rework loops', phase: 'Phase 10' },
                { title: 'HR, Piece-Rate Wage & Job Costing', desc: 'Workforce attendance/evaluations, logistics gate passes & order costing', phase: 'Phase 11' },
              ].map((item) => (
                <div key={item.title} className="p-3 rounded-lg bg-slate-950/30 border border-slate-800/40 opacity-80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">{item.title}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                      {item.phase}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
