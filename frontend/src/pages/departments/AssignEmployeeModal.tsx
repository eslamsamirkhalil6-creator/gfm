import React, { useState, useEffect } from 'react';
import { X, UserPlus, ArrowRightLeft, AlertCircle, Save } from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import {
  DepartmentWithDetails,
  DepartmentEmployee,
  AssignableUser,
} from '../../types/index.ts';

interface AssignEmployeeModalProps {
  department: DepartmentWithDetails;
  departments: DepartmentWithDetails[];
  users: AssignableUser[];
  transferEmployee?: DepartmentEmployee | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignEmployeeModal: React.FC<AssignEmployeeModalProps> = ({
  department,
  departments,
  users,
  transferEmployee,
  onClose,
  onSuccess,
}) => {
  const isTransfer = Boolean(transferEmployee);

  const [userId, setUserId] = useState<number>(
    transferEmployee ? transferEmployee.user_id : (users[0]?.id || 1)
  );
  const [targetDeptId, setTargetDeptId] = useState<number>(
    departments.find((d) => d.id !== department.id)?.id || 1
  );
  const [positionTitle, setPositionTitle] = useState<string>(
    transferEmployee ? transferEmployee.position_title : 'Staff Operator'
  );
  const [isPrimary, setIsPrimary] = useState<boolean>(
    transferEmployee ? transferEmployee.is_primary : true
  );
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTransfer && users.length > 0 && !users.some((u) => u.id === userId)) {
      setUserId(users[0].id);
    }
  }, [isTransfer, users, userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!positionTitle.trim()) {
      setError('Position title is required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isTransfer && transferEmployee) {
        await ApiService.transferDepartmentEmployee(department.id, {
          target_department_id: targetDeptId,
          user_id: transferEmployee.user_id,
          position_title: positionTitle.trim(),
          is_primary: isPrimary,
        });
      } else {
        await ApiService.assignDepartmentEmployee(department.id, {
          user_id: userId,
          position_title: positionTitle.trim(),
          is_primary: isPrimary,
          notes: notes.trim() || undefined,
        });
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to complete employee department operation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-8">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-2.5">
            {isTransfer ? (
              <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
            ) : (
              <UserPlus className="w-5 h-5 text-purple-400" />
            )}
            <h2 className="text-sm font-bold text-white">
              {isTransfer
                ? `Transfer Staff Member from ${department.dept_code}`
                : `Assign Staff to ${department.name}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* User Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {isTransfer ? 'Employee' : 'Select Employee'}
            </label>
            {isTransfer ? (
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium text-white">
                {transferEmployee?.full_name} (@{transferEmployee?.username})
              </div>
            ) : (
              <select
                value={userId}
                onChange={(e) => setUserId(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} (@{u.username})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* If Transfer: Target Department */}
          {isTransfer && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Target Department <span className="text-rose-400">*</span>
              </label>
              <select
                value={targetDeptId}
                onChange={(e) => setTargetDeptId(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              >
                {departments
                  .filter((d) => d.id !== department.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.dept_code})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Position Title */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Position / Job Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={positionTitle}
              onChange={(e) => setPositionTitle(e.target.value)}
              placeholder="e.g. Senior Cutting Specialist, Sewing Supervisor"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
              required
            />
          </div>

          {/* Primary Department Toggle (Multi-department support) */}
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="is_primary"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0 focus:outline-hidden cursor-pointer"
            />
            <label htmlFor="is_primary" className="text-xs text-slate-300 cursor-pointer">
              Mark as Primary Department Assignment
            </label>
          </div>
          <p className="text-[10px] text-slate-500">
            Employees can be assigned to multiple departments (e.g. a Sewing Supervisor overseeing multiple sections) while designating one primary department.
          </p>

          {!isTransfer && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Assignment Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional assignment background or shift information..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          )}

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
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isTransfer ? 'Transfer Employee' : 'Assign Employee'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
