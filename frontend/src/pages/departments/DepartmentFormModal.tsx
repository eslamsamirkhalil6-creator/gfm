import React, { useState, useEffect } from 'react';
import { X, Building2, AlertCircle, Save } from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import {
  DepartmentWithDetails,
  CreateDepartmentDTO,
  UpdateDepartmentDTO,
  AssignableUser,
} from '../../types/index.ts';

interface DepartmentFormModalProps {
  initialDept?: DepartmentWithDetails | null;
  defaultParentId?: number | null;
  departments: DepartmentWithDetails[];
  users: AssignableUser[];
  canManageManager?: boolean;
  canManageHierarchy?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DepartmentFormModal: React.FC<DepartmentFormModalProps> = ({
  initialDept,
  defaultParentId,
  departments,
  users,
  canManageManager = true,
  canManageHierarchy = true,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(initialDept);

  const [deptCode, setDeptCode] = useState(initialDept?.dept_code || '');
  const [name, setName] = useState(initialDept?.name || '');
  const [description, setDescription] = useState(initialDept?.description || '');
  const [parentId, setParentId] = useState<number | null>(
    initialDept ? initialDept.parent_id : (defaultParentId || null)
  );
  const [managerId, setManagerId] = useState<number | null>(
    initialDept ? initialDept.manager_id : null
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exclude current department from parent dropdown to prevent self-parenting
  const validParents = departments.filter((d) => !initialDept || d.id !== initialDept.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Department Name is required.');
      return;
    }
    if (!isEdit && !deptCode.trim()) {
      setError('Department Code is required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEdit && initialDept) {
        const updatePayload: UpdateDepartmentDTO = {
          name: name.trim(),
          description: description.trim() || undefined,
          ...(canManageHierarchy ? { parent_id: parentId } : {}),
          ...(canManageManager ? { manager_id: managerId } : {}),
        };
        await ApiService.updateDepartment(initialDept.id, updatePayload);
      } else {
        const createPayload: CreateDepartmentDTO = {
          dept_code: deptCode.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || undefined,
          parent_id: parentId,
          manager_id: managerId,
        };
        await ApiService.createDepartment(createPayload);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-2.5">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">
              {isEdit ? `Edit Department: ${initialDept?.dept_code}` : 'Create New Department'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Department Code */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Department Code <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={deptCode}
              onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
              disabled={isEdit}
              placeholder="e.g. DEP-CUT, DEP-WSH, DEP-LOGISTICS"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              required
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {isEdit
                ? 'Department code cannot be altered once created to preserve historical integrity.'
                : 'Unique alphanumeric identifier (e.g. DEP-FIN, DEP-HR, DEP-PLAN).'}
            </p>
          </div>

          {/* Department Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Department Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fabric Spreading & Automated Cutting"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
              required
            />
          </div>

          {/* Parent Department (Hierarchy) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Parent Department (Hierarchy Level)
            </label>
            <select
              value={parentId === null ? '' : parentId}
              onChange={(e) => setParentId(e.target.value === '' ? null : Number(e.target.value))}
              disabled={!canManageHierarchy && isEdit}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">None (Top-Level Primary Division)</option>
              {validParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.dept_code})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              {!canManageHierarchy && isEdit
                ? 'Hierarchy repositioning requires factory hierarchy authority.'
                : 'Select a parent department to register this unit as a sub-department.'}
            </p>
          </div>

          {/* Appointed Manager */}
          {canManageManager ? (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Department Manager (Optional)
              </label>
              <select
                value={managerId === null ? '' : managerId}
                onChange={(e) => setManagerId(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="">No Manager Assigned (Vacant)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} (@{u.username})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Department Manager
              </label>
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400">
                {initialDept?.manager_name ? `${initialDept.manager_name} (@${initialDept.manager_username})` : 'Unassigned'}
                <span className="ml-2 text-[10px] text-slate-500 italic">(Manager appointment requires factory authority)</span>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Responsibilities & Operational Scope
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe department function, floor responsibilities, and operational scope..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isEdit ? 'Update Department' : 'Create Department'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
