import React, { useState, useEffect, useCallback } from 'react';
import {
  Warehouse as WarehouseIcon,
  MapPin,
  Users,
  Plus,
  Edit3,
  Power,
  Lock,
  Search,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { useAuth } from '../../hooks/useAuth.tsx';
import {
  Warehouse,
  WarehouseLocation,
  WarehouseStaffAssignment,
  WarehouseType,
  LocationType,
  WarehouseStaffRole,
  DepartmentWithDetails,
  UserItem,
  PaginationMeta,
} from '../../types/index.ts';
import { PaginationBar, statusBadgeClass } from './wmsUi.tsx';

interface WarehouseDirectoryTabProps {
  onRefreshGlobal: () => void;
}

const WAREHOUSE_TYPES: WarehouseType[] = ['RAW_MATERIAL', 'TRIM_ACCESSORY', 'WIP', 'FINISHED_GOODS', 'GENERAL'];
const NON_DEFAULT_LOCATION_TYPES: Exclude<LocationType, 'DEFAULT'>[] = [
  'STORAGE',
  'RECEIVING',
  'STAGING',
  'QC_HOLD',
  'DISPATCH',
  'DAMAGED',
];
const STAFF_ROLES: WarehouseStaffRole[] = ['WAREHOUSE_MANAGER', 'WAREHOUSE_KEEPER', 'QC_INSPECTOR', 'VIEWER'];

export const WarehouseDirectoryTab: React.FC<WarehouseDirectoryTabProps> = ({ onRefreshGlobal }) => {
  const { user, hasPermission } = useAuth();

  const canManageWarehouse = hasPermission('warehouse:manage');
  const canCreateWarehouse =
    canManageWarehouse &&
    (hasPermission('warehouse:create') ||
      hasPermission('warehouse:settings:manage') ||
      hasPermission('inventory:adjust:approve_high'));

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ total: 0, limit: 20, offset: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const [selectedWhId, setSelectedWhId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{
    warehouse: Warehouse;
    locations: WarehouseLocation[];
    staff: WarehouseStaffAssignment[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [departments, setDepartments] = useState<DepartmentWithDetails[]>([]);
  const [usersList, setUsersList] = useState<UserItem[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Create/Edit Warehouse Modal
  const [whModalMode, setWhModalMode] = useState<'create' | 'edit' | null>(null);
  const [whForm, setWhForm] = useState({
    warehouse_code: '',
    name: '',
    warehouse_type: 'RAW_MATERIAL' as WarehouseType,
    department_id: '',
    manager_id: '',
    require_bin_tracking: true,
    description: '',
  });

  // Create Location Modal
  const [showLocModal, setShowLocModal] = useState(false);
  const [locForm, setLocForm] = useState({
    location_code: '',
    name: '',
    location_type: 'STORAGE' as Exclude<LocationType, 'DEFAULT'>,
    zone: '',
    aisle: '',
    rack: '',
    bin: '',
  });

  // Assign Staff Modal
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({
    user_id: '',
    staff_role: 'WAREHOUSE_KEEPER' as WarehouseStaffRole,
    is_primary: true,
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: '',
    notes: '',
  });

  const loadReferenceLookups = useCallback(async () => {
    const tasks: Promise<void>[] = [];
    if (hasPermission('departments:view') || hasPermission('departments:scoped:view')) {
      tasks.push(
        ApiService.getDepartments()
          .then(setDepartments)
          .catch(() => {})
      );
    }
    if (hasPermission('users:read')) {
      tasks.push(
        ApiService.getUsers()
          .then(setUsersList)
          .catch(() => {})
      );
    }
    await Promise.all(tasks);
  }, [hasPermission]);

  const loadWarehouses = useCallback(
    async (offset = 0) => {
      try {
        setLoading(true);
        const res = await ApiService.getWarehouses({
          search: search.trim() || undefined,
          warehouse_type: typeFilter || undefined,
          status: statusFilter || undefined,
          limit: 20,
          offset,
        });
        setWarehouses(res.data);
        setPagination(res.pagination);
        if (res.data.length > 0 && selectedWhId === null) {
          setSelectedWhId(res.data[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load warehouses');
      } finally {
        setLoading(false);
      }
    },
    [search, typeFilter, statusFilter, selectedWhId]
  );

  const loadDetail = useCallback(async (id: number) => {
    try {
      setDetailLoading(true);
      const res = await ApiService.getWarehouseById(id);
      setDetail(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load warehouse details');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferenceLookups();
  }, [loadReferenceLookups]);

  useEffect(() => {
    loadWarehouses(0);
  }, [loadWarehouses]);

  useEffect(() => {
    if (selectedWhId !== null) {
      loadDetail(selectedWhId);
    } else {
      setDetail(null);
    }
  }, [selectedWhId, loadDetail]);

  const handleOpenCreateWh = () => {
    setWhForm({
      warehouse_code: '',
      name: '',
      warehouse_type: 'RAW_MATERIAL',
      department_id: '',
      manager_id: '',
      require_bin_tracking: true,
      description: '',
    });
    setWhModalMode('create');
    setError(null);
  };

  const handleOpenEditWh = (w: Warehouse) => {
    setWhForm({
      warehouse_code: w.warehouse_code,
      name: w.name,
      warehouse_type: w.warehouse_type,
      department_id: w.department_id ? String(w.department_id) : '',
      manager_id: w.manager_id ? String(w.manager_id) : '',
      require_bin_tracking: Boolean(w.require_bin_tracking),
      description: w.description || '',
    });
    setWhModalMode('edit');
    setError(null);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (whModalMode === 'create') {
        const res = await ApiService.createWarehouse({
          warehouse_code: whForm.warehouse_code.trim().toUpperCase(),
          name: whForm.name.trim(),
          warehouse_type: whForm.warehouse_type,
          department_id: whForm.department_id ? Number(whForm.department_id) : null,
          manager_id: whForm.manager_id ? Number(whForm.manager_id) : null,
          require_bin_tracking: whForm.require_bin_tracking,
          description: whForm.description.trim() || undefined,
        });
        setFeedback(`Warehouse ${res.warehouse.warehouse_code} created with mandatory DEFAULT location.`);
        setSelectedWhId(res.warehouse.id);
      } else if (whModalMode === 'edit' && detail) {
        await ApiService.updateWarehouse(detail.warehouse.id, {
          name: whForm.name.trim(),
          warehouse_type: whForm.warehouse_type,
          department_id: whForm.department_id ? Number(whForm.department_id) : null,
          manager_id: whForm.manager_id ? Number(whForm.manager_id) : null,
          require_bin_tracking: whForm.require_bin_tracking,
          description: whForm.description.trim(),
        });
        setFeedback(`Warehouse ${detail.warehouse.warehouse_code} updated.`);
      }
      setWhModalMode(null);
      await loadWarehouses(pagination.offset);
      if (selectedWhId) await loadDetail(selectedWhId);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Warehouse save failed');
    }
  };

  const handleToggleWarehouseStatus = async (w: Warehouse) => {
    setError(null);
    try {
      const nextStatus = w.status === 'active' ? 'inactive' : 'active';
      await ApiService.toggleWarehouseStatus(w.id, nextStatus);
      setFeedback(`Warehouse ${w.warehouse_code} status changed to ${nextStatus}.`);
      await loadWarehouses(pagination.offset);
      if (selectedWhId === w.id) await loadDetail(w.id);
      onRefreshGlobal();
    } catch (err: any) {
      setError(err.message || 'Failed to update warehouse status');
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setError(null);
    try {
      const loc = await ApiService.createWarehouseLocation(detail.warehouse.id, {
        location_code: locForm.location_code.trim().toUpperCase(),
        name: locForm.name.trim(),
        location_type: locForm.location_type,
        zone: locForm.zone.trim() || undefined,
        aisle: locForm.aisle.trim() || undefined,
        rack: locForm.rack.trim() || undefined,
        bin: locForm.bin.trim() || undefined,
      });
      setShowLocModal(false);
      setLocForm({ location_code: '', name: '', location_type: 'STORAGE', zone: '', aisle: '', rack: '', bin: '' });
      setFeedback(`Bin ${loc.location_code} created in ${detail.warehouse.warehouse_code}.`);
      await loadDetail(detail.warehouse.id);
      await loadWarehouses(pagination.offset);
    } catch (err: any) {
      setError(err.message || 'Failed to create storage bin');
    }
  };

  const handleToggleLocationStatus = async (loc: WarehouseLocation) => {
    if (!detail) return;
    setError(null);
    try {
      const next = loc.status === 'active' ? 'inactive' : 'active';
      await ApiService.toggleLocationStatus(detail.warehouse.id, loc.id, next);
      setFeedback(`Location ${loc.location_code} marked ${next}.`);
      await loadDetail(detail.warehouse.id);
    } catch (err: any) {
      setError(err.message || 'Failed to update location status');
    }
  };

  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setError(null);
    try {
      await ApiService.assignWarehouseStaff(detail.warehouse.id, {
        user_id: Number(staffForm.user_id),
        staff_role: staffForm.staff_role,
        is_primary: staffForm.is_primary,
        effective_from: staffForm.effective_from || undefined,
        effective_to: staffForm.effective_to || null,
        notes: staffForm.notes.trim() || undefined,
      });
      setShowStaffModal(false);
      setStaffForm({
        user_id: '',
        staff_role: 'WAREHOUSE_KEEPER',
        is_primary: true,
        effective_from: new Date().toISOString().slice(0, 10),
        effective_to: '',
        notes: '',
      });
      setFeedback(`Warehouse staff assignment saved for ${detail.warehouse.warehouse_code}.`);
      await loadDetail(detail.warehouse.id);
      await loadWarehouses(pagination.offset);
    } catch (err: any) {
      setError(err.message || 'Failed to assign warehouse staff');
    }
  };

  const handleRemoveStaff = async (userId: number, username: string) => {
    if (!detail) return;
    setError(null);
    try {
      await ApiService.removeWarehouseStaff(detail.warehouse.id, userId);
      setFeedback(`Removed @${username} from ${detail.warehouse.warehouse_code}.`);
      await loadDetail(detail.warehouse.id);
      await loadWarehouses(pagination.offset);
    } catch (err: any) {
      setError(err.message || 'Failed to remove staff assignment');
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

      {/* Toolbar & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or name..."
              className="bg-slate-950 border border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="">All Types</option>
            {WAREHOUSE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-800">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Your Assigned Warehouses:{' '}
              {user?.managed_warehouse_ids && user.managed_warehouse_ids.length > 0
                ? user.managed_warehouse_ids.map((id) => `#${id}`).join(', ')
                : 'Global / Unassigned Pool'}
            </span>
          </div>

          {canCreateWarehouse && (
            <button
              type="button"
              onClick={handleOpenCreateWh}
              className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Warehouse</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split View: Directory Left + Inspector Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Directory */}
        <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <WarehouseIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Warehouse Directory ({pagination.total})</span>
            </h3>
            {loading && <span className="text-[11px] text-slate-400 font-mono">Refreshing...</span>}
          </div>

          <div className="space-y-2">
            {warehouses.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                No warehouses visible under current filter or user scope.
              </div>
            ) : (
              warehouses.map((w) => {
                const isSelected = selectedWhId === w.id;
                return (
                  <div
                    key={w.id}
                    onClick={() => setSelectedWhId(w.id)}
                    className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/35 border-indigo-600/70'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-indigo-300">{w.warehouse_code}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(w.status)}`}>
                            {w.status}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-white mt-0.5">{w.name}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Type: <span className="font-mono text-slate-300">{w.warehouse_type}</span> • Bin Tracking:{' '}
                          <span className="text-slate-200">{w.require_bin_tracking ? 'Strict' : 'Optional'}</span>
                        </p>
                      </div>
                      <div className="text-right text-[11px] font-mono text-slate-400 shrink-0">
                        <div>{w.location_count ?? 0} bins</div>
                        <div>{w.staff_count ?? 0} staff</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <PaginationBar pagination={pagination} onPageChange={(off) => loadWarehouses(off)} />
        </div>

        {/* Warehouse Inspector */}
        <div className="xl:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-5">
          {detailLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 font-mono">Loading warehouse blueprint...</div>
          ) : !detail ? (
            <div className="p-8 text-center text-xs text-slate-500">Select a warehouse to manage storage bins & staff roster.</div>
          ) : (
            <>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-bold text-indigo-300">{detail.warehouse.warehouse_code}</span>
                    <h2 className="text-base font-bold text-white">{detail.warehouse.name}</h2>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(detail.warehouse.status)}`}>
                      {detail.warehouse.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Type: {detail.warehouse.warehouse_type} • Manager:{' '}
                    {detail.warehouse.manager_name ? `${detail.warehouse.manager_name} (@${detail.warehouse.manager_username})` : 'Unassigned'}
                    {detail.warehouse.dept_code ? ` • Dept: ${detail.warehouse.dept_code}` : ''}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {canManageWarehouse && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditWh(detail.warehouse)}
                      className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center space-x-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                  {canCreateWarehouse && (
                    <button
                      type="button"
                      onClick={() => handleToggleWarehouseStatus(detail.warehouse)}
                      className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center space-x-1 cursor-pointer"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{detail.warehouse.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Storage Bins / Locations */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Storage Locations & Bins ({detail.locations.length})</span>
                  </h4>
                  {canManageWarehouse && (
                    <button
                      type="button"
                      onClick={() => setShowLocModal(true)}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] font-semibold text-white flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Bin</span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                      <tr>
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Zone/Rack/Bin</th>
                        <th className="px-3 py-2">Status</th>
                        {canManageWarehouse && <th className="px-3 py-2 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {detail.locations.map((loc) => (
                        <tr key={loc.id} className="hover:bg-slate-800/30">
                          <td className="px-3 py-2 font-mono text-indigo-300 flex items-center space-x-1">
                            <span>{loc.location_code}</span>
                            {loc.is_default && (
                              <span title="System mandatory DEFAULT bin">
                                <Lock className="w-3 h-3 text-amber-400" />
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-200">{loc.name}</td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{loc.location_type}</td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                            {[loc.zone, loc.aisle, loc.rack, loc.bin].filter(Boolean).join(' / ') || '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(loc.status)}`}>
                              {loc.status}
                            </span>
                          </td>
                          {canManageWarehouse && (
                            <td className="px-3 py-2 text-right">
                              {loc.is_default ? (
                                <span className="text-[10px] text-slate-500 font-mono">Locked DEFAULT</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleLocationStatus(loc)}
                                  className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                                >
                                  {loc.status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Warehouse Staff Assignments */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Warehouse Staff Roster ({detail.staff.length})</span>
                  </h4>
                  {canManageWarehouse && (
                    <button
                      type="button"
                      onClick={() => setShowStaffModal(true)}
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Assign Staff</span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
                      <tr>
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Primary</th>
                        <th className="px-3 py-2">Effective</th>
                        <th className="px-3 py-2">Status</th>
                        {canManageWarehouse && <th className="px-3 py-2 text-right">Remove</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {detail.staff.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                            No staff explicitly assigned to this warehouse.
                          </td>
                        </tr>
                      ) : (
                        detail.staff.map((st) => (
                          <tr key={st.id} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2">
                              <div className="text-slate-200 font-medium">{st.full_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                @{st.username} (ID #{st.user_id})
                              </div>
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-indigo-300">{st.staff_role}</td>
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-300">{st.is_primary ? 'Yes' : 'No'}</td>
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                              {String(st.effective_from).slice(0, 10)} → {st.effective_to ? String(st.effective_to).slice(0, 10) : 'Ongoing'}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadgeClass(st.status)}`}>
                                {st.status}
                              </span>
                            </td>
                            {canManageWarehouse && (
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStaff(st.user_id, st.username)}
                                  className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                                  title="Remove warehouse staff assignment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
            </>
          )}
        </div>
      </div>

      {/* Create / Edit Warehouse Modal */}
      {whModalMode && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <form onSubmit={handleSaveWarehouse} className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                {whModalMode === 'create' ? 'Create New Warehouse' : `Edit Warehouse ${whForm.warehouse_code}`}
              </h3>
              <button type="button" onClick={() => setWhModalMode(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Warehouse Code *</label>
                <input
                  type="text"
                  required
                  disabled={whModalMode === 'edit'}
                  value={whForm.warehouse_code}
                  onChange={(e) => setWhForm({ ...whForm, warehouse_code: e.target.value.toUpperCase() })}
                  placeholder="WH-FABRIC-02"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Warehouse Type *</label>
                <select
                  value={whForm.warehouse_type}
                  onChange={(e) => setWhForm({ ...whForm, warehouse_type: e.target.value as WarehouseType })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                >
                  {WAREHOUSE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Warehouse Name *</label>
                <input
                  type="text"
                  required
                  value={whForm.name}
                  onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
                  placeholder="Secondary Fabric Warehouse"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Linked Department</label>
                {departments.length > 0 ? (
                  <select
                    value={whForm.department_id}
                    onChange={(e) => setWhForm({ ...whForm, department_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  >
                    <option value="">None (Central Warehouse)</option>
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
                    value={whForm.department_id}
                    onChange={(e) => setWhForm({ ...whForm, department_id: e.target.value })}
                    placeholder="Department ID (optional)"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  />
                )}
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Manager User</label>
                {usersList.length > 0 ? (
                  <select
                    value={whForm.manager_id}
                    onChange={(e) => setWhForm({ ...whForm, manager_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  >
                    <option value="">Unassigned</option>
                    {usersList
                      .filter((u) => u.is_active)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          @{u.username} - {u.full_name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={1}
                    value={whForm.manager_id}
                    onChange={(e) => setWhForm({ ...whForm, manager_id: e.target.value })}
                    placeholder="Manager User ID"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  />
                )}
              </div>
              <div className="col-span-2 flex items-center space-x-2 pt-1">
                <input
                  id="reqBinTracking"
                  type="checkbox"
                  checked={whForm.require_bin_tracking}
                  onChange={(e) => setWhForm({ ...whForm, require_bin_tracking: e.target.checked })}
                />
                <label htmlFor="reqBinTracking" className="text-slate-300">
                  Require explicit Bin / Location selection on inbound & transfers (otherwise defaults to DEFAULT bin)
                </label>
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={whForm.description}
                  onChange={(e) => setWhForm({ ...whForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setWhModalMode(null)} className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white cursor-pointer">
                {whModalMode === 'create' ? 'Create Warehouse' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Location Modal */}
      {showLocModal && detail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <form onSubmit={handleCreateLocation} className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Add Storage Bin to {detail.warehouse.warehouse_code}</h3>
              <button type="button" onClick={() => setShowLocModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Location Code *</label>
                <input
                  type="text"
                  required
                  value={locForm.location_code}
                  onChange={(e) => setLocForm({ ...locForm, location_code: e.target.value.toUpperCase() })}
                  placeholder="BIN-A-02"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Location Type *</label>
                <select
                  value={locForm.location_type}
                  onChange={(e) => setLocForm({ ...locForm, location_type: e.target.value as Exclude<LocationType, 'DEFAULT'> })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                >
                  {NON_DEFAULT_LOCATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Bin Name *</label>
                <input
                  type="text"
                  required
                  value={locForm.name}
                  onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
                  placeholder="Zone A Rack 1 Bin 02"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Zone</label>
                <input
                  type="text"
                  value={locForm.zone}
                  onChange={(e) => setLocForm({ ...locForm, zone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Aisle</label>
                <input
                  type="text"
                  value={locForm.aisle}
                  onChange={(e) => setLocForm({ ...locForm, aisle: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Rack</label>
                <input
                  type="text"
                  value={locForm.rack}
                  onChange={(e) => setLocForm({ ...locForm, rack: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Bin</label>
                <input
                  type="text"
                  value={locForm.bin}
                  onChange={(e) => setLocForm({ ...locForm, bin: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setShowLocModal(false)} className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer">
                Create Bin
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assign Staff Modal */}
      {showStaffModal && detail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <form onSubmit={handleAssignStaff} className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Assign Staff to {detail.warehouse.warehouse_code}</h3>
              <button type="button" onClick={() => setShowStaffModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">User *</label>
                {usersList.length > 0 ? (
                  <select
                    required
                    value={staffForm.user_id}
                    onChange={(e) => setStaffForm({ ...staffForm, user_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  >
                    <option value="">Select active user...</option>
                    {usersList
                      .filter((u) => u.is_active)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          #{u.id} @{u.username} — {u.full_name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={1}
                    required
                    value={staffForm.user_id}
                    onChange={(e) => setStaffForm({ ...staffForm, user_id: e.target.value })}
                    placeholder="Enter target User ID"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  />
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Warehouse Role *</label>
                <select
                  value={staffForm.staff_role}
                  onChange={(e) => setStaffForm({ ...staffForm, staff_role: e.target.value as WarehouseStaffRole })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Effective From</label>
                <input
                  type="date"
                  value={staffForm.effective_from}
                  onChange={(e) => setStaffForm({ ...staffForm, effective_from: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Effective To (optional)</label>
                <input
                  type="date"
                  value={staffForm.effective_to}
                  onChange={(e) => setStaffForm({ ...staffForm, effective_to: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <input
                  id="staffPrimary"
                  type="checkbox"
                  checked={staffForm.is_primary}
                  onChange={(e) => setStaffForm({ ...staffForm, is_primary: e.target.checked })}
                />
                <label htmlFor="staffPrimary" className="text-slate-300">
                  Primary assigned warehouse for this user
                </label>
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Assignment Notes</label>
                <input
                  type="text"
                  value={staffForm.notes}
                  onChange={(e) => setStaffForm({ ...staffForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setShowStaffModal(false)} className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white cursor-pointer">
                Assign Staff
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
