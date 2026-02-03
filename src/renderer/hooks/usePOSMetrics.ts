/**
 * usePOSMetrics - Custom hook for managing POS metrics data
 *
 * Subscribes to metrics updates from the Main process via IPC.
 * Fetches initial metrics on mount and receives push updates thereafter.
 *
 * @example
 * ```tsx
 * const { metrics, isLoading } = usePOSMetrics();
 *
 * if (isLoading) return null;
 *
 * return <div>TPM: {metrics.transactionsPerMinute}</div>;
 * ```
 */

import { useState, useEffect } from 'react';
import type { Metrics } from '@shared/ipc-types';

/**
 * Return type for the usePOSMetrics hook
 */
export interface POSMetricsResult {
  /** Current metrics data, null while loading */
  metrics: Metrics | null;
  /** True while waiting for initial metrics from Main process */
  isLoading: boolean;
}

/**
 * Custom hook that subscribes to POS metrics updates from the Main process.
 *
 * The hook automatically:
 * - Fetches initial metrics on mount
 * - Subscribes to metrics updates (push-based)
 * - Unsubscribes on unmount
 *
 * @returns Object containing metrics and isLoading values
 */
export function usePOSMetrics(): POSMetricsResult {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    // Subscribe to metrics updates from Main process
    const unsubscribe = window.electronAPI.onMetricsUpdate((newMetrics) => {
      setMetrics(newMetrics);
    });

    // Fetch initial metrics on mount (silently ignore errors - metrics are non-critical)
    window.electronAPI.getMetrics().then(setMetrics).catch(() => {
      // Metrics fetch failed - continue without initial metrics
    });

    return unsubscribe;
  }, []);

  return {
    metrics,
    isLoading: metrics === null,
  };
}

