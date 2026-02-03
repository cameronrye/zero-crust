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
    <div className="h-full flex flex-col bg-slate-950 text-gray-100">
      {/* Header */}
      <div className="h-10 flex items-center justify-center shrink-0 border-b border-slate-800">
        <span className="text-amber-400/60 text-sm font-medium">Zero Crust Pizza</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Status Message */}
        <div className="text-center mb-4">
          <p className={`text-xl font-bold ${STATUS_TEXT_COLORS[status]}`}>
            {STATUS_MESSAGES[status]}
          </p>
          {isProcessing && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-amber-300 text-sm">Please wait...</span>
            </div>
          )}
          {isError && (
            <div className="mt-2 p-2 bg-rose-900/30 border border-rose-800 rounded text-sm">
              <p className="text-rose-300">Payment error. Please wait for assistance.</p>
            </div>
          )}
        </div>

        {showThankYou && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-3">🍕</div>
              <p className="text-xl text-emerald-400 font-bold">Thank You!</p>
              <p className="text-gray-400 text-sm mt-1">Pick up at the counter</p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-3 animate-pulse" aria-hidden="true">💳</div>
              <p className="text-lg text-amber-300 font-medium">
                Processing Payment
              </p>
              <p className="text-amber-400 text-xl font-bold mt-1">
                {formatCurrency(state.totalInCents)}
              </p>
              <p className="text-gray-500 text-sm mt-2">Please do not remove your card...</p>
            </div>
          </div>
        )}

        {!showThankYou && !isProcessing && (
          <>
            {/* Order Items */}
            <div className="flex-1 bg-slate-800/50 rounded-lg p-3 mb-3 overflow-y-auto">
              <h2 className="text-sm font-semibold mb-2 text-amber-400">Your Order</h2>
              {state.cart.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2 opacity-50">🛒</div>
                  <p className="text-gray-500 text-sm">Cart is empty</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {state.cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                          {item.quantity}
                        </span>
                        <span className="text-sm">{item.name}</span>
                      </div>
                      <span className="text-amber-400 text-sm font-semibold">
                        {formatCurrency(multiplyCents(item.priceInCents, item.quantity))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total */}
            <div className="bg-slate-800/50 rounded-lg p-3 shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Total</span>
                <span className="text-2xl font-bold text-emerald-400">
                  {formatCurrency(state.totalInCents)}
                </span>
              </div>
              {state.cart.length > 0 && (
                <div className="mt-1 text-center text-gray-500 text-xs">
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

