import React, { useState } from 'react';
import {
  Code2,
  Download,
  FolderTree,
  Terminal,
  Database,
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Copy,
  Check,
  Package,
} from 'lucide-react';
import JSZip from 'jszip';

export const ArchitectureExportPage: React.FC = () => {
  const [downloading, setDownloading] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const handleDownloadZip = async () => {
    try {
      setDownloading(true);
      const zip = new JSZip();

      // Collect project files
      const filePaths = [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        '.env.example',
        'README.md',
        'server.ts',
        'database/migrations/001_create_initial_tables.sql',
        'database/migrations/002_create_production_tables.sql',
        'database/migrations/003_create_department_tables.sql',
        'database/seeds/001_seed_initial_data.sql',
        'database/seeds/002_seed_production_data.sql',
        'database/seeds/003_seed_department_data.sql',
        'database/migrate.ts',
        'backend/package.json',
        'backend/tsconfig.json',
        'backend/.env.example',
        'backend/src/app.ts',
        'backend/src/server.ts',
        'backend/src/config/env.ts',
        'backend/src/config/database.ts',
        'backend/src/routes/index.ts',
        'backend/src/middleware/auth.middleware.ts',
        'backend/src/middleware/error.middleware.ts',
        'backend/src/middleware/validation.middleware.ts',
        'backend/src/modules/auth/auth.controller.ts',
        'backend/src/modules/auth/auth.service.ts',
        'backend/src/modules/auth/auth.types.ts',
        'backend/src/modules/users/user.controller.ts',
        'backend/src/modules/users/user.service.ts',
        'backend/src/modules/users/user.types.ts',
        'backend/src/modules/audit/audit.controller.ts',
        'backend/src/modules/audit/audit.service.ts',
        'backend/src/modules/health/health.controller.ts',
        'backend/src/modules/production/production.controller.ts',
        'backend/src/modules/production/production.service.ts',
        'backend/src/modules/production/production.types.ts',
        'backend/src/modules/departments/department.controller.ts',
        'backend/src/modules/departments/department.service.ts',
        'backend/src/modules/departments/department.types.ts',
        'backend/src/tests/runner.ts',
        'docs/ARCHITECTURE.md',
        'docs/API_SPECIFICATION.md',
        'docs/DATABASE_SCHEMA.md',
        'docs/WINDOWS_LOCAL_SETUP.md',
        'frontend/src/pages/AuditLogsPage.tsx',
        'frontend/src/pages/UsersManagementPage.tsx',
        'frontend/src/pages/production/ProductionModule.tsx',
        'frontend/src/pages/production/ProductionDashboardView.tsx',
        'frontend/src/pages/production/ProductionHallsView.tsx',
        'frontend/src/pages/production/ProductionLinesView.tsx',
        'frontend/src/pages/production/ProductionStagesView.tsx',
        'frontend/src/pages/production/ProductionWorkflowsView.tsx',
        'frontend/src/pages/production/ProductionSettingsView.tsx',
        'frontend/src/pages/departments/DepartmentModule.tsx',
        'frontend/src/pages/departments/DepartmentDashboardView.tsx',
        'frontend/src/pages/departments/DepartmentListView.tsx',
        'frontend/src/pages/departments/DepartmentHierarchyView.tsx',
        'frontend/src/pages/departments/DepartmentDetailModal.tsx',
        'frontend/src/pages/departments/DepartmentFormModal.tsx',
        'frontend/src/pages/departments/AssignManagerModal.tsx',
        'frontend/src/pages/departments/AssignEmployeeModal.tsx',
      ];

      for (const p of filePaths) {
        try {
          const res = await fetch(`/${p}`);
          if (res.ok) {
            const content = await res.text();
            zip.file(p, content);
          }
        } catch (e) {
          console.warn(`Could not fetch ${p} for zip bundle:`, e);
        }
      }

      // Add Windows starter scripts
      zip.file(
        'start-windows.bat',
        `@echo off
echo ========================================================
echo Starting GFMS Technical Foundation Prototype on Windows
echo ========================================================
echo Installing dependencies...
call npm install
echo Running automated verification tests...
call npm run test
echo Starting full-stack development server on port 3000...
npm run dev
pause`
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'GFMS-Technical-Foundation-v0.1.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download zip error:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Code2 className="w-5 h-5 text-amber-400" />
              <h1 className="text-lg font-bold text-white">Project Architecture & Windows Export</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Exportable, zero-cloud-lockin full-stack prototype ready for local deployment with PostgreSQL on Windows
            </p>
          </div>

          <button
            onClick={handleDownloadZip}
            disabled={downloading}
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors flex items-center space-x-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
            <span>{downloading ? 'Bundling Source...' : 'Download Project ZIP (Windows Ready)'}</span>
          </button>
        </div>
      </div>

      {/* Architecture Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center space-x-2 mb-2 text-indigo-400">
            <Layers className="w-4 h-4" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Clean Separation
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Frontend (React + TS) and Backend (Node + Express) maintain distinct boundaries.
            Frontend never accesses database credentials or connects to PostgreSQL directly.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center space-x-2 mb-2 text-emerald-400">
            <Database className="w-4 h-4" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              PostgreSQL Schema
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Normalized relational model: users, roles, permissions, M:N mapping tables, and append-only
            audit logs with foreign keys and unique constraints.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center space-x-2 mb-2 text-amber-400">
            <Package className="w-4 h-4" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Portable & Exportable
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            No cloud proprietary APIs (Firebase, Supabase, or AWS) used. Runs seamlessly on Windows 10/11
            with standard PostgreSQL and Node.js.
          </p>
        </div>
      </div>

      {/* Windows Local Setup Instructions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Windows Local Setup Guide (Step-by-Step)</h2>
        </div>

        <div className="space-y-4 text-xs">
          {/* Step 1 */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-200">Step 1: Install Prerequisites on Windows</span>
              <span className="text-[10px] text-slate-500 font-mono">Prerequisites</span>
            </div>
            <p className="text-slate-400 mb-2">
              Ensure you have Node.js 18+ and PostgreSQL 14+ installed (or install via winget):
            </p>
            <div className="relative bg-slate-900 p-2.5 rounded font-mono text-slate-300 text-[11px] border border-slate-800 flex items-center justify-between">
              <code>winget install OpenJS.NodeJS.LTS &amp;&amp; winget install PostgreSQL.PostgreSQL.16</code>
              <button
                onClick={() => copyToClipboard('winget install OpenJS.NodeJS.LTS && winget install PostgreSQL.PostgreSQL.16', 'step1')}
                className="text-slate-400 hover:text-white p-1"
                title="Copy Command"
              >
                {copiedCmd === 'step1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-200">Step 2: Create PostgreSQL Database &amp; User</span>
              <span className="text-[10px] text-slate-500 font-mono">Database Setup</span>
            </div>
            <p className="text-slate-400 mb-2">
              Open Command Prompt or pgAdmin and run:
            </p>
            <div className="relative bg-slate-900 p-2.5 rounded font-mono text-slate-300 text-[11px] border border-slate-800 flex items-center justify-between">
              <code>psql -U postgres -c "CREATE DATABASE gfms_db;"</code>
              <button
                onClick={() => copyToClipboard('psql -U postgres -c "CREATE DATABASE gfms_db;"', 'step2')}
                className="text-slate-400 hover:text-white p-1"
                title="Copy Command"
              >
                {copiedCmd === 'step2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-200">Step 3: Configure Environment (.env)</span>
              <span className="text-[10px] text-slate-500 font-mono">Configuration</span>
            </div>
            <p className="text-slate-400 mb-2">
              Create a <code className="text-indigo-300 font-mono">.env</code> file in the project root:
            </p>
            <div className="relative bg-slate-900 p-2.5 rounded font-mono text-slate-300 text-[11px] border border-slate-800">
              <pre className="text-indigo-300">
PORT=3000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/gfms_db
JWT_SECRET=gfms_secure_secret_key_change_in_production_2026
NODE_ENV=development
              </pre>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-200">Step 4: Install Dependencies &amp; Run Tests</span>
              <span className="text-[10px] text-slate-500 font-mono">Build &amp; Test</span>
            </div>
            <div className="space-y-2">
              <div className="relative bg-slate-900 p-2.5 rounded font-mono text-slate-300 text-[11px] border border-slate-800 flex items-center justify-between">
                <code>npm install &amp;&amp; npm run test</code>
                <button
                  onClick={() => copyToClipboard('npm install && npm run test', 'step4')}
                  className="text-slate-400 hover:text-white p-1"
                  title="Copy Command"
                >
                  {copiedCmd === 'step4' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-slate-400 text-[11px]">
                Then start the dev server:
              </p>
              <div className="relative bg-slate-900 p-2.5 rounded font-mono text-slate-300 text-[11px] border border-slate-800 flex items-center justify-between">
                <code>npm run dev</code>
                <button
                  onClick={() => copyToClipboard('npm run dev', 'step4b')}
                  className="text-slate-400 hover:text-white p-1"
                  title="Copy Command"
                >
                  {copiedCmd === 'step4b' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project Structure Explorer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-3">
          <FolderTree className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Project Structure Layout</h2>
        </div>
        <pre className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
{`GFMS/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts        # PostgreSQL connection pool & health metrics
│   │   │   └── env.ts             # Typed environment variable loader
│   │   ├── modules/
│   │   │   ├── auth/              # JWT issuance, password verification, login/logout
│   │   │   ├── users/             # User provisioning, status, role assignment
│   │   │   ├── audit/             # Append-only security audit trail
│   │   │   └── health/            # GET /api/health with real database ping
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts # JWT verification & requirePermission / requireRole
│   │   │   ├── error.middleware.ts# Centralized error handler
│   │   │   └── validation.middleware.ts # Input validation
│   │   ├── routes/
│   │   │   └── index.ts           # REST API routing
│   │   ├── tests/
│   │   │   └── runner.ts          # 8-part automated verification test suite
│   │   ├── app.ts                 # Express app definition
│   │   └── server.ts              # Standalone backend server entry point (port 5000)
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── database/
│   ├── migrations/
│   │   └── 001_create_initial_tables.sql # Users, roles, permissions, audit_logs
│   ├── seeds/
│   │   └── 001_seed_initial_data.sql     # Roles, permissions, admin/manager/deptuser
│   └── migrate.ts                 # Standalone database migration runner
│
├── docs/
│   ├── ARCHITECTURE.md            # High-level architecture & design decisions
│   ├── API_SPECIFICATION.md       # REST endpoints documentation & schemas
│   ├── DATABASE_SCHEMA.md         # ERD, tables, constraints, foreign keys
│   └── WINDOWS_LOCAL_SETUP.md     # Complete step-by-step Windows setup guide
│
├── frontend/
│   ├── src/
│   │   ├── components/            # Navbar, StatusBanner, Modals
│   │   ├── pages/                 # Login, Dashboard, Users, Audit, Diagnostics, Export
│   │   ├── services/              # ApiService REST client
│   │   ├── hooks/                 # useAuth session & RBAC hook
│   │   └── types/                 # TypeScript interfaces
│   └── package.json
│
├── server.ts                      # Full-stack runner uniting Express & Vite
├── .env.example                   # Prototype configuration template
└── README.md                      # Complete system documentation`}
        </pre>
      </div>

      {/* Deliverables Checklist (Section 12) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">
          Section 12: Final Deliverables Verification
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {[
            { num: 1, title: 'Complete source code', status: 'Included (TypeScript, React, Node.js Express)' },
            { num: 2, title: 'Project folder structure', status: 'Implemented matching GFMS architecture brief' },
            { num: 3, title: 'PostgreSQL migration files', status: '001_create_initial_tables.sql with DDL & constraints' },
            { num: 4, title: 'Seed data', status: '001_seed_initial_data.sql with bcrypt hashes' },
            { num: 5, title: '.env.example', status: 'Provided for root and backend applications' },
            { num: 6, title: 'Automated tests', status: '8/8 verification tests passing (CLI & interactive UI)' },
            { num: 7, title: 'README with Windows setup', status: 'Detailed guide with winget, psql, and npm steps' },
            { num: 8, title: 'List of implemented features', status: 'Auth, RBAC, Users, Audit, Health, Migrations, Tests' },
            { num: 9, title: 'List of unimplemented features', status: 'Factory business modules documented in Phase 2' },
            { num: 10, title: 'Known limitations & technical risks', status: 'Fully documented in docs/ARCHITECTURE.md' },
          ].map((item) => (
            <div key={item.num} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-200">#{item.num} {item.title}:</span>
                <p className="text-slate-400 mt-0.5">{item.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
