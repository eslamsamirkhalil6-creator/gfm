import React, { useState } from 'react';
import {
  Factory,
  Shield,
  Lock,
  User,
  AlertCircle,
  Database,
  Server,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';
import { HealthCheckData } from '../types/index.ts';

interface LoginPageProps {
  health: HealthCheckData | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({ health }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Please provide both username and password');
      return;
    }

    try {
      setLoading(true);
      await login(username.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  const isDbConnected = health?.database?.status === 'CONNECTED';
  const isApiUp = health?.status === 'UP';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      {/* Brand & Title */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex p-3 bg-indigo-600 rounded-xl text-white shadow-lg mb-4 ring-8 ring-indigo-900/30">
          <Factory className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Garment Factory Management System
        </h1>
        <p className="mt-1 text-xs text-indigo-400 font-mono font-medium uppercase tracking-wider">
          GFMS Technical Foundation Prototype v0.1
        </p>
      </div>

      {/* Main Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white">System Authentication</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your factory credentials or select a sample role below
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin, manager, or deptuser"
                  className="w-full bg-slate-950 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating via PostgreSQL...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick-Fill Preset Buttons */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Quick Test Credentials:
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => fillCredentials('admin', 'Admin@123')}
                className="w-full text-left p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-600/60 hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                      System Administrator
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/40 font-mono">
                      admin
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Full control, user management, audit review</p>
                </div>
                <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Fill →
                </span>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('manager', 'Manager@123')}
                className="w-full text-left p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-600/60 hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                      Factory Manager
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40 font-mono">
                      manager
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Floor dashboard & workforce viewing</p>
                </div>
                <span className="text-xs text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Fill →
                </span>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('deptuser', 'Dept@123')}
                className="w-full text-left p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-600/60 hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                      Department User
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-800/40 font-mono">
                      deptuser
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Restricted basic operational view only</p>
                </div>
                <span className="text-xs text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Fill →
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Health Indicator Footer */}
        <div className="mt-4 p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>API:</span>
            <span className={isApiUp ? 'text-emerald-400 font-medium' : 'text-rose-400'}>
              {health?.status || 'Connecting'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>PostgreSQL:</span>
            <span className={isDbConnected ? 'text-emerald-400 font-medium' : 'text-rose-400'}>
              {health?.database.status || 'Checking'} ({health?.database.latency_ms ?? 0}ms)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
