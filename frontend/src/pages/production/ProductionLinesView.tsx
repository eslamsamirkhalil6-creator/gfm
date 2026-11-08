import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  UserCheck,
  Zap,
  X,
  Gauge,
  Factory,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { ProductionHall, ProductionLine, UserItem } from '../../types/index.ts';
import { useAuth } from '../../hooks/useAuth.tsx';

export const ProductionLinesView: React.FC = () => {
  const { hasPermission } = useAuth();
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [halls, setHalls] = useState<ProductionHall[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [hallFilter, setHallFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ProductionLine | null>(null);
  const [formData, setFormData] = useState({
    line_number: '',
    name: '',
    hall_id: '',
    production_type: 'Sewing',
    supervisor_id: '',
    capacity_per_day: 650,
    description: '',
    status: 'active' as 'active' | 'idle' | 'maintenance' | 'inactive',
  });
  const [formLoading, setFormLoading] = useState(false);

  const canManage = hasPermission('production:lines:manage');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [linesData, hallsData, usersData] = await Promise.all([
        ApiService.getLines(),
        ApiService.getHalls(),
        ApiService.getUsers().catch(() => []),
      ]);
      setLines(linesData);
      setHalls(hallsData);
      setUsers(usersData);
    } catch (err: any) {
      setError(err.message || 'Failed to load production lines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingLine(null);
    setFormData({
      line_number: '',
      name: '',
      hall_id: halls.length > 0 ? String(halls[0].id) : '1',
      production_type: 'Sewing',
      supervisor_id: '',
      capacity_per_day: 650,
      description: '',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (line: ProductionLine) => {
    setEditingLine(line);
    setFormData({
      line_number: line.line_number,
      name: line.name,
      hall_id: String(line.hall_id),
      production_type: line.production_type,
      supervisor_id: line.supervisor_id ? String(line.supervisor_id) : '',
      capacity_per_day: line.capacity_per_day,
      description: line.description || '',
      status: line.status,
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.line_number.trim() || !formData.name.trim() || !formData.hall_id) {
      setError('Line number, name, and assigned hall are required');
      return;
    }

    try {
      setFormLoading(true);
      setError(null);
      const payload = {
        line_number: formData.line_number.trim().toUpperCase(),
        name: formData.name.trim(),
        hall_id: parseInt(formData.hall_id, 10),
        production_type: formData.production_type,
        supervisor_id: formData.supervisor_id ? parseInt(formData.supervisor_id, 10) : null,
        capacity_per_day: Number(formData.capacity_per_day) || 500,
        description: formData.description.trim(),
        status: formData.status,
      };

      if (editingLine) {
        await ApiService.updateLine(editingLine.id, payload);
        setSuccess(`Production line "${formData.name}" updated successfully`);
      } else {
        await ApiService.createLine(payload);
        setSuccess(`Production line "${formData.name}" registered successfully`);
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccess(null), 4000);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save production line');
    } finally {
      setFormLoading(false);
    }
  };

  const handleQuickStatusChange = async (
    lineId: number,
    status: 'active' | 'idle' | 'maintenance' | 'inactive'
  ) => {
    if (!canManage) return;
    try {
      await ApiService.toggleLineStatus(lineId, status);
      setSuccess(`Line status updated to ${status}`);
      setTimeout(() => setSuccess(null), 3000);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to update line status');
    }
  };

  const filtered = lines.filter((line) => {
    const q = search.toLowerCase();
    const matchSearch =
      line.name.toLowerCase().includes(q) ||
      line.line_number.toLowerCase().includes(q) ||
      line.production_type.toLowerCase().includes(q) ||
      (line.supervisor_name && line.supervisor_name.toLowerCase().includes(q));

    const matchHall = !hallFilter || line.hall_id === parseInt(hallFilter, 10);
    const matchStatus = !statusFilter || line.status === statusFilter;

    return matchSearch && matchHall && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h1 className="text-lg font-bold text-white">Production Lines Configuration</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Dynamic multi-line floor setup with hall assignment, supervisor distribution, and capacity targets
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Refresh Lines"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            {canManage && (
              <button
                onClick={openCreateModal}
                className="px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Production Line</span>
              </button>
            )}
          </div>
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

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search line name, number, supervisor..."
              className="w-full bg-slate-900 border border-slate-800 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <select
            value={hallFilter}
            onChange={(e) => setHallFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="">All Halls</option>
            {halls.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.code})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <span className="text-xs text-slate-400 font-mono">
          Showing {filtered.length} of {lines.length} lines
        </span>
      </div>

      {/* Lines Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Line Code</th>
                <th className="py-3 px-4">Name &amp; Type</th>
                <th className="py-3 px-4">Assigned Hall</th>
                <th className="py-3 px-4">Supervisor</th>
                <th className="py-3 px-4">Daily Target</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && lines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <div className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading production lines...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No production lines matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                      {line.line_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{line.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{line.production_type}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-200">{line.hall_name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{line.hall_code}</div>
                    </td>
                    <td className="py-3 px-4">
                      {line.supervisor_name ? (
                        <div className="flex items-center space-x-1.5 text-slate-200">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{line.supervisor_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-200">
                      {line.capacity_per_day} pcs/day
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${
                          line.status === 'active'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800/80'
                            : line.status === 'idle'
                            ? 'bg-amber-950 text-amber-300 border-amber-800/80'
                            : line.status === 'maintenance'
                            ? 'bg-purple-950 text-purple-300 border-purple-800/80'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {line.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {canManage && (
                          <button
                            onClick={() => openEditModal(line)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs flex items-center space-x-1"
                          >
                            <Edit2 className="w-3 h-3 text-indigo-400" />
                            <span>Edit</span>
                          </button>
                        )}

                        {canManage && (
                          <select
                            value={line.status}
                            onChange={(e) =>
                              handleQuickStatusChange(line.id, e.target.value as any)
                            }
                            className="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-slate-400 focus:outline-hidden"
                          >
                            <option value="active">Active</option>
                            <option value="idle">Idle</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Line Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {editingLine ? 'Edit Production Line' : 'Add New Production Line'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Line Number / Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.line_number}
                    onChange={(e) => setFormData({ ...formData, line_number: e.target.value })}
                    placeholder="e.g. LINE-SEW-03"
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white uppercase placeholder-slate-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Production Type <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.production_type}
                    onChange={(e) => setFormData({ ...formData, production_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
                  >
                    <option value="Sewing">Sewing &amp; Stitching</option>
                    <option value="Cutting">Automated Cutting</option>
                    <option value="Quality Inspection">Quality Inspection</option>
                    <option value="Packing">Finishing &amp; Packing</option>
                    <option value="Embroidery">Embroidery / Printing</option>
                    <option value="Washing">Washing / Treatment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Line Descriptive Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sewing Line Gamma (Heavy Denim Outerwear)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Assigned Production Hall <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.hall_id}
                    onChange={(e) => setFormData({ ...formData, hall_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
                  >
                    {halls.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Assigned Supervisor
                  </label>
                  <select
                    value={formData.supervisor_id}
                    onChange={(e) => setFormData({ ...formData, supervisor_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
                  >
                    <option value="">-- Unassigned --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} (@{u.username})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    One supervisor may manage multiple lines concurrently
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Daily Capacity Target (pcs/day)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.capacity_per_day}
                    onChange={(e) => setFormData({ ...formData, capacity_per_day: parseInt(e.target.value, 10) || 500 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
                  >
                    <option value="active">Active</option>
                    <option value="idle">Idle</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Machine setup, needle gauge, operator skill level..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
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
                  className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : editingLine ? 'Update Line' : 'Add Line'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
