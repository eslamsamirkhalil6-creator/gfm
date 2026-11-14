import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Layers,
  Building2,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import { ApiService } from '../services/api.ts';
import { useAuth } from '../hooks/useAuth.tsx';
import { PlanningDashboardData } from '../types/index.ts';

export const PlanningPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('planning:manage');

  const [data, setData] = useState<PlanningDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [deptId, setDeptId] = useState<number>(0);
  const [lineId, setLineId] = useState<string>('');
  const [planCode, setPlanCode] = useState('');
  const [title, setTitle] = useState('');
  const [targetDailyOutput, setTargetDailyOutput] = useState('1200');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ApiService.getPlanningDashboard();
      setData(res);
      if (res.departments.length > 0 && !res.departments.some((d) => d.id === deptId)) {
        setDeptId(res.departments[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load planning dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId) return;
    try {
      setSubmitting(true);
      setError(null);
      await ApiService.createPlanningSchedule({
        department_id: deptId,
        production_line_id: lineId ? Number(lineId) : null,
        plan_code: planCode.trim(),
        title: title.trim(),
        target_daily_output: Number(targetDailyOutput) || 0,
        planned_start_date: startDate,
        planned_end_date: endDate,
        status: 'active',
      });
      setPlanCode('');
      setTitle('');
      setLineId('');
      setShowForm(false);
      setSuccessMsg('Planning schedule created within authorized department scope.');
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create planning schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (
    scheduleId: number,
    nextStatus: 'draft' | 'active' | 'completed' | 'cancelled'
  ) => {
    try {
      setError(null);
      await ApiService.updatePlanningScheduleStatus(scheduleId, nextStatus);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update schedule status');
    }
  };

  const deptLines = (data?.production_lines || []).filter((l) => l.department_id === deptId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-800/60 flex items-center justify-center text-amber-400">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-white">Department Planning Dashboard</h1>
                {data && (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                    {data.scope === 'GLOBAL' ? 'Global Oversight (Read-Only)' : 'Department Scoped'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Capacity balancing and departmental planning schedules governed by planning permissions
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>

            {canManage && data && data.departments.length > 0 && (
              <button
                onClick={() => setShowForm((v) => !v)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showForm ? 'Close Form' : 'New Plan Schedule'}</span>
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

      {successMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg flex items-start space-x-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Create Schedule Form (Only with planning:manage) */}
      {showForm && canManage && data && (
        <form onSubmit={handleCreateSchedule} className="bg-slate-900 border border-amber-800/40 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">Create Departmental Planning Schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Authorized Department</label>
              <select
                value={deptId}
                onChange={(e) => {
                  setDeptId(Number(e.target.value));
                  setLineId('');
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              >
                {data.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.dept_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Production Line (Optional)</label>
              <select
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="">All / Department Level</option>
                {deptLines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.line_number} - {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Plan Code</label>
              <input
                type="text"
                required
                value={planCode}
                onChange={(e) => setPlanCode(e.target.value)}
                placeholder="PLN-2026-02"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Schedule Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekly Capacity Allocation"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target Daily Output</label>
              <input
                type="number"
                min="0"
                value={targetDailyOutput}
                onChange={(e) => setTargetDailyOutput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs text-white"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Create Plan Schedule'}
            </button>
          </div>
        </form>
      )}

      {/* Scoped Departments */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data?.departments || []).map((dept) => (
          <div key={dept.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/50">
                {dept.dept_code}
              </span>
              <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>{dept.lines_count} lines</span>
              </span>
            </div>
            <h3 className="text-sm font-bold text-white">{dept.name}</h3>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
              <span className="text-slate-400">Daily Capacity:</span>
              <span className="font-mono text-slate-200">{dept.total_daily_capacity.toLocaleString()} pcs</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Active Schedules:</span>
              <span className="font-mono text-amber-300">{dept.active_schedules_count}</span>
            </div>
          </div>
        ))}

        {!loading && (data?.departments?.length || 0) === 0 && (
          <div className="col-span-full bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
            <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            No departments are currently assigned to your planning scope.
          </div>
        )}
      </div>

      {/* Schedules Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">
            Departmental Planning Schedules ({data?.schedules.length || 0})
          </h2>
        </div>

        {(data?.schedules.length || 0) > 0 ? (
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Plan Code</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Title &amp; Line</th>
                  <th className="py-2.5 px-3">Target / Day</th>
                  <th className="py-2.5 px-3">Window</th>
                  <th className="py-2.5 px-3">Status</th>
                  {canManage && <th className="py-2.5 px-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {data!.schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-850/40">
                    <td className="py-2.5 px-3 font-mono font-semibold text-amber-300">{s.plan_code}</td>
                    <td className="py-2.5 px-3">{s.department_name} ({s.dept_code})</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-white">{s.title}</div>
                      {s.line_number && (
                        <div className="text-[10px] text-slate-400 font-mono">{s.line_number}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{s.target_daily_output.toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                      {String(s.planned_start_date).slice(0, 10)} → {String(s.planned_end_date).slice(0, 10)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-200 border border-slate-700">
                        {s.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="py-2.5 px-3 text-right space-x-1">
                        {s.status !== 'completed' && (
                          <button
                            onClick={() => handleStatusChange(s.id, 'completed')}
                            className="px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 text-[10px] cursor-pointer"
                          >
                            Complete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-850">
            No planning schedules found within your scope.
          </div>
        )}
      </div>
    </div>
  );
};
