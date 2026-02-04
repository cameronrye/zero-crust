/**
 * MetricsBar - Displays real-time transaction metrics
 *
 * Shows TPM, average cart size, transaction count, and revenue.
 */

import type { Metrics } from '../shared/types';
import { formatCurrency } from '../shared/currency';

interface MetricsBarProps {
  metrics: Metrics;
}

export function MetricsBar({ metrics }: Readonly<MetricsBarProps>) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 md:gap-x-4 gap-y-0.5 px-2 md:px-4 py-1 md:py-2 bg-slate-800 border-b border-slate-700 text-[10px] md:text-xs">
      <div className="flex items-center gap-1">
        <span className="text-gray-400">TPM:</span>
        <span className="font-medium text-emerald-400">
          {metrics.transactionsPerMinute.toFixed(1)}
        </span>
      </div>
      <div className="hidden sm:flex items-center gap-1">
        <span className="text-gray-400">Avg:</span>
        <span className="font-medium text-amber-400">
          {metrics.averageCartSize.toFixed(1)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-gray-400">Txns:</span>
        <span className="font-medium text-amber-400">
          {metrics.totalTransactionsToday}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-gray-400">Rev:</span>
        <span className="font-medium text-emerald-400">
          {formatCurrency(metrics.totalRevenueToday)}
        </span>
      </div>
    </div>
  );
}
