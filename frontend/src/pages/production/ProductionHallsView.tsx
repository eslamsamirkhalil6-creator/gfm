import React, { useState, useEffect } from 'react';
import {
  Factory,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Layers,
  X,
  ShieldAlert,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { ProductionHall } from '../../types/index.ts';
import { useAuth } from '../../hooks/useAuth.tsx';

export const ProductionHallsView: React.FC = () => {
  const { hasPermission } = useAuth();
  const [halls, setHalls] = useState<ProductionHall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHall, setEditingHall] = useState<ProductionHall | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });
  const [formLoading, setFormLoading] = useState(false);

  const canCreate = hasPermission('production:halls:create');
  const canEdit = hasPermission('production:halls:edit');

  const fetchHalls = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getHalls();
      setHalls(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load production halls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHalls();
  }, []);

  const openCreateModal = () => {
    setEditingHall(null);
    setFormData({ name: '', code: '', description: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (hall: ProductionHall) => {
    setEditingHall(hall);
    setFormData({
      name: hall.name,
      code: hall.code,
      description: hall.description || '',
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setError('Hall name and hall code are required');
      return;
    }

    try {
      setFormLoading(true);
      setError(null);
      if (editingHall) {
        await ApiService.updateHall(editingHall.id, formData);
        setSuccess(`Production Hall "${formData.name}" updated successfully`);
      } else {
        await ApiService.createHall(formData);
        setSuccess(`Production Hall "${formData.name}" created successfully`);
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccess(null), 4000);
      await fetchHalls();
    } catch (err: any) {
      setError(err.message || 'Failed to save production hall');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (hall: ProductionHall) => {
    if (!canEdit) {
      setError('Missing permission: production:halls:edit');
      return;
    }
    const nextStatus = hall.status === 'active' ? 'inactive' : 'active';
    try {
      setError(null);
      await ApiService.toggleHallStatus(hall.id, nextStatus);
      setSuccess(`Hall "${hall.name}" status updated to ${nextStatus}`);
      setTimeout(() => setSuccess(null), 4000);
      await fetchHalls();
    } catch (err: any) {
      setError(err.message || 'Failed to update hall status');
    }
  };

  const filtered = halls.filter(
    (h) =>
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.code.toLowerCase().includes(search.toLowerCase()) ||
      (h.description && h.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Factory className="w-5 h-5 text-indigo-400" />
              <h1 className="text-lg font-bold text-white">Production Halls Management</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Configure factory floors, physical production buildings, and associated production line complexes
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchHalls}
              disabled={loading}
              className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            {canCreate && (
              <button
                onClick={openCreateModal}
                className="px-3.5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Production Hall</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Safety Policy Notice (Section 4 Rule) */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start space-x-3 text-xs text-slate-300">
        <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">Data Preservation &amp; Audit Guard: </span>
          <span>
            Production halls cannot be permanently deleted if associated production lines or historical records exist.
            Instead, deactivation prevents newly scheduled orders while preserving complete historical audit traceability.
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg flex items-start space-x-2 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg flex items-start space-x-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hall name or code..."
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Showing {filtered.length} of {halls.length} halls
        </span>
      </div>

      {/* Halls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((hall) => (
          <div key={hall.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-white">{hall.name}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-indigo-400 border border-slate-800">
                    {hall.code}
                  </span>
                </div>
                <span
                  className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                    hall.status === 'active'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {hall.status}
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                {hall.description || 'No specialized description configured for this hall.'}
              </p>

              {/* Line Summary */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-850 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-slate-300 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Assigned Production Lines ({hall.lines?.length || 0})</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-medium">
                    {hall.active_lines_count} Running
                  </span>
                </div>

                {hall.lines && hall.lines.length > 0 ? (
                  <div className="space-y-1">
                    {hall.lines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between text-xs py-1 border-b border-slate-900 last:border-0"
                      >
                        <span className="font-mono text-slate-300 text-[11px]">{line.line_number}</span>
                        <span className="text-slate-400 text-[11px] truncate max-w-[160px]">{line.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{line.production_type}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">No lines configured yet.</p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Updated: {new Date(hall.updated_at).toLocaleDateString()}</span>
              <div className="flex items-center space-x-2">
                {canEdit && (
                  <button
                    onClick={() => openEditModal(hall)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-sans flex items-center space-x-1 transition-colors"
                  >
                    <Edit2 className="w-3 h-3 text-indigo-400" />
                    <span>Edit</span>
                  </button>
                )}

                {canEdit && (
                  <button
                    onClick={() => handleToggleStatus(hall)}
                    className={`px-2.5 py-1 rounded text-xs font-sans border transition-colors ${
                      hall.status === 'active'
                        ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/60'
                        : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/60'
                    }`}
                  >
                    {hall.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Hall Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {editingHall ? 'Edit Production Hall' : 'Create Production Hall'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Hall Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Hall C - Specialized Denim Assembly"
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Hall Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g. HALL-C"
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white uppercase placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Operational purpose, ventilation, heavy machinery specifications..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : editingHall ? 'Update Hall' : 'Create Hall'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
