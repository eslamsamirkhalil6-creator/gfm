import React, { useState, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  RefreshCw,
  Filter,
  AlertCircle,
  Clock,
  Terminal,
  Search,
} from 'lucide-react';
import { ApiService } from '../services/api.ts';
import { AuditLogItem } from '../types/index.ts';

// Intl.DateTimeFormat formatter configured for local factory time (Africa/Cairo)
const factoryTimeFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export const formatFactoryTime = (dateString: string): string => {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return factoryTimeFormatter.format(d);
  } catch {
    return dateString;
  }
};

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ApiService.getAuditLogs({
        action: actionFilter || undefined,
        limit: 100,
      });
      setLogs(res.logs);
      setTotal(res.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve audit trail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase();
    return (
      (log.username && log.username.toLowerCase().includes(q)) ||
      log.action.toLowerCase().includes(q) ||
      log.entity_type.toLowerCase().includes(q) ||
      (log.entity_id && log.entity_id.toLowerCase().includes(q)) ||
      (log.details && log.details.toLowerCase().includes(q)) ||
      (log.ip_address && log.ip_address.includes(q))
    );
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'LOGIN_SUCCESS':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800/80';
      case 'LOGIN_FAILED':
      case 'LOGIN_BLOCKED_INACTIVE':
        return 'bg-rose-950 text-rose-300 border-rose-800/80';
      case 'USER_CREATE':
        return 'bg-indigo-950 text-indigo-300 border-indigo-800/80';
      case 'USER_STATUS_UPDATE':
      case 'USER_ROLES_UPDATE':
      case 'ROLE_ASSIGN':
        return 'bg-amber-950 text-amber-300 border-amber-800/80';
      case 'LOGOUT':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'SYSTEM_INIT':
        return 'bg-purple-950 text-purple-300 border-purple-800/80';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <h1 className="text-lg font-bold text-white">System Security & Audit Trail</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Immutable ledger of authentication attempts, administrative interventions, and role mutations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            <div
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-slate-800/80 border border-slate-700 text-xs text-slate-300"
              title="All event timestamps are converted to local factory time zone"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Factory Time:</span>
              <span className="font-mono font-semibold text-white">Africa/Cairo</span>
            </div>

            <button
              onClick={fetchLogs}
              disabled={loading}
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Refresh Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* Compliance / Immutability Guarantee Notice */}
      <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-900/50 flex items-start space-x-3 text-xs text-indigo-200">
        <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">Backend-Authoritative Append-Only Storage: </span>
          <span>
            Every administrative mutation and login event is written directly to PostgreSQL.
            Audit logs cannot be updated or deleted by normal users or client API requests.
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg flex items-start space-x-2 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="">All Audit Actions ({total})</option>
            <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
            <option value="LOGIN_FAILED">LOGIN_FAILED</option>
            <option value="USER_CREATE">USER_CREATE</option>
            <option value="USER_STATUS_UPDATE">USER_STATUS_UPDATE</option>
            <option value="ROLE_ASSIGN">ROLE_ASSIGN</option>
            <option value="USER_ROLES_UPDATE">USER_ROLES_UPDATE</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="SYSTEM_INIT">SYSTEM_INIT</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, actor, details..."
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Log ID</th>
                <th className="py-3 px-4">
                  <div className="flex items-center space-x-1">
                    <span>Timestamp</span>
                    <span className="text-[9px] text-indigo-400 font-mono font-normal normal-case">(Africa/Cairo)</span>
                  </div>
                </th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor / Subject</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Event Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono text-[11px]">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    <div className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading audit ledger from PostgreSQL...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    No audit records matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-3 px-4 text-slate-400">#{log.id}</td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      <div title={`Raw UTC received from backend: ${log.created_at}`}>
                        <span className="text-slate-200 font-mono font-medium">{formatFactoryTime(log.created_at)}</span>
                        <span className="text-[9px] text-slate-500 block font-sans">Africa/Cairo</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-sans font-semibold border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {log.username ? (
                        <div className="font-sans">
                          <span className="text-white font-medium">@{log.username}</span>
                          {log.user_full_name && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {log.user_full_name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 font-sans italic">System / Anonymous</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans">
                      <span className="text-indigo-400 font-mono text-[10px]">{log.entity_type}</span>
                      {log.entity_id && (
                        <span className="text-slate-400 text-[10px] font-mono ml-1">
                          [{log.entity_id}]
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{log.ip_address || '127.0.0.1'}</td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate" title={log.details || ''}>
                      {log.details || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
