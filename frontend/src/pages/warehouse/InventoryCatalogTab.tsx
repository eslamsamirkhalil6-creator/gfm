import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  Tag,
  AlertTriangle,
  Plus,
  Edit3,
  Search,
  Layers,
  X,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { useAuth } from '../../hooks/useAuth.tsx';
import {
  InventoryBalance,
  InventoryLot,
  MaterialCategory,
  MaterialItem,
  PaginationMeta,
  StockStatus,
  Warehouse,
} from '../../types/index.ts';
import {
  formatCurrency,
  formatQty,
  PaginationBar,
  parseAttributesObject,
  statusBadgeClass,
} from './wmsUi.tsx';

interface InventoryCatalogTabProps {
  warehouses: Warehouse[];
  onQuickReorder?: (materialId: number, warehouseId: number) => void;
  onRefreshGlobal: () => void;
}

const STOCK_STATUSES: StockStatus[] = [
  'AVAILABLE',
  'RESERVED',
  'QUARANTINE',
  'HOLD',
  'IN_TRANSIT',
  'DAMAGED',
  'SCRAP',
];

const CATEGORY_TYPES = ['FABRIC', 'TRIM', 'ACCESSORY', 'PACKING', 'FINISHED_GOOD', 'OTHER'] as const;
const MATERIAL_UOMS = ['MTR', 'YD', 'KG', 'PCS', 'CONES', 'BOX', 'ROLL', 'SET'] as const;

