import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  UserCheck,
  Layers,
  Edit2,
  UserPlus,
  Trash2,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Activity,
  ArrowRightLeft,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { ApiService } from '../services/api.ts';
import { useAuth } from '../hooks/useAuth.tsx';
import {
  DepartmentWithDetails,
  DepartmentEmployee,
  DepartmentProductionLine,
  AssignableUser,
} from '../types/index.ts';
import { AssignEmployeeModal } from './departments/AssignEmployeeModal.tsx';
import { DepartmentFormModal } from './departments/DepartmentFormModal.tsx';

export const MyDepartmentPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const managedIds = user?.managed_department_ids || [];

  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(
    user?.primary_department_id || (managedIds.length > 0 ? managedIds[0] : null)
  );

  const [departmentData, setDepartmentData] = useState<{
    department: DepartmentWithDetails;
    sub_departments: DepartmentWithDetails[];
    employees: DepartmentEmployee[];
    manager_history: any[];
    production_lines: DepartmentProductionLine[];
  } | null>(null);

  const [allDepartments, setAllDepartments] = useState<DepartmentWithDetails[]>([]);
  const [usersList, setUsersList] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [transferringEmployee, setTransferringEmployee] = useState<DepartmentEmployee | null>(null);
  const [removingEmpId, setRemovingEmpId] = useState<number | null>(null);

  // Sync selectedDeptId if user's managed list updates
  useEffect(() => {
    if (!selectedDeptId && managedIds.length > 0) {
      setSelectedDeptId(user?.primary_department_id || managedIds[0]);
    }
  }, [user, selectedDeptId]);

  const loadData = async () => {
    if (!selectedDeptId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [deptDetail, depts, users] = await Promise.all([
        ApiService.getDepartmentById(selectedDeptId),
        ApiService.getDepartments().catch(() => []),
        ApiService.getDepartmentAssignableUsers(selectedDeptId),
      ]);

      setDepartmentData(deptDetail);
      setAllDepartments(depts);
      setUsersList(users);
    } catch (err: any) {
      setError(err.message || 'Failed to load department workspace data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDeptId]);

  const handleRemoveEmployee = async (empUserId: number, empName: string) => {
    if (!departmentData) return;
    if (!window.confirm(`Are you sure you want to remove "${empName}" from this department?`)) {
      return;
    }

    try {
      setRemovingEmpId(empUserId);
      await ApiService.removeDepartmentEmployee(departmentData.department.id, empUserId);
      setSuccessMsg(`Employee ${empName} was successfully removed from ${departmentData.department.dept_code}`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(`Failed to remove employee: ${err.message}`);
    } finally {
      setRemovingEmpId(null);
    }
  };

  if (managedIds.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-white mb-1">No Managed Department Assigned</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          You are currently not recorded as the appointed manager of any factory department.
          Department manager assignments must be configured by an administrator.
        </p>
      </div>
    );
  }

  const dept = departmentData?.department;
  const employees = departmentData?.employees || [];
  const lines: DepartmentProductionLine[] = departmentData?.production_lines || [];
  const primaryEmployees = employees.filter((e) => e.is_primary);
  const secondaryEmployees = employees.filter((e) => !e.is_primary);

  return (
    <div className="space-y-6">
      {/* Header & Department Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400 shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">
                  {dept?.dept_code || '...'}
                </span>
                <h1 className="text-xl font-bold text-white">{dept?.name || 'My Department'}</h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Department Manager Workspace • Operational roster and linked line management
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Multi-department Selector */}
            {managedIds.length > 1 && (
              <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
                <span className="text-[11px] text-slate-400">Managed Dept:</span>
                <select
                  value={selectedDeptId || ''}
                  onChange={(e) => setSelectedDeptId(Number(e.target.value))}
                  className="bg-transparent text-xs text-indigo-300 font-semibold focus:outline-hidden"
                >
                  {allDepartments
                    .filter((d) => managedIds.includes(d.id))
                    .map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                        {d.name} ({d.dept_code})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              title="Refresh Department Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            {dept && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Edit Info</span>
              </button>
            )}

            {dept && (
              <button
                onClick={() => {
                  setTransferringEmployee(null);
                  setIsAssignModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Assign Staff</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg flex items-start space-x-2 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg flex items-start space-x-2 text-xs text-emerald-300">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">Total Staff</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{employees.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {primaryEmployees.length} primary · {secondaryEmployees.length} secondary
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">Production Lines</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{lines.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {lines.filter((l: DepartmentProductionLine) => l.status === 'active').length} active lines
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">Department Status</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-center space-x-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${
                dept?.status === 'active'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border-rose-800'
              }`}
            >
              {dept?.status || 'ACTIVE'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">(System Controlled)</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Parent: {dept?.parent_name || 'Primary Division'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">Appointed Manager</span>
            <UserCheck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-sm font-bold text-white mt-2 truncate">
            {dept?.manager_name || user?.full_name}
          </div>
          <div className="text-[11px] text-indigo-400 font-mono mt-0.5">
            @{dept?.manager_username || user?.username} (You)
          </div>
        </div>
      </div>

      {/* Department Description / Operational Scope Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Operational Scope &amp; Responsibilities
          </h2>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 cursor-pointer"
          >
            <Edit2 className="w-3 h-3" />
            <span>Update Scope</span>
          </button>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
          {dept?.description || 'No formal operational description provided yet.'}
        </p>
      </div>

      {/* Linked Production Lines */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">
              Linked Production Lines ({lines.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            Floor lines assigned under this department&apos;s jurisdiction
          </span>
        </div>

        {lines.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lines.map((line: DepartmentProductionLine) => (
              <div
                key={line.id}
                className="bg-slate-950 border border-slate-850 rounded-lg p-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-900">
                      {line.line_number}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                        line.status === 'active'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {line.status}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white mt-2">{line.name}</h3>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Hall: <span className="text-slate-300">{line.hall_name || 'Main Factory'}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Process: <span className="text-slate-300">{line.production_type}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Cap: <span className="font-mono text-slate-200">{line.capacity_per_day?.toLocaleString()} pcs/day</span></span>
                  <span>Sup: <span className="text-slate-300">{line.supervisor_name || 'Unassigned'}</span></span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-lg border border-slate-850">
            No production lines currently mapped to {dept?.dept_code}.
          </div>
        )}
      </div>

      {/* Staff Allocations Roster */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white">
              Assigned Department Employees ({employees.length})
            </h2>
          </div>
          <button
            onClick={() => {
              setTransferringEmployee(null);
              setIsAssignModalOpen(true);
            }}
            className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white flex items-center space-x-1 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Member</span>
          </button>
        </div>

        {employees.length > 0 ? (
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Staff Member</th>
                  <th className="py-2.5 px-3">Position / Title</th>
                  <th className="py-2.5 px-3">Designation</th>
                  <th className="py-2.5 px-3">Assigned Date</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-850/40">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-white">{emp.full_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">@{emp.username}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 font-medium">
                      {emp.position_title}
                    </td>
                    <td className="py-2.5 px-3">
                      {emp.is_primary ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Primary Department
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                          Secondary Link
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                      {new Date(emp.assigned_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => {
                            setTransferringEmployee(emp);
                            setIsAssignModalOpen(true);
                          }}
                          title="Transfer to another department"
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveEmployee(emp.user_id, emp.full_name)}
                          disabled={removingEmpId === emp.user_id}
                          title="Remove from department"
                          className="p-1.5 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-850">
            No employees currently assigned to this department.
          </div>
        )}
      </div>

      {/* Modals */}
      {isAssignModalOpen && dept && (
        <AssignEmployeeModal
          department={dept}
          departments={allDepartments}
          users={usersList}
          transferEmployee={transferringEmployee}
          onClose={() => {
            setIsAssignModalOpen(false);
            setTransferringEmployee(null);
          }}
          onSuccess={() => {
            setIsAssignModalOpen(false);
            setTransferringEmployee(null);
            setSuccessMsg('Employee allocation updated successfully.');
            setTimeout(() => setSuccessMsg(null), 4000);
            loadData();
          }}
        />
      )}

      {isEditModalOpen && dept && (
        <DepartmentFormModal
          initialDept={dept}
          departments={allDepartments}
          users={usersList}
          canManageManager={false} // Department manager cannot reappoint manager
          canManageHierarchy={false} // Department manager cannot change parent hierarchy
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            setIsEditModalOpen(false);
            setSuccessMsg('Department operational details updated successfully.');
            setTimeout(() => setSuccessMsg(null), 4000);
            loadData();
          }}
        />
      )}
    </div>
  );
};
