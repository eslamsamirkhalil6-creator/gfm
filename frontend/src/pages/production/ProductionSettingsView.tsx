import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Clock,
  Layers,
  Lock,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { ProductionSetting } from '../../types/index.ts';
import { useAuth } from '../../hooks/useAuth.tsx';

export const ProductionSettingsView: React.FC = () => {
  const { hasPermission } = useAuth();
  const [settings, setSettings] = useState<ProductionSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const canManage = hasPermission('production:settings:manage');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getProductionSettings();
      setSettings(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load production settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleUpdate = async (key: string, value: string) => {
    if (!canManage) return;
    try {
      setSavingKey(key);
      setError(null);
      await ApiService.updateProductionSetting(key, value);
      setSuccess(`Setting "${key}" updated successfully and logged in audit ledger`);
      setTimeout(() => setSuccess(null), 4000);
      await fetchSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to update setting');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <h1 className="text-lg font-bold text-white">Production Policies &amp; Bypass Settings</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Configure factory-wide quality bypass controls, authorization thresholds, and stage skip policies
            </p>
          </div>

          <button
            onClick={fetchSettings}
            disabled={loading}
            className="self-start sm:self-auto p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
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

      {/* Settings List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Global Production Parameters
        </h2>

        <div className="space-y-4">
          {settings.map((setting) => {
            const isSaving = savingKey === setting.setting_key;

            return (
              <div
                key={setting.id}
                className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-indigo-300">
                      {setting.setting_key}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{setting.description}</p>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  {setting.setting_key.includes('allow') || setting.setting_key.includes('require') ? (
                    <select
                      disabled={!canManage || isSaving}
                      value={setting.setting_value}
                      onChange={(e) => handleUpdate(setting.setting_key, e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white disabled:opacity-50 font-mono"
                    >
                      <option value="true">TRUE (Enforced)</option>
                      <option value="false">FALSE (Disabled)</option>
                    </select>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <input
                        id={`input-${setting.setting_key}`}
                        type="text"
                        disabled={!canManage || isSaving}
                        defaultValue={setting.setting_value}
                        className="w-28 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white font-mono text-right"
                      />
                      {canManage && (
                        <button
                          onClick={() => {
                            const el = document.getElementById(
                              `input-${setting.setting_key}`
                            ) as HTMLInputElement;
                            if (el) handleUpdate(setting.setting_key, el.value);
                          }}
                          disabled={isSaving}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                          title="Save Value"
                        >
                          <Save className="w-3.5 h-3.5 text-emerald-400" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scope Limitation Roadmap Notice (Section 13) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-2 text-slate-300">
          <Clock className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">
            Architecture Boundary &amp; Subsequent Implementation Roadmap
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          As mandated by Section 13 (Scope Limitation), this phase intentionally delivers the complete
          configuration foundation without prematurely bundling runtime execution engines. The following
          operational modules will connect to this configuration in subsequent development phases:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {[
            { title: 'Production Order Allocation', desc: 'Distribution of cut bundles and specific customer purchase orders to lines' },
            { title: 'Bundle Barcode Tracking', desc: 'Real-time terminal barcode/QR scanning at each workstation' },
            { title: 'Quality Inspection Execution', desc: 'Technical defect logging, tolerance variance tracking, and audit passes' },
            { title: 'Worker Piece-Rate Engine', desc: 'Operator-level piece rate computation and hourly output monitoring' },
            { title: 'Packing & Carton Validation', desc: 'Physical carton barcode verification and export packing slip generation' },
            { title: 'Raw Material Consumption', desc: 'BOM fabric and trim inventory depletion upon workflow completion' },
          ].map((item) => (
            <div key={item.title} className="p-3 rounded-lg bg-slate-950/60 border border-slate-850">
              <span className="font-semibold text-slate-300 block">{item.title}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
