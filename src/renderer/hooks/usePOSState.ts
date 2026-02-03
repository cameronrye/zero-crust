/**
 * usePOSState - Custom hook for managing POS application state
 *
 * Subscribes to state updates from the Main process via IPC.
 * Automatically cleans up subscriptions on unmount.
 *
 * @example
 * ```tsx
 * const { state, isLoading, isLocked, error } = usePOSState();
 *
 * if (isLoading) return <LoadingSkeleton />;
 * if (error) return <ErrorDisplay error={error} />;
 *
 * return <div>{state.transactionStatus}</div>;
 * ```
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { AppState } from '@shared/ipc-types';

/**
 * Error information for state subscription failures
 */
export interface POSStateError {
  /** Error message */
  message: string;
  /** Error code for programmatic handling */
  code: 'INITIAL_STATE_FAILED' | 'SUBSCRIPTION_ERROR' | 'UNKNOWN';
  /** Original error if available */
  cause?: unknown;
}

/**
 * Return type for the usePOSState hook
 */
export interface POSStateResult {
  /** Current application state, null while loading */
  state: AppState | null;
  /** True while waiting for initial state from Main process */
  isLoading: boolean;
  /** True when the UI should be locked (non-IDLE transaction status) */
  isLocked: boolean;
  /** Error information if state subscription failed */
  error: POSStateError | null;
  /** Retry function to attempt reconnection after an error */
  retry: () => void;
}

/**
 * Custom hook that subscribes to POS state updates from the Main process.
 *
 * The hook automatically:
 * - Subscribes to state updates on mount
 * - Unsubscribes on unmount
 * - Provides computed helper values (isLoading, isLocked)
 * - Captures and exposes errors for UI handling
 * - Provides a retry function for error recovery
 *
 * @returns Object containing state, isLoading, isLocked, error, and retry values
 */
export function usePOSState(): POSStateResult {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<POSStateError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Retry function to attempt reconnection
  const retry = useCallback(() => {
    setError(null);
    setState(null);
    setRetryCount((c) => c + 1);
  }, []);

  // Subscribe to state updates from Main process
  useEffect(() => {
    const unsubscribe = window.electronAPI.onStateUpdate((newState) => {
      setState(newState);
      // Clear any previous errors on successful state update
      setError(null);
    });

    // Request initial state after subscribing
    window.electronAPI.requestInitialState().catch((err) => {
      setError({
        message: 'Failed to connect to the POS system. Please try again.',
        code: 'INITIAL_STATE_FAILED',
        cause: err,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [retryCount]);

  // Compute derived values
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

