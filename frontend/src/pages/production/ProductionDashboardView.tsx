import React, { useState, useEffect } from 'react';
import {
  Factory,
  Layers,
  GitBranch,
  ShieldCheck,
  Zap,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { ProductionOverviewStats, ProductionHall, ProductionWorkflow } from '../../types/index.ts';
import { useAuth } from '../../hooks/useAuth.tsx';

interface ProductionDashboardViewProps {
  onNavigateTab: (tab: 'halls' | 'lines' | 'stages' | 'workflows' | 'settings') => void;
}

export const ProductionDashboardView: React.FC<ProductionDashboardViewProps> = ({ onNavigateTab }) => {
  const { hasPermission } = useAuth();
  const [stats, setStats] = useState<ProductionOverviewStats | null>(null);
  const [halls, setHalls] = useState<ProductionHall[]>([]);
  const [workflows, setWorkflows] = useState<ProductionWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canCreateHall = hasPermission('production:halls:create');
  const canManageLines = hasPermission('production:lines:manage');
  const canManageWorkflows = hasPermission('production:workflows:manage');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, hallsData, workflowsData] = await Promise.all([
        ApiService.getProductionStats(),
        ApiService.getHalls(),
        ApiService.getWorkflows(),
      ]);
      setStats(statsData);
      setHalls(hallsData);
      setWorkflows(workflowsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load production overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Controls Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 font-semibold border border-indigo-900">
                Setup &amp; Layout
              </span>
              <span className="text-xs text-slate-400 font-medium">Garment Factory Management System</span>
            </div>
            <h1 className="text-xl font-bold text-white mt-1">Production Structure &amp; Workflow Overview</h1>
            <p className="text-xs text-slate-400 mt-1">
              Configure factory halls, dynamic lines, independent stages, and order-specific manufacturing workflows
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Refresh Metrics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            {canCreateHall && (
              <button
                onClick={() => onNavigateTab('halls')}
                className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors flex items-center space-x-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Hall</span>
              </button>
            )}

            {canManageLines && (
              <button
                onClick={() => onNavigateTab('lines')}
                className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                <span>New Line</span>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Halls & Complex */}
        <div
          onClick={() => onNavigateTab('halls')}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-600/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] uppercase tracking-wider font-medium">Production Halls</span>
            <Factory className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{stats?.halls_count ?? '--'}</span>
            <span className="text-xs text-emerald-400 font-medium">
              {stats?.active_halls_count ?? 0} Active
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Multi-hall physical facilities</p>
        </div>

        {/* Lines */}
        <div
          onClick={() => onNavigateTab('lines')}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-600/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] uppercase tracking-wider font-medium">Production Lines</span>
            <Layers className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{stats?.lines_count ?? '--'}</span>
            <span className="text-xs text-emerald-400 font-medium">
              {stats?.active_lines_count ?? 0} Running
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {stats?.supervisors_assigned_count ?? 0} Supervisors Assigned
          </p>
        </div>

        {/* Stages */}
        <div
          onClick={() => onNavigateTab('stages')}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-600/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] uppercase tracking-wider font-medium">Configured Stages</span>
            <ShieldCheck className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{stats?.stages_count ?? '--'}</span>
            <span className="text-xs text-amber-400 font-medium">
              {stats?.quality_stages_count ?? 0} QC Gates
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Independent Quality Functions</p>
        </div>

        {/* Workflows */}
        <div
          onClick={() => onNavigateTab('workflows')}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-600/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] uppercase tracking-wider font-medium">Active Workflows</span>
            <GitBranch className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{stats?.workflows_count ?? '--'}</span>
            <span className="text-xs text-sky-400 font-medium">
              {stats?.active_workflows_count ?? 0} Active
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Dynamic order routing paths</p>
        </div>
      </div>

      {/* Factory Halls & Floor Lines Layout Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <Factory className="w-4 h-4 text-indigo-400" />
              <span>Factory Floor Structure &amp; Line Allocation</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Production halls with dynamically mapped production lines and assigned floor supervisors
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('lines')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1"
          >
            <span>Configure Lines</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {halls.map((hall) => (
            <div key={hall.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">{hall.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-indigo-300 border border-slate-800">
                      {hall.code}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                      hall.status === 'active'
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {hall.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">{hall.description || 'No description provided.'}</p>
              </div>

              <div className="pt-3 border-t border-slate-900">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Assigned Lines ({hall.lines?.length || 0}):
                </span>
                {hall.lines && hall.lines.length > 0 ? (
                  <div className="space-y-1.5">
                    {hall.lines.map((line) => (
                      <div
                        key={line.id}
                        className="p-2 rounded bg-slate-900 border border-slate-850 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-indigo-400 font-semibold text-[11px]">
                            {line.line_number}
                          </span>
                          <span className="text-slate-300">{line.name}</span>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${
                            line.status === 'active'
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50'
                              : line.status === 'idle'
                              ? 'bg-amber-950/80 text-amber-400 border-amber-800/50'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {line.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No lines assigned to this hall yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configured Workflows Pipeline Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <GitBranch className="w-4 h-4 text-sky-400" />
              <span>Configurable Production Workflows Matrix</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Production workflows allow dynamic routing according to customer garment orders without hardcoding
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('workflows')}
            className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center space-x-1"
          >
            <span>Manage Workflows</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {workflows.map((wf) => (
            <div key={wf.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-white">{wf.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-sky-300 border border-slate-800">
                    {wf.workflow_code}
                  </span>
                  {wf.product_category && (
                    <span className="text-[10px] text-slate-400">({wf.product_category})</span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-emerald-400">{wf.status}</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">{wf.description}</p>

              {/* Visual Pipeline Sequence */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-900">
                {wf.steps.map((step, idx) => (
                  <React.Fragment key={step.id || idx}>
                    <div
                      className={`px-2.5 py-1 rounded text-[11px] font-medium border flex items-center space-x-1.5 ${
                        step.quality_gate
                          ? 'bg-amber-950/50 text-amber-300 border-amber-800/70'
                          : step.stage_type === 'PACKING'
                          ? 'bg-sky-950/50 text-sky-300 border-sky-800/70'
                          : 'bg-slate-900 text-slate-300 border-slate-800'
                      }`}
                    >
                      <span className="text-[10px] font-mono text-slate-400">{step.step_order}.</span>
                      <span>{step.stage_name}</span>
                      {step.quality_gate && (
                        <span title="Independent QC Gate">
                          <ShieldCheck className="w-3 h-3 text-amber-400" />
                        </span>
                      )}
                    </div>
                    {idx < wf.steps.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
