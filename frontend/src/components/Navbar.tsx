import React from 'react';
import {
  Factory,
  Users,
  FileText,
  Activity,
  LogOut,
  Server,
  Database,
  Code2,
  Layers,
  Building2,
  ClipboardList,
  Boxes,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';
import { HealthCheckData } from '../types/index.ts';

export type ActiveTab =
  | 'dashboard'
  | 'warehouse'
  | 'production'
  | 'departments'
  | 'my-department'
  | 'planning'
  | 'users'
  | 'audit'
  | 'diagnostics'
  | 'architecture';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  health: HealthCheckData | null;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, health }) => {
  const { user, logout, hasPermission, hasRole } = useAuth();

  const isDbConnected = health?.database?.status === 'CONNECTED';
  const isApiUp = health?.status === 'UP';
  const isDeptManager =
    hasRole('Department Manager') &&
    !hasRole('Factory Manager') &&
    !hasRole('System Administrator') &&
    (hasPermission('departments:scoped:view') || hasPermission('departments:scoped:manage')) &&
    Boolean(user?.managed_department_ids && user.managed_department_ids.length > 0);
  const canViewPlanning = hasPermission('planning:view') || hasPermission('planning:manage');
  const canViewWarehouse =
    hasPermission('warehouse:view') ||
    hasPermission('inventory:requisition:create') ||
    hasPermission('inventory:qc_inspect') ||
    hasPermission('inventory:return');

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-md text-white shadow-sm flex items-center justify-center">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-tight text-lg text-white">GFMS</span>
                <span className="text-xs uppercase px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400 font-mono font-medium border border-slate-700">
                  v0.3 Operations
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Garment Factory Management System</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 flex-wrap">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Factory className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dashboard</span>
            </button>

            {canViewWarehouse && (
              <button
                onClick={() => setActiveTab('warehouse')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  activeTab === 'warehouse'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-indigo-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Boxes className="w-3.5 h-3.5 text-indigo-300" />
                <span>Warehouse &amp; Inventory</span>
              </button>
            )}

            {hasPermission('production:view') && (
              <button
                onClick={() => setActiveTab('production')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  activeTab === 'production'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Production</span>
              </button>
            )}

            {hasPermission('departments:view') && (
              <button
                onClick={() => setActiveTab('departments')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  activeTab === 'departments'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Departments</span>
              </button>
            )}

            {isDeptManager && (
              <button
                onClick={() => setActiveTab('my-department')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  activeTab === 'my-department'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-indigo-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-300" />
                <span>My Department</span>
              </button>
            )}

            {canViewPlanning && (
              <button
                onClick={() => setActiveTab('planning')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  activeTab === 'planning'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-amber-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 text-amber-300" />
                <span>Planning</span>
              </button>
            )}

            {hasPermission('users:read') && (
              <button
                onClick={() => setActiveTab('users')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>Users &amp; Roles</span>
              </button>
            )}

            {hasPermission('audit:read') && (
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  activeTab === 'audit'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Audit Logs</span>
              </button>
            )}

            {hasRole('System Administrator') && (
              <button
                onClick={() => setActiveTab('diagnostics')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  activeTab === 'diagnostics'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Automated Tests</span>
              </button>
            )}

            {(hasRole('System Administrator') || hasRole('Factory Manager')) && (
              <button
                onClick={() => setActiveTab('architecture')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  activeTab === 'architecture'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Architecture &amp; Export</span>
              </button>
            )}
          </nav>

          {/* User Info & Connection Badges */}
          <div className="flex items-center space-x-3">
            {/* Live Status Indicators */}
            <div className="hidden lg:flex items-center space-x-2 text-[11px] font-mono border-r border-slate-800 pr-3">
              <div className="flex items-center space-x-1 text-slate-300">
                <Server className="w-3 h-3 text-slate-400" />
                <span>API:</span>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    isApiUp ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                  }`}
                />
              </div>
              <div className="flex items-center space-x-1 text-slate-300">
                <Database className="w-3 h-3 text-slate-400" />
                <span>PG:</span>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    isDbConnected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                  }`}
                />
              </div>
            </div>

            {/* Current User Session */}
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-xs font-medium text-white flex items-center justify-end space-x-1.5">
                    <span>{user.full_name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({user.username})</span>
                  </div>
                  <div className="flex items-center justify-end space-x-1 mt-0.5">
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-medium"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={logout}
                  title="Logout from session"
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Mobile / Narrow Viewport Navigation Strip */}
        <nav className="flex md:hidden items-center gap-1 overflow-x-auto pb-2.5 pt-1 border-t border-slate-800/70">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
              activeTab === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400'
            }`}
          >
            Dashboard
          </button>
          {canViewWarehouse && (
            <button
              onClick={() => setActiveTab('warehouse')}
              className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
                activeTab === 'warehouse' ? 'bg-indigo-600 text-white' : 'text-indigo-300'
              }`}
            >
              Warehouse
            </button>
          )}
          {hasPermission('production:view') && (
            <button
              onClick={() => setActiveTab('production')}
              className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
                activeTab === 'production' ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
            >
              Production
            </button>
          )}
          {hasPermission('departments:view') && (
            <button
              onClick={() => setActiveTab('departments')}
              className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
                activeTab === 'departments' ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
            >
              Departments
            </button>
          )}
          {isDeptManager && (
            <button
              onClick={() => setActiveTab('my-department')}
              className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
                activeTab === 'my-department' ? 'bg-indigo-600 text-white' : 'text-indigo-300'
              }`}
            >
              My Dept
            </button>
          )}
          {canViewPlanning && (
            <button
              onClick={() => setActiveTab('planning')}
              className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
                activeTab === 'planning' ? 'bg-amber-600 text-white' : 'text-amber-300'
              }`}
            >
              Planning
            </button>
          )}
          {hasPermission('users:read') && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
                activeTab === 'users' ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
            >
              Users
            </button>
          )}
          {hasPermission('audit:read') && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
                activeTab === 'audit' ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
            >
              Audit
            </button>
          )}
          {hasRole('System Administrator') && (
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
                activeTab === 'diagnostics' ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
            >
              Tests
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};
