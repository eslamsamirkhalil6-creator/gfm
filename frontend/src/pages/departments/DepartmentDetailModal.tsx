import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Users,
  UserCheck,
  UserX,
  History,
  Layers,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  ArrowRightLeft,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import {
  DepartmentWithDetails,
  DepartmentEmployee,
  DepartmentManagerHistoryItem,
  DepartmentProductionLine,
} from '../../types/index.ts';

interface DepartmentDetailModalProps {
  department: DepartmentWithDetails | null;
  canManageManager: boolean;
  canManageEmployees: boolean;
  onClose: () => void;
  onOpenAssignManager: (dept: DepartmentWithDetails) => void;
  onOpenAssignEmployee: (dept: DepartmentWithDetails) => void;
  onOpenTransferEmployee: (dept: DepartmentWithDetails, emp: DepartmentEmployee) => void;
  onRefreshParent: () => void;
}

export const DepartmentDetailModal: React.FC<DepartmentDetailModalProps> = ({
  department,
  canManageManager,
  canManageEmployees,
  onClose,
  onOpenAssignManager,
  onOpenAssignEmployee,
  onOpenTransferEmployee,
  onRefreshParent,
}) => {
  const [details, setDetails] = useState<{
    department: DepartmentWithDetails;
    sub_departments: DepartmentWithDetails[];
    employees: DepartmentEmployee[];
    manager_history: DepartmentManagerHistoryItem[];
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [removingEmpId, setRemovingEmpId] = useState<number | null>(null);

  const fetchDetails = async () => {
    if (!department) return;
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getDepartmentById(department.id);
      setDetails(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load department details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [department?.id]);

  if (!department) return null;

  const handleRemoveEmployee = async (userId: number, fullName: string) => {
    if (!window.confirm(`Are you sure you want to remove "${fullName}" from this department?`)) {
      return;
    }
    try {
      setRemovingEmpId(userId);
      await ApiService.removeDepartmentEmployee(department.id, userId);
      await fetchDetails();
      onRefreshParent();
    } catch (err: any) {
      alert(`Failed to remove employee: ${err.message}`);
    } finally {
      setRemovingEmpId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-800 flex items-center justify-center text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 border border-indigo-900 text-indigo-300">
                  {department.dept_code}
                </span>
                <h2 className="text-base font-bold text-white">{department.name}</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {department.parent_name
                  ? `Sub-Department under ${department.parent_name}`
                  : 'Primary Top-Level Organizational Division'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Description & Metadata Card */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Department Scope & Responsibilities
            </h3>
            <p className="text-xs text-slate-200 leading-relaxed">
              {department.description || 'No formal description provided.'}
            </p>
          </div>

          {/* Appointed Manager Card */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-white">Appointed Department Manager</h3>
              </div>
              {canManageManager && (
                <button
                  onClick={() => onOpenAssignManager(department)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                >
                  {department.manager_name ? 'Change Manager' : 'Appoint Manager'}
                </button>
              )}
            </div>

            {department.manager_name ? (
              <div className="flex items-center space-x-3 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <div className="w-9 h-9 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 flex items-center justify-center font-bold text-sm">
                  {department.manager_name.charAt(0)}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{department.manager_name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">@{department.manager_username}</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-400/90 italic bg-amber-950/20 p-3 rounded-lg border border-amber-900/40">
                No primary manager currently appointed to this department.
              </div>
            )}
          </div>

          {/* Sub-Departments Section */}
          {details?.sub_departments && details.sub_departments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white">
                  Sub-Departments ({details.sub_departments.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {details.sub_departments.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono text-[10px] text-indigo-400 font-bold">
                          {sub.dept_code}
                        </span>
                        <span className="text-xs font-semibold text-white">{sub.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Manager: {sub.manager_name || 'Vacant'} · {sub.employee_count} staff
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked Production Lines Section */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white">
                Linked Production Lines ({details?.department?.production_lines?.length || 0})
              </h3>
            </div>

            {details?.department?.production_lines && details.department.production_lines.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {details.department.production_lines.map((line: DepartmentProductionLine) => (
                  <div
                    key={line.id}
                    className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-900/60">
                          {line.line_number}
                        </span>
                        <div className="text-xs font-semibold text-white mt-1">{line.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Hall: {line.hall_name || 'Unassigned'} · Type: {line.production_type}
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                          line.status === 'active'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {line.status}
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Cap: {line.capacity_per_day?.toLocaleString() || 0} pcs/day</span>
                      <span>Sup: {line.supervisor_name || 'None'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg text-slate-500 text-xs italic">
                No production lines currently linked to this department.
              </div>
            )}
          </div>

          {/* Assigned Employees List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-white">
                  Assigned Staff Members ({details?.employees?.length ?? 0})
                </h3>
              </div>
              {canManageEmployees && (
                <button
                  onClick={() => onOpenAssignEmployee(department)}
                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Staff</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                Loading assigned staff...
              </div>
            ) : details?.employees && details.employees.length > 0 ? (
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Member</th>
                      <th className="py-2.5 px-3">Position / Title</th>
                      <th className="py-2.5 px-3">Assignment</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {details.employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-850/40">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-white">{emp.full_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">@{emp.username}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-200 font-medium">
                          {emp.position_title}
                        </td>
                        <td className="py-2.5 px-3">
                          {emp.is_primary ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                              Primary Dept
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                              Secondary Link
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {canManageEmployees && (
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => onOpenTransferEmployee(department, emp)}
                                title="Transfer to another department"
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRemoveEmployee(emp.user_id, emp.full_name)}
                                disabled={removingEmpId === emp.user_id}
                                title="Remove employee from department"
                                className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-850">
                No staff members currently assigned to this department.
              </div>
            )}
          </div>

          {/* Historical Manager Tenure Timeline (Section 6) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2">
              <History className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold text-white">
                Manager Assignment History
              </h3>
            </div>

            {details?.manager_history && details.manager_history.length > 0 ? (
              <div className="space-y-2 border-l-2 border-slate-800 pl-4 ml-2">
                {details.manager_history.map((hist) => (
                  <div key={hist.id} className="relative text-xs space-y-0.5 pb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 absolute -left-[21px] top-1" />
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-white">
                        {hist.manager_name || 'Unassigned / Vacant'}
                      </span>
                      {hist.relinquished_at ? (
                        <span className="text-[10px] text-slate-400">
                          (Tenure concluded)
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Current Active
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Appointed by {hist.assigned_by_name || 'System'} on{' '}
                      {new Date(hist.assigned_at).toLocaleDateString()}
                      {hist.notes && ` · "${hist.notes}"`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic pl-2">
                No previous manager tenure records on file.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-950/70">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
