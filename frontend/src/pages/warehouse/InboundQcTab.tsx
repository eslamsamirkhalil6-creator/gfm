import React, { useState, useEffect, useCallback } from 'react';
import {
  PackageCheck,
  ShieldCheck,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  ClipboardCheck,
  ShieldAlert,
  Factory,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { useAuth } from '../../hooks/useAuth.tsx';
import {
  DepartmentWithDetails,
  GoodsReceipt,
  GoodsReceiptItem,
  InventoryLot,
  MaterialItem,
  PaginationMeta,
  PendingQcItem,
  ProductionLine,
  QcInspection,
  Warehouse,
  WarehouseLocation,
} from '../../types/index.ts';
import { formatCurrency, formatQty, PaginationBar, statusBadgeClass } from './wmsUi.tsx';

interface InboundQcTabProps {
  mode: 'inbound' | 'qc';
  warehouses: Warehouse[];
  onRefreshGlobal: () => void;
}

export const InboundQcTab: React.FC<InboundQcTabProps> = ({ mode, warehouses, onRefreshGlobal }) => {
  const { hasPermission } = useAuth();
  const canReceive = hasPermission('inventory:receive');
  const canInspectQc = hasPermission('inventory:qc_inspect');
  const canOverrideQc = hasPermission('inventory:qc_override');

  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [locationsByWh, setLocationsByWh] = useState<Record<number, WarehouseLocation[]>>({});
  const [departments, setDepartments] = useState<DepartmentWithDetails[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);

  // GRN state
  const [grns, setGrns] = useState<GoodsReceipt[]>([]);
  const [grnPagination, setGrnPagination] = useState<PaginationMeta>({ total: 0, limit: 15, offset: 0 });
  const [grnStatusFilter, setGrnStatusFilter] = useState('');
  const [selectedGrn, setSelectedGrn] = useState<{ grn: GoodsReceipt; items: GoodsReceiptItem[] } | null>(null);

  const [showCreateGrn, setShowCreateGrn] = useState(false);
  const [grnForm, setGrnForm] = useState({
    warehouse_id: '',
    supplier_name: '',
    delivery_note_no: '',
    po_reference: '',
    notes: '',
  });

  const [grnItemForm, setGrnItemForm] = useState({
    material_id: '',
    target_location_id: '',
    ordered_qty: '',
    received_qty: '',
    accepted_qty: '',
    rejected_qty: '0',
    damaged_qty: '0',
    pending_inspection_qty: '0',
    unit_cost: '0',
    lot_number: '',
    roll_number: '',
    shade_code: '',
  });

  // Finished Goods Handover
  const [showFgPanel, setShowFgPanel] = useState(false);
  const [fgForm, setFgForm] = useState({
    department_id: '',
    production_line_id: '',
    warehouse_id: '',
    target_location_id: '',
    material_id: '',
    quantity: '',
    unit_cost: '0',
    lot_number: '',
    handover_ref: '',
    notes: '',
  });

  // QC state
  const [pendingQc, setPendingQc] = useState<PendingQcItem[]>([]);
  const [pendingPagination, setPendingPagination] = useState<PaginationMeta>({ total: 0, limit: 20, offset: 0 });
  const [qcHistory, setQcHistory] = useState<QcInspection[]>([]);
  const [histPagination, setHistPagination] = useState<PaginationMeta>({ total: 0, limit: 20, offset: 0 });
  const [inspectTarget, setInspectTarget] = useState<PendingQcItem | null>(null);
  const [inspectForm, setInspectForm] = useState({
    passed_qty: '',
    rejected_qty: '0',
    damaged_qty: '0',
    target_location_id: '',
    reject_stock_status: 'DAMAGED' as 'DAMAGED' | 'SCRAP',
    notes: '',
  });

  // QC Manager Override
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [overrideForm, setOverrideForm] = useState({
    warehouse_id: '',
    material_id: '',
    lot_id: '',
    target_location_id: '',
    from_stock_status: 'QUARANTINE' as 'QUARANTINE' | 'HOLD' | 'DAMAGED',
    to_stock_status: 'AVAILABLE' as 'AVAILABLE' | 'HOLD' | 'DAMAGED' | 'SCRAP',
    quantity: '',
    reason: '',
  });

  const ensureLocations = useCallback(
    async (whId: number) => {
      if (!whId || locationsByWh[whId]) return;
      try {
        const locs = await ApiService.getWarehouseLocations(whId);
        setLocationsByWh((prev) => ({ ...prev, [whId]: locs }));
      } catch {
        // ignore scoped error
      }
    },
    [locationsByWh]
  );

  const loadLookups = useCallback(async () => {
    try {
      const matRes = await ApiService.getMaterials({ status: 'active', limit: 500, offset: 0 });
      setMaterials(matRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load active materials catalog');
    }
    if (hasPermission('departments:view') || hasPermission('departments:scoped:view')) {
      ApiService.getDepartments({ status: 'active' }).then(setDepartments).catch(() => {});
    } else if (
      hasPermission('warehouse:view') ||
      hasPermission('inventory:requisition:create') ||
      hasPermission('inventory:return')
    ) {
      ApiService.getWarehouseDepartments()
        .then((opts) => setDepartments(opts as any))
        .catch(() => {});
    }
    if (hasPermission('production:view')) {
      ApiService.getLines().then(setLines).catch(() => {});
    }
  }, [hasPermission]);

  const loadGrns = useCallback(
    async (offset = 0) => {
      if (mode !== 'inbound') return;
      try {
        const res = await ApiService.getGrns({
          status: grnStatusFilter || undefined,
          limit: 15,
          offset,
        });
        setGrns(res.data);
        setGrnPagination(res.pagination);
      } catch (err: any) {
        setError(err.message || 'Failed to load GRNs');
      }
    },
    [mode, grnStatusFilter]
  );

  const loadQcData = useCallback(
    async (offset = 0) => {
      if (mode !== 'qc') return;
      try {
        const [pend, hist] = await Promise.all([
          ApiService.getPendingQc({ limit: 20, offset }),
          ApiService.getQcHistory({ limit: 20, offset: 0 }),
        ]);
        setPendingQc(pend.data);
        setPendingPagination(pend.pagination);
        setQcHistory(hist.data);
        setHistPagination(hist.pagination);
        if (canOverrideQc) {
          ApiService.getInventoryLots({ limit: 200, offset: 0 })
            .then((r) => setLots(r.data))
            .catch(() => {});
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load QC queue');
      }
    },
    [mode, canOverrideQc]
  );

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (warehouses.length > 0) {
      if (!grnForm.warehouse_id) setGrnForm((p) => ({ ...p, warehouse_id: String(warehouses[0].id) }));
      const fgWh = warehouses.find((w) => w.warehouse_type === 'FINISHED_GOODS') || warehouses[0];
      if (!fgForm.warehouse_id && fgWh) setFgForm((p) => ({ ...p, warehouse_id: String(fgWh.id) }));
      if (!overrideForm.warehouse_id) setOverrideForm((p) => ({ ...p, warehouse_id: String(warehouses[0].id) }));
    }
  }, [warehouses, grnForm.warehouse_id, fgForm.warehouse_id, overrideForm.warehouse_id]);

  useEffect(() => {
    loadGrns(0);
    loadQcData(0);
  }, [loadGrns, loadQcData]);

  useEffect(() => {
    if (selectedGrn?.grn.warehouse_id) ensureLocations(selectedGrn.grn.warehouse_id);
  }, [selectedGrn, ensureLocations]);

  useEffect(() => {
    if (fgForm.warehouse_id) ensureLocations(Number(fgForm.warehouse_id));
  }, [fgForm.warehouse_id, ensureLocations]);

  useEffect(() => {
    if (overrideForm.warehouse_id) ensureLocations(Number(overrideForm.warehouse_id));
  }, [overrideForm.warehouse_id, ensureLocations]);

  const selectedGrnMaterial = materials.find((m) => String(m.id) === grnItemForm.material_id);

  // Sync physical reconciliation breakdown when material or received_qty changes
  const handleGrnMatOrQtyChange = (matId: string, recQty: string) => {
    const mat = materials.find((m) => String(m.id) === matId);
    const reqQc = Boolean(mat?.requires_qc_on_receipt);
    setGrnItemForm((prev) => ({
      ...prev,
      material_id: matId,
      received_qty: recQty,
      accepted_qty: reqQc ? '0' : recQty || '0',
      pending_inspection_qty: reqQc ? recQty || '0' : '0',
      rejected_qty: '0',
      damaged_qty: '0',
    }));
  };

  const handleSelectGrn = async (id: number) => {
    setError(null);
    try {
      const data = await ApiService.getGrnById(id);
      setSelectedGrn(data);
      await ensureLocations(data.grn.warehouse_id);
    } catch (err: any) {
      setError(err.message || 'Failed to load GRN detail');
    }
  };

  const handleCreateGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const created = await ApiService.createGrn({
        warehouse_id: Number(grnForm.warehouse_id),
        supplier_name: grnForm.supplier_name.trim(),
        delivery_note_no: grnForm.delivery_note_no.trim() || undefined,
        po_reference: grnForm.po_reference.trim() || undefined,
        notes: grnForm.notes.trim() || undefined,
      });
      setShowCreateGrn(false);
      setGrnForm((p) => ({ ...p, supplier_name: '', delivery_note_no: '', po_reference: '', notes: '' }));
      setSelectedGrn(created);
      setFeedback(`GRN draft ${created.grn.grn_number} created.`);
      await loadGrns(0);
    } catch (err: any) {
      setError(err.message || 'Failed to create GRN');
    }
  };

  const handleAddGrnItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGrn) return;
    setError(null);
    try {
      await ApiService.addGrnItem(selectedGrn.grn.id, {
        material_id: Number(grnItemForm.material_id),
        target_location_id: grnItemForm.target_location_id ? Number(grnItemForm.target_location_id) : undefined,
        ordered_qty: grnItemForm.ordered_qty ? Number(grnItemForm.ordered_qty) : undefined,
        received_qty: Number(grnItemForm.received_qty),
        accepted_qty: Number(grnItemForm.accepted_qty || 0),
        rejected_qty: Number(grnItemForm.rejected_qty || 0),
        damaged_qty: Number(grnItemForm.damaged_qty || 0),
        pending_inspection_qty: Number(grnItemForm.pending_inspection_qty || 0),
        unit_cost: Number(grnItemForm.unit_cost || 0),
        lot_number: grnItemForm.lot_number.trim() || undefined,
        roll_number: grnItemForm.roll_number.trim() || undefined,
        shade_code: grnItemForm.shade_code.trim() || undefined,
      });
      setFeedback(`Added line item to ${selectedGrn.grn.grn_number}.`);
      setGrnItemForm({
        material_id: '',
        target_location_id: '',
        ordered_qty: '',
        received_qty: '',
        accepted_qty: '',
        rejected_qty: '0',
        damaged_qty: '0',
        pending_inspection_qty: '0',
        unit_cost: '0',
        lot_number: '',
        roll_number: '',
        shade_code: '',
      });
      await handleSelectGrn(selectedGrn.grn.id);
    } catch (err: any) {
      setError(err.message || 'Failed to add GRN line item');
    }
  };

  const handlePostGrn = async (grnId: number) => {
    setError(null);
    try {
      const res = await ApiService.postGrn(grnId);
      setFeedback(`GRN ${res.grn.grn_number} posted to stock & ledger!`);
      await handleSelectGrn(grnId);
      await loadGrns(grnPagination.offset);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Failed to post GRN');
    }
  };

  const handleFinishedGoodsReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await ApiService.receiveFinishedGoods({
        department_id: Number(fgForm.department_id),
        production_line_id: fgForm.production_line_id ? Number(fgForm.production_line_id) : undefined,
        warehouse_id: Number(fgForm.warehouse_id),
        target_location_id: fgForm.target_location_id ? Number(fgForm.target_location_id) : undefined,
        material_id: Number(fgForm.material_id),
        quantity: Number(fgForm.quantity),
        unit_cost: Number(fgForm.unit_cost || 0),
        lot_number: fgForm.lot_number.trim() || undefined,
        handover_ref: fgForm.handover_ref.trim() || undefined,
        notes: fgForm.notes.trim() || undefined,
      });
      setFeedback(`Finished Goods receipt ${res.receipt.grn_number} posted.`);
      setFgForm((p) => ({ ...p, quantity: '', lot_number: '', handover_ref: '', notes: '' }));
      setShowFgPanel(false);
      await loadGrns(0);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Finished goods handover failed');
    }
  };

  const handleOpenInspect = async (item: PendingQcItem) => {
    setInspectTarget(item);
    await ensureLocations(item.warehouse_id);
    setInspectForm({
      passed_qty: String(item.pending_inspection_qty),
      rejected_qty: '0',
      damaged_qty: '0',
      target_location_id: '',
      reject_stock_status: 'DAMAGED',
      notes: '',
    });
    setError(null);
  };

  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectTarget) return;
    setError(null);
    try {
      const res = await ApiService.performQcInspection({
        grn_item_id: inspectTarget.id,
        passed_qty: Number(inspectForm.passed_qty || 0),
        rejected_qty: Number(inspectForm.rejected_qty || 0),
        damaged_qty: Number(inspectForm.damaged_qty || 0),
        target_location_id: inspectForm.target_location_id ? Number(inspectForm.target_location_id) : undefined,
        reject_stock_status: inspectForm.reject_stock_status,
        notes: inspectForm.notes.trim() || undefined,
      });
      setFeedback(`QC inspection ${res.inspection.inspection_number} recorded (${res.inspection.outcome_status}).`);
      setInspectTarget(null);
      await loadQcData(pendingPagination.offset);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'QC inspection failed');
    }
  };

  const handleOverrideQc = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await ApiService.overrideQcStatus({
        warehouse_id: Number(overrideForm.warehouse_id),
        material_id: Number(overrideForm.material_id),
        lot_id: overrideForm.lot_id ? Number(overrideForm.lot_id) : undefined,
        target_location_id: overrideForm.target_location_id ? Number(overrideForm.target_location_id) : undefined,
        from_stock_status: overrideForm.from_stock_status,
        to_stock_status: overrideForm.to_stock_status,
        quantity: Number(overrideForm.quantity),
        reason: overrideForm.reason.trim(),
      });
      setFeedback(`QC Manager Override ${res.inspection.inspection_number} applied & audited.`);
      setOverrideForm((p) => ({ ...p, quantity: '', reason: '' }));
      await loadQcData(pendingPagination.offset);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'QC override failed');
    }
  };

  const grnEquationValid = (() => {
    const rec = Number(grnItemForm.received_qty || 0);
    const sum =
      Number(grnItemForm.accepted_qty || 0) +
      Number(grnItemForm.rejected_qty || 0) +
      Number(grnItemForm.damaged_qty || 0) +
      Number(grnItemForm.pending_inspection_qty || 0);
    return rec > 0 && Math.abs(rec - sum) < 0.001;
  })();

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

      {/* ==================== INBOUND & FINISHED GOODS ==================== */}
      {mode === 'inbound' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs">
              <PackageCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-white uppercase tracking-wider">Goods Receiving (GRN)</span>
              <select
                value={grnStatusFilter}
                onChange={(e) => setGrnStatusFilter(e.target.value)}
                className="ml-3 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200"
              >
                <option value="">All Status</option>
                <option value="DRAFT">DRAFT</option>
                <option value="POSTED">POSTED</option>
              </select>
            </div>
            {canReceive && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowFgPanel((v) => !v)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-emerald-300 flex items-center space-x-1.5 cursor-pointer"
                >
                  <Factory className="w-3.5 h-3.5" />
                  <span>{showFgPanel ? 'Close Finished Goods' : 'Finished Goods Handover'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateGrn(true)}
                  className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New GRN Draft</span>
                </button>
              </div>
            )}
          </div>

          {showFgPanel && canReceive && (
            <form onSubmit={handleFinishedGoodsReceive} className="bg-slate-900 border border-emerald-800/50 rounded-xl p-4 space-y-3 text-xs">
              <h4 className="font-bold text-emerald-300 flex items-center space-x-1.5">
                <Factory className="w-4 h-4" />
                <span>Finished Goods Production Handover</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Source Department *</label>
                  {departments.length > 0 ? (
                    <select
                      required
                      value={fgForm.department_id}
                      onChange={(e) => setFgForm({ ...fgForm, department_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                    >
                      <option value="">Select Dept...</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.dept_code} - {d.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min={1}
                      required
                      value={fgForm.department_id}
                      onChange={(e) => setFgForm({ ...fgForm, department_id: e.target.value })}
                      placeholder="Department ID"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Production Line (opt.)</label>
                  {lines.length > 0 ? (
                    <select
                      value={fgForm.production_line_id}
                      onChange={(e) => setFgForm({ ...fgForm, production_line_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                    >
                      <option value="">None</option>
                      {lines.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.line_number} - {l.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min={1}
                      value={fgForm.production_line_id}
                      onChange={(e) => setFgForm({ ...fgForm, production_line_id: e.target.value })}
                      placeholder="Line ID"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Target Warehouse *</label>
                  <select
                    required
                    value={fgForm.warehouse_id}
                    onChange={(e) => setFgForm({ ...fgForm, warehouse_id: e.target.value, target_location_id: '' })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_code} ({w.warehouse_type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Target Bin</label>
                  <select
                    value={fgForm.target_location_id}
                    onChange={(e) => setFgForm({ ...fgForm, target_location_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="">DEFAULT / Auto</option>
                    {(locationsByWh[Number(fgForm.warehouse_id)] || []).map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.location_code} ({loc.location_type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1">Finished Good Material SKU *</label>
                  <select
                    required
                    value={fgForm.material_id}
                    onChange={(e) => setFgForm({ ...fgForm, material_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="">Select Finished Good SKU...</option>
                    {materials
                      .filter((m) => m.category_type === 'FINISHED_GOOD' || m.sku.startsWith('FG'))
                      .concat(materials.filter((m) => m.category_type !== 'FINISHED_GOOD' && !m.sku.startsWith('FG')))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.sku} — {m.name} ({m.base_uom})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    required
                    value={fgForm.quantity}
                    onChange={(e) => setFgForm({ ...fgForm, quantity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Unit Cost / Handover Ref</label>
                  <div className="flex space-x-1">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={fgForm.unit_cost}
                      onChange={(e) => setFgForm({ ...fgForm, unit_cost: e.target.value })}
                      placeholder="Cost"
                      className="w-1/2 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                    />
                    <input
                      type="text"
                      value={fgForm.handover_ref}
                      onChange={(e) => setFgForm({ ...fgForm, handover_ref: e.target.value })}
                      placeholder="HO-REF"
                      className="w-1/2 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer">
                  Post Finished Goods Handover
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* GRN List */}
            <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                    <tr>
                      <th className="px-3 py-2">GRN #</th>
                      <th className="px-3 py-2">Warehouse</th>
                      <th className="px-3 py-2">Supplier / PO</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {grns.map((g) => (
                      <tr
                        key={g.id}
                        onClick={() => handleSelectGrn(g.id)}
                        className={`cursor-pointer ${
                          selectedGrn?.grn.id === g.id ? 'bg-indigo-950/40' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-indigo-300 font-semibold">{g.grn_number}</td>
                        <td className="px-3 py-2 font-mono text-slate-300">{g.warehouse_code}</td>
                        <td className="px-3 py-2">
                          <div className="text-white">{g.supplier_name}</div>
                          {g.po_reference && <div className="text-[11px] font-mono text-slate-400">{g.po_reference}</div>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(g.status)}`}>
                            {g.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar pagination={grnPagination} onPageChange={(off) => loadGrns(off)} />
            </div>

            {/* GRN Detail & Line Editor */}
            <div className="xl:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              {!selectedGrn ? (
                <div className="p-8 text-center text-xs text-slate-500">Select a GRN to inspect items, add receiving lines, or post to stock.</div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-indigo-300">{selectedGrn.grn.grn_number}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(selectedGrn.grn.status)}`}>
                          {selectedGrn.grn.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selectedGrn.grn.warehouse_code} • Supplier: {selectedGrn.grn.supplier_name}
                        {selectedGrn.grn.po_reference ? ` • PO: ${selectedGrn.grn.po_reference}` : ''}
                      </p>
                    </div>
                    {canReceive && selectedGrn.grn.status === 'DRAFT' && selectedGrn.items.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handlePostGrn(selectedGrn.grn.id)}
                        className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer"
                      >
                        Post GRN to Inventory
                      </button>
                    )}
                  </div>

                  {/* Items table */}
                  <div className="overflow-x-auto border border-slate-800 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                        <tr>
                          <th className="px-2.5 py-2">SKU / Lot</th>
                          <th className="px-2.5 py-2">Bin</th>
                          <th className="px-2.5 py-2 text-right">Rec</th>
                          <th className="px-2.5 py-2 text-right">Acc</th>
                          <th className="px-2.5 py-2 text-right">QC Pend</th>
                          <th className="px-2.5 py-2 text-right">Dmg/Rej</th>
                          <th className="px-2.5 py-2 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {selectedGrn.items.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                              No line items added yet.
                            </td>
                          </tr>
                        ) : (
                          selectedGrn.items.map((it) => (
                            <tr key={it.id}>
                              <td className="px-2.5 py-2">
                                <div className="font-mono text-indigo-300">{it.sku}</div>
                                <div className="text-[11px] font-mono text-slate-400">
                                  {it.lot_number || 'No lot'}
                                  {it.roll_number ? ` • ${it.roll_number}` : ''}
                                </div>
                              </td>
                              <td className="px-2.5 py-2 font-mono text-slate-300">{it.location_code}</td>
                              <td className="px-2.5 py-2 text-right font-mono text-white">{formatQty(it.received_qty)}</td>
                              <td className="px-2.5 py-2 text-right font-mono text-emerald-400">{formatQty(it.accepted_qty)}</td>
                              <td className="px-2.5 py-2 text-right font-mono text-amber-300">{formatQty(it.pending_inspection_qty)}</td>
                              <td className="px-2.5 py-2 text-right font-mono text-rose-400">
                                {formatQty(Number(it.damaged_qty) + Number(it.rejected_qty))}
                              </td>
                              <td className="px-2.5 py-2 text-right font-mono text-slate-300">{formatCurrency(it.unit_cost)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Item Form if DRAFT */}
                  {canReceive && selectedGrn.grn.status === 'DRAFT' && (
                    <form onSubmit={handleAddGrnItem} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">Add Receiving Line Item</span>
                        {selectedGrnMaterial?.requires_qc_on_receipt && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/50 font-mono">
                            QC Required: usable qty enters QUARANTINE (pending_inspection_qty)
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="sm:col-span-2">
                          <label className="block text-slate-400 mb-1">Material *</label>
                          <select
                            required
                            value={grnItemForm.material_id}
                            onChange={(e) => handleGrnMatOrQtyChange(e.target.value, grnItemForm.received_qty)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                          >
                            <option value="">Select Material...</option>
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.sku} — {m.name} ({m.base_uom})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Target Bin</label>
                          <select
                            value={grnItemForm.target_location_id}
                            onChange={(e) => setGrnItemForm({ ...grnItemForm, target_location_id: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                          >
                            <option value="">DEFAULT</option>
                            {(locationsByWh[selectedGrn.grn.warehouse_id] || [])
                              .filter((l) => l.status === 'active')
                              .map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.location_code} ({l.location_type})
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Unit Cost ($)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={grnItemForm.unit_cost}
                            onChange={(e) => setGrnItemForm({ ...grnItemForm, unit_cost: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1">Ordered Qty</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={grnItemForm.ordered_qty}
                            onChange={(e) => setGrnItemForm({ ...grnItemForm, ordered_qty: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Received Qty *</label>
                          <input
                            type="number"
                            min={0.01}
                            step="0.01"
                            required
                            value={grnItemForm.received_qty}
                            onChange={(e) => handleGrnMatOrQtyChange(grnItemForm.material_id, e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Accepted Qty</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            disabled={Boolean(selectedGrnMaterial?.requires_qc_on_receipt)}
                            value={grnItemForm.accepted_qty}
                            onChange={(e) => setGrnItemForm({ ...grnItemForm, accepted_qty: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Pending QC Qty</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={grnItemForm.pending_inspection_qty}
                            onChange={(e) => setGrnItemForm({ ...grnItemForm, pending_inspection_qty: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Damaged Qty</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={grnItemForm.damaged_qty}
                            onChange={(e) => setGrnItemForm({ ...grnItemForm, damaged_qty: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Rejected Qty</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={grnItemForm.rejected_qty}
                            onChange={(e) => setGrnItemForm({ ...grnItemForm, rejected_qty: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">
                            Lot # {selectedGrnMaterial?.is_lot_tracked ? '*' : ''}
                          </label>
                          <input
                            type="text"
                            required={Boolean(selectedGrnMaterial?.is_lot_tracked)}
                            value={grnItemForm.lot_number}
                            onChange={(e) => setGrnItemForm({ ...grnItemForm, lot_number: e.target.value })}
                            placeholder="LOT-2026-01"
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">
                            Roll # {selectedGrnMaterial?.is_roll_tracked ? '*' : ''} / Shade
                          </label>
                          <div className="flex space-x-1">
                            <input
                              type="text"
                              required={Boolean(selectedGrnMaterial?.is_roll_tracked)}
                              value={grnItemForm.roll_number}
                              onChange={(e) => setGrnItemForm({ ...grnItemForm, roll_number: e.target.value })}
                              placeholder="ROLL-01"
                              className="w-1/2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                            />
                            <input
                              type="text"
                              value={grnItemForm.shade_code}
                              onChange={(e) => setGrnItemForm({ ...grnItemForm, shade_code: e.target.value })}
                              placeholder="SH-A"
                              className="w-1/2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className={`font-mono text-[11px] ${grnEquationValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                          Reconciliation: Rec({grnItemForm.received_qty || 0}) = Acc({grnItemForm.accepted_qty || 0}) + QC(
                          {grnItemForm.pending_inspection_qty || 0}) + Dmg({grnItemForm.damaged_qty || 0}) + Rej(
                          {grnItemForm.rejected_qty || 0})
                        </span>
                        <button
                          type="submit"
                          disabled={!grnEquationValid}
                          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-40 cursor-pointer"
                        >
                          Add Line Item
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== QC QUARANTINE & OVERRIDE ==================== */}
      {mode === 'qc' && (
        <div className="space-y-5">
          {/* Pending Queue */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>QC Quarantine Release Queue ({pendingPagination.total})</span>
            </h3>

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                  <tr>
                    <th className="px-3 py-2">GRN # / Supplier</th>
                    <th className="px-3 py-2">Warehouse / Bin</th>
                    <th className="px-3 py-2">SKU / Lot &amp; Roll</th>
                    <th className="px-3 py-2 text-right">Pending QC Qty</th>
                    {canInspectQc && <th className="px-3 py-2 text-right">Inspect</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {pendingQc.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                        No GRN items currently pending QC inspection.
                      </td>
                    </tr>
                  ) : (
                    pendingQc.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30">
                        <td className="px-3 py-2">
                          <div className="font-mono text-indigo-300">{item.grn_number}</div>
                          <div className="text-[11px] text-slate-400">{item.supplier_name}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-300">
                          {item.warehouse_code} / {item.location_code}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-mono text-white">{item.sku}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {item.lot_number || 'No Lot'}
                            {item.roll_number ? ` • ${item.roll_number}` : ''}
                            {item.shade_code ? ` (${item.shade_code})` : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-amber-300">
                          {formatQty(item.pending_inspection_qty)} {item.base_uom}
                        </td>
                        {canInspectQc && (
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenInspect(item)}
                              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white cursor-pointer"
                            >
                              Perform QC
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar pagination={pendingPagination} onPageChange={(off) => loadQcData(off)} />
          </div>

          {/* QC Manager Override Panel (strictly gated) */}
          {canOverrideQc && (
            <form onSubmit={handleOverrideQc} className="bg-slate-900 border border-amber-700/50 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-amber-300 flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>QC Manager Senior Stock-Status Override</span>
                </h4>
                <span className="text-[10px] font-mono text-amber-400">Permission: inventory:qc_override</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Warehouse *</label>
                  <select
                    required
                    value={overrideForm.warehouse_id}
                    onChange={(e) => setOverrideForm({ ...overrideForm, warehouse_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_code} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Material *</label>
                  <select
                    required
                    value={overrideForm.material_id}
                    onChange={(e) => setOverrideForm({ ...overrideForm, material_id: e.target.value, lot_id: '' })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="">Select Material...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.sku} - {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Lot (if tracked)</label>
                  <select
                    value={overrideForm.lot_id}
                    onChange={(e) => setOverrideForm({ ...overrideForm, lot_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="">None / Lot-Free</option>
                    {lots
                      .filter((l) => !overrideForm.material_id || String(l.material_id) === overrideForm.material_id)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.lot_number}
                          {l.roll_number ? ` (${l.roll_number})` : ''} [{l.qc_status}]
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    required
                    value={overrideForm.quantity}
                    onChange={(e) => setOverrideForm({ ...overrideForm, quantity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">From Status *</label>
                  <select
                    value={overrideForm.from_stock_status}
                    onChange={(e) => setOverrideForm({ ...overrideForm, from_stock_status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="QUARANTINE">QUARANTINE</option>
                    <option value="HOLD">HOLD</option>
                    <option value="DAMAGED">DAMAGED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">To Status *</label>
                  <select
                    value={overrideForm.to_stock_status}
                    onChange={(e) => setOverrideForm({ ...overrideForm, to_stock_status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="HOLD">HOLD</option>
                    <option value="DAMAGED">DAMAGED</option>
                    <option value="SCRAP">SCRAP</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1">Mandatory Audit Justification *</label>
                  <input
                    type="text"
                    required
                    value={overrideForm.reason}
                    onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                    placeholder="Document manager approval & test clearance basis..."
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white cursor-pointer">
                  Execute Audited QC Override
                </button>
              </div>
            </form>
          )}

          {/* QC History */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>QC Inspection &amp; Override History ({histPagination.total})</span>
            </h4>
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                  <tr>
                    <th className="px-3 py-2">Inspection #</th>
                    <th className="px-3 py-2">Warehouse / SKU</th>
                    <th className="px-3 py-2">Lot / Roll</th>
                    <th className="px-3 py-2">Outcome</th>
                    <th className="px-3 py-2 text-right">Pass / Dmg / Rej</th>
                    <th className="px-3 py-2">Inspector</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {qcHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-800/30">
                      <td className="px-3 py-2 font-mono text-indigo-300">{h.inspection_number}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-slate-300">{h.warehouse_code}</span> •{' '}
                        <span className="font-mono text-white">{h.sku}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">
                        {h.lot_number || '—'} {h.roll_number ? `(${h.roll_number})` : ''}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(h.outcome_status)}`}>
                          {h.outcome_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span className="text-emerald-400">{formatQty(h.passed_qty)}</span> /{' '}
                        <span className="text-amber-300">{formatQty(h.damaged_qty)}</span> /{' '}
                        <span className="text-rose-400">{formatQty(h.rejected_qty)}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">@{h.inspector_username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create GRN Modal */}
      {showCreateGrn && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <form onSubmit={handleCreateGrn} className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Create Goods Receipt (GRN) Draft</h3>
              <button type="button" onClick={() => setShowCreateGrn(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Receiving Warehouse *</label>
                <select
                  required
                  value={grnForm.warehouse_id}
                  onChange={(e) => setGrnForm({ ...grnForm, warehouse_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_code} - {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={grnForm.supplier_name}
                  onChange={(e) => setGrnForm({ ...grnForm, supplier_name: e.target.value })}
                  placeholder="Nile Delta Textiles"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">PO Reference</label>
                  <input
                    type="text"
                    value={grnForm.po_reference}
                    onChange={(e) => setGrnForm({ ...grnForm, po_reference: e.target.value })}
                    placeholder="PO-2026-101"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Delivery Note #</label>
                  <input
                    type="text"
                    value={grnForm.delivery_note_no}
                    onChange={(e) => setGrnForm({ ...grnForm, delivery_note_no: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setShowCreateGrn(false)} className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white cursor-pointer">
                Create Draft
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inspect QC Modal */}
      {inspectTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitInspection} className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                QC Inspection — {inspectTarget.sku} ({inspectTarget.grn_number})
              </h3>
              <button type="button" onClick={() => setInspectTarget(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs flex justify-between">
              <span className="text-slate-400">Pending Quarantine Quantity:</span>
              <span className="font-mono font-bold text-amber-300">
                {formatQty(inspectTarget.pending_inspection_qty)} {inspectTarget.base_uom}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Passed Qty *</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={inspectForm.passed_qty}
                  onChange={(e) => setInspectForm({ ...inspectForm, passed_qty: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Damaged Qty</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={inspectForm.damaged_qty}
                  onChange={(e) => setInspectForm({ ...inspectForm, damaged_qty: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Rejected Qty</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={inspectForm.rejected_qty}
                  onChange={(e) => setInspectForm({ ...inspectForm, rejected_qty: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Target Release Bin</label>
                <select
                  value={inspectForm.target_location_id}
                  onChange={(e) => setInspectForm({ ...inspectForm, target_location_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                >
                  <option value="">Same / Default Bin</option>
                  {(locationsByWh[inspectTarget.warehouse_id] || [])
                    .filter((l) => l.status === 'active')
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.location_code} ({l.location_type})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Reject Status</label>
                <select
                  value={inspectForm.reject_stock_status}
                  onChange={(e) => setInspectForm({ ...inspectForm, reject_stock_status: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                >
                  <option value="DAMAGED">DAMAGED</option>
                  <option value="SCRAP">SCRAP</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-slate-400 mb-1">Inspection Notes</label>
                <input
                  type="text"
                  value={inspectForm.notes}
                  onChange={(e) => setInspectForm({ ...inspectForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setInspectTarget(null)} className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer">
                Release QC Result
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
