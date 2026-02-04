/**
 * CustomerDisplay - Customer-facing order display for the web demo
 */

import type { AppState } from '../shared/types';
import { formatCurrency, multiplyCents } from '../shared/currency';
import { STATUS_TEXT_COLORS, STATUS_MESSAGES } from '../utils/status';

interface CustomerDisplayProps {
  readonly state: AppState | null;
}

export function CustomerDisplay({ state }: Readonly<CustomerDisplayProps>) {
  if (!state) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950 text-gray-500">
        Loading...
      </div>
    );
  }

  const status = state.transactionStatus;
  const showThankYou = status === 'PAID';
  const isProcessing = status === 'PROCESSING';
  const isError = status === 'ERROR';

  return (
    <div className="h-full flex flex-col bg-slate-950 text-gray-100 overflow-hidden">
      {/* Header */}
      <div className="h-8 md:h-10 flex items-center justify-center shrink-0 border-b border-slate-800">
        <span className="text-amber-400/60 text-xs md:text-sm font-medium">Zero Crust Pizza</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-2 md:p-4 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] md:pb-[calc(1rem+env(safe-area-inset-bottom,0px))] min-h-0 overflow-hidden">
        {/* Status Message */}
        <div className="text-center mb-2 md:mb-4 shrink-0">
          <p className={`text-base md:text-xl font-bold ${STATUS_TEXT_COLORS[status]}`}>
            {STATUS_MESSAGES[status]}
          </p>
          {isProcessing && (
            <div className="flex items-center justify-center gap-2 mt-1 md:mt-2">
              <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-amber-300 text-xs md:text-sm">Please wait...</span>
            </div>
          )}
          {isError && (
            <div className="mt-1 md:mt-2 p-1.5 md:p-2 bg-rose-900/30 border border-rose-800 rounded text-xs md:text-sm">
              <p className="text-rose-300">Payment error. Please wait.</p>
            </div>
          )}
        </div>

        {showThankYou && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl md:text-5xl mb-2 md:mb-3">🍕</div>
              <p className="text-lg md:text-xl text-emerald-400 font-bold">Thank You!</p>
              <p className="text-gray-400 text-xs md:text-sm mt-1">Pick up at the counter</p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl md:text-5xl mb-2 md:mb-3 animate-pulse" aria-hidden="true">💳</div>
              <p className="text-base md:text-lg text-amber-300 font-medium">
                Processing
              </p>
              <p className="text-amber-400 text-lg md:text-xl font-bold mt-1">
                {formatCurrency(state.totalInCents)}
              </p>
              <p className="text-gray-500 text-xs md:text-sm mt-2">Do not remove card...</p>
            </div>
          </div>
        )}

        {!showThankYou && !isProcessing && (
          <>
            {/* Order Items - scrollable */}
            <div className="flex-1 bg-slate-800/50 rounded-lg p-2 md:p-3 mb-2 md:mb-3 min-h-0 overflow-y-auto">
              <h2 className="text-xs md:text-sm font-semibold mb-1.5 md:mb-2 text-amber-400 sticky top-0 bg-slate-800/90 -mx-2 md:-mx-3 -mt-2 md:-mt-3 px-2 md:px-3 py-1.5 md:py-2">Your Order</h2>
              {state.cart.length === 0 ? (
                <div className="text-center py-4 md:py-6">
                  <div className="text-2xl md:text-3xl mb-2 opacity-50">🛒</div>
                  <p className="text-gray-500 text-xs md:text-sm">Cart is empty</p>
                </div>
              ) : (
                <div className="space-y-1 md:space-y-2">
                  {state.cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-1.5 md:py-2 border-b border-slate-700/50 last:border-0">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="bg-amber-600 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold">
                          {item.quantity}
                        </span>
                        <span className="text-xs md:text-sm">{item.name}</span>
                      </div>
                      <span className="text-amber-400 text-xs md:text-sm font-semibold">
                        {formatCurrency(multiplyCents(item.priceInCents, item.quantity))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total - always visible */}
            <div className="bg-slate-800/50 rounded-lg p-2 md:p-3 shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-xs md:text-base">Total</span>
                <span className="text-lg md:text-2xl font-bold text-emerald-400">
                  {formatCurrency(state.totalInCents)}
                </span>
              </div>
              {state.cart.length > 0 && (
                <div className="mt-0.5 md:mt-1 text-center text-gray-500 text-[10px] md:text-xs">
                  {state.cart.length} item{state.cart.length === 1 ? '' : 's'}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

