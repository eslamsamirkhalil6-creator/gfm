import React from 'react';
import { Server, Database, Clock, RefreshCw, Layers, ShieldCheck } from 'lucide-react';
import { HealthCheckData } from '../types/index.ts';

interface StatusBannerProps {
  health: HealthCheckData | null;
  loading: boolean;
  onRefresh: () => void;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({ health, loading, onRefresh }) => {
  const isDbConnected = health?.database?.status === 'CONNECTED';
  const isApiUp = health?.status === 'UP';

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Core Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
          {/* API Server Status */}
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-slate-800 border border-slate-700 text-indigo-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">REST API</p>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isApiUp ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                  }`}
                />
                <span className="text-xs font-semibold text-slate-200">
                  {health ? health.status : 'Connecting...'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Uptime: {health ? `${health.server.uptime_seconds}s` : '0s'}
              </p>
            </div>
          </div>

          {/* PostgreSQL Status */}
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-slate-800 border border-slate-700 text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Database</p>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isDbConnected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                  }`}
                />
                <span className="text-xs font-semibold text-slate-200">
                  {health?.database.status || 'Checking...'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Latency: <span className="text-emerald-400 font-semibold">{health?.database.latency_ms ?? 0}ms</span>
              </p>
            </div>
          </div>

          {/* Engine & Tables */}
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-slate-800 border border-slate-700 text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Storage Engine</p>
              <p className="text-xs font-medium text-slate-200 truncate max-w-[140px]" title={health?.database.engine}>
                {health?.database.mode || 'PostgreSQL'}
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                {health?.database.tables_count ?? 6} Tables | {health?.database.users_count ?? 3} Users
              </p>
            </div>
          </div>

          {/* Server Timestamp */}
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-slate-800 border border-slate-700 text-sky-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Server Time (UTC)</p>
              <p className="text-xs font-mono text-slate-300">
                {health?.server.timestamp ? new Date(health.server.timestamp).toLocaleTimeString() : '--:--:--'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Node {health?.server.node_version || process.version}
              </p>
            </div>
          </div>
        </div>

        {/* Refresh Action */}
        <div className="flex items-center justify-end border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Health Check</span>
          </button>
        </div>
      </div>
    </div>
  );
};
