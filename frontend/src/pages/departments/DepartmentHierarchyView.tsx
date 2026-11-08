import React, { useState } from 'react';
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Building2,
  Users,
  UserCheck,
  UserX,
  Shield,
  Info,
  CornerDownRight,
  Eye,
  Plus,
} from 'lucide-react';
import { DepartmentTreeNode, DepartmentWithDetails } from '../../types/index.ts';

interface DepartmentHierarchyViewProps {
  tree: DepartmentTreeNode[];
  loading: boolean;
  canCreate: boolean;
  onOpenCreateChild: (parent: DepartmentWithDetails) => void;
  onSelectDepartment: (dept: DepartmentWithDetails) => void;
}

export const DepartmentHierarchyView: React.FC<DepartmentHierarchyViewProps> = ({
  tree,
  loading,
  canCreate,
  onOpenCreateChild,
  onSelectDepartment,
}) => {
  const [collapsedMap, setCollapsedMap] = useState<Record<number, boolean>>({});

  const toggleCollapse = (id: number) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNode = (node: DepartmentTreeNode, depth = 0) => {
    const isCollapsed = collapsedMap[node.id];
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="relative select-none">
        <div
          className={`flex items-center justify-between p-3.5 my-1.5 rounded-xl border transition-all ${
            depth === 0
              ? 'bg-slate-900 border-slate-800 shadow-sm'
              : 'bg-slate-950/70 border-slate-850 hover:border-slate-700'
          }`}
          style={{ marginLeft: `${depth * 28}px` }}
        >
          {/* Node Left: Expand button, code, name, and hierarchy indicator */}
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {hasChildren ? (
              <button
                onClick={() => toggleCollapse(node.id)}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-indigo-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-indigo-400" />
                )}
              </button>
            ) : depth > 0 ? (
              <CornerDownRight className="w-4 h-4 text-slate-600 shrink-0 ml-1" />
            ) : (
              <div className="w-6 h-6 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-slate-500" />
              </div>
            )}

            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-indigo-300 shrink-0">
              {node.dept_code}
            </span>

            <div
              onClick={() => onSelectDepartment(node)}
              className="cursor-pointer group flex-1 min-w-0"
            >
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors truncate">
                  {node.name}
                </span>
                {node.status === 'inactive' && (
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800/80">
                    Inactive
                  </span>
                )}
              </div>
              {node.description && (
                <p className="text-[11px] text-slate-400 truncate max-w-lg mt-0.5">
                  {node.description}
                </p>
              )}
            </div>
          </div>

          {/* Node Right: Manager, Staff count, and action buttons */}
          <div className="flex items-center space-x-4 shrink-0 text-xs">
            {/* Manager Pill */}
            {node.manager_name ? (
              <div className="flex items-center space-x-1.5 bg-slate-850 px-2.5 py-1 rounded-md border border-slate-800">
                <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[11px] text-slate-300 font-medium truncate max-w-[140px]">
                  {node.manager_name}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 bg-amber-950/40 px-2 py-1 rounded-md border border-amber-900/60 text-amber-400 text-[10px]">
                <UserX className="w-3 h-3" />
                <span>Vacant</span>
              </div>
            )}

            {/* Staff Count */}
            <div
              className="flex items-center space-x-1 text-slate-400 font-mono text-[11px]"
              title="Assigned Department Staff"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{node.employee_count}</span>
            </div>

            {/* Inspect Button */}
            <button
              onClick={() => onSelectDepartment(node)}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Inspect Department Details"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>

            {/* Add Sub-department button */}
            {canCreate && (
              <button
                onClick={() => onOpenCreateChild(node)}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                title={`Add Sub-Department under ${node.name}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Children Render */}
        {hasChildren && !isCollapsed && (
          <div className="relative">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Informational Architecture Banner (Section 5) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start space-x-3 text-xs">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-slate-300 space-y-1">
          <p>
            <strong className="text-white">Hierarchical Department Architecture:</strong> Sub-departments represent operational functional divisions (e.g., <code className="text-indigo-300 font-mono">DEP-PROD</code> branches into <code className="text-indigo-300 font-mono">DEP-CUT</code>, <code className="text-indigo-300 font-mono">DEP-SEW</code>, <code className="text-indigo-300 font-mono">DEP-PCK</code>).
          </p>
          <p className="text-slate-400 text-[11px]">
            Organizational hierarchy is distinct from physical production halls and line machines. Department managers oversee functions based on assigned RBAC permissions without automatic privilege inheritance.
          </p>
        </div>
      </div>

      {/* Tree Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Factory Organizational Chart
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            {tree.length} Root Divisions
          </span>
        </div>

        {loading && tree.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <div className="inline-block w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs">Building hierarchical tree from PostgreSQL...</p>
          </div>
        ) : tree.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No departments found.
          </div>
        ) : (
          <div className="space-y-1">
            {tree.map((rootNode) => renderNode(rootNode, 0))}
          </div>
        )}
      </div>
    </div>
  );
};
