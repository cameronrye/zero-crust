/**
 * POSDemo - Main demo component for the web version of Zero Crust POS
 *
 * Shows Cashier + Customer side-by-side with tabs for Transactions and Debugger.
 * Demonstrates the multi-window architecture in a single browser page.
 */

import { useState, Component, type ReactNode, type ErrorInfo } from 'react';
import type { ProductCategory } from './shared/catalog';
import { WebAPIProvider } from './context/WebAPIContext';
import { usePOSState, usePOSCommands, usePOSMetrics, usePOSInventory, useTraceEvents, useKeyboardShortcuts } from './hooks';
import { ProductGrid, CartSidebar, CustomerDisplay, TransactionHistory, SimpleArchDebugger, StateInspector, MetricsBar } from './components';

/**
 * Error Boundary component to gracefully handle runtime errors
 */
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('POS Demo Error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center bg-slate-950 text-gray-100 p-8">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-rose-400 mb-2">Something went wrong</h2>
            <p className="text-gray-400 mb-4">
              The demo encountered an error. This has been logged for debugging.
            </p>
            <details className="text-left mb-4 bg-slate-800 rounded p-3">
              <summary className="cursor-pointer text-sm text-gray-400">Error details</summary>
              <pre className="mt-2 text-xs text-rose-300 overflow-auto">
                {this.state.error?.message}
              </pre>
            </details>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-amber-600 text-white rounded font-medium hover:bg-amber-500 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type ViewTab = 'pos' | 'transactions' | 'debugger';

function CashierPanel() {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('pizza');
  const { state, isLoading, isLocked, error, retry } = usePOSState();
  const { metrics } = usePOSMetrics();
  const { stockBySku } = usePOSInventory();
  const commands = usePOSCommands();

  // F1-F12 keyboard shortcuts for quick product selection
  useKeyboardShortcuts({
    onAddItem: commands.handleAddItem,
    selectedCategory,
    isEnabled: !isLocked,
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 text-gray-400">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 text-gray-100 p-8">
        <div className="text-center max-w-sm">
          <div className="text-3xl mb-3 text-rose-400">Connection Error</div>
          <p className="text-gray-400 mb-4">{error.message}</p>
          <button
            onClick={retry}
            className="px-4 py-2 bg-amber-600 text-white rounded font-medium hover:bg-amber-500 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 text-gray-100">
      <MetricsBar metrics={metrics} />
      <div className="flex flex-1 overflow-hidden">
        <ProductGrid
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onAddItem={commands.handleAddItem}
          onDemoOrder={commands.handleDemoOrder}
          isLocked={isLocked}
          demoLoopRunning={state?.demoLoopRunning ?? false}
          showShortcuts={!isLocked}
          stockBySku={stockBySku}
        />
        <CartSidebar
          state={state}
          onRemoveItem={commands.handleRemoveItem}
          onUpdateQuantity={commands.handleUpdateQuantity}
          onClearCart={commands.handleClearCart}
          onCheckout={commands.handleCheckout}
          onProcessPayment={commands.handleProcessPayment}
          onRetryPayment={commands.handleRetryPayment}
          onNewTransaction={commands.handleNewTransaction}
          onCancelCheckout={commands.handleCancelCheckout}
        />
      </div>
    </div>
  );
}

function CustomerPanel() {
  const { state } = usePOSState();
  return <CustomerDisplay state={state} />;
}

function DebuggerPanel() {
  const { events, stats, isConnected, clearEvents } = useTraceEvents();
  return (
    <div className="h-full flex">
      {/* Event Timeline */}
      <div className="flex-1 min-w-0 border-r border-slate-700">
        <SimpleArchDebugger
          events={events}
          stats={stats}
          isConnected={isConnected}
          onClear={clearEvents}
        />
      </div>
      {/* State Inspector */}
      <div className="w-80 shrink-0">
        <StateInspector events={events} />
      </div>
    </div>
  );
}

function DemoContent() {
  const [activeTab, setActiveTab] = useState<ViewTab>('pos');
  const { state, isLocked } = usePOSState();
  const commands = usePOSCommands();

  const tabs: { id: ViewTab; label: string }[] = [
    { id: 'pos', label: 'POS Demo' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'debugger', label: 'Debugger' },
  ];

  const demoLoopRunning = state?.demoLoopRunning ?? false;
  const canToggleAutoplay = !isLocked || demoLoopRunning;

  const getAutoplayButtonClass = (): string => {
    if (demoLoopRunning) {
      return 'bg-red-600 text-white hover:bg-red-500 animate-pulse';
    }
    if (canToggleAutoplay) {
      return 'bg-emerald-600 text-white hover:bg-emerald-500';
    }
    return 'bg-slate-700 text-gray-500 cursor-not-allowed';
  };

  const handleAutoplayToggle = () => {
    if (demoLoopRunning) {
      commands.handleStopDemoLoop();
    } else {
      commands.handleStartDemoLoop();
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Tab Navigation */}
      <nav className="flex items-center gap-2 p-2 bg-slate-900 border-b border-slate-700 shrink-0" aria-label="Demo views">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            aria-label={`${tab.label}${activeTab === tab.id ? ' (active)' : ''}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={handleAutoplayToggle}
          disabled={!canToggleAutoplay}
          aria-label={demoLoopRunning ? 'Stop automatic demo transactions' : 'Start automatic demo transactions'}
          aria-pressed={demoLoopRunning}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${getAutoplayButtonClass()}`}
        >
          {demoLoopRunning ? 'Stop' : 'Autoplay'}
        </button>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-gray-200 transition-colors"
        >
          Website
        </a>
        <div className="text-xs text-gray-500 ml-2">
          Zero Crust POS - Web Demo
        </div>
      </nav>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'pos' && (
          <div className="h-full flex">
            {/* Cashier Window (left) */}
            <div className="flex-1 border-r border-slate-700 min-w-0">
              <div className="h-8 bg-slate-800 flex items-center justify-center text-xs text-gray-400 border-b border-slate-700">
                Cashier Window
              </div>
              <div className="h-[calc(100%-2rem)]">
                <CashierPanel />
              </div>
            </div>
            {/* Customer Window (right) */}
            <div className="w-80 min-w-64 shrink-0">
              <div className="h-8 bg-slate-800 flex items-center justify-center text-xs text-gray-400 border-b border-slate-700">
                Customer Display
              </div>
              <div className="h-[calc(100%-2rem)]">
                <CustomerPanel />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && <TransactionHistory />}

        {activeTab === 'debugger' && <DebuggerPanel />}
      </div>
    </div>
  );
}

export default function POSDemo() {
  return (
    <ErrorBoundary>
      <WebAPIProvider windowId="cashier">
        <DemoContent />
      </WebAPIProvider>
    </ErrorBoundary>
  );
}

