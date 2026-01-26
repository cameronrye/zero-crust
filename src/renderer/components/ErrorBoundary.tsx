/**
 * ErrorBoundary - Catches and handles renderer crashes gracefully
 *
 * Displays a friendly error UI instead of crashing the whole window.
 * Provides a reload button to recover from errors.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { IS_DEVELOPMENT } from '@shared/config';

/**
 * Error handler callback for external error reporting integration.
 * Can be used to send errors to monitoring services like Sentry, LogRocket, etc.
 */
export type ErrorHandler = (error: Error, errorInfo: ErrorInfo) => void;

interface Props {
  children: ReactNode;
  /** Optional callback for error reporting to external services */
  onError?: ErrorHandler;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error for debugging
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Call external error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-rose-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-rose-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">
              Something went wrong
            </h1>

            <p className="text-slate-400 mb-6">
              An unexpected error occurred. Click the button below to reload.
            </p>

            {IS_DEVELOPMENT && this.state.error && (
              <div className="mb-6 p-4 bg-slate-900 rounded-lg text-left overflow-auto max-h-32">
                <code className="text-xs text-rose-400 font-mono">
                  {this.state.error.message}
                </code>
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

