/**
 * POSDemo - Main demo component for the web version of Zero Crust POS
 *
 * Shows Cashier + Customer side-by-side with tabs for Transactions and Debugger.
 * Demonstrates the multi-window architecture in a single browser page.
 */

import { useState, Component, type ReactNode, type ErrorInfo } from 'react';
import type { ProductCategory } from './shared/catalog';
import { WebAPIProvider } from './context/WebAPIContext';
import { usePOSState, usePOSCommands, usePOSMetrics, usePOSInventory, useTraceEvents, useKeyboardShortcuts, useStorageErrors } from './hooks';
import { ProductGrid, CartSidebar, CustomerDisplay, TransactionHistory, SimpleArchDebugger, StateInspector, MetricsBar, StorageErrorToast } from './components';

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
        <div className="h-full flex items-center justify-center bg-slate-950 text-gray-100 p-8" role="alert" aria-live="assertive">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4" aria-hidden="true">⚠️</div>
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
type MobilePanel = 'cashier' | 'customer';

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
      <output className="h-full flex items-center justify-center bg-slate-900 text-gray-400" aria-live="polite" aria-busy="true">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2" aria-hidden="true" />
        <span>Loading...</span>
      </output>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 text-gray-100 p-8" role="alert" aria-live="assertive">
        <div className="text-center max-w-sm">
          <div className="text-3xl mb-3 text-rose-400" aria-hidden="true">Connection Error</div>
          <h2 className="sr-only">Connection Error</h2>
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
  const [showMobileState, setShowMobileState] = useState(false);

  return (
    <div className="h-full flex flex-col md:flex-row relative">
      {/* Event Timeline */}
      <div className="flex-1 min-w-0 md:border-r border-slate-700 border-b md:border-b-0">
        <SimpleArchDebugger
          events={events}
          stats={stats}
          isConnected={isConnected}
          onClear={clearEvents}
        />
      </div>
      {/* State Inspector - hidden on mobile, visible on desktop */}
      <div className="hidden md:block w-80 shrink-0">
        <StateInspector events={events} />
      </div>

      {/* Mobile State Inspector Toggle Button */}
      <button
        onClick={() => setShowMobileState(true)}
        className="md:hidden fixed bottom-4 right-4 z-40 px-4 py-2 bg-amber-600 text-white rounded-full shadow-lg font-medium text-sm hover:bg-amber-500 transition-colors"
        aria-label="Open state inspector"
      >
        State
      </button>

      {/* Mobile State Inspector Drawer */}
      {showMobileState && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowMobileState(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="absolute bottom-0 left-0 right-0 h-[70vh] bg-slate-900 rounded-t-2xl shadow-xl flex flex-col animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-700">
              <h2 className="font-semibold text-white">State Inspector</h2>
              <button
                onClick={() => setShowMobileState(false)}
                className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                aria-label="Close state inspector"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Drawer Content */}
            <div className="flex-1 overflow-hidden">
              <StateInspector events={events} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DemoContent() {
  const [activeTab, setActiveTab] = useState<ViewTab>('pos');
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('cashier');
  const { state, isLocked } = usePOSState();
  const commands = usePOSCommands();
  const { error: storageError, dismissError } = useStorageErrors();

  const tabs: { id: ViewTab; label: string }[] = [
    { id: 'pos', label: 'POS' },
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
      {/* Storage Error Toast */}
      <StorageErrorToast error={storageError} onDismiss={dismissError} />

      {/* Tab Navigation */}
      <nav className="flex items-center gap-1 md:gap-2 p-1 md:p-2 bg-slate-900 border-b border-slate-700 shrink-0" aria-label="Demo views">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            aria-label={`${tab.label}${activeTab === tab.id ? ' (active)' : ''}`}
            className={`px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
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
          className={`px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${getAutoplayButtonClass()}`}
        >
          {demoLoopRunning ? 'Stop' : 'Auto'}
        </button>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:block px-3 py-2 rounded-lg text-sm font-medium bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-gray-200 transition-colors"
        >
          Website
        </a>
        <div className="hidden lg:block text-xs text-gray-500 ml-2">
          Zero Crust POS - Web Demo
        </div>
      </nav>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'pos' && (
          <div className="h-full flex flex-col md:flex-row">
            {/* Mobile Panel Toggle - hidden on desktop */}
            <div className="flex md:hidden border-b border-slate-700 shrink-0">
              <button
                onClick={() => setMobilePanel('cashier')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mobilePanel === 'cashier'
                    ? 'bg-slate-800 text-amber-400 border-b-2 border-amber-500'
                    : 'bg-slate-900 text-gray-400'
                }`}
              >
                Cashier
              </button>
              <button
                onClick={() => setMobilePanel('customer')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mobilePanel === 'customer'
                    ? 'bg-slate-800 text-amber-400 border-b-2 border-amber-500'
                    : 'bg-slate-900 text-gray-400'
                }`}
              >
                Customer
              </button>
            </div>
            {/* Cashier Window - full width on mobile, flex-1 on desktop */}
            <div className={`flex-1 md:border-r border-slate-700 min-w-0 ${mobilePanel === 'cashier' ? '' : 'hidden md:block'}`}>
              <div className="h-8 bg-slate-800 hidden md:flex items-center justify-center text-xs text-gray-400 border-b border-slate-700">
                Cashier Window
              </div>
              <div className="h-full md:h-[calc(100%-2rem)]">
                <CashierPanel />
              </div>
            </div>
            {/* Customer Window - full width on mobile, fixed width on desktop */}
            <div className={`flex-1 md:flex-none md:w-80 md:min-w-64 md:shrink-0 ${mobilePanel === 'customer' ? '' : 'hidden md:block'}`}>
              <div className="h-8 bg-slate-800 hidden md:flex items-center justify-center text-xs text-gray-400 border-b border-slate-700">
                Customer Display
              </div>
              <div className="h-full md:h-[calc(100%-2rem)]">
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

