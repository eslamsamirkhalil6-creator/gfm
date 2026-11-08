import React, { useState, useEffect } from 'react';
import {
  Building2,
  Layers,
  LayoutDashboard,
  RefreshCw,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { ApiService } from '../../services/api.ts';
import { useAuth } from '../../hooks/useAuth.tsx';
import {
  DepartmentWithDetails,
  DepartmentTreeNode,
  DepartmentStats,
  DepartmentEmployee,
  UserItem,
} from '../../types/index.ts';
import { DepartmentDashboardView } from './DepartmentDashboardView.tsx';
import { DepartmentListView } from './DepartmentListView.tsx';
import { DepartmentHierarchyView } from './DepartmentHierarchyView.tsx';
import { DepartmentDetailModal } from './DepartmentDetailModal.tsx';
import { DepartmentFormModal } from './DepartmentFormModal.tsx';
import { AssignManagerModal } from './AssignManagerModal.tsx';
import { AssignEmployeeModal } from './AssignEmployeeModal.tsx';

type DepartmentSubTab = 'dashboard' | 'directory' | 'hierarchy';

export const DepartmentModule: React.FC = () => {
  const { hasPermission } = useAuth();

  const canCreate = hasPermission('departments:create');
  const canEdit = hasPermission('departments:edit');
  const canStatus = hasPermission('departments:status');
  const canManageManager = hasPermission('departments:manage_manager');
  const canManageEmployees = hasPermission('departments:manage_employees');

  const [activeSubTab, setActiveSubTab] = useState<DepartmentSubTab>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<DepartmentStats | null>(null);
  const [departments, setDepartments] = useState<DepartmentWithDetails[]>([]);
  const [tree, setTree] = useState<DepartmentTreeNode[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);

  // Modals state
  const [selectedDetailDept, setSelectedDetailDept] = useState<DepartmentWithDetails | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentWithDetails | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<number | null>(null);

  const [assignManagerDept, setAssignManagerDept] = useState<DepartmentWithDetails | null>(null);
  const [assignEmployeeDept, setAssignEmployeeDept] = useState<DepartmentWithDetails | null>(null);
  const [transferringEmployee, setTransferringEmployee] = useState<DepartmentEmployee | null>(null);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, deptsData, treeData, usersData] = await Promise.all([
        ApiService.getDepartmentStats(),
        ApiService.getDepartments(),
        ApiService.getDepartmentTree(),
        ApiService.getUsers().catch(() => []),
      ]);

      setStats(statsData);
      setDepartments(deptsData);
      setTree(treeData);
      setUsers(usersData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load department module data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleToggleStatus = async (dept: DepartmentWithDetails) => {
    try {
      await ApiService.toggleDepartmentStatus(dept.id);
      await loadAllData();
    } catch (err: any) {
      alert(`Error toggling department status: ${err.message}`);
    }
  };

  const handleDelete = async (dept: DepartmentWithDetails) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete department "${dept.name}" [${dept.dept_code}]?\n\nNote: Departments with historical records, assigned staff, or sub-departments cannot be deleted (deactivation must be used instead).`
      )
    ) {
      return;
    }

    try {
      await ApiService.deleteDepartment(dept.id);
      await loadAllData();
    } catch (err: any) {
      alert(`Delete rejected: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Navigation Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-800 flex items-center justify-center text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Department Management Module</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Organizational structure, department hierarchy, manager appointments, and staff allocations
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadAllData}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Refresh</span>
            </button>

            {canCreate && (
              <button
                onClick={() => {
                  setEditingDept(null);
                  setDefaultParentId(null);
                  setFormModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>New Department</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-Tabs Nav */}
        <div className="flex items-center space-x-2 mt-5 border-t border-slate-800 pt-3">
          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'dashboard'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" />
            <span>Overview & Dashboard</span>
          </button>

          <button
            onClick={() => setActiveSubTab('directory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'directory'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Departments Directory</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 ml-1">
              {departments.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('hierarchy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'hierarchy'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Organizational Hierarchy</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg flex items-start space-x-2 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* View Switcher */}
      {activeSubTab === 'dashboard' && (
        <DepartmentDashboardView
          stats={stats}
          departments={departments}
          loading={loading}
          onNavigateTab={(tab) => setActiveSubTab(tab)}
          onSelectDepartment={(dept) => setSelectedDetailDept(dept)}
        />
      )}

      {activeSubTab === 'directory' && (
        <DepartmentListView
          departments={departments}
          loading={loading}
          canCreate={canCreate}
          canEdit={canEdit}
          canStatus={canStatus}
          canManageManager={canManageManager}
          canManageEmployees={canManageEmployees}
          onOpenCreate={() => {
            setEditingDept(null);
            setDefaultParentId(null);
            setFormModalOpen(true);
          }}
          onOpenEdit={(dept) => {
            setEditingDept(dept);
            setDefaultParentId(null);
            setFormModalOpen(true);
          }}
          onOpenDetail={(dept) => setSelectedDetailDept(dept)}
          onOpenAssignManager={(dept) => setAssignManagerDept(dept)}
          onOpenAssignEmployee={(dept) => {
            setAssignEmployeeDept(dept);
            setTransferringEmployee(null);
          }}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
        />
      )}

      {activeSubTab === 'hierarchy' && (
        <DepartmentHierarchyView
          tree={tree}
          loading={loading}
          canCreate={canCreate}
          onOpenCreateChild={(parent) => {
            setEditingDept(null);
            setDefaultParentId(parent.id);
            setFormModalOpen(true);
          }}
          onSelectDepartment={(dept) => setSelectedDetailDept(dept)}
        />
      )}

      {/* Modals */}
      {selectedDetailDept && (
        <DepartmentDetailModal
          department={selectedDetailDept}
          canManageManager={canManageManager}
          canManageEmployees={canManageEmployees}
          onClose={() => setSelectedDetailDept(null)}
          onOpenAssignManager={(dept) => {
            setSelectedDetailDept(null);
            setAssignManagerDept(dept);
          }}
          onOpenAssignEmployee={(dept) => {
            setSelectedDetailDept(null);
            setAssignEmployeeDept(dept);
            setTransferringEmployee(null);
          }}
          onOpenTransferEmployee={(dept, emp) => {
            setSelectedDetailDept(null);
            setAssignEmployeeDept(dept);
            setTransferringEmployee(emp);
          }}
          onRefreshParent={loadAllData}
        />
      )}

      {formModalOpen && (
        <DepartmentFormModal
          initialDept={editingDept}
          defaultParentId={defaultParentId}
          departments={departments}
          users={users}
          canManageManager={canManageManager}
          canManageHierarchy={hasPermission('departments:hierarchy')}
          onClose={() => {
            setFormModalOpen(false);
            setEditingDept(null);
            setDefaultParentId(null);
          }}
          onSuccess={() => {
            setFormModalOpen(false);
            setEditingDept(null);
            setDefaultParentId(null);
            loadAllData();
          }}
        />
      )}

      {assignManagerDept && (
        <AssignManagerModal
          department={assignManagerDept}
          users={users}
          onClose={() => setAssignManagerDept(null)}
          onSuccess={() => {
            setAssignManagerDept(null);
            loadAllData();
          }}
        />
      )}

      {assignEmployeeDept && (
        <AssignEmployeeModal
          department={assignEmployeeDept}
          departments={departments}
          users={users}
          transferEmployee={transferringEmployee}
          onClose={() => {
            setAssignEmployeeDept(null);
            setTransferringEmployee(null);
          }}
          onSuccess={() => {
            setAssignEmployeeDept(null);
            setTransferringEmployee(null);
            loadAllData();
          }}
        />
      )}
    </div>
  );
};
