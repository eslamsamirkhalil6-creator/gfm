import React, { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  SlidersHorizontal,
  ShoppingCart,
  History,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { useAuth } from '../../hooks/useAuth.tsx';
import {
  InventoryValuationReport,
  LedgerReconciliationReport,
  MaterialItem,
  PaginationMeta,
  ReorderRequest,
  StockAdjustment,
  StockCount,
  StockCountItem,
  StockMovement,
  Warehouse,
} from '../../types/index.ts';
import { formatCurrency, formatQty, PaginationBar, statusBadgeClass } from './wmsUi.tsx';

interface ControlReportsTabProps {
  mode: 'control' | 'reports';
  warehouses: Warehouse[];
  prefillReorder?: { materialId: number; warehouseId: number } | null;
  onClearPrefill?: () => void;
  onRefreshGlobal: () => void;
}

const ADJUSTMENT_REASONS = [
  'CYCLE_COUNT_VARIANCE',
  'DAMAGE',
  'LOSS',
  'WRITE_OFF',
  'FOUND',
  'OPENING_BALANCE',
  'OTHER',
] as const;

export const ControlReportsTab: React.FC<ControlReportsTabProps> = ({
  mode,
  warehouses,
  prefillReorder,
  onClearPrefill,
  onRefreshGlobal,
}) => {
  const { user, hasPermission } = useAuth();
  const canCount = hasPermission('inventory:count');
  const canProposeAdj = hasPermission('inventory:adjust:propose');
  const canApproveAdj = hasPermission('inventory:adjust:approve') || hasPermission('inventory:adjust:approve_high');
  const canCreateReorder = hasPermission('inventory:reorder:create');
  const canReviewReorder = hasPermission('inventory:reorder:review');
  const canApproveReorder = hasPermission('inventory:reorder:approve');
  const canViewValuation = hasPermission('warehouse:reports:valuation');

  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);

  // Stock Counts
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [countPagination, setCountPagination] = useState<PaginationMeta>({ total: 0, limit: 15, offset: 0 });
  const [selectedCount, setSelectedCount] = useState<{ stock_count: StockCount; items: StockCountItem[] } | null>(null);
  const [countedInputs, setCountedInputs] = useState<Record<number, string>>({});
  const [newCountForm, setNewCountForm] = useState({
    warehouse_id: '',
    count_type: 'CYCLE' as 'CYCLE' | 'FULL',
    notes: '',
  });

  // Adjustments & Write-Offs
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [adjPagination, setAdjPagination] = useState<PaginationMeta>({ total: 0, limit: 15, offset: 0 });
  const [adjForm, setAdjForm] = useState({
    warehouse_id: '',
    material_id: '',
    direction: 'OUT' as 'IN' | 'OUT',
    quantity: '',
    unit_cost: '0',
    reason_code: 'DAMAGE',
    notes: '',
  });

  // 3-Tier Reorders
  const [reorders, setReorders] = useState<ReorderRequest[]>([]);
  const [reorderPagination, setReorderPagination] = useState<PaginationMeta>({ total: 0, limit: 15, offset: 0 });
  const [reorderForm, setReorderForm] = useState({
    warehouse_id: '',
    material_id: '',
    requested_qty: '',
    priority: 'NORMAL' as 'NORMAL' | 'URGENT',
    required_date: '',
    justification: '',
  });
  const [reviewTarget, setReviewTarget] = useState<ReorderRequest | null>(null);
  const [reviewForm, setReviewForm] = useState({ supplier_note: '', po_reference: '' });

  // Ledger & Reports
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movPagination, setMovPagination] = useState<PaginationMeta>({ total: 0, limit: 25, offset: 0 });
  const [movWhFilter, setMovWhFilter] = useState('');
  const [movTypeFilter, setMovTypeFilter] = useState('');
  const [valuation, setValuation] = useState<InventoryValuationReport | null>(null);
  const [reconciliation, setReconciliation] = useState<LedgerReconciliationReport | null>(null);

  const loadMaterials = useCallback(async () => {
    try {
      const r = await ApiService.getMaterials({ status: 'active', limit: 500, offset: 0 });
      setMaterials(r.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load active materials catalog');
    }
  }, []);

  const loadControlData = useCallback(async () => {
    if (mode !== 'control') return;
    try {
      const [cRes, aRes, rRes] = await Promise.all([
        ApiService.getStockCounts({ limit: 15, offset: 0 }),
        ApiService.getAdjustments({ limit: 15, offset: 0 }),
        ApiService.getReorders({ limit: 15, offset: 0 }),
      ]);
      setCounts(cRes.data);
      setCountPagination(cRes.pagination);
      setAdjustments(aRes.data);
      setAdjPagination(aRes.pagination);
      setReorders(rRes.data);
      setReorderPagination(rRes.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory control records');
    }
  }, [mode]);

  const loadMovements = useCallback(
    async (offset = 0) => {
      if (mode !== 'reports') return;
      try {
        const res = await ApiService.getStockMovements({
          warehouse_id: movWhFilter ? Number(movWhFilter) : undefined,
          movement_type: movTypeFilter || undefined,
          limit: 25,
          offset,
        });
        setMovements(res.data);
        setMovPagination(res.pagination);
      } catch (err: any) {
        setError(err.message || 'Failed to load stock movements');
      }
    },
    [mode, movWhFilter, movTypeFilter]
  );

  const loadFinancialReports = useCallback(async () => {
    if (mode !== 'reports' || !canViewValuation) return;
    try {
      const [val, rec] = await Promise.all([
        ApiService.getInventoryValuation(),
        ApiService.reconcileInventoryLedger(),
      ]);
      setValuation(val);
      setReconciliation(rec);
    } catch (err: any) {
      setError(err.message || 'Failed to load valuation / reconciliation reports');
    }
  }, [mode, canViewValuation]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  useEffect(() => {
    if (warehouses.length > 0) {
      const firstId = String(warehouses[0].id);
      if (!newCountForm.warehouse_id) setNewCountForm((p) => ({ ...p, warehouse_id: firstId }));
      if (!adjForm.warehouse_id) setAdjForm((p) => ({ ...p, warehouse_id: firstId }));
      if (!reorderForm.warehouse_id) setReorderForm((p) => ({ ...p, warehouse_id: firstId }));
    }
  }, [warehouses, newCountForm.warehouse_id, adjForm.warehouse_id, reorderForm.warehouse_id]);

  useEffect(() => {
    if (prefillReorder) {
      setReorderForm((p) => ({
        ...p,
        material_id: String(prefillReorder.materialId),
        warehouse_id: String(prefillReorder.warehouseId),
        priority: 'URGENT',
        justification: 'Low stock monitor replenishment trigger',
      }));
      onClearPrefill?.();
    }
  }, [prefillReorder, onClearPrefill]);

  useEffect(() => {
    loadControlData();
    loadMovements(0);
    loadFinancialReports();
  }, [loadControlData, loadMovements, loadFinancialReports]);

  // Stock count handlers
  const handleCreateCount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await ApiService.createStockCount({
        warehouse_id: Number(newCountForm.warehouse_id),
        count_type: newCountForm.count_type,
        notes: newCountForm.notes.trim() || undefined,
      });
      const init: Record<number, string> = {};
      for (const it of res.items) init[it.id] = it.counted_qty !== null ? String(it.counted_qty) : String(it.system_qty);
      setCountedInputs(init);
      setSelectedCount(res);
      setFeedback(`Stock count ${res.stock_count.count_number} snapshot generated.`);
      await loadControlData();
    } catch (err: any) {
      setError(err.message || 'Failed to create stock count');
    }
  };

  const handleSelectCount = async (id: number) => {
    setError(null);
    try {
      const res = await ApiService.getStockCountById(id);
      const init: Record<number, string> = {};
      for (const it of res.items) init[it.id] = it.counted_qty !== null ? String(it.counted_qty) : String(it.system_qty);
      setCountedInputs(init);
      setSelectedCount(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load stock count sheet');
    }
  };

  const handleSaveCountQuantities = async () => {
    if (!selectedCount) return;
    setError(null);
    try {
      await ApiService.recordStockCountItems(
        selectedCount.stock_count.id,
        selectedCount.items.map((it) => ({
          stock_count_item_id: it.id,
          counted_qty: Number(countedInputs[it.id] ?? it.system_qty),
        }))
      );
      setFeedback(`Saved physical count quantities for ${selectedCount.stock_count.count_number}.`);
      await handleSelectCount(selectedCount.stock_count.id);
    } catch (err: any) {
      setError(err.message || 'Failed to save count quantities');
    }
  };

  const handleSubmitCount = async () => {
    if (!selectedCount) return;
    setError(null);
    try {
      await ApiService.submitStockCount(selectedCount.stock_count.id);
      setFeedback(`Submitted ${selectedCount.stock_count.count_number} for manager approval.`);
      await handleSelectCount(selectedCount.stock_count.id);
      await loadControlData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit stock count');
    }
  };

  const handleApproveCount = async () => {
    if (!selectedCount) return;
    setError(null);
    try {
      await ApiService.approveStockCount(selectedCount.stock_count.id);
      setFeedback(`Approved ${selectedCount.stock_count.count_number} & posted variance adjustments!`);
      await handleSelectCount(selectedCount.stock_count.id);
      await loadControlData();
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Stock count approval blocked');
    }
  };

  // Adjustments handlers
  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const adj = await ApiService.createAdjustment({
        warehouse_id: Number(adjForm.warehouse_id),
        material_id: Number(adjForm.material_id),
        direction: adjForm.direction,
        quantity: Number(adjForm.quantity),
        unit_cost: adjForm.direction === 'IN' ? Number(adjForm.unit_cost || 0) : undefined,
        reason_code: adjForm.reason_code,
        notes: adjForm.notes.trim() || undefined,
      });
      setFeedback(`Adjustment ${adj.adjustment_number} submitted (${adj.requires_factory_manager ? 'Requires Factory Manager' : 'Manager Approval'}).`);
      setAdjForm((p) => ({ ...p, quantity: '', notes: '' }));
      await loadControlData();
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Adjustment proposal failed');
    }
  };

  const handleAdjAction = async (id: number, action: 'approve' | 'reject') => {
    setError(null);
    try {
      if (action === 'approve') {
        const res = await ApiService.approveAdjustment(id);
        setFeedback(`Adjustment ${res.adjustment.adjustment_number} approved & posted.`);
      } else {
        const res = await ApiService.rejectAdjustment(id, 'Rejected by approver');
        setFeedback(`Adjustment ${res.adjustment_number} rejected.`);
      }
      await loadControlData();
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || `Adjustment ${action} failed`);
    }
  };

  // Reorder handlers
  const handleCreateReorder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const rr = await ApiService.createReorder({
        warehouse_id: Number(reorderForm.warehouse_id),
        material_id: Number(reorderForm.material_id),
        requested_qty: Number(reorderForm.requested_qty),
        priority: reorderForm.priority,
        required_date: reorderForm.required_date || undefined,
        justification: reorderForm.justification.trim() || undefined,
      });
      setFeedback(`Reorder draft ${rr.request_number} created.`);
      setReorderForm((p) => ({ ...p, requested_qty: '', justification: '' }));
      await loadControlData();
    } catch (err: any) {
      setError(err.message || 'Reorder creation failed');
    }
  };

  const handleReorderStep = async (id: number, step: 'submit' | 'approve' | 'reject') => {
    setError(null);
    try {
      if (step === 'submit') await ApiService.submitReorder(id);
      if (step === 'approve') await ApiService.approveReorder(id);
      if (step === 'reject') await ApiService.rejectReorder(id, 'Rejected via UI');
      setFeedback(`Reorder #${id} ${step} succeeded.`);
      await loadControlData();
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || `Reorder ${step} failed`);
    }
  };

  const handlePurchasingReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    setError(null);
    try {
      const res = await ApiService.reviewReorder(reviewTarget.id, {
        supplier_note: reviewForm.supplier_note.trim() || undefined,
        po_reference: reviewForm.po_reference.trim() || undefined,
      });
      setFeedback(`Reorder ${res.request_number} reviewed by Purchasing; routed to Factory Manager.`);
      setReviewTarget(null);
      await loadControlData();
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Purchasing review failed');
    }
  };

  return (
    <div className="space-y-4">
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

      {/* ==================== CONTROL: COUNTS, ADJUSTMENTS, REORDERS ==================== */}
      {mode === 'control' && (
        <div className="space-y-5">
          {/* 1. Physical Stock Counts */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center space-x-1.5">
                <Scale className="w-4 h-4" />
                <span>Physical Stock Counts (Maker-Checker) ({countPagination.total})</span>
              </h3>
              {canCount && (
                <form onSubmit={handleCreateCount} className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    required
                    value={newCountForm.warehouse_id}
                    onChange={(e) => setNewCountForm({ ...newCountForm, warehouse_id: e.target.value })}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_code}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newCountForm.count_type}
                    onChange={(e) => setNewCountForm({ ...newCountForm, count_type: e.target.value as any })}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                  >
                    <option value="CYCLE">CYCLE</option>
                    <option value="FULL">FULL</option>
                  </select>
                  <button type="submit" className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center space-x-1 cursor-pointer">
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Count Snapshot</span>
                  </button>
                </form>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              <div className="xl:col-span-5 overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                    <tr>
                      <th className="px-2.5 py-2">Count #</th>
                      <th className="px-2.5 py-2">WH / Type</th>
                      <th className="px-2.5 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {counts.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => handleSelectCount(c.id)}
                        className={`cursor-pointer ${
                          selectedCount?.stock_count.id === c.id ? 'bg-indigo-950/40' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="px-2.5 py-2 font-mono text-indigo-300 font-semibold">{c.count_number}</td>
                        <td className="px-2.5 py-2 font-mono text-slate-300">
                          {c.warehouse_code} ({c.count_type})
                        </td>
                        <td className="px-2.5 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(c.status)}`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="xl:col-span-7 space-y-3">
                {!selectedCount ? (
                  <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                    Select a stock count to record physical quantities or execute Maker-Checker approval.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-mono font-bold text-white">{selectedCount.stock_count.count_number}</span>
                        <span className="text-slate-400 ml-2">Created by @{selectedCount.stock_count.created_by_username}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {canCount && selectedCount.stock_count.status === 'IN_PROGRESS' && (
                          <>
                            <button
                              type="button"
                              onClick={handleSaveCountQuantities}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
                            >
                              Save Quantities
                            </button>
                            <button
                              type="button"
                              onClick={handleSubmitCount}
                              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer"
                            >
                              Submit for Approval
                            </button>
                          </>
                        )}
                        {canApproveAdj && selectedCount.stock_count.status === 'SUBMITTED' && (
                          <button
                            type="button"
                            disabled={
                              user?.id === selectedCount.stock_count.created_by ||
                              user?.id === selectedCount.stock_count.submitted_by
                            }
                            onClick={handleApproveCount}
                            title={
                              user?.id === selectedCount.stock_count.created_by ||
                              user?.id === selectedCount.stock_count.submitted_by
                                ? 'Maker-Checker: Creator/Submitter cannot self-approve'
                                : 'Approve count variances'
                            }
                            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-40 cursor-pointer"
                          >
                            Approve &amp; Post Variances
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase sticky top-0">
                          <tr>
                            <th className="px-2.5 py-2">Bin / SKU</th>
                            <th className="px-2.5 py-2 text-right">System</th>
                            <th className="px-2.5 py-2 text-right">Counted</th>
                            <th className="px-2.5 py-2 text-right">Variance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {selectedCount.items.map((it) => {
                            const countedVal = countedInputs[it.id] ?? String(it.counted_qty ?? it.system_qty);
                            const variance = Number(countedVal) - Number(it.system_qty);
                            return (
                              <tr key={it.id}>
                                <td className="px-2.5 py-2">
                                  <span className="font-mono text-indigo-300">{it.location_code}</span> •{' '}
                                  <span className="font-mono text-white">{it.sku}</span>
                                </td>
                                <td className="px-2.5 py-2 text-right font-mono text-slate-300">{formatQty(it.system_qty)}</td>
                                <td className="px-2.5 py-2 text-right">
                                  {selectedCount.stock_count.status === 'IN_PROGRESS' && canCount ? (
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={countedVal}
                                      onChange={(e) => setCountedInputs({ ...countedInputs, [it.id]: e.target.value })}
                                      className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-right text-white font-mono"
                                    />
                                  ) : (
                                    <span className="font-mono text-white">{formatQty(it.counted_qty)}</span>
                                  )}
                                </td>
                                <td
                                  className={`px-2.5 py-2 text-right font-mono font-semibold ${
                                    variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {variance > 0 ? `+${formatQty(variance)}` : formatQty(variance)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 2. Stock Adjustments & Write-Offs */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center space-x-1.5">
              <SlidersHorizontal className="w-4 h-4" />
              <span>Stock Adjustments &amp; Write-Offs ({adjPagination.total})</span>
            </h3>

            {canProposeAdj && (
              <form onSubmit={handleCreateAdjustment} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Warehouse *</label>
                  <select
                    required
                    value={adjForm.warehouse_id}
                    onChange={(e) => setAdjForm({ ...adjForm, warehouse_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Material *</label>
                  <select
                    required
                    value={adjForm.material_id}
                    onChange={(e) => setAdjForm({ ...adjForm, material_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                  >
                    <option value="">Select SKU...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.sku} - {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Direction *</label>
                  <select
                    value={adjForm.direction}
                    onChange={(e) => setAdjForm({ ...adjForm, direction: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                  >
                    <option value="OUT">OUT (Deduct)</option>
                    <option value="IN">IN (Add)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Reason *</label>
                  <select
                    value={adjForm.reason_code}
                    onChange={(e) => setAdjForm({ ...adjForm, reason_code: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                  >
                    {ADJUSTMENT_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Qty {adjForm.direction === 'IN' ? '/ Unit Cost' : '*'}</label>
                  <div className="flex space-x-1">
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      required
                      value={adjForm.quantity}
                      onChange={(e) => setAdjForm({ ...adjForm, quantity: e.target.value })}
                      placeholder="Qty"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                    />
                    {adjForm.direction === 'IN' && (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={adjForm.unit_cost}
                        onChange={(e) => setAdjForm({ ...adjForm, unit_cost: e.target.value })}
                        placeholder="Cost"
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer">
                    Propose Adjustment
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                  <tr>
                    <th className="px-3 py-2">Adj #</th>
                    <th className="px-3 py-2">WH / SKU</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2 text-right">Qty / Value</th>
                    <th className="px-3 py-2">Escalation</th>
                    <th className="px-3 py-2">Status</th>
                    {canApproveAdj && <th className="px-3 py-2 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {adjustments.map((a) => {
                    const isSelf = user?.id === a.requested_by;
                    return (
                      <tr key={a.id}>
                        <td className="px-3 py-2 font-mono text-indigo-300">{a.adjustment_number}</td>
                        <td className="px-3 py-2">
                          <span className="font-mono text-slate-300">{a.warehouse_code}</span> •{' '}
                          <span className="font-mono text-white">{a.sku}</span>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-300">
                          {a.direction} • {a.reason_code}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-white">
                          {formatQty(a.quantity)} ({formatCurrency(a.total_value)})
                        </td>
                        <td className="px-3 py-2 text-[11px] font-mono text-amber-300">
                          {a.requires_factory_manager ? 'Factory Manager' : 'Warehouse Manager'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(a.status)}`}>
                            {a.status}
                          </span>
                        </td>
                        {canApproveAdj && (
                          <td className="px-3 py-2 text-right space-x-1.5">
                            {a.status === 'PENDING_APPROVAL' ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isSelf}
                                  onClick={() => handleAdjAction(a.id, 'approve')}
                                  title={isSelf ? 'Maker-Checker: Cannot approve own proposal' : 'Approve adjustment'}
                                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] text-white disabled:opacity-40 cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdjAction(a.id, 'reject')}
                                  className="px-2 py-0.5 rounded bg-rose-700 hover:bg-rose-600 text-[11px] text-white cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-500 font-mono">Processed</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. 3-Tier Reorder Requests */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300 flex items-center space-x-1.5">
              <ShoppingCart className="w-4 h-4" />
              <span>3-Tier Reorder Requests (WM → Purchasing → Factory Manager) ({reorderPagination.total})</span>
            </h3>

            {canCreateReorder && (
              <form onSubmit={handleCreateReorder} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Warehouse *</label>
                  <select
                    required
                    value={reorderForm.warehouse_id}
                    onChange={(e) => setReorderForm({ ...reorderForm, warehouse_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Material *</label>
                  <select
                    required
                    value={reorderForm.material_id}
                    onChange={(e) => setReorderForm({ ...reorderForm, material_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                  >
                    <option value="">Select SKU...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.sku} - {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Qty *</label>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    required
                    value={reorderForm.requested_qty}
                    onChange={(e) => setReorderForm({ ...reorderForm, requested_qty: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Priority</label>
                  <select
                    value={reorderForm.priority}
                    onChange={(e) => setReorderForm({ ...reorderForm, priority: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Justification</label>
                  <input
                    type="text"
                    value={reorderForm.justification}
                    onChange={(e) => setReorderForm({ ...reorderForm, justification: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                  />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer">
                    Create Reorder
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                  <tr>
                    <th className="px-3 py-2">Request #</th>
                    <th className="px-3 py-2">WH / SKU</th>
                    <th className="px-3 py-2 text-right">Qty / Priority</th>
                    <th className="px-3 py-2">PO Ref / Supplier</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2 text-right">Workflow Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {reorders.map((rr) => (
                    <tr key={rr.id}>
                      <td className="px-3 py-2 font-mono text-indigo-300">{rr.request_number}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-slate-300">{rr.warehouse_code}</span> •{' '}
                        <span className="font-mono text-white">{rr.sku}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-white">
                        {formatQty(rr.requested_qty)} {rr.base_uom} ({rr.priority})
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-300 font-mono">
                        {rr.po_reference || '—'} {rr.supplier_note ? `(${rr.supplier_note})` : ''}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(rr.status)}`}>
                          {rr.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right space-x-1.5">
                        {canCreateReorder && rr.status === 'OPEN' && (
                          <button
                            type="button"
                            onClick={() => handleReorderStep(rr.id, 'submit')}
                            className="px-2 py-0.5 rounded bg-indigo-600 text-[11px] text-white cursor-pointer"
                          >
                            Submit
                          </button>
                        )}
                        {canReviewReorder && rr.status === 'SUBMITTED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewTarget(rr);
                              setReviewForm({ supplier_note: rr.supplier_note || '', po_reference: rr.po_reference || '' });
                            }}
                            className="px-2 py-0.5 rounded bg-amber-600 text-[11px] text-white cursor-pointer"
                          >
                            Purchasing Review
                          </button>
                        )}
                        {canApproveReorder && rr.status === 'PURCHASING_REVIEWED' && (
                          <button
                            type="button"
                            onClick={() => handleReorderStep(rr.id, 'approve')}
                            className="px-2 py-0.5 rounded bg-emerald-600 text-[11px] text-white cursor-pointer"
                          >
                            Final Approve
                          </button>
                        )}
                        {(canCreateReorder || canReviewReorder || canApproveReorder) &&
                          ['OPEN', 'SUBMITTED', 'PURCHASING_REVIEWED'].includes(rr.status) && (
                            <button
                              type="button"
                              onClick={() => handleReorderStep(rr.id, 'reject')}
                              className="px-2 py-0.5 rounded bg-rose-700 text-[11px] text-white cursor-pointer"
                            >
                              Reject
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== LEDGER, VALUATION & RECONCILIATION ==================== */}
      {mode === 'reports' && (
        <div className="space-y-5">
          {canViewValuation && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Valuation Card */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300 flex items-center space-x-1.5">
                    <DollarSign className="w-4 h-4" />
                    <span>Global Weighted Average Cost (WAC) Valuation</span>
                  </h3>
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    {formatCurrency(valuation?.total_inventory_value ?? 0)}
                  </span>
                </div>
                <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase sticky top-0">
                      <tr>
                        <th className="px-2.5 py-2">SKU</th>
                        <th className="px-2.5 py-2">Material</th>
                        <th className="px-2.5 py-2 text-right">Valued Qty</th>
                        <th className="px-2.5 py-2 text-right">WAC</th>
                        <th className="px-2.5 py-2 text-right">Total Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {(valuation?.materials || []).map((m) => (
                        <tr key={m.id}>
                          <td className="px-2.5 py-1.5 font-mono text-indigo-300">{m.sku}</td>
                          <td className="px-2.5 py-1.5 text-slate-200">{m.name}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-slate-300">
                            {formatQty(m.total_valued_qty)} {m.base_uom}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-slate-300">
                            {formatCurrency(m.weighted_avg_cost)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-mono font-semibold text-emerald-400">
                            {formatCurrency(m.total_inventory_value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Ledger Reconciliation */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Balances vs Ledger Reconciliation</span>
                  </h3>
                  <button
                    type="button"
                    onClick={loadFinancialReports}
                    className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white cursor-pointer"
                  >
                    Run Check
                  </button>
                </div>

                {reconciliation ? (
                  <div className="space-y-3 text-xs">
                    <div
                      className={`p-3 rounded-lg border ${
                        reconciliation.isBalanced
                          ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                      }`}
                    >
                      <p className="font-bold">
                        {reconciliation.isBalanced
                          ? 'BALANCED — 0 Ledger Discrepancies Detected'
                          : `DISCREPANCY — ${reconciliation.discrepancies.length} mismatch(es) detected`}
                      </p>
                      <p className="text-[11px] opacity-80 mt-0.5">
                        Verified SUM(inventory_balances.qty_on_hand) == Net SUM(stock_movements) across all warehouses &amp; SKUs.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Immutable Stock Movements Ledger */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Immutable Stock Movements Ledger ({movPagination.total})</span>
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={movWhFilter}
                  onChange={(e) => setMovWhFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200"
                >
                  <option value="">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_code}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={movTypeFilter}
                  onChange={(e) => setMovTypeFilter(e.target.value.toUpperCase())}
                  placeholder="Movement type filter..."
                  className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-white font-mono"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                  <tr>
                    <th className="px-3 py-2">Movement #</th>
                    <th className="px-3 py-2">Type / Doc Ref</th>
                    <th className="px-3 py-2">WH / Bin</th>
                    <th className="px-3 py-2">SKU / Lot</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Before → After</th>
                    <th className="px-3 py-2">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/30">
                      <td className="px-3 py-2 font-mono text-indigo-300">{m.movement_number}</td>
                      <td className="px-3 py-2">
                        <div className="font-mono text-slate-200">{m.movement_type}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {m.source_document_type} {m.source_document_ref || `#${m.source_document_id}`}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-300">
                        {m.warehouse_code} / {m.location_code}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-white">{m.sku}</span>
                        {m.lot_number && <div className="text-[11px] font-mono text-slate-400">{m.lot_number}</div>}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono font-bold ${
                          m.direction === 'IN' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {m.direction === 'IN' ? '+' : '-'}
                        {formatQty(m.quantity)} {m.base_uom}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">
                        {formatQty(m.balance_before)} → {formatQty(m.balance_after)}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">@{m.actor_username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationBar pagination={movPagination} onPageChange={(off) => loadMovements(off)} />
          </div>
        </div>
      )}

      {/* Purchasing Review Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <form onSubmit={handlePurchasingReview} className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Purchasing Sourcing Review — {reviewTarget.request_number}</h3>
              <button type="button" onClick={() => setReviewTarget(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Proposed PO Reference</label>
                <input
                  type="text"
                  value={reviewForm.po_reference}
                  onChange={(e) => setReviewForm({ ...reviewForm, po_reference: e.target.value })}
                  placeholder="PO-2026-NEW"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Supplier &amp; Lead-Time Note</label>
                <textarea
                  rows={3}
                  value={reviewForm.supplier_note}
                  onChange={(e) => setReviewForm({ ...reviewForm, supplier_note: e.target.value })}
                  placeholder="Vendor quote, price & lead time details..."
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setReviewTarget(null)} className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white cursor-pointer">
                Submit Purchasing Review
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
