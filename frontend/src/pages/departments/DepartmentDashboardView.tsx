import React from 'react';
import {
  Building2,
  CheckCircle2,
  XCircle,
  UserCheck,
  UserX,
  Users,
  ChevronRight,
  TrendingUp,
  Layers,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { DepartmentStats, DepartmentWithDetails } from '../../types/index.ts';

interface DepartmentDashboardViewProps {
  stats: DepartmentStats | null;
  departments: DepartmentWithDetails[];
  loading: boolean;
  onNavigateTab: (tab: 'directory' | 'hierarchy') => void;
  onSelectDepartment: (dept: DepartmentWithDetails) => void;
}

export const DepartmentDashboardView: React.FC<DepartmentDashboardViewProps> = ({
  stats,
  departments,
  loading,
  onNavigateTab,
  onSelectDepartment,
}) => {
  if (loading && !stats) {
    return (
      <div className="py-16 text-center text-slate-400">
        <div className="inline-block w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Loading Department Dashboard metrics from PostgreSQL...</p>
      </div>
    );
  }

  const topLevelDepts = departments.filter((d) => !d.parent_id);
  const subDepts = departments.filter((d) => d.parent_id);

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{stats?.total ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Organizational Units</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{stats?.active ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Operational Depts</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">Inactive</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">{stats?.inactive ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Deactivated Depts</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">Managed</span>
            <UserCheck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-sky-400">{stats?.with_manager ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Appointed Managers</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Unmanaged</span>
            <UserX className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">{stats?.without_manager ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Vacant Manager Post</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400">Allocations</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400">
            {stats?.total_employee_assignments ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Staff Assignments</div>
        </div>
      </div>

      {/* Main Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Employee Distribution */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">Workforce Distribution by Department</h2>
            </div>
            <button
              onClick={() => onNavigateTab('directory')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1"
            >
              <span>View Full Directory</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            Live headcounts derived from PostgreSQL <code className="text-indigo-300 font-mono">department_employees</code> records.
          </p>

          <div className="space-y-3">
            {stats?.distribution && stats.distribution.length > 0 ? (
              stats.distribution.map((item) => {
                const max = Math.max(...stats.distribution.map((d) => d.employee_count), 1);
                const pct = Math.round((item.employee_count / max) * 100);
                const dept = departments.find((d) => d.id === item.department_id);

                return (
                  <div
                    key={item.department_id}
                    onClick={() => dept && onSelectDepartment(dept)}
                    className="p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-indigo-400 text-[11px] font-bold">
                          {item.dept_code}
                        </span>
                        <span className="text-white font-medium group-hover:text-indigo-300 transition-colors">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-slate-300 font-semibold">
                          {item.employee_count} {item.employee_count === 1 ? 'member' : 'members'}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                No active departments found.
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Hierarchy Structure Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Organizational Hierarchy</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Structural distribution between parent corporate departments and specialized operational sub-units.
            </p>

            <div className="space-y-3 mb-6">
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs text-white font-semibold">Top-Level Departments</div>
                  <div className="text-[10px] text-slate-400">Primary operational branches</div>
                </div>
                <div className="text-lg font-bold font-mono text-emerald-400">
                  {topLevelDepts.length}
                </div>
              </div>

              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs text-white font-semibold">Sub-Departments</div>
                  <div className="text-[10px] text-slate-400">Specialized child sections (e.g. Cutting, Sewing)</div>
                </div>
                <div className="text-lg font-bold font-mono text-indigo-400">
                  {subDepts.length}
                </div>
              </div>
            </div>

            {/* Production Architecture Alignment Note */}
            <div className="p-3 bg-indigo-950/30 border border-indigo-900/50 rounded-lg text-xs text-indigo-200 space-y-1">
              <div className="flex items-center space-x-1.5 font-semibold text-white">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Production Module Linkage:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Production sub-departments (Cutting, Sewing, Packing) are linked to physical production lines without altering physical hall configurations or line balancing workflows.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('hierarchy')}
            className="w-full mt-6 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center justify-center space-x-2 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open Interactive Hierarchy Tree</span>
          </button>
        </div>
      </div>
    </div>
  );
};
