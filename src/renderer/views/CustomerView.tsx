/**
 * CustomerView - Display for the customer-facing window
 *
 * Shows real-time order summary synchronized with Cashier window.
 * Wrapped in SectionErrorBoundary for graceful error handling.
 */

import { formatCurrency, multiplyCents } from '@shared/currency';
import { LoadingSkeleton, SectionErrorBoundary } from '../components';
import { usePOSState } from '../hooks/usePOSState';
import { DRAG_REGION_STYLE, STATUS_TEXT_COLORS, STATUS_MESSAGES } from '../utils';

export default function CustomerView() {
  const { state, isLoading } = usePOSState();

  // Show loading skeleton until initial state is received
  if (isLoading || !state) {
    return <LoadingSkeleton variant="customer" />;
  }

  // TypeScript now knows state is non-null after the above check
  const status = state.transactionStatus;
  const showThankYou = status === 'PAID';
  const isProcessing = status === 'PROCESSING';
  const isError = status === 'ERROR';

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 font-sans flex flex-col">
      {/* Draggable title bar area for window movement */}
      <div
        className="h-10 bg-slate-950 flex items-center justify-center shrink-0"
        style={DRAG_REGION_STYLE}
      >
        <span className="text-amber-400/60 text-sm font-medium select-none">
          Zero Crust Pizza
        </span>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-8">
        <SectionErrorBoundary sectionName="Order Display">
          {/* Status Message */}
          <div className="text-center mb-8">
            <p className={`text-3xl font-bold ${STATUS_TEXT_COLORS[status]}`}>
              {STATUS_MESSAGES[status]}
            </p>
          {/* Processing spinner */}
          {isProcessing && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-amber-300">Please wait...</span>
            </div>
          )}
          {/* Error message - friendly for customers */}
          {isError && (
            <div className="mt-4 p-4 bg-rose-900/30 border border-rose-800 rounded-lg max-w-md mx-auto">
              <p className="text-rose-300">
                We&apos;re having trouble processing your payment.
              </p>
              <p className="text-rose-400 text-sm mt-2">
                Please wait while the cashier assists you.
              </p>
            </div>
          )}
        </div>

        {showThankYou ? (
          /* Thank You Screen */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">🍕</div>
              <p className="text-2xl text-emerald-400 font-bold">
                Thank You for Your Order!
              </p>
              <p className="text-gray-400 mt-2">Please pick up at the counter</p>
            </div>
          </div>
        ) : isProcessing ? (
          /* Processing Screen - show order summary while processing */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4 animate-pulse">💳</div>
              <p className="text-xl text-amber-300">
                Processing your payment of{' '}
                <span className="font-bold">
                  {formatCurrency(state.totalInCents)}
                </span>
              </p>
            </div>
          </div>
        ) : (
          /* Order Display */
          <>
            {/* Order Items */}
            <div className="flex-1 bg-slate-800/50 rounded-lg p-6 mb-6 overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4 text-amber-400">
                Your Order
              </h2>

              {state.cart.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4 opacity-50">🛒</div>
                  <p className="text-gray-500 text-lg">Your cart is empty</p>
                  <p className="text-gray-600 text-sm mt-2">
                    Items will appear here as they are added
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {state.cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center py-3 border-b border-slate-700/50 last:border-0"
                    >
                      <div className="flex items-center gap-4">
                        <span className="bg-amber-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                          {item.quantity}
                        </span>
                        <span className="text-lg">{item.name}</span>
                      </div>
                      <span className="text-amber-400 font-semibold">
                        {formatCurrency(multiplyCents(item.priceInCents, item.quantity))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total Section */}
            <div className="bg-slate-800/50 rounded-lg p-6">
              <div className="flex justify-between items-center">
                <span className="text-2xl text-gray-300">Total</span>
                <span className="text-4xl font-bold text-emerald-400">
                  {formatCurrency(state.totalInCents)}
                </span>
              </div>

              {state.cart.length > 0 && (
                <div className="mt-4 text-center text-gray-500">
                  {state.cart.length} item{state.cart.length !== 1 ? 's' : ''} in
                  cart
                </div>
              )}
            </div>
          </>
        )}
        </SectionErrorBoundary>
      </main>
    </div>
  );
}

