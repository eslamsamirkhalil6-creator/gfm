import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowUp,
  ArrowDown,
  Trash2,
  ShieldCheck,
  Check,
  X,
  Sliders,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { ProductionStage, ProductionWorkflow, WorkflowStep } from '../../types/index.ts';
import { useAuth } from '../../hooks/useAuth.tsx';

export const ProductionWorkflowsView: React.FC = () => {
  const { hasPermission } = useAuth();
  const [workflows, setWorkflows] = useState<ProductionWorkflow[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Selected workflow for visual stage editor
  const [selectedWf, setSelectedWf] = useState<ProductionWorkflow | null>(null);
  const [editedSteps, setEditedSteps] = useState<WorkflowStep[]>([]);
  const [isSavingSteps, setIsSavingSteps] = useState(false);

  // Workflow Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    workflow_code: '',
    description: '',
    product_category: 'General Apparel',
    selectedStageIds: [] as number[],
  });
  const [createLoading, setCreateLoading] = useState(false);

  const canManage = hasPermission('production:workflows:manage');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [wfData, stagesData] = await Promise.all([
        ApiService.getWorkflows(),
        ApiService.getStages(),
      ]);
      setWorkflows(wfData);
      setStages(stagesData);

      // Keep selected workflow updated
      if (selectedWf) {
        const updated = wfData.find((w) => w.id === selectedWf.id);
        if (updated) {
          setSelectedWf(updated);
          setEditedSteps(updated.steps);
        }
      } else if (wfData.length > 0) {
        setSelectedWf(wfData[0]);
        setEditedSteps(wfData[0].steps);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectWorkflow = (wf: ProductionWorkflow) => {
    setSelectedWf(wf);
    setEditedSteps(JSON.parse(JSON.stringify(wf.steps)));
    setError(null);
    setSuccess(null);
  };

  // Stage Reordering within Selected Workflow
  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === editedSteps.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newSteps = [...editedSteps];
    const [moved] = newSteps.splice(index, 1);
    newSteps.splice(targetIndex, 0, moved);

    // Re-assign step_order
    const reordered = newSteps.map((step, idx) => ({
      ...step,
      step_order: idx + 1,
    }));
    setEditedSteps(reordered);
  };

  const removeStep = (index: number) => {
    if (editedSteps.length <= 1) {
      setError('A workflow must contain at least one production stage');
      return;
    }
    const newSteps = editedSteps.filter((_, idx) => idx !== index);
    const reordered = newSteps.map((step, idx) => ({
      ...step,
      step_order: idx + 1,
    }));
    setEditedSteps(reordered);
  };

  const toggleStepMandatory = (index: number) => {
    const updated = [...editedSteps];
    updated[index].is_mandatory = !updated[index].is_mandatory;
    setEditedSteps(updated);
  };

  const toggleStepQualityGate = (index: number) => {
    const updated = [...editedSteps];
    updated[index].quality_gate = !updated[index].quality_gate;
    setEditedSteps(updated);
  };

  const addStageToSequence = (stageId: number) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return;

    const newStep: WorkflowStep = {
      stage_id: stage.id,
      stage_name: stage.name,
      stage_code: stage.stage_code,
      stage_type: stage.stage_type,
      step_order: editedSteps.length + 1,
      is_mandatory: stage.is_mandatory_default,
      quality_gate: stage.stage_type === 'QUALITY',
      notes: null,
    };
    setEditedSteps([...editedSteps, newStep]);
  };

  const handleSaveSteps = async () => {
    if (!selectedWf || !canManage) return;
    try {
      setIsSavingSteps(true);
      setError(null);
      await ApiService.reorderWorkflowSteps(
        selectedWf.id,
        editedSteps.map((s, idx) => ({
          stage_id: s.stage_id,
          step_order: idx + 1,
          is_mandatory: s.is_mandatory,
          quality_gate: s.quality_gate,
          notes: s.notes || undefined,
        }))
      );
      setSuccess(`Workflow "${selectedWf.name}" sequence and parameters saved successfully`);
      setTimeout(() => setSuccess(null), 4000);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to reorder and save workflow sequence');
    } finally {
      setIsSavingSteps(false);
    }
  };

  const handleToggleWfStatus = async (wf: ProductionWorkflow) => {
    if (!canManage) return;
    const nextStatus = wf.status === 'active' ? 'inactive' : 'active';
    try {
      setError(null);
      await ApiService.toggleWorkflowStatus(wf.id, nextStatus);
      setSuccess(`Workflow "${wf.name}" status updated to ${nextStatus}`);
      setTimeout(() => setSuccess(null), 3000);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to update workflow status');
    }
  };

  const handleCreateWorkflowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name.trim() || !createFormData.workflow_code.trim()) {
      setError('Workflow name and code are required');
      return;
    }
    if (createFormData.selectedStageIds.length === 0) {
      setError('Please select at least one stage for the initial workflow sequence');
      return;
    }

    try {
      setCreateLoading(true);
      setError(null);
      const payload = {
        name: createFormData.name.trim(),
        workflow_code: createFormData.workflow_code.trim().toUpperCase(),
        description: createFormData.description.trim(),
        product_category: createFormData.product_category.trim(),
        steps: createFormData.selectedStageIds.map((sId, idx) => {
          const stg = stages.find((s) => s.id === sId);
          return {
            stage_id: sId,
            step_order: idx + 1,
            is_mandatory: stg?.is_mandatory_default ?? true,
            quality_gate: stg?.stage_type === 'QUALITY',
          };
        }),
      };

      const created = await ApiService.createWorkflow(payload);
      setSuccess(`Workflow "${created.name}" created successfully`);
      setIsCreateModalOpen(false);
      setTimeout(() => setSuccess(null), 4000);
      await fetchData();
      setSelectedWf(created);
      setEditedSteps(created.steps);
    } catch (err: any) {
      setError(err.message || 'Failed to create workflow');
    } finally {
      setCreateLoading(false);
    }
  };

  const filtered = workflows.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.workflow_code.toLowerCase().includes(search.toLowerCase()) ||
      (w.product_category && w.product_category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <GitBranch className="w-5 h-5 text-sky-400" />
              <h1 className="text-lg font-bold text-white">Configurable Production Workflows</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Design order-specific manufacturing sequences, rearrange production stages, and establish quality gates
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            {canManage && (
              <button
                onClick={() => {
                  setCreateFormData({
                    name: '',
                    workflow_code: '',
                    description: '',
                    product_category: 'General Apparel',
                    selectedStageIds: stages.slice(0, 4).map((s) => s.id),
                  });
                  setIsCreateModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-md bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Workflow Pipeline</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Workflow Architecture Rules (Section 7) */}
      <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-900/40 flex items-start space-x-3 text-xs text-sky-200">
        <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">Configurable Order Routing Engine: </span>
          <span>
            Every production order operates under an explicitly bound workflow. Mandatory stages cannot be bypassed
            silently. Reordering stages immediately updates the pipeline sequence and is audited in the security ledger.
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

      {/* Main Grid: Workflows List (Left) + Interactive Visual Sequence Editor (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Workflow Directory */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Configured Workflows ({workflows.length})
            </span>
          </div>

          <div className="space-y-2.5">
            {filtered.map((wf) => {
              const isSelected = selectedWf?.id === wf.id;
              return (
                <div
                  key={wf.id}
                  onClick={() => handleSelectWorkflow(wf)}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-sky-950/40 border-sky-500 shadow-md ring-1 ring-sky-500/50'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-950 text-sky-300 border border-slate-800 font-bold">
                      {wf.workflow_code}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded border ${
                        wf.status === 'active'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {wf.status}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-white">{wf.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {wf.description || 'No description provided.'}
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{wf.steps.length} Sequenced Stages</span>
                    <span className="text-sky-400 text-xs font-medium">Configure Sequence →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Visual Sequence Builder & Stage Reordering */}
        <div className="lg:col-span-7">
          {selectedWf ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs text-sky-400 font-bold">
                      {selectedWf.workflow_code}
                    </span>
                    <h2 className="text-sm font-bold text-white">{selectedWf.name}</h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Category: <span className="text-slate-200">{selectedWf.product_category || 'General'}</span>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {canManage && (
                    <button
                      onClick={() => handleToggleWfStatus(selectedWf)}
                      className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                        selectedWf.status === 'active'
                          ? 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                          : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                      }`}
                    >
                      {selectedWf.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  )}

                  {canManage && (
                    <button
                      onClick={handleSaveSteps}
                      disabled={isSavingSteps}
                      className="px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSavingSteps ? 'Saving...' : 'Save Sequence'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Stage Reordering List */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Workflow Stage Execution Sequence ({editedSteps.length} Steps)
                </span>

                <div className="space-y-2">
                  {editedSteps.map((step, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === editedSteps.length - 1;

                    return (
                      <div
                        key={step.id ? `step-${step.id}` : `step-new-${idx}`}
                        className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                          step.quality_gate
                            ? 'bg-amber-950/20 border-amber-800/50'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        {/* Order & Stage details */}
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 rounded bg-slate-900 border border-slate-700 flex items-center justify-center font-mono text-xs font-bold text-slate-300">
                            {idx + 1}
                          </div>

                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-white">{step.stage_name}</span>
                              <span className="font-mono text-[10px] text-slate-500">[{step.stage_code}]</span>
                              {step.quality_gate && (
                                <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                                  <span>QC Gate</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-3 mt-1 text-[11px]">
                              {/* Mandatory toggle */}
                              <label className="flex items-center space-x-1 cursor-pointer text-slate-400 hover:text-white">
                                <input
                                  type="checkbox"
                                  checked={step.is_mandatory}
                                  onChange={() => toggleStepMandatory(idx)}
                                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                                />
                                <span className={step.is_mandatory ? 'text-slate-200 font-medium' : 'text-slate-500'}>
                                  Mandatory
                                </span>
                              </label>

                              {/* QC Gate toggle */}
                              <label className="flex items-center space-x-1 cursor-pointer text-slate-400 hover:text-white">
                                <input
                                  type="checkbox"
                                  checked={step.quality_gate}
                                  onChange={() => toggleStepQualityGate(idx)}
                                  className="rounded border-slate-700 text-amber-500 focus:ring-0"
                                />
                                <span className={step.quality_gate ? 'text-amber-400 font-medium' : 'text-slate-500'}>
                                  Quality Checkpoint
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Reorder and Delete Actions */}
                        {canManage && (
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              onClick={() => moveStep(idx, 'up')}
                              disabled={isFirst}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move Stage Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => moveStep(idx, 'down')}
                              disabled={isLast}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move Stage Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeStep(idx)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 ml-1"
                              title="Remove Stage from Workflow"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add Stage to Workflow Dropdown */}
              {canManage && (
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    Add another station or inspection checkpoint:
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      id="stageAddSelect"
                      className="bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        -- Select Stage to Append --
                      </option>
                      {stages.map((stg) => (
                        <option key={stg.id} value={stg.id}>
                          {stg.name} ({stg.stage_type})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        const select = document.getElementById('stageAddSelect') as HTMLSelectElement;
                        if (select && select.value) {
                          addStageToSequence(parseInt(select.value, 10));
                          select.value = '';
                        }
                      }}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5 text-sky-400" />
                      <span>Append</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
              Select a workflow from the directory to inspect and configure its execution sequence.
            </div>
          )}
        </div>
      </div>

      {/* Workflow Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Create Production Workflow Pipeline</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkflowSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Workflow Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  placeholder="e.g. Export Denim Heavy-Wash Process Flow"
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Workflow Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createFormData.workflow_code}
                    onChange={(e) => setCreateFormData({ ...createFormData, workflow_code: e.target.value })}
                    placeholder="e.g. WF-DENIM-01"
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Garment Category</label>
                  <input
                    type="text"
                    value={createFormData.product_category}
                    onChange={(e) => setCreateFormData({ ...createFormData, product_category: e.target.value })}
                    placeholder="e.g. Jeans & Jackets"
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={createFormData.description}
                  onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                  placeholder="Manufacturing routing specifics, washing requirements..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Select Initial Stages in Order <span className="text-rose-400">*</span>
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {stages.map((stg) => {
                    const isSelected = createFormData.selectedStageIds.includes(stg.id);
                    return (
                      <div
                        key={stg.id}
                        onClick={() => {
                          const current = createFormData.selectedStageIds;
                          const next = isSelected
                            ? current.filter((id) => id !== stg.id)
                            : [...current, stg.id];
                          setCreateFormData({ ...createFormData, selectedStageIds: next });
                        }}
                        className={`p-2 rounded border text-left cursor-pointer transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-sky-950/40 border-sky-600'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                              isSelected ? 'bg-sky-600 border-sky-500 text-white' : 'border-slate-600'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-3" />}
                          </div>
                          <span className="text-xs text-white">{stg.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{stg.stage_type}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {createLoading ? 'Provisioning...' : 'Create Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
