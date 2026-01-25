/**
 * PaymentActions - Payment state buttons and transaction controls
 */

import type { TransactionStatus } from '@shared/ipc-types';
import type { Cents } from '@shared/currency';
import { formatCurrency } from '@shared/currency';

interface PaymentActionsProps {
  status: TransactionStatus;
  totalInCents: Cents;
  errorMessage?: string;
  cartLength: number;
  canRetry: boolean;
  onClearCart: () => void;
  onCheckout: () => void;
  onProcessPayment: () => void;
  onRetryPayment: () => void;
  onNewTransaction: () => void;
  onCancelCheckout: () => void;
}

export function PaymentActions({
  status,
  totalInCents,
  errorMessage,
  cartLength,
  canRetry,
  onClearCart,
  onCheckout,
  onProcessPayment,
  onRetryPayment,
  onNewTransaction,
  onCancelCheckout,
}: PaymentActionsProps) {
  const isError = status === 'ERROR';
  const isPending = status === 'PENDING';
  const isProcessing = status === 'PROCESSING';
  const isPaid = status === 'PAID';

  return (
    <div className="p-4 border-t border-slate-700 bg-slate-850">
      {/* Error Message */}
      {isError && errorMessage && (
        <div className="mb-4 p-3 bg-rose-900/50 border border-rose-700 rounded text-rose-200 text-sm whitespace-pre-line">
          {errorMessage}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-400">Total</span>
        <span className="text-2xl font-bold text-emerald-400">
          {formatCurrency(totalInCents)}
        </span>
      </div>

      {/* IDLE state: Clear + Checkout buttons */}
      {status === 'IDLE' && (
        <div className="flex gap-2">
          <button
            onClick={onClearCart}
            disabled={!cartLength}
            className="flex-1 py-3 rounded font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Clear
          </button>
          <button
            onClick={onCheckout}
            disabled={!cartLength}
            className="flex-2 py-3 rounded font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Checkout
          </button>
        </div>
      )}

      {/* PENDING state: Cancel + Process Payment buttons */}
      {isPending && (
        <div className="flex gap-2">
          <button
            onClick={onCancelCheckout}
            className="flex-1 py-3 rounded font-medium bg-slate-700 hover:bg-slate-600 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onProcessPayment}
            className="flex-2 py-3 rounded font-medium bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer"
          >
            Process Payment
          </button>
        </div>
      )}

      {/* PROCESSING state: Spinner + locked UI */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-3 py-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-amber-400 font-medium">Processing Payment...</span>
        </div>
      )}

      {/* ERROR state: Retry or Cancel */}
      {isError && (
        <div className="flex gap-2">
          <button
            onClick={onCancelCheckout}
            className="flex-1 py-3 rounded font-medium bg-slate-700 hover:bg-slate-600 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          {canRetry ? (
            <button
              onClick={onRetryPayment}
              className="flex-2 py-3 rounded font-medium bg-amber-600 hover:bg-amber-500 transition-colors cursor-pointer"
            >
              Retry Payment
            </button>
          ) : (
            <button
              disabled
              className="flex-2 py-3 rounded font-medium bg-slate-600 opacity-50 cursor-not-allowed"
            >
              Contact Manager
            </button>
          )}
        </div>
      )}

      {/* PAID state: New Transaction button */}
      {isPaid && (
        <button
          onClick={onNewTransaction}
          className="w-full py-3 rounded font-medium bg-amber-600 hover:bg-amber-500 transition-colors cursor-pointer"
        >
          New Transaction
        </button>
      )}
    </div>
  );
}

