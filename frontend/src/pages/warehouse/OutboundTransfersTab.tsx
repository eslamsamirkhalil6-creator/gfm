import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardList,
  Send,
  RotateCcw,
  ArrowLeftRight,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  Truck,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { useAuth } from '../../hooks/useAuth.tsx';
import {
  InventoryBalance,
  InventoryLot,
  MaterialItem,
  MaterialRequisition,
  MaterialRequisitionItem,
  MaterialReturn,
  PaginationMeta,
  ProductionLine,
  StockIssue,
  Warehouse,
  WarehouseDepartmentOption,
  WarehouseLocation,
  WarehouseTransfer,
  WarehouseTransferItem,
} from '../../types/index.ts';
import { formatQty, PaginationBar, statusBadgeClass } from './wmsUi.tsx';

interface OutboundTransfersTabProps {
  mode: 'requisitions' | 'returns-transfers';
  warehouses: Warehouse[];
  onRefreshGlobal: () => void;
}

export const OutboundTransfersTab: React.FC<OutboundTransfersTabProps> = ({
  mode,
  warehouses,
  onRefreshGlobal,
}) => {
  const { user, hasPermission } = useAuth();
  const canCreateReq = hasPermission('inventory:requisition:create');
  const canApproveReq = hasPermission('inventory:requisition:approve');
  const canIssue = hasPermission('inventory:issue');
  const canReturn = hasPermission('inventory:return');
  const canTransfer = hasPermission('inventory:transfer');

  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [returnMaterials, setReturnMaterials] = useState<MaterialItem[]>([]);
  const [returnMaterialsLoading, setReturnMaterialsLoading] = useState(false);
  const [returnMaterialsError, setReturnMaterialsError] = useState<string | null>(null);
  const [internalAvailBalances, setInternalAvailBalances] = useState<InventoryBalance[]>([]);
  const [internalAvailLoading, setInternalAvailLoading] = useState(false);
  const [dispatchAvailBalances, setDispatchAvailBalances] = useState<InventoryBalance[]>([]);
  const [dispatchAvailLoading, setDispatchAvailLoading] = useState(false);
  const [stockIssueContext, setStockIssueContext] = useState<{ issue: StockIssue; items: any[] } | null>(null);
  const [stockIssueError, setStockIssueError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<WarehouseDepartmentOption[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentsError, setDepartmentsError] = useState<string | null>(null);
  const [returnLots, setReturnLots] = useState<InventoryLot[]>([]);
  const [returnLotsLoading, setReturnLotsLoading] = useState(false);
  const [returnLotsError, setReturnLotsError] = useState<string | null>(null);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [locationsByWh, setLocationsByWh] = useState<Record<number, WarehouseLocation[]>>({});
  const loadedLocationsRef = useRef<Set<number>>(new Set());

  // Requisitions & Issues
  const [requisitions, setRequisitions] = useState<MaterialRequisition[]>([]);
  const [reqPagination, setReqPagination] = useState<PaginationMeta>({ total: 0, limit: 15, offset: 0 });
  const [reqStatusFilter, setReqStatusFilter] = useState('');
  const [selectedReq, setSelectedReq] = useState<{
    requisition: MaterialRequisition;
    items: MaterialRequisitionItem[];
  } | null>(null);
  const [showCreateReq, setShowCreateReq] = useState(false);
  const [reqForm, setReqForm] = useState({
    department_id: '',
    production_line_id: '',
    warehouse_id: '',
    reference_type: 'PRODUCTION_ORDER',
    reference_code: '',
    required_date: '',
    notes: '',
    first_material_id: '',
    first_qty: '',
  });
  const [addReqItemForm, setAddReqItemForm] = useState({ material_id: '', requested_qty: '' });
  const [rejectReason, setRejectReason] = useState('');

  // Issue Stock Modal
  const [issueTarget, setIssueTarget] = useState<{
    requisition: MaterialRequisition;
    items: MaterialRequisitionItem[];
  } | null>(null);
  const [availableByMat, setAvailableByMat] = useState<Record<number, InventoryBalance[]>>({});
  const [issueLineSelections, setIssueLineSelections] = useState<
    Record<number, { balanceId: string; issued_qty: string; fifo_override_reason: string }>
  >({});
  const [issueNotes, setIssueNotes] = useState('');
  const [issues, setIssues] = useState<StockIssue[]>([]);
  const [issuesPagination, setIssuesPagination] = useState<PaginationMeta>({ total: 0, limit: 15, offset: 0 });

  // Returns
  const [returns, setReturns] = useState<MaterialReturn[]>([]);
  const [retPagination, setRetPagination] = useState<PaginationMeta>({ total: 0, limit: 15, offset: 0 });
  const [returnForm, setReturnForm] = useState({
    department_id: '',
    production_line_id: '',
    warehouse_id: '',
    target_location_id: '',
    stock_issue_id: '',
    material_id: '',
    lot_id: '',
    returned_qty: '',
    return_condition: 'USABLE_SURPLUS' as 'USABLE_SURPLUS' | 'DAMAGED' | 'WASTE_SCRAP',
    notes: '',
  });

  // Transfers
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [trfPagination, setTrfPagination] = useState<PaginationMeta>({ total: 0, limit: 15, offset: 0 });
  const [trfMode, setTrfMode] = useState<'none' | 'internal' | 'dispatch'>('none');
  const [internalTrfForm, setInternalTrfForm] = useState({
    warehouse_id: '',
    balance_id: '',
    material_id: '',
    source_location_id: '',
    target_location_id: '',
    quantity: '',
    notes: '',
  });
  const [dispatchTrfForm, setDispatchTrfForm] = useState({
    source_warehouse_id: '',
    target_warehouse_id: '',
    target_location_id: '',
    balance_id: '',
    material_id: '',
    source_location_id: '',
    dispatched_qty: '',
    notes: '',
  });
  const [receiveTarget, setReceiveTarget] = useState<{
    transfer: WarehouseTransfer;
    items: WarehouseTransferItem[];
  } | null>(null);
  const [receiveLines, setReceiveLines] = useState<
    Record<number, { received_qty: string; damaged_qty: string; discrepancy_qty: string; notes: string }>
  >({});

  const ensureLocations = useCallback(async (whId: number, force = false) => {
    if (!whId || (!force && loadedLocationsRef.current.has(whId))) return;
    loadedLocationsRef.current.add(whId);
    try {
      const locs = await ApiService.getWarehouseLocations(whId);
      setLocationsByWh((prev) => ({ ...prev, [whId]: locs }));
    } catch {
      loadedLocationsRef.current.delete(whId);
    }
  }, []);

  const loadDepartmentsLookup = useCallback(async () => {
    const canUseFullDepts = hasPermission('departments:view') || hasPermission('departments:scoped:view');
    const canUseWmsDepts =
      hasPermission('warehouse:view') ||
      hasPermission('inventory:requisition:create') ||
      hasPermission('inventory:return');
    if (!canUseFullDepts && !canUseWmsDepts) {
      setDepartments([]);
      return;
    }
    setDepartmentsLoading(true);
    setDepartmentsError(null);
    try {
      const list = canUseFullDepts
        ? await ApiService.getDepartments({ status: 'active' })
        : await ApiService.getWarehouseDepartments();
      setDepartments(list);
    } catch (err: any) {
      setDepartments([]);
      setDepartmentsError(err.message || 'Failed to load authorized departments');
    } finally {
      setDepartmentsLoading(false);
    }
  }, [hasPermission]);

  const loadLookups = useCallback(async () => {
    setMaterialsError(null);
    try {
      const r = await ApiService.getMaterials({ status: 'active', limit: 500, offset: 0 });
      setMaterials(r.data);
    } catch (err: any) {
      setMaterials([]);
      setMaterialsError(err.message || 'Failed to load active materials catalog');
    }
    loadDepartmentsLookup();
    if (hasPermission('production:view')) {
      ApiService.getLines().then(setLines).catch(() => {});
    }
  }, [hasPermission, loadDepartmentsLookup]);

  const loadReturnMaterials = useCallback(async () => {
    if (mode !== 'returns-transfers' || !returnForm.warehouse_id) return;
    setReturnMaterialsLoading(true);
    setReturnMaterialsError(null);
    try {
      const r = await ApiService.getMaterials({
        status: 'active',
        warehouse_id: Number(returnForm.warehouse_id),
        operation: 'RETURN',
        limit: 500,
        offset: 0,
      });
      setReturnMaterials(r.data);
      setReturnForm((prev) => {
        if (prev.material_id && !r.data.some((m) => String(m.id) === prev.material_id)) {
          return { ...prev, material_id: '', lot_id: '' };
        }
        return prev;
      });
    } catch (err: any) {
      setReturnMaterials([]);
      setReturnMaterialsError(err.message || 'Failed to load eligible return materials');
    } finally {
      setReturnMaterialsLoading(false);
    }
  }, [mode, returnForm.warehouse_id, returnForm.department_id]);

  const loadReturnLots = useCallback(async () => {
    if (
      mode !== 'returns-transfers' ||
      !returnForm.warehouse_id ||
      !returnForm.material_id ||
      (!hasPermission('warehouse:view') && !hasPermission('inventory:return'))
    ) {
      setReturnLots([]);
      setReturnLotsError(null);
      return;
    }
    setReturnLotsLoading(true);
    setReturnLotsError(null);
    try {
      const res = await ApiService.getInventoryLots({
        warehouse_id: Number(returnForm.warehouse_id),
        material_id: Number(returnForm.material_id),
        limit: 200,
        offset: 0,
      });
      setReturnLots(res.data);
    } catch (err: any) {
      setReturnLots([]);
      setReturnLotsError(err.message || 'Failed to load warehouse material lots');
    } finally {
      setReturnLotsLoading(false);
    }
  }, [mode, returnForm.warehouse_id, returnForm.material_id, hasPermission]);

  const loadInternalAvailable = useCallback(async () => {
    if (mode !== 'returns-transfers' || !internalTrfForm.warehouse_id) return;
    setInternalAvailLoading(true);
    try {
      const bals = await ApiService.getAvailableBalances(Number(internalTrfForm.warehouse_id));
      setInternalAvailBalances(bals);
    } catch (err: any) {
      setInternalAvailBalances([]);
      setError(err.message || 'Failed to load available stock for internal transfer');
    } finally {
      setInternalAvailLoading(false);
    }
  }, [mode, internalTrfForm.warehouse_id]);

  const loadDispatchAvailable = useCallback(async () => {
    if (mode !== 'returns-transfers' || !dispatchTrfForm.source_warehouse_id) return;
    setDispatchAvailLoading(true);
    try {
      const bals = await ApiService.getAvailableBalances(Number(dispatchTrfForm.source_warehouse_id));
      setDispatchAvailBalances(bals);
    } catch (err: any) {
      setDispatchAvailBalances([]);
      setError(err.message || 'Failed to load available stock for dispatch transfer');
    } finally {
      setDispatchAvailLoading(false);
    }
  }, [mode, dispatchTrfForm.source_warehouse_id]);

  const loadRequisitions = useCallback(
    async (offset = 0) => {
      if (mode !== 'requisitions') return;
      try {
        const res = await ApiService.getRequisitions({
          status: reqStatusFilter || undefined,
          limit: 15,
          offset,
        });
        setRequisitions(res.data);
        setReqPagination(res.pagination);
      } catch (err: any) {
        setError(err.message || 'Failed to load requisitions');
      }
    },
    [mode, reqStatusFilter]
  );

  const loadIssues = useCallback(
    async (offset = 0) => {
      if (mode !== 'requisitions' || !hasPermission('warehouse:view')) return;
      try {
        const res = await ApiService.getStockIssues({ limit: 15, offset });
        setIssues(res.data);
        setIssuesPagination(res.pagination);
      } catch {
        // ignore if role cannot list issues
      }
    },
    [mode, hasPermission]
  );

  const loadReturnsAndTransfers = useCallback(
    async (offset = 0) => {
      if (mode !== 'returns-transfers') return;
      const tasks: Promise<void>[] = [
        ApiService.getMaterialReturns({ limit: 15, offset })
          .then((r) => {
            setReturns(r.data);
            setRetPagination(r.pagination);
          })
          .catch((err: any) => {
            setError(err.message || 'Failed to load material returns');
          }),
      ];
      if (hasPermission('warehouse:view')) {
        tasks.push(
          ApiService.getTransfers({ limit: 15, offset })
            .then((t) => {
              setTransfers(t.data);
              setTrfPagination(t.pagination);
            })
            .catch((err: any) => {
              setError(err.message || 'Failed to load warehouse transfers');
            })
        );
      }
      await Promise.all(tasks);
    },
    [mode, hasPermission]
  );

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (warehouses.length > 0) {
      const firstId = String(warehouses[0].id);
      if (!reqForm.warehouse_id) setReqForm((p) => ({ ...p, warehouse_id: firstId }));
      if (!returnForm.warehouse_id) setReturnForm((p) => ({ ...p, warehouse_id: firstId }));
      if (!internalTrfForm.warehouse_id) setInternalTrfForm((p) => ({ ...p, warehouse_id: firstId }));
      if (!dispatchTrfForm.source_warehouse_id) {
        const defaultTarget = warehouses.find((w) => String(w.id) !== firstId && w.status === 'active');
        setDispatchTrfForm((p) => ({
          ...p,
          source_warehouse_id: firstId,
          target_warehouse_id: defaultTarget ? String(defaultTarget.id) : '',
          target_location_id: '',
        }));
      }
    }
    if (user?.primary_department_id) {
      if (!reqForm.department_id) setReqForm((p) => ({ ...p, department_id: String(user.primary_department_id) }));
      if (!returnForm.department_id) setReturnForm((p) => ({ ...p, department_id: String(user.primary_department_id) }));
    }
  }, [
    warehouses,
    user,
    reqForm.warehouse_id,
    reqForm.department_id,
    returnForm.warehouse_id,
    returnForm.department_id,
    internalTrfForm.warehouse_id,
    dispatchTrfForm.source_warehouse_id,
  ]);

  useEffect(() => {
    loadRequisitions(0);
    loadIssues(0);
    loadReturnsAndTransfers(0);
  }, [loadRequisitions, loadIssues, loadReturnsAndTransfers]);

  useEffect(() => {
    loadReturnMaterials();
  }, [loadReturnMaterials]);

  useEffect(() => {
    loadReturnLots();
  }, [loadReturnLots]);

  useEffect(() => {
    loadInternalAvailable();
  }, [loadInternalAvailable]);

  useEffect(() => {
    loadDispatchAvailable();
  }, [loadDispatchAvailable]);

  useEffect(() => {
    const rawIssueId = returnForm.stock_issue_id.trim();
    if (!rawIssueId) {
      setStockIssueContext(null);
      setStockIssueError(null);
      return;
    }
    const issueId = Number(rawIssueId);
    if (!Number.isInteger(issueId) || issueId <= 0) {
      setStockIssueContext(null);
      setStockIssueError('Stock Issue ID must be a positive integer');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const detail = await ApiService.getStockIssueById(issueId);
        if (cancelled) return;
        setStockIssueContext(detail);
        setStockIssueError(null);
      } catch (err: any) {
        if (cancelled) return;
        setStockIssueContext(null);
        setStockIssueError(err.message || `Stock Issue #${issueId} could not be loaded`);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [returnForm.stock_issue_id]);

  useEffect(() => {
    if (returnForm.warehouse_id) ensureLocations(Number(returnForm.warehouse_id));
  }, [returnForm.warehouse_id, ensureLocations]);

  useEffect(() => {
    if (internalTrfForm.warehouse_id) ensureLocations(Number(internalTrfForm.warehouse_id));
  }, [internalTrfForm.warehouse_id, ensureLocations]);

  useEffect(() => {
    if (dispatchTrfForm.source_warehouse_id) ensureLocations(Number(dispatchTrfForm.source_warehouse_id));
  }, [dispatchTrfForm.source_warehouse_id, ensureLocations]);

  useEffect(() => {
    const tgtId = Number(dispatchTrfForm.target_warehouse_id);
    if (tgtId && warehouses.some((w) => w.id === tgtId)) {
      ensureLocations(tgtId, true);
    }
  }, [dispatchTrfForm.target_warehouse_id, warehouses, ensureLocations]);

  const handleSelectReq = async (id: number) => {
    setError(null);
    try {
      const data = await ApiService.getRequisitionById(id);
      setSelectedReq(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load requisition details');
    }
  };

  const handleCreateReq = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const items =
        reqForm.first_material_id && Number(reqForm.first_qty) > 0
          ? [{ material_id: Number(reqForm.first_material_id), requested_qty: Number(reqForm.first_qty) }]
          : undefined;
      const res = await ApiService.createRequisition({
        department_id: Number(reqForm.department_id),
        production_line_id: reqForm.production_line_id ? Number(reqForm.production_line_id) : null,
        warehouse_id: Number(reqForm.warehouse_id),
        reference_type: reqForm.reference_type || undefined,
        reference_code: reqForm.reference_code.trim() || undefined,
        required_date: reqForm.required_date || undefined,
        notes: reqForm.notes.trim() || undefined,
        items,
      });
      setShowCreateReq(false);
      setSelectedReq(res);
      setFeedback(`Requisition draft ${res.requisition.requisition_number} created.`);
      await loadRequisitions(0);
    } catch (err: any) {
      setError(err.message || 'Failed to create requisition');
    }
  };

  const handleAddReqItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    setError(null);
    try {
      await ApiService.addRequisitionItem(selectedReq.requisition.id, {
        material_id: Number(addReqItemForm.material_id),
        requested_qty: Number(addReqItemForm.requested_qty),
      });
      setAddReqItemForm({ material_id: '', requested_qty: '' });
      setFeedback('Item added to requisition draft.');
      await handleSelectReq(selectedReq.requisition.id);
    } catch (err: any) {
      setError(err.message || 'Failed to add requisition item');
    }
  };

  const handleReqTransition = async (action: 'submit' | 'approve' | 'reject' | 'cancel') => {
    if (!selectedReq) return;
    setError(null);
    try {
      if (action === 'submit') await ApiService.submitRequisition(selectedReq.requisition.id);
      if (action === 'approve') await ApiService.approveRequisition(selectedReq.requisition.id);
      if (action === 'reject') await ApiService.rejectRequisition(selectedReq.requisition.id, rejectReason.trim() || undefined);
      if (action === 'cancel') await ApiService.cancelRequisition(selectedReq.requisition.id);
      setRejectReason('');
      setFeedback(`Requisition ${selectedReq.requisition.requisition_number} ${action} completed.`);
      await handleSelectReq(selectedReq.requisition.id);
      await loadRequisitions(reqPagination.offset);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || `Failed to ${action} requisition`);
    }
  };

  const handleOpenIssueModal = async (reqData: { requisition: MaterialRequisition; items: MaterialRequisitionItem[] }) => {
    setError(null);
    try {
      const matMap: Record<number, InventoryBalance[]> = {};
      const selMap: Record<number, { balanceId: string; issued_qty: string; fifo_override_reason: string }> = {};
      for (const item of reqData.items) {
        const remaining = Math.max(0, Number(item.requested_qty) - Number(item.issued_qty));
        const bals = await ApiService.getAvailableBalances(reqData.requisition.warehouse_id, item.material_id);
        matMap[item.material_id] = bals;
        selMap[item.id] = {
          balanceId: bals[0] ? String(bals[0].id) : '',
          issued_qty: remaining > 0 ? String(remaining) : '0',
          fifo_override_reason: '',
        };
      }
      setAvailableByMat(matMap);
      setIssueLineSelections(selMap);
      setIssueNotes('');
      setIssueTarget(reqData);
    } catch (err: any) {
      setError(err.message || 'Failed to load FIFO available balances');
    }
  };

  const isLineFifoOverride = (item: MaterialRequisitionItem): boolean => {
    const bals = availableByMat[item.material_id] || [];
    const lotBals = bals.filter((b) => b.lot_id !== null);
    if (lotBals.length <= 1) return false;
    const oldestLotId = lotBals[0].lot_id;
    const chosenId = issueLineSelections[item.id]?.balanceId;
    const chosenBal = bals.find((b) => String(b.id) === chosenId);
    return Boolean(chosenBal?.lot_id && oldestLotId && chosenBal.lot_id !== oldestLotId);
  };

  const handlePostIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTarget) return;
    setError(null);
    try {
      const itemsToPost = issueTarget.items
        .map((it) => {
          const sel = issueLineSelections[it.id];
          const qty = Number(sel?.issued_qty || 0);
          if (qty <= 0) return null;
          const bals = availableByMat[it.material_id] || [];
          const chosen = bals.find((b) => String(b.id) === sel.balanceId);
          return {
            requisition_item_id: it.id,
            location_id: chosen?.location_id,
            lot_id: chosen?.lot_id ?? null,
            issued_qty: qty,
            fifo_override_reason: sel.fifo_override_reason.trim() || undefined,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const res = await ApiService.issueStock({
        requisition_id: issueTarget.requisition.id,
        notes: issueNotes.trim() || undefined,
        items: itemsToPost,
      });
      setIssueTarget(null);
      setFeedback(`Stock issue ${res.issue.issue_number} posted & FIFO/WAC applied!`);
      if (selectedReq?.requisition.id === issueTarget.requisition.id) {
        await handleSelectReq(issueTarget.requisition.id);
      }
      await loadRequisitions(reqPagination.offset);
      await loadIssues(0);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Stock issue failed');
    }
  };

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const chosenMat =
      returnMaterials.find((m) => String(m.id) === returnForm.material_id) ||
      materials.find((m) => String(m.id) === returnForm.material_id);
    if (chosenMat && (chosenMat.is_lot_tracked || chosenMat.is_roll_tracked) && !returnForm.lot_id) {
      setError(`Lot selection is required for lot/roll tracked material ${chosenMat.sku}.`);
      return;
    }
    try {
      const res = await ApiService.createMaterialReturn({
        department_id: Number(returnForm.department_id),
        production_line_id: returnForm.production_line_id ? Number(returnForm.production_line_id) : undefined,
        stock_issue_id: returnForm.stock_issue_id ? Number(returnForm.stock_issue_id) : undefined,
        warehouse_id: Number(returnForm.warehouse_id),
        target_location_id: returnForm.target_location_id ? Number(returnForm.target_location_id) : undefined,
        material_id: Number(returnForm.material_id),
        lot_id: returnForm.lot_id ? Number(returnForm.lot_id) : undefined,
        returned_qty: Number(returnForm.returned_qty),
        return_condition: returnForm.return_condition,
        notes: returnForm.notes.trim() || undefined,
      });
      setFeedback(`Material return ${res.material_return.return_number} posted (${res.material_return.return_condition}).`);
      setReturnForm((p) => ({ ...p, returned_qty: '', notes: '' }));
      await Promise.all([loadReturnsAndTransfers(0), loadInternalAvailable(), loadDispatchAvailable(), loadReturnLots()]);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Material return failed');
    }
  };

  const handleInternalTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const chosenBal = internalAvailBalances.find((b) => String(b.id) === internalTrfForm.balance_id);
    if (!chosenBal) {
      setError('Please select an available stock balance to move');
      return;
    }
    const qty = Number(internalTrfForm.quantity);
    if (qty > Number(chosenBal.qty_available)) {
      setError(`Requested quantity (${qty}) exceeds available stock (${formatQty(chosenBal.qty_available)} ${chosenBal.base_uom})`);
      return;
    }
    try {
      const res = await ApiService.executeInternalTransfer({
        warehouse_id: Number(internalTrfForm.warehouse_id),
        notes: internalTrfForm.notes.trim() || undefined,
        items: [
          {
            source_location_id: chosenBal.location_id,
            target_location_id: Number(internalTrfForm.target_location_id),
            material_id: chosenBal.material_id,
            lot_id: chosenBal.lot_id ?? undefined,
            quantity: qty,
          },
        ],
      });
      setFeedback(`Internal bin move ${res.transfer.transfer_number} completed.`);
      setTrfMode('none');
      setInternalTrfForm((p) => ({ ...p, balance_id: '', material_id: '', quantity: '' }));
      await Promise.all([loadReturnsAndTransfers(0), loadInternalAvailable(), loadDispatchAvailable()]);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Internal bin transfer failed');
    }
  };

  const handleDispatchTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const srcWhId = Number(dispatchTrfForm.source_warehouse_id);
    const tgtWhId = Number(dispatchTrfForm.target_warehouse_id);
    if (!tgtWhId || srcWhId === tgtWhId) {
      setError('Please select a destination warehouse distinct from the source warehouse');
      return;
    }
    const targetWh = warehouses.find((w) => w.id === tgtWhId);
    if (targetWh?.require_bin_tracking && !dispatchTrfForm.target_location_id) {
      setError(`Target bin selection is required for warehouse ${targetWh.warehouse_code}`);
      return;
    }
    const chosenBal = dispatchAvailBalances.find((b) => String(b.id) === dispatchTrfForm.balance_id);
    if (!chosenBal) {
      setError('Please select an available stock balance to dispatch');
      return;
    }
    const qty = Number(dispatchTrfForm.dispatched_qty);
    if (qty > Number(chosenBal.qty_available)) {
      setError(`Requested dispatch quantity (${qty}) exceeds available stock (${formatQty(chosenBal.qty_available)} ${chosenBal.base_uom})`);
      return;
    }
    try {
      const res = await ApiService.dispatchInterWarehouseTransfer({
        source_warehouse_id: srcWhId,
        target_warehouse_id: tgtWhId,
        notes: dispatchTrfForm.notes.trim() || undefined,
        items: [
          {
            source_location_id: chosenBal.location_id,
            target_location_id: dispatchTrfForm.target_location_id
              ? Number(dispatchTrfForm.target_location_id)
              : undefined,
            material_id: chosenBal.material_id,
            lot_id: chosenBal.lot_id ?? undefined,
            dispatched_qty: qty,
          },
        ],
      });
      setFeedback(`Transfer ${res.transfer.transfer_number} dispatched (IN_TRANSIT).`);
      setTrfMode('none');
      setDispatchTrfForm((p) => ({
        ...p,
        balance_id: '',
        material_id: '',
        target_location_id: '',
        dispatched_qty: '',
      }));
      await Promise.all([loadReturnsAndTransfers(0), loadInternalAvailable(), loadDispatchAvailable()]);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Transfer dispatch failed');
    }
  };

  const handleOpenReceiveTransfer = async (transferId: number) => {
    setError(null);
    try {
      const detail = await ApiService.getTransferById(transferId);
      const init: Record<number, { received_qty: string; damaged_qty: string; discrepancy_qty: string; notes: string }> = {};
      for (const it of detail.items) {
        init[it.id] = {
          received_qty: String(it.dispatched_qty),
          damaged_qty: '0',
          discrepancy_qty: '0',
          notes: '',
        };
      }
      setReceiveLines(init);
      setReceiveTarget(detail);
    } catch (err: any) {
      setError(err.message || 'Failed to load transfer items');
    }
  };

  const handleReceiveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveTarget) return;
    setError(null);
    try {
      const payloadItems = receiveTarget.items.map((it) => {
        const row = receiveLines[it.id];
        return {
          transfer_item_id: it.id,
          received_qty: Number(row?.received_qty || 0),
          damaged_qty: Number(row?.damaged_qty || 0),
          discrepancy_qty: Number(row?.discrepancy_qty || 0),
          notes: row?.notes?.trim() || undefined,
        };
      });
      const res = await ApiService.receiveInterWarehouseTransfer(receiveTarget.transfer.id, { items: payloadItems });
      setFeedback(`Transfer ${res.transfer.transfer_number} received (${res.transfer.status}).`);
      setReceiveTarget(null);
      await loadReturnsAndTransfers(trfPagination.offset);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Transfer receipt failed');
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

      {/* ==================== REQUISITIONS & STOCK ISSUING ==================== */}
      {mode === 'requisitions' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs">
              <ClipboardList className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-white uppercase tracking-wider">
                Material Requisitions &amp; FIFO Stock Issuing
              </span>
              <select
                value={reqStatusFilter}
                onChange={(e) => setReqStatusFilter(e.target.value)}
                className="ml-3 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200"
              >
                <option value="">All Status</option>
                {['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_ISSUED', 'FULFILLED', 'REJECTED', 'CANCELLED'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {canCreateReq && (
              <button
                type="button"
                onClick={() => setShowCreateReq(true)}
                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Requisition</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* Requisitions List */}
            <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                    <tr>
                      <th className="px-2.5 py-2">Req #</th>
                      <th className="px-2.5 py-2">Dept / Line</th>
                      <th className="px-2.5 py-2">WH</th>
                      <th className="px-2.5 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {requisitions.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => handleSelectReq(r.id)}
                        className={`cursor-pointer ${
                          selectedReq?.requisition.id === r.id ? 'bg-indigo-950/40' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="px-2.5 py-2 font-mono text-indigo-300 font-semibold">{r.requisition_number}</td>
                        <td className="px-2.5 py-2">
                          <div className="font-mono text-slate-200">{r.dept_code}</div>
                          {r.line_number && <div className="text-[11px] text-slate-400">Line {r.line_number}</div>}
                        </td>
                        <td className="px-2.5 py-2 font-mono text-slate-300">{r.warehouse_code}</td>
                        <td className="px-2.5 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar pagination={reqPagination} onPageChange={(off) => loadRequisitions(off)} />
            </div>

            {/* Requisition Inspector */}
            <div className="xl:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              {!selectedReq ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Select a Material Requisition to review items, approve reservation, or issue stock via Advisory FIFO.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-indigo-300">
                          {selectedReq.requisition.requisition_number}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(selectedReq.requisition.status)}`}>
                          {selectedReq.requisition.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selectedReq.requisition.dept_code} ({selectedReq.requisition.department_name}) →{' '}
                        {selectedReq.requisition.warehouse_code}
                        {selectedReq.requisition.line_number ? ` • Line ${selectedReq.requisition.line_number}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {canCreateReq && selectedReq.requisition.status === 'DRAFT' && selectedReq.items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleReqTransition('submit')}
                          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-white cursor-pointer"
                        >
                          Submit Requisition
                        </button>
                      )}
                      {canApproveReq && selectedReq.requisition.status === 'SUBMITTED' && (
                        <button
                          type="button"
                          onClick={() => handleReqTransition('approve')}
                          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 font-semibold text-white cursor-pointer"
                        >
                          Approve &amp; Reserve Stock
                        </button>
                      )}
                      {canIssue &&
                        (selectedReq.requisition.status === 'APPROVED' ||
                          selectedReq.requisition.status === 'PARTIALLY_ISSUED') && (
                          <button
                            type="button"
                            onClick={() => handleOpenIssueModal(selectedReq)}
                            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 font-semibold text-white flex items-center space-x-1 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Issue Stock (FIFO)</span>
                          </button>
                        )}
                      {(canCreateReq || canApproveReq) &&
                        ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(selectedReq.requisition.status) && (
                          <button
                            type="button"
                            onClick={() => handleReqTransition('cancel')}
                            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                    </div>
                  </div>

                  {canApproveReq && selectedReq.requisition.status === 'SUBMITTED' && (
                    <div className="flex items-center space-x-2 text-xs">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Optional rejection reason..."
                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleReqTransition('reject')}
                        className="px-3 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white font-semibold cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  <div className="overflow-x-auto border border-slate-800 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                        <tr>
                          <th className="px-3 py-2">SKU</th>
                          <th className="px-3 py-2">Material</th>
                          <th className="px-3 py-2 text-right">Requested</th>
                          <th className="px-3 py-2 text-right">Issued</th>
                          <th className="px-3 py-2 text-right">Remaining</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {selectedReq.items.map((it) => {
                          const rem = Math.max(0, Number(it.requested_qty) - Number(it.issued_qty));
                          return (
                            <tr key={it.id}>
                              <td className="px-3 py-2 font-mono text-indigo-300">{it.sku}</td>
                              <td className="px-3 py-2 text-white">{it.material_name}</td>
                              <td className="px-3 py-2 text-right font-mono text-slate-200">
                                {formatQty(it.requested_qty)} {it.base_uom}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-emerald-400">
                                {formatQty(it.issued_qty)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-amber-300">{formatQty(rem)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {canCreateReq && selectedReq.requisition.status === 'DRAFT' && (
                    <form onSubmit={handleAddReqItem} className="flex flex-wrap items-center gap-2 text-xs pt-1">
                      <select
                        required
                        value={addReqItemForm.material_id}
                        onChange={(e) => setAddReqItemForm({ ...addReqItemForm, material_id: e.target.value })}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                      >
                        <option value="">Add SKU to requisition...</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.sku} - {m.name} ({m.base_uom})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0.01}
                        step="0.01"
                        required
                        value={addReqItemForm.requested_qty}
                        onChange={(e) => setAddReqItemForm({ ...addReqItemForm, requested_qty: e.target.value })}
                        placeholder="Qty"
                        className="w-28 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                      />
                      <button type="submit" className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer">
                        Add Item
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Posted Stock Issues */}
          {issues.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Posted Stock Issues ({issuesPagination.total})
              </h4>
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                    <tr>
                      <th className="px-3 py-2">Issue #</th>
                      <th className="px-3 py-2">Requisition #</th>
                      <th className="px-3 py-2">Warehouse → Dept</th>
                      <th className="px-3 py-2">Issued By</th>
                      <th className="px-3 py-2">Issued At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {issues.map((is) => (
                      <tr key={is.id}>
                        <td className="px-3 py-2 font-mono text-emerald-400 font-semibold">{is.issue_number}</td>
                        <td className="px-3 py-2 font-mono text-indigo-300">{is.requisition_number}</td>
                        <td className="px-3 py-2 font-mono text-slate-300">
                          {is.warehouse_code} → {is.dept_code}
                          {is.line_number ? ` (${is.line_number})` : ''}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-400">@{is.issued_by_username}</td>
                        <td className="px-3 py-2 font-mono text-slate-400">{new Date(is.issued_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar pagination={issuesPagination} onPageChange={(off) => loadIssues(off)} />
            </div>
          )}
        </div>
      )}

      {/* ==================== RETURNS & TRANSFERS ==================== */}
      {mode === 'returns-transfers' && (
        <div className="space-y-5">
          {/* Transfers */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center space-x-1.5">
                <ArrowLeftRight className="w-4 h-4" />
                <span>Bin Moves &amp; 2-Step Inter-Warehouse Transfers ({trfPagination.total})</span>
              </h3>
              {canTransfer && (
                <div className="flex items-center space-x-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setTrfMode(trfMode === 'internal' ? 'none' : 'internal')}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
                  >
                    Internal Bin Move
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrfMode(trfMode === 'dispatch' ? 'none' : 'dispatch')}
                    className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-white flex items-center space-x-1 cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Dispatch Inter-Warehouse</span>
                  </button>
                </div>
              )}
            </div>

            {trfMode === 'internal' && (() => {
              const filteredInternal = internalAvailBalances.filter(
                (b) =>
                  Number(b.qty_available) > 0 &&
                  (!internalTrfForm.source_location_id || String(b.location_id) === internalTrfForm.source_location_id)
              );
              const selectedInternalBal = filteredInternal.find((b) => String(b.id) === internalTrfForm.balance_id);
              return (
                <form onSubmit={handleInternalTransfer} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Warehouse *</label>
                    <select
                      required
                      value={internalTrfForm.warehouse_id}
                      onChange={(e) =>
                        setInternalTrfForm({
                          ...internalTrfForm,
                          warehouse_id: e.target.value,
                          source_location_id: '',
                          target_location_id: '',
                          balance_id: '',
                          material_id: '',
                        })
                      }
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
                    <label className="block text-slate-400 mb-1">Source Bin (Filter)</label>
                    <select
                      value={internalTrfForm.source_location_id}
                      onChange={(e) =>
                        setInternalTrfForm({
                          ...internalTrfForm,
                          source_location_id: e.target.value,
                          balance_id: '',
                          material_id: '',
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                    >
                      <option value="">All Bins with Stock</option>
                      {(locationsByWh[Number(internalTrfForm.warehouse_id)] || []).map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.location_code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Target Bin *</label>
                    <select
                      required
                      value={internalTrfForm.target_location_id}
                      onChange={(e) => setInternalTrfForm({ ...internalTrfForm, target_location_id: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                    >
                      <option value="">Select...</option>
                      {(locationsByWh[Number(internalTrfForm.warehouse_id)] || [])
                        .filter((l) => !selectedInternalBal || l.id !== selectedInternalBal.location_id)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.location_code}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Available Stock / SKU *</label>
                    <select
                      required
                      value={internalTrfForm.balance_id}
                      onChange={(e) => {
                        const bal = filteredInternal.find((b) => String(b.id) === e.target.value);
                        setInternalTrfForm({
                          ...internalTrfForm,
                          balance_id: e.target.value,
                          material_id: bal ? String(bal.material_id) : '',
                          source_location_id: bal ? String(bal.location_id) : internalTrfForm.source_location_id,
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                    >
                      {internalAvailLoading ? (
                        <option value="">Loading available stock...</option>
                      ) : filteredInternal.length === 0 ? (
                        <option value="">No available stock in selected warehouse/bin</option>
                      ) : (
                        <>
                          <option value="">Select available stock...</option>
                          {filteredInternal.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.sku} - {b.material_name}
                              {b.lot_number ? ` • Lot ${b.lot_number}` : ''}
                              {b.roll_number ? ` (${b.roll_number})` : ''} • {b.location_code} • Avail {formatQty(b.qty_available)} {b.base_uom}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                  <div className="flex items-end space-x-2">
                    <input
                      type="number"
                      min={0.01}
                      max={selectedInternalBal ? Number(selectedInternalBal.qty_available) : undefined}
                      step="0.01"
                      required
                      value={internalTrfForm.quantity}
                      onChange={(e) => setInternalTrfForm({ ...internalTrfForm, quantity: e.target.value })}
                      placeholder="Qty"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                    />
                    <button
                      type="submit"
                      disabled={filteredInternal.length === 0}
                      className="px-3 py-1 rounded bg-emerald-600 disabled:opacity-50 text-white font-semibold cursor-pointer"
                    >
                      Move
                    </button>
                  </div>
                </form>
              );
            })()}

            {trfMode === 'dispatch' && (() => {
              const targetOptions = warehouses.filter(
                (w) => String(w.id) !== dispatchTrfForm.source_warehouse_id && w.status === 'active'
              );
              const selectedTargetWh = warehouses.find((w) => String(w.id) === dispatchTrfForm.target_warehouse_id);
              const targetLocations = (locationsByWh[Number(dispatchTrfForm.target_warehouse_id)] || []).filter(
                (l) => l.status === 'active'
              );
              const filteredDispatch = dispatchAvailBalances.filter(
                (b) =>
                  Number(b.qty_available) > 0 &&
                  (!dispatchTrfForm.source_location_id || String(b.location_id) === dispatchTrfForm.source_location_id)
              );
              const selectedDispatchBal = filteredDispatch.find((b) => String(b.id) === dispatchTrfForm.balance_id);
              return (
                <form onSubmit={handleDispatchTransfer} className="p-3 rounded-lg bg-slate-950/70 border border-indigo-800/40 grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Source Warehouse *</label>
                    <select
                      required
                      value={dispatchTrfForm.source_warehouse_id}
                      onChange={(e) => {
                        const nextSrc = e.target.value;
                        const nextTgt =
                          dispatchTrfForm.target_warehouse_id === nextSrc
                            ? String(warehouses.find((w) => String(w.id) !== nextSrc && w.status === 'active')?.id ?? '')
                            : dispatchTrfForm.target_warehouse_id;
                        setDispatchTrfForm({
                          ...dispatchTrfForm,
                          source_warehouse_id: nextSrc,
                          target_warehouse_id: nextTgt,
                          target_location_id: dispatchTrfForm.target_warehouse_id === nextSrc ? '' : dispatchTrfForm.target_location_id,
                          source_location_id: '',
                          balance_id: '',
                          material_id: '',
                        });
                      }}
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
                    <label className="block text-slate-400 mb-1">Target Warehouse *</label>
                    {targetOptions.length > 0 ? (
                      <select
                        required
                        value={dispatchTrfForm.target_warehouse_id}
                        onChange={(e) =>
                          setDispatchTrfForm({
                            ...dispatchTrfForm,
                            target_warehouse_id: e.target.value,
                            target_location_id: '',
                            balance_id: '',
                            material_id: '',
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      >
                        <option value="">Select target warehouse...</option>
                        {targetOptions.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.warehouse_code} - {w.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        required
                        value={dispatchTrfForm.target_warehouse_id}
                        onChange={(e) =>
                          setDispatchTrfForm({
                            ...dispatchTrfForm,
                            target_warehouse_id: e.target.value,
                            target_location_id: '',
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Target Bin {selectedTargetWh?.require_bin_tracking ? '*' : '(Opt.)'}
                    </label>
                    {selectedTargetWh ? (
                      <select
                        required={Boolean(selectedTargetWh.require_bin_tracking)}
                        disabled={!dispatchTrfForm.target_warehouse_id}
                        value={dispatchTrfForm.target_location_id}
                        onChange={(e) => setDispatchTrfForm({ ...dispatchTrfForm, target_location_id: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      >
                        <option value="">
                          {selectedTargetWh.require_bin_tracking ? 'Select target bin...' : 'DEFAULT / Auto'}
                        </option>
                        {targetLocations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.location_code} - {l.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        value={dispatchTrfForm.target_location_id}
                        onChange={(e) => setDispatchTrfForm({ ...dispatchTrfForm, target_location_id: e.target.value })}
                        placeholder="Bin ID"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Source Bin (Filter)</label>
                    <select
                      value={dispatchTrfForm.source_location_id}
                      onChange={(e) =>
                        setDispatchTrfForm({
                          ...dispatchTrfForm,
                          source_location_id: e.target.value,
                          balance_id: '',
                          material_id: '',
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                    >
                      <option value="">All Bins with Stock</option>
                      {(locationsByWh[Number(dispatchTrfForm.source_warehouse_id)] || []).map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.location_code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Available Stock / SKU *</label>
                    <select
                      required
                      value={dispatchTrfForm.balance_id}
                      onChange={(e) => {
                        const bal = filteredDispatch.find((b) => String(b.id) === e.target.value);
                        setDispatchTrfForm({
                          ...dispatchTrfForm,
                          balance_id: e.target.value,
                          material_id: bal ? String(bal.material_id) : '',
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                    >
                      {dispatchAvailLoading ? (
                        <option value="">Loading available stock...</option>
                      ) : filteredDispatch.length === 0 ? (
                        <option value="">No available stock in source warehouse/bin</option>
                      ) : (
                        <>
                          <option value="">Select available stock...</option>
                          {filteredDispatch.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.sku} - {b.material_name}
                              {b.lot_number ? ` • Lot ${b.lot_number}` : ''}
                              {b.roll_number ? ` (${b.roll_number})` : ''} • {b.location_code} • Avail {formatQty(b.qty_available)} {b.base_uom}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                  <div className="flex items-end space-x-2">
                    <input
                      type="number"
                      min={0.01}
                      max={selectedDispatchBal ? Number(selectedDispatchBal.qty_available) : undefined}
                      step="0.01"
                      required
                      value={dispatchTrfForm.dispatched_qty}
                      onChange={(e) => setDispatchTrfForm({ ...dispatchTrfForm, dispatched_qty: e.target.value })}
                      placeholder="Qty"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                    />
                    <button
                      type="submit"
                      disabled={filteredDispatch.length === 0}
                      className="px-3 py-1 rounded bg-indigo-600 disabled:opacity-50 text-white font-semibold cursor-pointer"
                    >
                      Dispatch
                    </button>
                  </div>
                </form>
              );
            })()}

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                  <tr>
                    <th className="px-3 py-2">Transfer #</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Route</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Initiated By</th>
                    {canTransfer && <th className="px-3 py-2 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {transfers.map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-2 font-mono text-indigo-300 font-semibold">{t.transfer_number}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{t.transfer_type}</td>
                      <td className="px-3 py-2 font-mono text-white">
                        {t.source_warehouse_code} → {t.target_warehouse_code}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(t.status)}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">
                        {t.initiated_by_username ? `@${t.initiated_by_username}` : '—'}
                      </td>
                      {canTransfer && (
                        <td className="px-3 py-2 text-right">
                          {['DISPATCHED', 'IN_TRANSIT'].includes(t.status) ? (
                            <button
                              type="button"
                              onClick={() => handleOpenReceiveTransfer(t.id)}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] font-semibold text-white cursor-pointer"
                            >
                              Receive Stock
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-mono">Closed</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar pagination={trfPagination} onPageChange={(off) => loadReturnsAndTransfers(off)} />
          </div>

          {/* Material Returns */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center space-x-1.5">
              <RotateCcw className="w-4 h-4" />
              <span>Material Returns, Waste &amp; Damage Routing ({retPagination.total})</span>
            </h3>

            {canReturn && (() => {
              const issuedMaterialIds = stockIssueContext
                ? new Set<number>(stockIssueContext.items.map((it) => Number(it.material_id)))
                : null;
              const eligibleReturnMaterials = issuedMaterialIds
                ? returnMaterials.filter((m) => issuedMaterialIds.has(m.id))
                : returnMaterials;
              const issueDeptMismatch =
                Boolean(stockIssueContext && returnForm.department_id) &&
                Number(stockIssueContext?.issue.department_id) !== Number(returnForm.department_id);
              const selectedReturnMaterial =
                eligibleReturnMaterials.find((m) => String(m.id) === returnForm.material_id) ||
                returnMaterials.find((m) => String(m.id) === returnForm.material_id) ||
                null;
              const requiresLotSelection = Boolean(
                selectedReturnMaterial && (selectedReturnMaterial.is_lot_tracked || selectedReturnMaterial.is_roll_tracked)
              );

              const issuedLotIdsForMat = stockIssueContext
                ? new Set<number>(
                    stockIssueContext.items
                      .filter((it) => String(it.material_id) === returnForm.material_id && it.lot_id !== null && it.lot_id !== undefined)
                      .map((it) => Number(it.lot_id))
                  )
                : null;

              const mergedLotOptions: Array<{ id: number; label: string }> = [];
              const seenLotIds = new Set<number>();
              for (const lot of returnLots) {
                if (issuedLotIdsForMat && !issuedLotIdsForMat.has(lot.id)) continue;
                seenLotIds.add(lot.id);
                mergedLotOptions.push({
                  id: lot.id,
                  label: `${lot.lot_number}${lot.roll_number ? ` (${lot.roll_number})` : ''} • Rem ${formatQty(lot.remaining_qty)}`,
                });
              }
              if (stockIssueContext && returnForm.material_id) {
                for (const it of stockIssueContext.items) {
                  if (
                    String(it.material_id) === returnForm.material_id &&
                    it.lot_id !== null &&
                    it.lot_id !== undefined &&
                    !seenLotIds.has(Number(it.lot_id))
                  ) {
                    seenLotIds.add(Number(it.lot_id));
                    mergedLotOptions.push({
                      id: Number(it.lot_id),
                      label: `${it.lot_number || `Lot #${it.lot_id}`}${it.roll_number ? ` (${it.roll_number})` : ''} • Issued ${formatQty(it.issued_qty)}`,
                    });
                  }
                }
              }
              const missingRequiredLot = requiresLotSelection && !returnForm.lot_id;

              return (
                <div className="space-y-2">
                  {departmentsError && (
                    <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-700/60 text-xs text-rose-200 flex items-center justify-between">
                      <span>{departmentsError}</span>
                      <button
                        type="button"
                        onClick={loadDepartmentsLookup}
                        className="px-2 py-0.5 rounded bg-rose-800/80 hover:bg-rose-700 text-white text-[11px] cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {returnMaterialsError && (
                    <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-700/60 text-xs text-rose-200 flex items-center justify-between">
                      <span>{returnMaterialsError}</span>
                      <button
                        type="button"
                        onClick={loadReturnMaterials}
                        className="px-2 py-0.5 rounded bg-rose-800/80 hover:bg-rose-700 text-white text-[11px] cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {returnLotsError && (
                    <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-700/60 text-xs text-rose-200 flex items-center justify-between">
                      <span>{returnLotsError}</span>
                      <button
                        type="button"
                        onClick={loadReturnLots}
                        className="px-2 py-0.5 rounded bg-rose-800/80 hover:bg-rose-700 text-white text-[11px] cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {materialsError && !returnMaterialsError && (
                    <div className="p-2.5 rounded-lg bg-amber-950/50 border border-amber-700/60 text-xs text-amber-200">
                      {materialsError}
                    </div>
                  )}
                  <form onSubmit={handleCreateReturn} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 grid grid-cols-2 sm:grid-cols-8 gap-2 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">Dept *</label>
                      <select
                        required
                        disabled={departmentsLoading || departments.length === 0}
                        value={returnForm.department_id}
                        onChange={(e) =>
                          setReturnForm({
                            ...returnForm,
                            department_id: e.target.value,
                            production_line_id: '',
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      >
                        {departmentsLoading ? (
                          <option value="">Loading departments...</option>
                        ) : departments.length === 0 ? (
                          <option value="">No authorized active departments</option>
                        ) : (
                          <>
                            <option value="">Select Dept...</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.dept_code} - {d.name}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Warehouse *</label>
                      <select
                        required
                        value={returnForm.warehouse_id}
                        onChange={(e) =>
                          setReturnForm({
                            ...returnForm,
                            warehouse_id: e.target.value,
                            target_location_id: '',
                            lot_id: '',
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      >
                        {warehouses.length === 0 && <option value="">No authorized warehouses</option>}
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.warehouse_code} - {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Target Bin</label>
                      <select
                        value={returnForm.target_location_id}
                        onChange={(e) => setReturnForm({ ...returnForm, target_location_id: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      >
                        <option value="">DEFAULT / Auto</option>
                        {(locationsByWh[Number(returnForm.warehouse_id)] || []).map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.location_code}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Material *</label>
                      <select
                        required
                        disabled={returnMaterialsLoading}
                        value={returnForm.material_id}
                        onChange={(e) => {
                          const matId = e.target.value;
                          const matchedIssueItem = stockIssueContext?.items.find((it) => String(it.material_id) === matId);
                          setReturnForm({
                            ...returnForm,
                            material_id: matId,
                            lot_id: matchedIssueItem?.lot_id ? String(matchedIssueItem.lot_id) : '',
                          });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      >
                        {returnMaterialsLoading ? (
                          <option value="">Loading active materials...</option>
                        ) : returnMaterialsError ? (
                          <option value="">Error loading materials</option>
                        ) : eligibleReturnMaterials.length === 0 ? (
                          <option value="">
                            {stockIssueContext
                              ? 'No issued material compatible with selected warehouse'
                              : 'No eligible active materials for selected warehouse'}
                          </option>
                        ) : (
                          <>
                            <option value="">Select SKU...</option>
                            {eligibleReturnMaterials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.sku} - {m.name} ({m.base_uom})
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">
                        Lot {requiresLotSelection ? <span className="text-amber-300">*</span> : '(Opt.)'}
                      </label>
                      <select
                        required={requiresLotSelection}
                        disabled={!returnForm.material_id || returnLotsLoading}
                        value={returnForm.lot_id}
                        onChange={(e) => setReturnForm({ ...returnForm, lot_id: e.target.value })}
                        className={`w-full bg-slate-900 border rounded px-2 py-1 text-white ${
                          missingRequiredLot ? 'border-amber-600/80' : 'border-slate-700'
                        }`}
                      >
                        {!returnForm.material_id ? (
                          <option value="">Select material first</option>
                        ) : returnLotsLoading ? (
                          <option value="">Loading lots...</option>
                        ) : mergedLotOptions.length === 0 ? (
                          <option value="">
                            {requiresLotSelection ? 'No eligible lots in warehouse' : 'Lot-free / None'}
                          </option>
                        ) : (
                          <>
                            <option value="">
                              {requiresLotSelection ? 'Select Lot (Required)...' : 'None / Optional'}
                            </option>
                            {mergedLotOptions.map((lot) => (
                              <option key={lot.id} value={lot.id}>
                                {lot.label}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Condition *</label>
                      <select
                        value={returnForm.return_condition}
                        onChange={(e) => setReturnForm({ ...returnForm, return_condition: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      >
                        <option value="USABLE_SURPLUS">USABLE_SURPLUS</option>
                        <option value="DAMAGED">DAMAGED</option>
                        <option value="WASTE_SCRAP">WASTE_SCRAP</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Stock Issue ID</label>
                      <input
                        type="number"
                        min={1}
                        value={returnForm.stock_issue_id}
                        onChange={(e) => setReturnForm({ ...returnForm, stock_issue_id: e.target.value, lot_id: '' })}
                        placeholder="Optional"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                      />
                    </div>
                    <div className="flex items-end space-x-2">
                      <input
                        type="number"
                        min={0.01}
                        step="0.01"
                        required
                        value={returnForm.returned_qty}
                        onChange={(e) => setReturnForm({ ...returnForm, returned_qty: e.target.value })}
                        placeholder="Qty"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                      />
                      <button
                        type="submit"
                        disabled={
                          departmentsLoading ||
                          departments.length === 0 ||
                          returnMaterialsLoading ||
                          eligibleReturnMaterials.length === 0 ||
                          issueDeptMismatch ||
                          missingRequiredLot
                        }
                        className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold cursor-pointer"
                      >
                        Post
                      </button>
                    </div>
                  </form>
                  {requiresLotSelection && !returnForm.lot_id && (
                    <p className="text-[11px] text-amber-300 font-mono">
                      Lot selection is required for lot/roll-tracked material {selectedReturnMaterial?.sku}.
                    </p>
                  )}
                  {stockIssueError && (
                    <p className="text-[11px] text-amber-300 font-mono">{stockIssueError}</p>
                  )}
                  {stockIssueContext && (
                    <div
                      className={`p-2 rounded border text-[11px] font-mono ${
                        issueDeptMismatch
                          ? 'bg-rose-950/40 border-rose-700/60 text-rose-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300'
                      }`}
                    >
                      {issueDeptMismatch
                        ? `Department mismatch: ${stockIssueContext.issue.issue_number} belongs to ${stockIssueContext.issue.dept_code} (Dept #${stockIssueContext.issue.department_id}), not Dept #${returnForm.department_id}.`
                        : `Linked Issue ${stockIssueContext.issue.issue_number} (${stockIssueContext.issue.dept_code} from ${stockIssueContext.issue.warehouse_code}): ${stockIssueContext.items
                            .map((it) => `${it.sku}: ${formatQty(it.issued_qty)} ${it.base_uom}`)
                            .join(', ')}`}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                  <tr>
                    <th className="px-3 py-2">Return #</th>
                    <th className="px-3 py-2">Dept / Warehouse</th>
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2">Condition</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {returns.map((ret) => (
                    <tr key={ret.id}>
                      <td className="px-3 py-2 font-mono text-indigo-300">{ret.return_number}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">
                        {ret.dept_code} → {ret.warehouse_code}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-white">{ret.sku}</span> {ret.material_name}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(ret.return_condition)}`}>
                          {ret.return_condition}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-white">{formatQty(ret.returned_qty)}</td>
                      <td className="px-3 py-2 font-mono text-slate-400">
                        {ret.returned_by_username ? `@${ret.returned_by_username}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar pagination={retPagination} onPageChange={(off) => loadReturnsAndTransfers(off)} />
          </div>
        </div>
      )}

      {/* Create Requisition Modal */}
      {showCreateReq && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <form onSubmit={handleCreateReq} className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Create Material Requisition Draft</h3>
              <button type="button" onClick={() => setShowCreateReq(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Requesting Department *</label>
                <select
                  required
                  disabled={departmentsLoading || departments.length === 0}
                  value={reqForm.department_id}
                  onChange={(e) => setReqForm({ ...reqForm, department_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                >
                  {departmentsLoading ? (
                    <option value="">Loading departments...</option>
                  ) : departments.length === 0 ? (
                    <option value="">No authorized departments</option>
                  ) : (
                    <>
                      <option value="">Select Dept...</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.dept_code} - {d.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Production Line</label>
                {lines.length > 0 ? (
                  <select
                    value={reqForm.production_line_id}
                    onChange={(e) => setReqForm({ ...reqForm, production_line_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  >
                    <option value="">Department-Wide / None</option>
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
                    value={reqForm.production_line_id}
                    onChange={(e) => setReqForm({ ...reqForm, production_line_id: e.target.value })}
                    placeholder="Line ID (if supervisor)"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  />
                )}
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Fulfilling Warehouse *</label>
                {warehouses.length > 0 ? (
                  <select
                    required
                    value={reqForm.warehouse_id}
                    onChange={(e) => setReqForm({ ...reqForm, warehouse_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_code} - {w.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={1}
                    required
                    value={reqForm.warehouse_id}
                    onChange={(e) => setReqForm({ ...reqForm, warehouse_id: e.target.value })}
                    placeholder="Warehouse ID (e.g., 1)"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  />
                )}
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Reference Code</label>
                <input
                  type="text"
                  value={reqForm.reference_code}
                  onChange={(e) => setReqForm({ ...reqForm, reference_code: e.target.value })}
                  placeholder="CUT-JOB-01"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                />
              </div>
              <div className="col-span-2 border-t border-slate-800 pt-2">
                <p className="text-slate-300 font-semibold mb-1.5">Initial Material Line (optional)</p>
                <div className="flex space-x-2">
                  <select
                    value={reqForm.first_material_id}
                    onChange={(e) => setReqForm({ ...reqForm, first_material_id: e.target.value })}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="">Select Material...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.sku} - {m.name} ({m.base_uom})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={reqForm.first_qty}
                    onChange={(e) => setReqForm({ ...reqForm, first_qty: e.target.value })}
                    placeholder="Qty"
                    className="w-28 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setShowCreateReq(false)} className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white cursor-pointer">
                Create Draft
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Advisory FIFO Stock Issue Modal */}
      {issueTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handlePostIssue} className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Issue Stock — {issueTarget.requisition.requisition_number}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Advisory FIFO picks oldest received lot first; choosing a newer lot requires a mandatory override reason.
                </p>
              </div>
              <button type="button" onClick={() => setIssueTarget(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-96 overflow-y-auto">
              {issueTarget.items.map((it) => {
                const rem = Math.max(0, Number(it.requested_qty) - Number(it.issued_qty));
                if (rem <= 0) return null;
                const bals = availableByMat[it.material_id] || [];
                const sel = issueLineSelections[it.id] || { balanceId: '', issued_qty: String(rem), fifo_override_reason: '' };
                const overrideNeeded = isLineFifoOverride(it);
                return (
                  <div key={it.id} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-indigo-300">
                        {it.sku} — {it.material_name}
                      </span>
                      <span className="font-mono text-amber-300">
                        Remaining: {formatQty(rem)} {it.base_uom}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-slate-400 mb-1">Source Lot / Bin (FIFO sorted oldest-first)</label>
                        <select
                          required
                          value={sel.balanceId}
                          onChange={(e) =>
                            setIssueLineSelections({
                              ...issueLineSelections,
                              [it.id]: { ...sel, balanceId: e.target.value },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                        >
                          {bals.length === 0 && <option value="">No available balances</option>}
                          {bals.map((b, idx) => (
                            <option key={b.id} value={b.id}>
                              {idx === 0 ? '[FIFO #1] ' : ''}
                              {b.location_code} • {b.lot_number || 'Lot-Free'}
                              {b.roll_number ? ` (${b.roll_number})` : ''} • Avail {formatQty(b.qty_available)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Issue Qty *</label>
                        <input
                          type="number"
                          min={0}
                          max={rem}
                          step="0.01"
                          value={sel.issued_qty}
                          onChange={(e) =>
                            setIssueLineSelections({
                              ...issueLineSelections,
                              [it.id]: { ...sel, issued_qty: e.target.value },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                        />
                      </div>
                    </div>
                    {overrideNeeded && (
                      <div>
                        <label className="block text-amber-300 mb-1 font-semibold">
                          FIFO Override Reason Required (skipping oldest lot) *
                        </label>
                        <input
                          type="text"
                          required
                          value={sel.fifo_override_reason}
                          onChange={(e) =>
                            setIssueLineSelections({
                              ...issueLineSelections,
                              [it.id]: { ...sel, fifo_override_reason: e.target.value },
                            })
                          }
                          placeholder="e.g., Buyer shade continuity match for Lot B"
                          className="w-full bg-slate-900 border border-amber-700 rounded px-2 py-1.5 text-white"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              <div>
                <label className="block text-slate-400 mb-1">Issue Notes</label>
                <input
                  type="text"
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setIssueTarget(null)} className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer">
                Post Stock Issue
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Receive Inter-Warehouse Transfer Modal */}
      {receiveTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleReceiveTransfer} className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                Receive In-Transit Transfer {receiveTarget.transfer.transfer_number}
              </h3>
              <button type="button" onClick={() => setReceiveTarget(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {receiveTarget.items.map((it) => {
                const row = receiveLines[it.id] || { received_qty: '0', damaged_qty: '0', discrepancy_qty: '0', notes: '' };
                const total = Number(row.received_qty || 0) + Number(row.damaged_qty || 0) + Number(row.discrepancy_qty || 0);
                const valid = Math.abs(total - Number(it.dispatched_qty)) < 0.001;
                return (
                  <div key={it.id} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-mono text-indigo-300">
                        {it.sku} — {it.material_name} {it.lot_number ? `(${it.lot_number})` : ''}
                      </span>
                      <span className={`font-mono ${valid ? 'text-emerald-400' : 'text-rose-400'}`}>
                        Dispatched: {formatQty(it.dispatched_qty)} • Accounted: {formatQty(total)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-slate-400 mb-1">Received Good</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.received_qty}
                          onChange={(e) =>
                            setReceiveLines({
                              ...receiveLines,
                              [it.id]: { ...row, received_qty: e.target.value },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Damaged</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.damaged_qty}
                          onChange={(e) =>
                            setReceiveLines({
                              ...receiveLines,
                              [it.id]: { ...row, damaged_qty: e.target.value },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Short / Discrepancy</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.discrepancy_qty}
                          onChange={(e) =>
                            setReceiveLines({
                              ...receiveLines,
                              [it.id]: { ...row, discrepancy_qty: e.target.value },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setReceiveTarget(null)} className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer">
                Confirm Receipt
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
