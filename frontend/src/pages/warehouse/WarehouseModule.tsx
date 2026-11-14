import React, { useState, useEffect, useCallback } from 'react';
import {
  Warehouse as WarehouseIcon,
  Boxes,
  PackageCheck,
  ShieldCheck,
  ClipboardList,
  ArrowLeftRight,
  Scale,
  History,
  Settings,
  Bell,
  RefreshCw,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { useAuth } from '../../hooks/useAuth.tsx';
import { InventorySummary, Warehouse } from '../../types/index.ts';
import { formatCurrency, formatQty } from './wmsUi.tsx';
import { WarehouseDirectoryTab } from './WarehouseDirectoryTab.tsx';
import { WarehouseSettingsAlertsTab } from './WarehouseSettingsAlertsTab.tsx';
import { InventoryCatalogTab } from './InventoryCatalogTab.tsx';
import { InboundQcTab } from './InboundQcTab.tsx';
import { OutboundTransfersTab } from './OutboundTransfersTab.tsx';
import { ControlReportsTab } from './ControlReportsTab.tsx';

type WmsSubTab =
  | 'overview'
  | 'warehouses'
  | 'inbound'
  | 'qc'
  | 'requisitions'
  | 'returns-transfers'
  | 'control'
  | 'reports'
  | 'settings';

export const WarehouseModule: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const canViewWarehouse = hasPermission('warehouse:view');
  const canViewValuation = hasPermission('warehouse:reports:valuation');
  const canReqCreate = hasPermission('inventory:requisition:create');
  const canQcInspect = hasPermission('inventory:qc_inspect');

  const defaultTab: WmsSubTab = canViewWarehouse
    ? canQcInspect && !hasPermission('inventory:receive') && !hasPermission('warehouse:manage')
      ? 'qc'
      : 'overview'
    : canReqCreate
    ? 'requisitions'
    : 'qc';

  const [subTab, setSubTab] = useState<WmsSubTab>(defaultTab);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [prefillReorder, setPrefillReorder] = useState<{ materialId: number; warehouseId: number } | null>(null);

  const loadWorkspaceOverview = useCallback(async () => {
    try {
      setLoading(true);
      const tasks: Promise<void>[] = [];
      if (canViewWarehouse) {
        tasks.push(
          ApiService.getWarehouses({ limit: 100, offset: 0 })
            .then((r) => setWarehouses(r.data))
            .catch(() => {})
        );
        tasks.push(
          ApiService.getInventorySummary()
            .then(setSummary)
            .catch(() => {})
        );
      }
      if (canViewWarehouse || canReqCreate || canQcInspect) {
        tasks.push(
          ApiService.getWarehouseNotifications({ unread_only: true, limit: 100, offset: 0 })
            .then((r) => setUnreadCount(r.pagination?.total ?? r.data.length))
            .catch(() => {})
        );
      }
      await Promise.all(tasks);
    } finally {
      setLoading(false);
    }
  }, [canViewWarehouse, canReqCreate, canQcInspect]);

  useEffect(() => {
    loadWorkspaceOverview();
  }, [loadWorkspaceOverview]);

  const allTabs: Array<{ id: WmsSubTab; label: string; icon: any; visible: boolean }> = [
    { id: 'overview', label: 'Balances, Lots & Catalog', icon: Boxes, visible: canViewWarehouse },
    { id: 'warehouses', label: 'Warehouses, Bins & Staff', icon: WarehouseIcon, visible: canViewWarehouse },
    { id: 'inbound', label: 'Receiving (GRN & FG)', icon: PackageCheck, visible: canViewWarehouse },
    { id: 'qc', label: 'QC Inspection & Release', icon: ShieldCheck, visible: canViewWarehouse || canQcInspect },
    { id: 'requisitions', label: 'Requisitions & Issuing', icon: ClipboardList, visible: canViewWarehouse || canReqCreate },
    { id: 'returns-transfers', label: 'Returns & Transfers', icon: ArrowLeftRight, visible: canViewWarehouse || hasPermission('inventory:return') },
    { id: 'control', label: 'Counts, Adj & Reorders', icon: Scale, visible: canViewWarehouse },
    { id: 'reports', label: 'Ledger & Valuation', icon: History, visible: canViewWarehouse },
    { id: 'settings', label: `Settings & Alerts${unreadCount > 0 ? ` (${unreadCount})` : ''}`, icon: Settings, visible: canViewWarehouse || canReqCreate || canQcInspect },
  ];
  const tabs = allTabs.filter((t) => t.visible);

  const handleQuickReorder = (materialId: number, warehouseId: number) => {
    setPrefillReorder({ materialId, warehouseId });
    setSubTab('control');
  };

  return (
    <div className="space-y-5">
      {/* Top Workspace Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono font-semibold border border-indigo-800">
                GFMS WMS v0.3
              </span>
              <span className="text-xs text-slate-400">
                Warehouse &amp; Inventory Management System
              </span>
            </div>
            <h1 className="text-lg font-bold text-white mt-1">
              Warehouse Setup &amp; Real-Time Inventory Operations
            </h1>
            <p className="text-xs text-slate-400">
              Scope:{' '}
              <span className="font-mono text-slate-200">
                {user?.managed_warehouse_ids && user.managed_warehouse_ids.length > 0
                  ? `${user.managed_warehouse_ids.length} Assigned Warehouse(s) [${user.managed_warehouse_ids.join(', ')}]`
                  : 'Authorized Role Scope'}
              </span>
              {warehouses.length > 0 ? ` • ${warehouses.length} Accessible Warehouse(s)` : ''}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => setSubTab('settings')}
                className="px-3 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900/70 border border-amber-700/60 text-xs font-semibold text-amber-300 flex items-center space-x-1.5 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>{unreadCount} Unread Alert(s)</span>
              </button>
            )}
            <button
              type="button"
              onClick={loadWorkspaceOverview}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* Live KPI Strip */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Available</div>
              <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">{formatQty(summary.total_available_qty)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Reserved</div>
              <div className="text-sm font-mono font-bold text-indigo-300 mt-0.5">{formatQty(summary.total_reserved_qty)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Quarantine</div>
              <div className="text-sm font-mono font-bold text-amber-300 mt-0.5">{formatQty(summary.total_quarantine_qty)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">In Transit</div>
              <div className="text-sm font-mono font-bold text-sky-300 mt-0.5">{formatQty(summary.total_in_transit_qty)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Damaged/Scrap</div>
              <div className="text-sm font-mono font-bold text-rose-400 mt-0.5">{formatQty(summary.total_damaged_qty)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Pending QC</div>
              <div className="text-sm font-mono font-bold text-amber-400 mt-0.5">{summary.pending_qc_lines_count} lines</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Low Stock</div>
              <div className="text-sm font-mono font-bold text-rose-300 mt-0.5">{summary.low_stock_count} SKUs</div>
            </div>
            {canViewValuation ? (
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-emerald-800/40">
                <div className="text-[10px] text-emerald-400 uppercase">Global WAC</div>
                <div className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
                  {formatCurrency(summary.total_global_valuation ?? 0)}
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Pending Reqs</div>
                <div className="text-sm font-mono font-bold text-slate-200 mt-0.5">
                  {summary.pending_requisition_approvals}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sub-tab Navigation */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-950/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Sub-View */}
      {subTab === 'overview' && (
        <InventoryCatalogTab
          warehouses={warehouses}
          onQuickReorder={handleQuickReorder}
          onRefreshGlobal={loadWorkspaceOverview}
        />
      )}
      {subTab === 'warehouses' && (
        <WarehouseDirectoryTab onRefreshGlobal={loadWorkspaceOverview} />
      )}
      {subTab === 'inbound' && (
        <InboundQcTab mode="inbound" warehouses={warehouses} onRefreshGlobal={loadWorkspaceOverview} />
      )}
      {subTab === 'qc' && (
        <InboundQcTab mode="qc" warehouses={warehouses} onRefreshGlobal={loadWorkspaceOverview} />
      )}
      {subTab === 'requisitions' && (
        <OutboundTransfersTab mode="requisitions" warehouses={warehouses} onRefreshGlobal={loadWorkspaceOverview} />
      )}
      {subTab === 'returns-transfers' && (
        <OutboundTransfersTab mode="returns-transfers" warehouses={warehouses} onRefreshGlobal={loadWorkspaceOverview} />
      )}
      {subTab === 'control' && (
        <ControlReportsTab
          mode="control"
          warehouses={warehouses}
          prefillReorder={prefillReorder}
          onClearPrefill={() => setPrefillReorder(null)}
          onRefreshGlobal={loadWorkspaceOverview}
        />
      )}
      {subTab === 'reports' && (
        <ControlReportsTab
          mode="reports"
          warehouses={warehouses}
          onRefreshGlobal={loadWorkspaceOverview}
        />
      )}
      {subTab === 'settings' && (
        <WarehouseSettingsAlertsTab warehouses={warehouses} onRefreshGlobal={loadWorkspaceOverview} />
      )}
    </div>
  );
};