export const InventoryCatalogTab: React.FC<InventoryCatalogTabProps> = ({
  warehouses,
  onQuickReorder,
  onRefreshGlobal,
}) => {
  const { hasPermission } = useAuth();
  const canManageMaterials = hasPermission('warehouse:materials:manage');
  const canViewValuation = hasPermission('warehouse:reports:valuation');
  const canCreateReorder = hasPermission('inventory:reorder:create');

  const [subView, setSubView] = useState<'balances' | 'lots' | 'low-stock' | 'catalog'>('balances');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Stock Balances
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [balPagination, setBalPagination] = useState<PaginationMeta>({ total: 0, limit: 25, offset: 0 });
  const [balWarehouse, setBalWarehouse] = useState('');
  const [balStatus, setBalStatus] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Lots / Rolls
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [lotPagination, setLotPagination] = useState<PaginationMeta>({ total: 0, limit: 25, offset: 0 });
  const [lotSearch, setLotSearch] = useState('');
  const [lotWarehouse, setLotWarehouse] = useState('');
  const [selectedMaterialForLots, setSelectedMaterialForLots] = useState<number | null>(null);

  // Categories & Materials
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [matPagination, setMatPagination] = useState<PaginationMeta>({ total: 0, limit: 25, offset: 0 });
  const [matSearch, setMatSearch] = useState('');
  const [matCatFilter, setMatCatFilter] = useState('');

  // Low stock aggregated from all balances + materials
  const [lowStockRows, setLowStockRows] = useState<
    Array<{ material: MaterialItem; available_qty: number; shortfall: number; primary_warehouse_id: number }>
  >([]);

  // Category Modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [catForm, setCatForm] = useState({
    category_code: '',
    name: '',
    category_type: 'FABRIC' as (typeof CATEGORY_TYPES)[number],
    description: '',
  });

  // Material Modal
  const [matModalMode, setMatModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null);
  const [matForm, setMatForm] = useState({
    sku: '',
    name: '',
    category_id: '',
    base_uom: 'MTR' as string,
    color: '',
    size: '',
    is_lot_tracked: true,
    is_roll_tracked: false,
    requires_qc_on_receipt: true,
    min_stock_level: '0',
    reorder_level: '0',
    status: 'active' as 'active' | 'inactive',
    attributesPairs: [{ key: '', value: '' }] as Array<{ key: string; value: string }>,
  });

  const loadBalances = useCallback(
    async (offset = 0) => {
      try {
        const res = await ApiService.getInventoryBalances({
          warehouse_id: balWarehouse ? Number(balWarehouse) : undefined,
          stock_status: balStatus || undefined,
          only_available: onlyAvailable || undefined,
          limit: 25,
          offset,
        });
        setBalances(res.data);
        setBalPagination(res.pagination);
      } catch (err: any) {
        setError(err.message || 'Failed to load stock balances');
      }
    },
    [balWarehouse, balStatus, onlyAvailable]
  );

  const loadLots = useCallback(
    async (offset = 0) => {
      try {
        const res = await ApiService.getInventoryLots({
          warehouse_id: lotWarehouse ? Number(lotWarehouse) : undefined,
          material_id: selectedMaterialForLots ?? undefined,
          lot_number: lotSearch.trim() || undefined,
          limit: 25,
          offset,
        });
        setLots(res.data);
        setLotPagination(res.pagination);
      } catch (err: any) {
        setError(err.message || 'Failed to load lot/roll ledger');
      }
    },
    [lotWarehouse, selectedMaterialForLots, lotSearch]
  );

  const loadCatalog = useCallback(
    async (offset = 0) => {
      try {
        const [cats, mats] = await Promise.all([
          ApiService.getMaterialCategories(),
          ApiService.getMaterials({
            category_id: matCatFilter ? Number(matCatFilter) : undefined,
            search: matSearch.trim() || undefined,
            limit: 25,
            offset,
          }),
        ]);
        setCategories(cats);
        setMaterials(mats.data);
        setMatPagination(mats.pagination);
      } catch (err: any) {
        setError(err.message || 'Failed to load material catalog');
      }
    },
    [matCatFilter, matSearch]
  );

  const loadLowStock = useCallback(async () => {
    try {
      const [matsRes, balRes] = await Promise.all([
        ApiService.getMaterials({ status: 'active', limit: 500, offset: 0 }),
        ApiService.getInventoryBalances({ stock_status: 'AVAILABLE', limit: 500, offset: 0 }),
      ]);
      const availByMat = new Map<number, number>();
      const whByMat = new Map<number, number>();
      for (const b of balRes.data) {
        availByMat.set(b.material_id, (availByMat.get(b.material_id) || 0) + Number(b.qty_available));
        if (!whByMat.has(b.material_id)) whByMat.set(b.material_id, b.warehouse_id);
      }
      const fallbackWhId = warehouses[0]?.id || 1;
      const flagged = matsRes.data
        .filter((m) => Number(m.reorder_level || 0) > 0)
        .map((m) => {
          const avail = availByMat.get(m.id) || 0;
          const reorderLvl = Number(m.reorder_level || 0);
          return {
            material: m,
            available_qty: avail,
            shortfall: Math.max(0, reorderLvl - avail),
            primary_warehouse_id: whByMat.get(m.id) || fallbackWhId,
          };
        })
        .filter((r) => r.available_qty <= Number(r.material.reorder_level));
      setLowStockRows(flagged);
    } catch (err: any) {
      setError(err.message || 'Failed to compute low stock monitor');
    }
  }, [warehouses]);

  useEffect(() => {
    loadBalances(0);
  }, [loadBalances]);

  useEffect(() => {
    if (subView === 'lots') loadLots(0);
    if (subView === 'catalog') loadCatalog(0);
    if (subView === 'low-stock') loadLowStock();
  }, [subView, loadLots, loadCatalog, loadLowStock]);

  useEffect(() => {
    loadCatalog(0);
  }, [loadCatalog]);

  const handleOpenCreateMat = () => {
    setEditingMaterialId(null);
    setMatForm({
      sku: '',
      name: '',
      category_id: categories[0]?.id ? String(categories[0].id) : '',
      base_uom: 'MTR',
      color: '',
      size: '',
      is_lot_tracked: true,
      is_roll_tracked: false,
      requires_qc_on_receipt: true,
      min_stock_level: '0',
      reorder_level: '0',
      status: 'active',
      attributesPairs: [{ key: '', value: '' }],
    });
    setMatModalMode('create');
    setError(null);
  };

  const handleOpenEditMat = (m: MaterialItem) => {
    const attrs = parseAttributesObject(m.attributes_json);
    const pairs = Object.entries(attrs).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }));
    setEditingMaterialId(m.id);
    setMatForm({
      sku: m.sku,
      name: m.name,
      category_id: String(m.category_id),
      base_uom: m.base_uom,
      color: m.color || '',
      size: m.size || '',
      is_lot_tracked: Boolean(m.is_lot_tracked),
      is_roll_tracked: Boolean(m.is_roll_tracked),
      requires_qc_on_receipt: Boolean(m.requires_qc_on_receipt),
      min_stock_level: String(m.min_stock_level ?? 0),
      reorder_level: String(m.reorder_level ?? 0),
      status: m.status,
      attributesPairs: pairs.length > 0 ? pairs : [{ key: '', value: '' }],
    });
    setMatModalMode('edit');
    setError(null);
  };

  const buildAttributesObject = (): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const pair of matForm.attributesPairs) {
      const k = pair.key.trim();
      if (!k) continue;
      const v = pair.value.trim();
      const num = Number(v);
      if (v !== '' && !Number.isNaN(num) && String(num) === v) {
        out[k] = num;
      } else if (v === 'true') {
        out[k] = true;
      } else if (v === 'false') {
        out[k] = false;
      } else {
        out[k] = v;
      }
    }
    return out;
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const attributes = buildAttributesObject();
      if (matModalMode === 'create') {
        const created = await ApiService.createMaterial({
          sku: matForm.sku.trim().toUpperCase(),
          name: matForm.name.trim(),
          category_id: Number(matForm.category_id),
          base_uom: matForm.base_uom,
          color: matForm.color.trim() || undefined,
          size: matForm.size.trim() || undefined,
          attributes,
          is_lot_tracked: matForm.is_lot_tracked,
          is_roll_tracked: matForm.is_roll_tracked,
          requires_qc_on_receipt: matForm.requires_qc_on_receipt,
          min_stock_level: Number(matForm.min_stock_level || 0),
          reorder_level: Number(matForm.reorder_level || 0),
        });
        setFeedback(`Material SKU ${created.sku} created.`);
      } else if (matModalMode === 'edit' && editingMaterialId) {
        const updated = await ApiService.updateMaterial(editingMaterialId, {
          name: matForm.name.trim(),
          category_id: Number(matForm.category_id),
          base_uom: matForm.base_uom,
          color: matForm.color.trim() || null,
          size: matForm.size.trim() || null,
          attributes,
          is_lot_tracked: matForm.is_lot_tracked,
          is_roll_tracked: matForm.is_roll_tracked,
          requires_qc_on_receipt: matForm.requires_qc_on_receipt,
          min_stock_level: Number(matForm.min_stock_level || 0),
          reorder_level: Number(matForm.reorder_level || 0),
          status: matForm.status,
        });
        setFeedback(`Material SKU ${updated.sku} updated.`);
      }
      setMatModalMode(null);
      await loadCatalog(matPagination.offset);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Failed to save material');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const created = await ApiService.createMaterialCategory({
        category_code: catForm.category_code.trim().toUpperCase(),
        name: catForm.name.trim(),
        category_type: catForm.category_type,
        description: catForm.description.trim() || undefined,
      });
      setShowCatModal(false);
      setCatForm({ category_code: '', name: '', category_type: 'FABRIC', description: '' });
      setFeedback(`Category ${created.category_code} created.`);
      await loadCatalog(0);
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
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

      {/* Inner Switcher */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2">
        {[
          { id: 'balances', label: 'Stock Balances', icon: Boxes },
          { id: 'lots', label: 'Lots, Rolls & Shades', icon: Layers },
          { id: 'low-stock', label: 'Low Stock Monitor', icon: AlertTriangle },
          { id: 'catalog', label: 'Materials & Categories', icon: Tag },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubView(item.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                subView === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Stock Balances */}
      {subView === 'balances' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Live Bin & Lot Stock Balances ({balPagination.total})
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={balWarehouse}
                onChange={(e) => setBalWarehouse(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200"
              >
                <option value="">All Scoped Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_code} - {w.name}
                  </option>
                ))}
              </select>
              <select
                value={balStatus}
                onChange={(e) => setBalStatus(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200"
              >
                <option value="">All Stock Status</option>
                {STOCK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <label className="flex items-center space-x-1.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                />
                <span>Available &gt; 0 only</span>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                <tr>
                  <th className="px-3 py-2">Warehouse / Bin</th>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">Lot / Roll / Shade</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">On Hand</th>
                  <th className="px-3 py-2 text-right">Reserved</th>
                  <th className="px-3 py-2 text-right">Available</th>
                  {canViewValuation && <th className="px-3 py-2 text-right">WAC</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {balances.length === 0 ? (
                  <tr>
                    <td colSpan={canViewValuation ? 8 : 7} className="px-3 py-6 text-center text-slate-500">
                      No inventory balances match the current filter.
                    </td>
                  </tr>
                ) : (
                  balances.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => {
                        setSelectedMaterialForLots(b.material_id);
                        setSubView('lots');
                      }}
                      className="hover:bg-slate-800/35 cursor-pointer"
                      title="Click to inspect lots & rolls for this SKU"
                    >
                      <td className="px-3 py-2">
                        <div className="font-mono text-indigo-300 font-semibold">{b.warehouse_code}</div>
                        <div className="font-mono text-[11px] text-slate-400">{b.location_code}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-mono text-slate-200">{b.sku}</div>
                        <div className="text-[11px] text-slate-400">{b.material_name}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-300">
                        {b.lot_number ? (
                          <div>
                            {b.lot_number}
                            {b.roll_number ? ` • ${b.roll_number}` : ''}
                            {b.shade_code ? ` (${b.shade_code})` : ''}
                          </div>
                        ) : (
                          <span className="text-slate-500">Lot-Free</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(b.stock_status)}`}>
                          {b.stock_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-200">
                        {formatQty(b.qty_on_hand)} {b.base_uom}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-amber-300">
                        {formatQty(b.qty_reserved)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">
                        {formatQty(b.qty_available)}
                      </td>
                      {canViewValuation && (
                        <td className="px-3 py-2 text-right font-mono text-slate-300">
                          {formatCurrency(b.weighted_avg_cost)}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PaginationBar pagination={balPagination} onPageChange={(off) => loadBalances(off)} />
        </div>
      )}

      {/* 2. Lots / Rolls & Shades */}
      {subView === 'lots' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Lot, Fabric Roll & Dye Shade Tracking ({lotPagination.total})
              </h3>
              {selectedMaterialForLots && (
                <button
                  type="button"
                  onClick={() => setSelectedMaterialForLots(null)}
                  className="text-[11px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700 cursor-pointer"
                >
                  Clear Material Filter (#{selectedMaterialForLots}) ×
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={lotSearch}
                  onChange={(e) => setLotSearch(e.target.value)}
                  placeholder="Lot number..."
                  className="bg-slate-950 border border-slate-700 rounded pl-8 pr-2.5 py-1 text-white"
                />
              </div>
              <select
                value={lotWarehouse}
                onChange={(e) => setLotWarehouse(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200"
              >
                <option value="">All Scoped Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                <tr>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">Lot / Roll</th>
                  <th className="px-3 py-2">Shade</th>
                  <th className="px-3 py-2">QC Status</th>
                  <th className="px-3 py-2 text-right">Initial</th>
                  <th className="px-3 py-2 text-right">Remaining</th>
                  <th className="px-3 py-2">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {lots.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                      No lots found.
                    </td>
                  </tr>
                ) : (
                  lots.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/30">
                      <td className="px-3 py-2">
                        <span className="font-mono text-indigo-300">{l.sku}</span>
                        <div className="text-[11px] text-slate-400">{l.material_name}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-200">
                        {l.lot_number}
                        {l.roll_number && <span className="ml-1 text-emerald-300">[{l.roll_number}]</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-300">{l.shade_code || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(l.qc_status)}`}>
                          {l.qc_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">
                        {formatQty(l.initial_qty)} {l.base_uom}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-white">
                        {formatQty(l.remaining_qty)} {l.base_uom}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                        {String(l.received_at).slice(0, 10)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PaginationBar pagination={lotPagination} onPageChange={(off) => loadLots(off)} />
        </div>
      )}

      {/* 3. Low Stock Monitor */}
      {subView === 'low-stock' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Low Stock Monitor ({lowStockRows.length} SKUs At/Below Reorder Level)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Active materials with configured reorder thresholds where available stock requires replenishment.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                <tr>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2 text-right">Available</th>
                  <th className="px-3 py-2 text-right">Reorder Level</th>
                  <th className="px-3 py-2 text-right">Min Stock</th>
                  <th className="px-3 py-2 text-right">Shortfall</th>
                  {canCreateReorder && onQuickReorder && <th className="px-3 py-2 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {lowStockRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-emerald-400">
                      All active monitored SKUs are currently above reorder threshold.
                    </td>
                  </tr>
                ) : (
                  lowStockRows.map((row) => (
                    <tr key={row.material.id} className="hover:bg-slate-800/30">
                      <td className="px-3 py-2 font-mono text-indigo-300">{row.material.sku}</td>
                      <td className="px-3 py-2 text-white">{row.material.name}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-rose-400">
                        {formatQty(row.available_qty)} {row.material.base_uom}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-amber-300">
                        {formatQty(row.material.reorder_level)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-400">
                        {formatQty(row.material.min_stock_level)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-rose-300">
                        {formatQty(row.shortfall)}
                      </td>
                      {canCreateReorder && onQuickReorder && (
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => onQuickReorder(row.material.id, row.primary_warehouse_id)}
                            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-[11px] font-semibold text-white inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>Create Reorder</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Material Categories & Catalog */}
      {subView === 'catalog' && (
        <div className="space-y-4">
          {/* Categories Strip */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Material Categories ({categories.length})
              </h3>
              {canManageMaterials && (
                <button
                  type="button"
                  onClick={() => setShowCatModal(true)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Category</span>
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <div key={c.id} className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <span className="font-mono text-indigo-300 font-semibold">{c.category_code}</span>{' '}
                  <span className="text-slate-200">{c.name}</span>{' '}
                  <span className="text-[10px] text-slate-500 font-mono">({c.category_type})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Materials Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={matSearch}
                    onChange={(e) => setMatSearch(e.target.value)}
                    placeholder="Search SKU or name..."
                    className="bg-slate-950 border border-slate-700 rounded pl-8 pr-2.5 py-1.5 text-white"
                  />
                </div>
                <select
                  value={matCatFilter}
                  onChange={(e) => setMatCatFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.category_code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {canManageMaterials && (
                <button
                  type="button"
                  onClick={handleOpenCreateMat}
                  className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Material</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Name & Category</th>
                    <th className="px-3 py-2">UOM / Variant</th>
                    <th className="px-3 py-2">Tracking & QC Flags</th>
                    <th className="px-3 py-2">Attributes JSON</th>
                    <th className="px-3 py-2 text-right">Min / Reorder</th>
                    <th className="px-3 py-2">Status</th>
                    {canManageMaterials && <th className="px-3 py-2 text-right">Edit</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {materials.map((m) => {
                    const attrs = parseAttributesObject(m.attributes_json);
                    return (
                      <tr key={m.id} className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-mono text-indigo-300 font-semibold">{m.sku}</td>
                        <td className="px-3 py-2">
                          <div className="text-white font-medium">{m.name}</div>
                          <div className="text-[11px] text-slate-400">{m.category_name || m.category_code}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-300">
                          {m.base_uom}
                          {m.color ? ` • ${m.color}` : ''}
                          {m.size ? ` • ${m.size}` : ''}
                        </td>
                        <td className="px-3 py-2 text-[10px] font-mono space-x-1">
                          {m.is_lot_tracked && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40">
                              LOT
                            </span>
                          )}
                          {m.is_roll_tracked && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                              ROLL
                            </span>
                          )}
                          {m.requires_qc_on_receipt && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/40">
                              QC-REQ
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[11px] font-mono text-slate-400 max-w-[200px] truncate">
                          {Object.keys(attrs).length > 0
                            ? Object.entries(attrs)
                                .map(([k, v]) => `${k}:${v}`)
                                .join(', ')
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-300">
                          {formatQty(m.min_stock_level)} / {formatQty(m.reorder_level)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(m.status)}`}>
                            {m.status}
                          </span>
                        </td>
                        {canManageMaterials && (
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenEditMat(m)}
                              className="p-1 text-indigo-400 hover:text-indigo-300 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationBar pagination={matPagination} onPageChange={(off) => loadCatalog(off)} />
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <form onSubmit={handleCreateCategory} className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Create Material Category</h3>
              <button type="button" onClick={() => setShowCatModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Category Code *</label>
                <input
                  type="text"
                  required
                  value={catForm.category_code}
                  onChange={(e) => setCatForm({ ...catForm, category_code: e.target.value.toUpperCase() })}
                  placeholder="CAT-LINING"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Category Type *</label>
                <select
                  value={catForm.category_type}
                  onChange={(e) => setCatForm({ ...catForm, category_type: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                >
                  {CATEGORY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setShowCatModal(false)} className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white cursor-pointer">
                Create Category
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create / Edit Material Modal */}
      {matModalMode && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSaveMaterial} className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                {matModalMode === 'create' ? 'Create Material SKU' : `Edit Material ${matForm.sku}`}
              </h3>
              <button type="button" onClick={() => setMatModalMode(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">SKU *</label>
                <input
                  type="text"
                  required
                  disabled={matModalMode === 'edit'}
                  value={matForm.sku}
                  onChange={(e) => setMatForm({ ...matForm, sku: e.target.value.toUpperCase() })}
                  placeholder="FAB-COT-180"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono disabled:opacity-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1">Material Name *</label>
                <input
                  type="text"
                  required
                  value={matForm.name}
                  onChange={(e) => setMatForm({ ...matForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Category *</label>
                <select
                  required
                  value={matForm.category_id}
                  onChange={(e) => setMatForm({ ...matForm, category_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.category_code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Base UOM *</label>
                <select
                  value={matForm.base_uom}
                  onChange={(e) => setMatForm({ ...matForm, base_uom: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                >
                  {MATERIAL_UOMS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Color / Shade</label>
                <input
                  type="text"
                  value={matForm.color}
                  onChange={(e) => setMatForm({ ...matForm, color: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Size / Width</label>
                <input
                  type="text"
                  value={matForm.size}
                  onChange={(e) => setMatForm({ ...matForm, size: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Min Stock Level</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={matForm.min_stock_level}
                  onChange={(e) => setMatForm({ ...matForm, min_stock_level: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Reorder Level</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={matForm.reorder_level}
                  onChange={(e) => setMatForm({ ...matForm, reorder_level: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                />
              </div>

              <div className="col-span-2 sm:col-span-3 flex flex-wrap gap-4 pt-1">
                <label className="flex items-center space-x-1.5 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={matForm.is_lot_tracked}
                    onChange={(e) => setMatForm({ ...matForm, is_lot_tracked: e.target.checked })}
                  />
                  <span>Lot Tracked</span>
                </label>
                <label className="flex items-center space-x-1.5 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={matForm.is_roll_tracked}
                    onChange={(e) => setMatForm({ ...matForm, is_roll_tracked: e.target.checked })}
                  />
                  <span>Roll Tracked</span>
                </label>
                <label className="flex items-center space-x-1.5 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={matForm.requires_qc_on_receipt}
                    onChange={(e) => setMatForm({ ...matForm, requires_qc_on_receipt: e.target.checked })}
                  />
                  <span>Requires QC on Receipt (Quarantine)</span>
                </label>
              </div>

              {matModalMode === 'edit' && (
                <div>
                  <label className="block text-slate-400 mb-1">Status</label>
                  <select
                    value={matForm.status}
                    onChange={(e) => setMatForm({ ...matForm, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>
              )}
            </div>

            {/* Hybrid Attributes JSON Editor */}
            <div className="border-t border-slate-800 pt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">Hybrid Textile Attributes (attributes_json)</span>
                <button
                  type="button"
                  onClick={() =>
                    setMatForm({ ...matForm, attributesPairs: [...matForm.attributesPairs, { key: '', value: '' }] })
                  }
                  className="text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  + Add Attribute
                </button>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {matForm.attributesPairs.map((pair, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={pair.key}
                      onChange={(e) => {
                        const copy = [...matForm.attributesPairs];
                        copy[idx] = { ...copy[idx], key: e.target.value };
                        setMatForm({ ...matForm, attributesPairs: copy });
                      }}
                      placeholder="e.g., gsm or composition"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                    />
                    <input
                      type="text"
                      value={pair.value}
                      onChange={(e) => {
                        const copy = [...matForm.attributesPairs];
                        copy[idx] = { ...copy[idx], value: e.target.value };
                        setMatForm({ ...matForm, attributesPairs: copy });
                      }}
                      placeholder="e.g., 180 or 100% Cotton"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const copy = matForm.attributesPairs.filter((_, i) => i !== idx);
                        setMatForm({ ...matForm, attributesPairs: copy.length ? copy : [{ key: '', value: '' }] });
                      }}
                      className="text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setMatModalMode(null)} className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white cursor-pointer">
                {matModalMode === 'create' ? 'Create SKU' : 'Save Material'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
