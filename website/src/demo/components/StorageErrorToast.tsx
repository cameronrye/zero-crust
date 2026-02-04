/**
 * StorageErrorToast - Displays localStorage error notifications
 *
 * Shows a dismissible toast when localStorage operations fail,
 * informing users that their data may not persist.
 */

import { useEffect } from 'react';
import type { StorageError } from '../services/WebStore';

interface StorageErrorToastProps {
  error: StorageError | null;
  onDismiss: () => void;
}

const ERROR_MESSAGES: Record<StorageError['type'], string> = {
  load: 'Could not load saved data. Starting fresh.',
  save: 'Could not save your progress. Changes may be lost on refresh.',
  clear: 'Could not clear saved data.',
};

export function StorageErrorToast({ error, onDismiss }: Readonly<StorageErrorToastProps>) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!error) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);

    return () => clearTimeout(timer);
  }, [error, onDismiss]);

  if (!error) return null;

  const message = ERROR_MESSAGES[error.type];

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-sm bg-amber-900/95 border border-amber-700 rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-2"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-amber-400" aria-hidden="true">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-100">{message}</p>
          <p className="mt-1 text-xs text-amber-300/80">
            Storage may be full or disabled in your browser.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 text-amber-400 hover:text-amber-200 transition-colors"
          aria-label="Dismiss notification"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
