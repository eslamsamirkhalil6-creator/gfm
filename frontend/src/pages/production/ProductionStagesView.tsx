import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  GitBranch,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { ProductionStage } from '../../types/index.ts';
import { useAuth } from '../../hooks/useAuth.tsx';

export const ProductionStagesView: React.FC = () => {
  const { hasPermission } = useAuth();
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<ProductionStage | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    stage_code: '',
    description: '',
    stage_type: 'STANDARD' as 'STANDARD' | 'QUALITY' | 'PACKING',
    is_mandatory_default: true,
  });
  const [formLoading, setFormLoading] = useState(false);

  const canManage = hasPermission('production:stages:manage');

  const fetchStages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getStages();
      setStages(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load production stages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  const openCreateModal = () => {
    setEditingStage(null);
    setFormData({
      name: '',
      stage_code: '',
      description: '',
      stage_type: 'STANDARD',
      is_mandatory_default: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (stage: ProductionStage) => {
    setEditingStage(stage);
    setFormData({
      name: stage.name,
      stage_code: stage.stage_code,
      description: stage.description || '',
      stage_type: stage.stage_type,
      is_mandatory_default: stage.is_mandatory_default,
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.stage_code.trim()) {
      setError('Stage name and stage code are required');
      return;
    }

    try {
      setFormLoading(true);
      setError(null);
      if (editingStage) {
        await ApiService.updateStage(editingStage.id, formData);
        setSuccess(`Stage "${formData.name}" updated successfully`);
      } else {
        await ApiService.createStage(formData);
        setSuccess(`Stage "${formData.name}" registered successfully`);
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccess(null), 4000);
      await fetchStages();
    } catch (err: any) {
      setError(err.message || 'Failed to save production stage');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (stage: ProductionStage) => {
    if (!canManage) return;
    const nextStatus = stage.status === 'active' ? 'inactive' : 'active';
    try {
      setError(null);
      await ApiService.toggleStageStatus(stage.id, nextStatus);
      setSuccess(`Stage "${stage.name}" status updated to ${nextStatus}`);
      setTimeout(() => setSuccess(null), 3000);
      await fetchStages();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle stage status');
    }
  };

  const filtered = stages.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.stage_code.toLowerCase().includes(search.toLowerCase()) ||
      s.stage_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h1 className="text-lg font-bold text-white">Production Stages Management</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Configurable manufacturing stations, independent quality inspection gates, and packing operations
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchStages}
              disabled={loading}
              className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Refresh Stages"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            {canManage && (
              <button
                onClick={openCreateModal}
                className="px-3.5 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Production Stage</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Independent Quality Function Notice (Section 6 Rule) */}
      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 flex items-start space-x-3 text-xs text-amber-200">
        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">Independent Quality Assurance Architecture: </span>
          <span>
            Quality inspection is modeled as an autonomous functional gate, not merely an operational production stage.
            Quality checkpoints enforce technical compliance checks and cannot be bypassed through routine manufacturing overrides.
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

      {/* Search Toolbar */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stage name, code, or type..."
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <span className="text-xs text-slate-400 font-mono">
          Showing {filtered.length} of {stages.length} configured stages
        </span>
      </div>

      {/* Stages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((stage) => (
          <div
            key={stage.id}
            className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
              stage.stage_type === 'QUALITY'
                ? 'bg-amber-950/15 border-amber-900/40 hover:border-amber-700/60'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-950 text-indigo-300 border border-slate-800 font-bold">
                  {stage.stage_code}
                </span>

                <div className="flex items-center space-x-1.5">
                  <span
                    className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                      stage.stage_type === 'QUALITY'
                        ? 'bg-amber-950 text-amber-300 border-amber-800/80 font-bold'
                        : stage.stage_type === 'PACKING'
                        ? 'bg-sky-950 text-sky-300 border-sky-800/80'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {stage.stage_type}
                  </span>

                  <span
                    className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                      stage.status === 'active'
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {stage.status}
                  </span>
                </div>
              </div>

              <h3 className="text-sm font-bold text-white mb-1.5">{stage.name}</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                {stage.description || 'No detailed technical instructions provided.'}
              </p>

              {/* Where Used Inspector (Section 6 Requirement) */}
              <div className="p-2.5 rounded bg-slate-950/70 border border-slate-850 mb-3 text-xs">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="flex items-center space-x-1">
                    <GitBranch className="w-3.5 h-3.5 text-sky-400" />
                    <span>Active in Workflows:</span>
                  </span>
                  <span className="font-mono text-white font-bold">
                    {stage.used_in_workflows_count}
                  </span>
                </div>
                {stage.workflows && stage.workflows.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {stage.workflows.map((wf) => (
                      <span
                        key={wf.id}
                        className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-300"
                        title={wf.name}
                      >
                        {wf.workflow_code}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500 italic">Not currently used in any workflow</span>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">
                Default: {stage.is_mandatory_default ? (
                  <span className="text-amber-400 font-medium">Mandatory</span>
                ) : (
                  <span className="text-slate-400 font-medium">Optional</span>
                )}
              </span>

              <div className="flex items-center space-x-1.5">
                {canManage && (
                  <button
                    onClick={() => openEditModal(stage)}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    title="Edit Stage"
                  >
                    <Edit2 className="w-3 h-3 text-indigo-400" />
                  </button>
                )}

                {canManage && (
                  <button
                    onClick={() => handleToggleStatus(stage)}
                    className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                      stage.status === 'active'
                        ? 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/60'
                        : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                    }`}
                  >
                    {stage.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stage Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {editingStage ? 'Edit Production Stage' : 'Add New Production Stage'}
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
                  Stage Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ultrasonic Seam Welding"
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Stage Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.stage_code}
                    onChange={(e) => setFormData({ ...formData, stage_code: e.target.value })}
                    placeholder="e.g. STG-WELD"
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Function Category <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.stage_type}
                    onChange={(e) => setFormData({ ...formData, stage_type: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
                  >
                    <option value="STANDARD">Standard Manufacturing</option>
                    <option value="QUALITY">Quality Inspection Gate</option>
                    <option value="PACKING">Finishing &amp; Packing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={formData.is_mandatory_default}
                    onChange={(e) => setFormData({ ...formData, is_mandatory_default: e.target.checked })}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Mandatory by default when added to new workflows</span>
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5 ml-5">
                  Can be adjusted per-workflow as required by specific garment specifications
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Technical Description &amp; Standards
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Tolerance parameters, machine equipment, standard minute value guidance..."
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
                  className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : editingStage ? 'Update Stage' : 'Register Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
