import React, { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  Building2,
  Users,
  UserCheck,
  UserX,
  Layers,
  MoreVertical,
  CheckCircle,
  XCircle,
  Eye,
  Edit2,
  UserPlus,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { DepartmentWithDetails } from '../../types/index.ts';

interface DepartmentListViewProps {
  departments: DepartmentWithDetails[];
  loading: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canStatus: boolean;
  canManageManager: boolean;
  canManageEmployees: boolean;
  onOpenCreate: () => void;
  onOpenEdit: (dept: DepartmentWithDetails) => void;
  onOpenDetail: (dept: DepartmentWithDetails) => void;
  onOpenAssignManager: (dept: DepartmentWithDetails) => void;
  onOpenAssignEmployee: (dept: DepartmentWithDetails) => void;
  onToggleStatus: (dept: DepartmentWithDetails) => void;
  onDelete: (dept: DepartmentWithDetails) => void;
}

export const DepartmentListView: React.FC<DepartmentListViewProps> = ({
  departments,
  loading,
  canCreate,
  canEdit,
  canStatus,
  canManageManager,
  canManageEmployees,
  onOpenCreate,
  onOpenEdit,
  onOpenDetail,
  onOpenAssignManager,
  onOpenAssignEmployee,
  onToggleStatus,
  onDelete,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [parentFilter, setParentFilter] = useState<string>('all');
  const [actionMenuOpenId, setActionMenuOpenId] = useState<number | null>(null);

  const topLevelDepts = departments.filter((d) => !d.parent_id);

  const filteredDepts = departments.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch =
      d.name.toLowerCase().includes(q) ||
      d.dept_code.toLowerCase().includes(q) ||
      (d.description && d.description.toLowerCase().includes(q)) ||
      (d.manager_name && d.manager_name.toLowerCase().includes(q));

    const matchStatus =
      statusFilter === 'all' || d.status === statusFilter;

    let matchParent = true;
    if (parentFilter === 'toplevel') {
      matchParent = d.parent_id === null;
    } else if (parentFilter !== 'all') {
      matchParent = d.parent_id === Number(parentFilter);
    }

    return matchSearch && matchStatus && matchParent;
  });

  return (
    <div className="space-y-4">
      {/* Search and Filters Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, department name, manager..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="all">All Statuses ({departments.length})</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Hierarchy Branch Filter */}
          <select
            value={parentFilter}
            onChange={(e) => setParentFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 shrink-0"
          >
            <option value="all">All Levels</option>
            <option value="toplevel">Top-Level Primary Branches</option>
            {topLevelDepts.map((p) => (
              <option key={p.id} value={p.id}>
                Under {p.name} ({p.dept_code})
              </option>
            ))}
          </select>
        </div>

        {canCreate && (
          <button
            onClick={onOpenCreate}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Department</span>
          </button>
        )}
      </div>

      {/* Departments Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Department Name</th>
                <th className="py-3 px-4">Hierarchy Position</th>
                <th className="py-3 px-4">Appointed Manager</th>
                <th className="py-3 px-4 text-center">Staff Allocations</th>
                <th className="py-3 px-4 text-center">Sub-Depts</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && departments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="inline-block w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-xs">Loading organizational directory from PostgreSQL...</p>
                  </td>
                </tr>
              ) : filteredDepts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    No departments found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredDepts.map((dept) => (
                  <tr
                    key={dept.id}
                    className="hover:bg-slate-850/40 transition-colors"
                  >
                    {/* Code */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-slate-950 border border-indigo-900/60 text-indigo-300">
                        {dept.dept_code}
                      </span>
                    </td>

                    {/* Name & Description */}
                    <td className="py-3 px-4">
                      <div
                        onClick={() => onOpenDetail(dept)}
                        className="cursor-pointer group"
                      >
                        <div className="font-semibold text-white group-hover:text-indigo-400 transition-colors flex items-center space-x-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400" />
                          <span>{dept.name}</span>
                        </div>
                        {dept.description && (
                          <div className="text-[11px] text-slate-400 line-clamp-1 max-w-sm mt-0.5">
                            {dept.description}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Hierarchy Position */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {dept.parent_name ? (
                        <div className="flex items-center space-x-1.5 text-slate-300">
                          <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="text-[11px]">
                            {dept.parent_name}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-medium">
                          Primary Top-Level
                        </span>
                      )}
                    </td>

                    {/* Manager */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {dept.manager_name ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                            {dept.manager_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-white text-[11px]">
                              {dept.manager_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              @{dept.manager_username}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] bg-amber-950/50 border border-amber-800/60 text-amber-300">
                          <UserX className="w-3 h-3" />
                          <span>Unassigned</span>
                        </span>
                      )}
                    </td>

                    {/* Staff Allocations */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1 font-mono text-xs font-semibold text-slate-200">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>{dept.employee_count}</span>
                      </span>
                    </td>

                    {/* Sub-Depts */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="font-mono text-xs text-slate-400">
                        {dept.sub_department_count}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
                          dept.status === 'active'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800/80'
                            : 'bg-rose-950 text-rose-300 border-rose-800/80'
                        }`}
                      >
                        {dept.status === 'active' ? (
                          <>
                            <CheckCircle className="w-2.5 h-2.5" />
                            <span>ACTIVE</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-2.5 h-2.5" />
                            <span>INACTIVE</span>
                          </>
                        )}
                      </span>
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="relative inline-block text-left">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => onOpenDetail(dept)}
                            title="Inspect Details"
                            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => onOpenEdit(dept)}
                              title="Edit Department"
                              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canManageManager && (
                            <button
                              onClick={() => onOpenAssignManager(dept)}
                              title="Assign / Replace Manager"
                              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-sky-300 transition-colors"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canManageEmployees && (
                            <button
                              onClick={() => onOpenAssignEmployee(dept)}
                              title="Assign Employee"
                              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-purple-300 transition-colors"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canStatus && (
                            <button
                              onClick={() => onToggleStatus(dept)}
                              title={
                                dept.status === 'active'
                                  ? 'Deactivate Department'
                                  : 'Activate Department'
                              }
                              className={`p-1.5 rounded-md hover:bg-slate-800 transition-colors ${
                                dept.status === 'active'
                                  ? 'text-amber-400 hover:text-amber-300'
                                  : 'text-emerald-400 hover:text-emerald-300'
                              }`}
                            >
                              {dept.status === 'active' ? (
                                <XCircle className="w-3.5 h-3.5" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          {canCreate && (
                            <button
                              onClick={() => onDelete(dept)}
                              title="Delete Department (Safety checked)"
                              className="p-1.5 rounded-md hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
