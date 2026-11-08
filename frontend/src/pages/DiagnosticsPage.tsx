import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Play,
  RefreshCw,
  Terminal,
  ShieldAlert,
  Clock,
  Database,
  Lock,
} from 'lucide-react';
import { ApiService } from '../services/api.ts';
import { TestSuiteResult } from '../types/index.ts';

export const DiagnosticsPage: React.FC = () => {
  const [suite, setSuite] = useState<TestSuiteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTests = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.runTests();
      setSuite(data);
    } catch (err: any) {
      setError(err.message || 'Failed to execute test suite');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h1 className="text-lg font-bold text-white">Automated Verification Suite</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Validates the 8 core pillars of the GFMS technical foundation against live PostgreSQL
            </p>
          </div>

          <button
            onClick={runTests}
            disabled={loading}
            className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors flex items-center space-x-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Executing Suite...' : 'Re-run All Tests'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg flex items-start space-x-2 text-xs text-rose-300">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Scorecard */}
      {suite && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">Overall Result</span>
            <div className="flex items-center space-x-1.5 mt-1">
              {suite.allPassed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">ALL PASSED</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span className="text-sm font-bold text-rose-400">{suite.failed} FAILED</span>
                </>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">Pass Rate</span>
            <p className="text-sm font-bold text-slate-100 mt-1">
              {suite.passed} / {suite.total} ({Math.round((suite.passed / suite.total) * 100)}%)
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">Total Duration</span>
            <p className="text-sm font-bold font-mono text-indigo-400 mt-1">
              {suite.totalDurationMs} ms
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">CLI Equivalent</span>
            <p className="text-xs font-mono text-slate-300 mt-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 inline-block">
              npm run test
            </p>
          </div>
        </div>
      )}

      {/* Test Results List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Automated Test Matrix (Section 10 Requirements)
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            {suite ? `Executed at: ${new Date(suite.timestamp).toLocaleTimeString()}` : 'Running...'}
          </span>
        </div>

        <div className="divide-y divide-slate-800">
          {loading && !suite ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <div className="inline-block w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-2" />
              <p>Executing test cases against PostgreSQL engine...</p>
            </div>
          ) : (
            suite?.results.map((test) => {
              const isPassed = test.status === 'PASSED';
              return (
                <div key={test.id} className="p-4 sm:px-6 hover:bg-slate-850/40 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {isPassed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-white">
                            #{test.id} {test.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {test.category}
                          </span>
                        </div>
                        {test.details && (
                          <p className="text-xs text-slate-400 mt-1 font-mono leading-relaxed">
                            {test.details}
                          </p>
                        )}
                        {test.error && (
                          <p className="text-xs text-rose-400 mt-1 font-mono bg-rose-950/40 p-2 rounded border border-rose-900/60">
                            ERROR: {test.error}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 self-end sm:self-center">
                      <span className="text-[11px] font-mono text-slate-400">
                        {test.durationMs}ms
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                          isPassed
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border-rose-800'
                        }`}
                      >
                        {test.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
