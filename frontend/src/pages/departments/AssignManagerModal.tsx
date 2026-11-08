import React, { useState } from 'react';
import { X, UserCheck, AlertCircle, Save } from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { DepartmentWithDetails, UserItem } from '../../types/index.ts';

interface AssignManagerModalProps {
  department: DepartmentWithDetails;
  users: UserItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignManagerModal: React.FC<AssignManagerModalProps> = ({
  department,
  users,
  onClose,
  onSuccess,
}) => {
  const [managerId, setManagerId] = useState<number | null>(department.manager_id);
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await ApiService.assignDepartmentManager(department.id, {
        manager_id: managerId,
        notes: notes.trim() || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update department manager');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-8">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-2.5">
            <UserCheck className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-bold text-white">
              Assign Manager: {department.name}
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

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Select Primary Department Manager
            </label>
            <select
              value={managerId === null ? '' : managerId}
              onChange={(e) => setManagerId(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="">No Manager (Vacant / Unassigned)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} (@{u.username})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              Selecting a new manager closes previous manager tenure in the database audit history.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Assignment Notes / Reason
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Appointed as head of production operations following shift expansion..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

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
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Manager Assignment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
