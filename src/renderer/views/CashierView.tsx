/**
 * CashierView - Main interface for the cashier window
 *
 * Composed of modular components for maintainability:
 * - MetricsBar: Real-time transaction metrics, status, and controls
 * - ProductGrid: Category tabs and product selection
 * - CartSidebar: Cart items and payment actions
 *
 * Each section is wrapped in SectionErrorBoundary for graceful degradation.
 * If one section fails, others continue to function.
 */

import { useState } from 'react';
import type { ProductCategory } from '@shared/catalog';
import { MetricsBar, ProductGrid, CartSidebar, LoadingSkeleton, SectionErrorBoundary } from '../components';
import { usePOSState, usePOSMetrics, usePOSCommands, useKeyboardShortcuts } from '../hooks';

export default function CashierView() {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('pizza');

  // Use custom hooks for state management and commands
  const { state, isLoading, isLocked } = usePOSState();
  const { metrics } = usePOSMetrics();
  const commands = usePOSCommands();

  // Keyboard shortcuts: F1-F12 for quick product selection
  useKeyboardShortcuts({
    onAddItem: commands.handleAddItem,
    selectedCategory,
    isEnabled: !isLocked,
  });

  // Show loading skeleton until initial state is received
  if (isLoading) {
    return <LoadingSkeleton variant="cashier" />;
  }

  // Toggle demo loop handler
  const handleToggleDemoLoop = () => {
    if (state?.demoLoopRunning) {
      commands.handleStopDemoLoop();
    } else {
      commands.handleStartDemoLoop();
    }
  };

  return (
    <div className="h-screen bg-slate-900 text-gray-100 font-sans flex flex-col overflow-hidden">
      {metrics && (
        <SectionErrorBoundary sectionName="Metrics">
          <MetricsBar
            metrics={metrics}
            isLocked={isLocked}
            demoLoopRunning={state?.demoLoopRunning ?? false}
            onToggleDemoLoop={handleToggleDemoLoop}
          />
        </SectionErrorBoundary>
      )}

      <div className="flex flex-1 overflow-hidden">
        <SectionErrorBoundary sectionName="Product Grid">
          <ProductGrid
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            onAddItem={commands.handleAddItem}
            onQuickOrder={commands.handleDemoOrder}
            isLocked={isLocked}
            demoLoopRunning={state?.demoLoopRunning ?? false}
          />
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="Cart">
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
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
