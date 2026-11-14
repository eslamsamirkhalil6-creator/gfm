import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Settings, Check, Radar, AlertCircle, CheckCircle2, X, RefreshCw } from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { useAuth } from '../../hooks/useAuth.tsx';
import { Warehouse, WarehouseNotification, WarehouseSetting, PaginationMeta } from '../../types/index.ts';
import { PaginationBar, statusBadgeClass } from './wmsUi.tsx';

interface WarehouseSettingsAlertsTabProps {
  warehouses: Warehouse[];
  onRefreshGlobal: () => void;
}

const BOOLEAN_SETTING_KEYS = new Set(['write_off_requires_factory_manager', 'fifo_override_requires_reason']);

export const WarehouseSettingsAlertsTab: React.FC<WarehouseSettingsAlertsTabProps> = ({
  warehouses,
  onRefreshGlobal,
}) => {
  const { hasPermission } = useAuth();
  const canViewSettings = hasPermission('warehouse:view');
  const canEditSettings = hasPermission('warehouse:settings:manage');
  const canManageWarehouse = hasPermission('warehouse:manage');

  const [settings, setSettings] = useState<WarehouseSetting[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<WarehouseNotification[]>([]);
  const [notifPagination, setNotifPagination] = useState<PaginationMeta>({ total: 0, limit: 20, offset: 0 });
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [maxHoursScan, setMaxHoursScan] = useState('24');

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!canViewSettings) return;
    try {
      const list = await ApiService.getWarehouseSettings();
      setSettings(list);
      const nextDrafts: Record<string, string> = {};
      for (const s of list) nextDrafts[s.setting_key] = s.setting_value;
      setDraftValues(nextDrafts);
    } catch (err: any) {
      setError(err.message || 'Failed to load warehouse settings');
    }
  }, [canViewSettings]);

  const loadNotifications = useCallback(
    async (offset = 0) => {
      try {
        const res = await ApiService.getWarehouseNotifications({
          unread_only: unreadOnly || undefined,
          warehouse_id: warehouseFilter ? Number(warehouseFilter) : undefined,
          limit: 20,
          offset,
        });
        setNotifications(res.data);
        setNotifPagination(res.pagination);
      } catch (err: any) {
        setError(err.message || 'Failed to load warehouse notifications');
      }
    },
    [unreadOnly, warehouseFilter]
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    loadNotifications(0);
  }, [loadNotifications]);

  const handleSaveSetting = async (key: string) => {
    setError(null);
    try {
      setSavingKey(key);
      const updated = await ApiService.updateWarehouseSetting(key, draftValues[key] ?? '');
      setFeedback(`Updated setting "${updated.setting_key}" to "${updated.setting_value}".`);
      await loadSettings();
    } catch (err: any) {
      setError(err.message || `Failed to update ${key}`);
    } finally {
      setSavingKey(null);
    }
  };

  const handleMarkRead = async (id: number) => {
    setError(null);
    try {
      await ApiService.markNotificationRead(id);
      await loadNotifications(notifPagination.offset);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Failed to mark notification read');
    }
  };

  const handleScanDelayed = async () => {
    setError(null);
    try {
      setScanning(true);
      const res = await ApiService.scanDelayedTransfers(Number(maxHoursScan) || 24);
      setFeedback(`Delayed transfer scan complete: ${res.alerts_created} new alert(s) generated.`);
      await loadNotifications(0);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Failed to scan delayed transfers');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Notifications Inbox */}
        <div className={`${canViewSettings ? 'lg:col-span-7' : 'lg:col-span-12'} bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>Warehouse Operational Alerts ({notifPagination.total})</span>
            </h3>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center space-x-1.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                />
                <span>Unread only</span>
              </label>

              {warehouses.length > 0 && (
                <select
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_code}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => loadNotifications(notifPagination.offset)}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                title="Refresh notifications"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {canManageWarehouse && (
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2 text-slate-300">
                <Radar className="w-4 h-4 text-indigo-400" />
                <span>Scan In-Transit Transfers Older Than (hours):</span>
                <input
                  type="number"
                  min={0}
                  value={maxHoursScan}
                  onChange={(e) => setMaxHoursScan(e.target.value)}
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                />
              </div>
              <button
                type="button"
                disabled={scanning}
                onClick={handleScanDelayed}
                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
              >
                {scanning ? 'Scanning...' : 'Scan Delayed Transfers'}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                No notifications matching active filter.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                    n.is_read
                      ? 'bg-slate-950/40 border-slate-800/70 opacity-75'
                      : 'bg-slate-950 border-slate-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(n.severity)}`}>
                        {n.severity}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                        {n.notification_type}
                      </span>
                      {n.target_role_name && (
                        <span className="text-[10px] text-slate-400 font-mono">Role: {n.target_role_name}</span>
                      )}
                      {!n.is_read && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/50 font-semibold">
                          UNREAD
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-white">{n.title}</p>
                    <p className="text-slate-300">{n.message}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {new Date(n.created_at).toLocaleString()} {n.entity_type ? `• ${n.entity_type} #${n.entity_id}` : ''}
                    </p>
                  </div>

                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-emerald-300 flex items-center space-x-1 shrink-0 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Mark Read</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <PaginationBar pagination={notifPagination} onPageChange={(off) => loadNotifications(off)} />
        </div>

        {/* Policy Settings */}
        {canViewSettings && (
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Settings className="w-3.5 h-3.5 text-indigo-400" />
                <span>WMS Policy Settings</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                {canEditSettings ? 'Editable' : 'Read-Only'}
              </span>
            </div>

            <div className="space-y-3">
              {settings.map((s) => {
                const isBool = BOOLEAN_SETTING_KEYS.has(s.setting_key);
                const val = draftValues[s.setting_key] ?? s.setting_value;
                return (
                  <div key={s.id} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-indigo-300">{s.setting_key}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Current: {s.setting_value}
                      </span>
                    </div>
                    {s.description && <p className="text-[11px] text-slate-400">{s.description}</p>}

                    {canEditSettings && (
                      <div className="flex items-center space-x-2 pt-1">
                        {isBool ? (
                          <select
                            value={val}
                            onChange={(e) => setDraftValues({ ...draftValues, [s.setting_key]: e.target.value })}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => setDraftValues({ ...draftValues, [s.setting_key]: e.target.value })}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                          />
                        )}
                        <button
                          type="button"
                          disabled={savingKey === s.setting_key}
                          onClick={() => handleSaveSetting(s.setting_key)}
                          className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                        >
                          {savingKey === s.setting_key ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
