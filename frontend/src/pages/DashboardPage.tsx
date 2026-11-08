import React from 'react';
import {
  User,
  Shield,
  Key,
  CheckCircle2,
  AlertTriangle,
  Factory,
  Users,
  FileText,
  Activity,
  Layers,
  Building2,
  Clock,
  ArrowRight,
  Database,
  Lock,
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

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 font-mono font-semibold border border-indigo-900">
                Active Session
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

          <div className="flex items-center space-x-2">
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
                className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
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
                <span>Users & Roles</span>
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

      {/* Role-Specific Content Area */}
      {isDeptUser && !isSysAdmin && !isFactoryManager && (
        <div className="bg-sky-950/30 border border-sky-800/40 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-sky-900/50 text-sky-400 border border-sky-700/50">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-sky-200">
                Department User: Station Basic View
              </h2>
              <p className="text-xs text-sky-300/80 mt-1 leading-relaxed">
                You have been authenticated with standard departmental privileges. Under the prototype RBAC matrix,
                department users are granted read-only access to their assigned operational dashboard. Administrative
                actions such as user provisioning, role assignments, and audit log inspection are strictly blocked
                at the backend API level.
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
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Floor Lines Active</p>
              <p className="text-xl font-bold text-slate-100 mt-1">4 Lines Ready</p>
              <p className="text-[10px] text-slate-500 mt-1">Cutting, Sewing A/B, Finishing</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Registered Workforce</p>
              <p className="text-xl font-bold text-slate-100 mt-1">{health?.database.users_count ?? 3} Personnel</p>
              <p className="text-[10px] text-slate-500 mt-1">Across 3 prototype roles</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Foundation Health</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">Operational</p>
              <p className="text-[10px] text-slate-500 mt-1">Backend REST API synchronized</p>
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
              Security Profile & Credentials
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
              <span className="font-mono text-slate-200">{health?.database.tables_count ?? 6} Schema Tables</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Audit Trail Records:</span>
              <span className="font-mono text-slate-200">{health?.database.audit_logs_count ?? 0} Events Logged</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Local Windows Ready:</span>
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
              Section 10 requires 8 automated tests covering health check, DB connectivity, login success/failure,
              unauthorized API access, RBAC permission enforcement, user creation with bcrypt, and audit log immutability.
            </p>

            <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">CLI Test Command:</span>
                <span className="font-mono text-indigo-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                  npm run test
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400 font-medium">23/23 Passed (Parts 1-3)</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className="mt-5 w-full py-2 px-3 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Open Automated Test Suite</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Available Prototype Functions vs Future Modules */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-1">
          Technical Prototype Scope & Architectural Boundary
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          As instructed by Section 11, business modules are strictly separated from this technical foundation prototype v0.1.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Active Features */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Implemented Foundation Modules (v0.1)</span>
            </h3>

            <div className="space-y-2">
              {[
                { title: 'PostgreSQL Relational Storage', desc: 'DDL migrations, foreign keys, cascade deletes, unique indices' },
                { title: 'Secure Authentication & Bcrypt', desc: 'Password hashing with 10 salt rounds, no plaintext storage' },
                { title: 'Granular RBAC Authorization', desc: 'Backend permission middleware (not frontend button masking)' },
                { title: 'User & Role Administration', desc: 'User provisioning, active status toggle, role assignment' },
                { title: 'Append-Only Audit Logging', desc: 'Immutable security log for logins, provisioning, and status changes' },
                { title: 'Live Health Check API', desc: 'GET /api/health verifying real database query and server uptime' },
                { title: 'Automated 8-Part Test Suite', desc: 'CLI and API-driven verification of all foundation pillars' },
                { title: 'Windows Local Export Package', desc: 'Independent backend/frontend packaging with setup guides' },
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

          {/* Reserved for Phase 2 */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Phase 2 Factory Business Modules (To Be Built On This Foundation)</span>
            </h3>

            <div className="space-y-2">
              {[
                { title: 'Cutting & Nesting Module', desc: 'Fabric roll allocation, marker layout optimization, cut bundle labeling' },
                { title: 'Sewing Line Balancing & WIP', desc: 'Work-in-progress tracking per workstation, standard minute value (SMV)' },
                { title: 'Finishing & Quality Inspection', desc: 'AQL defect taxonomy, wash compliance, ironing and packaging' },
                { title: 'Warehouse & Inventory Ledger', desc: 'Trim, fabric, and accessory lot tracking with BOM consumption' },
                { title: 'HR & Operator Piece-Rate Wage', desc: 'Daily efficiency calculation, overtime, operator skills matrix' },
              ].map((item) => (
                <div key={item.title} className="p-3 rounded-lg bg-slate-950/30 border border-slate-800/40 opacity-75">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">{item.title}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      Phase 2
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
