import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PaginationMeta } from '../../types/index.ts';

export const statusBadgeClass = (status: string): string => {
  const s = (status || '').toUpperCase();
  if (['ACTIVE', 'AVAILABLE', 'POSTED', 'APPROVED', 'COMPLETED', 'RECEIVED', 'FULFILLED', 'PASSED'].includes(s)) {
    return 'bg-emerald-950 text-emerald-400 border-emerald-800/50';
  }
  if (['DRAFT', 'OPEN', 'INFO'].includes(s)) {
    return 'bg-slate-800 text-slate-300 border-slate-700';
  }
  if (['SUBMITTED', 'PURCHASING_REVIEWED', 'IN_PROGRESS', 'PARTIALLY_ISSUED', 'IN_TRANSIT', 'DISPATCHED', 'RESERVED'].includes(s)) {
    return 'bg-indigo-950 text-indigo-300 border-indigo-800/50';
  }
  if (['QUARANTINE', 'HOLD', 'PENDING_APPROVAL', 'URGENT', 'WARNING', 'RECEIVED_WITH_DISCREPANCY', 'PARTIAL', 'PARTIALLY_PASSED', 'PENDING'].includes(s)) {
    return 'bg-amber-950 text-amber-300 border-amber-800/50';
  }
  if (['INACTIVE', 'REJECTED', 'CANCELLED', 'DAMAGED', 'SCRAP', 'CRITICAL', 'FAILED'].includes(s)) {
    return 'bg-rose-950 text-rose-400 border-rose-800/50';
  }
  return 'bg-slate-800 text-slate-300 border-slate-700';
};

export const formatQty = (val: string | number | null | undefined): string => {
  const n = Number(val ?? 0);
  if (Number.isNaN(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

export const formatCurrency = (val: string | number | null | undefined): string => {
  const n = Number(val ?? 0);
  if (Number.isNaN(n)) return '$0.00';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const parseAttributesObject = (raw: Record<string, any> | string | null | undefined): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
};

interface PaginationBarProps {
  pagination: PaginationMeta;
  onPageChange: (nextOffset: number) => void;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({ pagination, onPageChange }) => {
  const { total, limit, offset } = pagination;
  if (total <= limit && offset === 0) return null;
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
      <span>
        Showing <span className="font-mono text-slate-200">{start}-{end}</span> of{' '}
        <span className="font-mono text-slate-200">{total}</span>
      </span>
      <div className="flex items-center space-x-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 flex items-center space-x-1 cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(offset + limit)}
          className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 flex items-center space-x-1 cursor-pointer"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
