import React, { useState } from 'react';
import {
  Factory,
  Layers,
  ShieldCheck,
  GitBranch,
  Sliders,
  BarChart3,
} from 'lucide-react';
import { ProductionDashboardView } from './ProductionDashboardView.tsx';
import { ProductionHallsView } from './ProductionHallsView.tsx';
import { ProductionLinesView } from './ProductionLinesView.tsx';
import { ProductionStagesView } from './ProductionStagesView.tsx';
import { ProductionWorkflowsView } from './ProductionWorkflowsView.tsx';
import { ProductionSettingsView } from './ProductionSettingsView.tsx';

export type ProductionSubTab = 'dashboard' | 'halls' | 'lines' | 'stages' | 'workflows' | 'settings';

export const ProductionModule: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<ProductionSubTab>('dashboard');

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Tabs */}
      <div className="border-b border-slate-800 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Production Dashboard</span>
          </button>

          <button
            onClick={() => setActiveSubTab('halls')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'halls'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Factory className="w-3.5 h-3.5" />
            <span>Production Halls</span>
          </button>

          <button
            onClick={() => setActiveSubTab('lines')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'lines'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Production Lines</span>
          </button>

          <button
            onClick={() => setActiveSubTab('stages')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'stages'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Production Stages</span>
          </button>

          <button
            onClick={() => setActiveSubTab('workflows')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'workflows'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Production Workflows</span>
          </button>

          <button
            onClick={() => setActiveSubTab('settings')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Production Settings</span>
          </button>
        </div>
      </div>

      {/* Render Active View */}
      {activeSubTab === 'dashboard' && (
        <ProductionDashboardView onNavigateTab={(tab) => setActiveSubTab(tab)} />
      )}
      {activeSubTab === 'halls' && <ProductionHallsView />}
      {activeSubTab === 'lines' && <ProductionLinesView />}
      {activeSubTab === 'stages' && <ProductionStagesView />}
      {activeSubTab === 'workflows' && <ProductionWorkflowsView />}
      {activeSubTab === 'settings' && <ProductionSettingsView />}
    </div>
  );
};
