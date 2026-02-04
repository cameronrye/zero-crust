/**
 * useStorageErrors - Hook to subscribe to localStorage error notifications
 *
 * Provides user-facing feedback when localStorage operations fail.
 */

import { useState, useEffect, useCallback } from 'react';
import { webStore, type StorageError } from '../services/WebStore';

export interface StorageErrorsResult {
  /** The most recent storage error, if any */
  error: StorageError | null;
  /** Dismiss the current error notification */
  dismissError: () => void;
  /** Whether there's an active error to display */
  hasError: boolean;
}

export function useStorageErrors(): StorageErrorsResult {
  const [error, setError] = useState<StorageError | null>(null);

  useEffect(() => {
    const unsubscribe = webStore.subscribeStorageErrors((storageError) => {
      setError(storageError);
    });

    return unsubscribe;
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    dismissError,
    hasError: error !== null,
  };
}
