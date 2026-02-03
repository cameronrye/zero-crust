/**
 * usePOSState - Custom hook for managing POS application state (Web version)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { AppState } from '../shared/types';
import { useElectronAPI } from '../context/WebAPIContext';

export interface POSStateError {
  message: string;
  code: 'INITIAL_STATE_FAILED' | 'SUBSCRIPTION_ERROR' | 'UNKNOWN';
  cause?: unknown;
}

export interface POSStateResult {
  state: AppState | null;
  isLoading: boolean;
  isLocked: boolean;
  error: POSStateError | null;
  retry: () => void;
}

export function usePOSState(): POSStateResult {
  const api = useElectronAPI();
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<POSStateError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setState(null);
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    const unsubscribe = api.onStateUpdate((newState) => {
      setState(newState);
      setError(null);
    });

    api.requestInitialState().catch((err) => {
      console.error('Failed to request initial state:', err);
      setError({
        message: 'Failed to connect to the POS system. Please try again.',
        code: 'INITIAL_STATE_FAILED',
        cause: err,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [api, retryCount]);

  const isLoading = state === null && error === null;
  const isLocked = useMemo(() => {
    return (state?.transactionStatus ?? 'IDLE') !== 'IDLE';
  }, [state?.transactionStatus]);

  return {
    state,
    isLoading,
    isLocked,
    error,
    retry,
  };
}

