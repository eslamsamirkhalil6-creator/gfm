import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth.tsx';
import { Navbar, ActiveTab } from './components/Navbar.tsx';
import { StatusBanner } from './components/StatusBanner.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { UsersManagementPage } from './pages/UsersManagementPage.tsx';
import { AuditLogsPage } from './pages/AuditLogsPage.tsx';
import { DiagnosticsPage } from './pages/DiagnosticsPage.tsx';
import { ArchitectureExportPage } from './pages/ArchitectureExportPage.tsx';
import { ProductionModule } from './pages/production/ProductionModule.tsx';
import { DepartmentModule } from './pages/departments/DepartmentModule.tsx';
import { HealthCheckData } from './types/index.ts';
import { ApiService } from './services/api.ts';

const MainLayout: React.FC = () => {
  const { user, loading: authLoading, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [health, setHealth] = useState<HealthCheckData | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);

  const fetchHealth = async () => {
    try {
      setHealthLoading(true);
      const data = await ApiService.getHealth();
      setHealth(data);
    } catch (err: any) {
      console.warn('Health check query failed:', err.message);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, []);

  // Show minimal loading state while restoring session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono">Initializing GFMS Security Context...</p>
        </div>
      </div>
    );
  }

  // Not authenticated -> show login page
  if (!user) {
    return <LoginPage health={health} />;
  }

  // Fallback to dashboard if navigating to unauthorized tab
  const canViewProduction = hasPermission('production:view');
  const canViewDepartments = hasPermission('departments:view');
  const canViewUsers = hasPermission('users:read');
  const canViewAudit = hasPermission('audit:read');

  const currentTab =
    activeTab === 'production' && !canViewProduction
      ? 'dashboard'
      : activeTab === 'departments' && !canViewDepartments
      ? 'dashboard'
      : activeTab === 'users' && !canViewUsers
      ? 'dashboard'
      : activeTab === 'audit' && !canViewAudit
      ? 'dashboard'
      : activeTab;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Industrial Navbar */}
      <Navbar activeTab={currentTab} setActiveTab={setActiveTab} health={health} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Live System Status Banner */}
        <StatusBanner health={health} loading={healthLoading} onRefresh={fetchHealth} />

        {/* View Routing */}
        {currentTab === 'dashboard' && (
          <DashboardPage health={health} setActiveTab={setActiveTab} />
        )}
        {currentTab === 'production' && canViewProduction && <ProductionModule />}
        {currentTab === 'departments' && canViewDepartments && <DepartmentModule />}
        {currentTab === 'users' && canViewUsers && <UsersManagementPage />}
        {currentTab === 'audit' && canViewAudit && <AuditLogsPage />}
        {currentTab === 'diagnostics' && <DiagnosticsPage />}
        {currentTab === 'architecture' && <ArchitectureExportPage />}
      </main>

      {/* Industrial Footer */}
      <footer className="bg-slate-900/60 border-t border-slate-800/80 py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>GFMS v0.3 • Production & Department Management System • PostgreSQL Relational Architecture</span>
          <span>REST API Base: /api • Authenticated via JWT</span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
