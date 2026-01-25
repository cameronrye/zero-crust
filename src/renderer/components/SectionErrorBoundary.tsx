/**
 * SectionErrorBoundary - Granular error boundary for UI sections
 *
 * Unlike the root ErrorBoundary which shows a full-page error,
 * this component displays an inline error message allowing other
 * parts of the UI to continue functioning.
 *
 * Use this to wrap critical sections like:
 * - ProductGrid (product selection can fail without breaking cart)
 * - CartSidebar (cart errors shouldn't break product browsing)
 * - MetricsBar (metrics failures shouldn't block transactions)
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  /** Section name for error logging and display */
  sectionName: string;
  /** Optional callback for error reporting */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[SectionErrorBoundary:${this.props.sectionName}] Error:`, error);
    console.error(`[SectionErrorBoundary:${this.props.sectionName}] Stack:`, errorInfo.componentStack);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default inline error UI
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-lg border border-rose-500/30">
          <div className="w-10 h-10 bg-rose-600/20 rounded-full flex items-center justify-center mb-3">
            <svg
              className="w-5 h-5 text-rose-500"
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

          <p className="text-sm text-slate-400 mb-3 text-center">
            {this.props.sectionName} encountered an error
          </p>

          <button
            onClick={this.handleRetry}
            className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

