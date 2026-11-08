import React, { useState } from 'react';
import { X, Shield, AlertCircle, Check } from 'lucide-react';
import { RoleItem, UserItem } from '../types/index.ts';
import { ApiService } from '../services/api.ts';

interface EditRolesModalProps {
  user: UserItem;
  roles: RoleItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditRolesModal: React.FC<EditRolesModalProps> = ({
  user,
  roles,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>(
    user.roles.map((r) => r.id)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleRole = (roleId: number) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedRoleIds.length === 0) {
      setError('A user must have at least one assigned role');
      return;
    }

    try {
      setLoading(true);
      await ApiService.updateUserRoles(user.id, selectedRoleIds);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update roles');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Edit User Roles</h3>
              <p className="text-xs text-slate-400">
                User: <span className="text-indigo-300 font-mono">{user.username}</span> ({user.full_name})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-md flex items-start space-x-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            {roles.map((role) => {
              const isSelected = selectedRoleIds.includes(role.id);
              return (
                <div
                  key={role.id}
                  onClick={() => toggleRole(role.id)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex items-start space-x-3 ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-600/70'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'border-slate-600 bg-slate-900'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-3" />}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-white">{role.role_name}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">{role.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Role Assignment</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
