/**
 * usePOSMetrics - Custom hook for subscribing to POS metrics
 */

import { useState, useEffect } from 'react';
import { useElectronAPI } from '../context/WebAPIContext';
import type { Metrics } from '../shared/types';
import { cents } from '../shared/currency';

const DEFAULT_METRICS: Metrics = {
  transactionsPerMinute: 0,
  averageCartSize: 0,
  totalTransactionsToday: 0,
  totalRevenueToday: cents(0),
  lastUpdated: new Date().toISOString(),
};

export interface POSMetricsResult {
  metrics: Metrics;
  isLoading: boolean;
}

/**
 * Hook to subscribe to real-time POS metrics updates
 */
export function usePOSMetrics(): POSMetricsResult {
  const api = useElectronAPI();
  const [metrics, setMetrics] = useState<Metrics>(DEFAULT_METRICS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = api.onMetricsUpdate((newMetrics) => {
      setMetrics(newMetrics);
      setIsLoading(false);
    });

    return unsubscribe;
  }, [api]);

  return { metrics, isLoading };
}
