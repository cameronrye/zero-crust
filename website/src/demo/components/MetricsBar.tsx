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
    <div className="flex items-center gap-4 px-4 py-2 bg-slate-800 border-b border-slate-700 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">TPM:</span>
        <span className="font-medium text-emerald-400">
          {metrics.transactionsPerMinute.toFixed(1)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">Avg Cart:</span>
        <span className="font-medium text-amber-400">
          {metrics.averageCartSize.toFixed(1)} items
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">Today:</span>
        <span className="font-medium text-amber-400">
          {metrics.totalTransactionsToday} txns
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">Revenue:</span>
        <span className="font-medium text-emerald-400">
          {formatCurrency(metrics.totalRevenueToday)}
        </span>
      </div>
    </div>
  );
}
