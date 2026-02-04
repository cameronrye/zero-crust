/**
 * PaymentActions - Payment state buttons and transaction controls (Web version)
 */

import type { TransactionStatus } from '../shared/types';
import type { Cents } from '../shared/currency';
import { formatCurrency } from '../shared/currency';

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
    <div className="p-2 md:p-4 border-t border-slate-700 bg-slate-800">
      {isError && errorMessage && (
        <div className="mb-2 md:mb-4 p-2 md:p-3 bg-rose-900/50 border border-rose-700 rounded text-rose-200 text-xs md:text-sm">
          {errorMessage}
        </div>
      )}

      <div className="flex justify-between items-center mb-2 md:mb-4">
        <span className="text-gray-400 text-xs md:text-base">Total</span>
        <span className="text-lg md:text-2xl font-bold text-emerald-400">
          {formatCurrency(totalInCents)}
        </span>
      </div>

      {status === 'IDLE' && (
        <div className="flex gap-1 md:gap-2">
          <button
            onClick={onClearCart}
            disabled={!cartLength}
            className="flex-1 py-2 md:py-3 rounded text-xs md:text-base font-medium bg-slate-700 hover:bg-slate-600 active:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Clear
          </button>
          <button
            onClick={onCheckout}
            disabled={!cartLength}
            className="flex-[2] py-2 md:py-3 rounded text-xs md:text-base font-medium bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Checkout
          </button>
        </div>
      )}

      {isPending && (
        <div className="flex gap-1 md:gap-2">
          <button
            onClick={onCancelCheckout}
            className="flex-1 py-2 md:py-3 rounded text-xs md:text-base font-medium bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onProcessPayment}
            aria-label="Process payment"
            className="flex-[2] py-2 md:py-3 rounded text-xs md:text-base font-medium bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400 transition-colors cursor-pointer"
          >
            Pay
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 md:gap-3 py-2 md:py-3">
          <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-amber-400 font-medium text-xs md:text-base">Processing...</span>
        </div>
      )}

      {isError && (
        <div className="flex gap-1 md:gap-2">
          <button
            onClick={onCancelCheckout}
            className="flex-1 py-2 md:py-3 rounded text-xs md:text-base font-medium bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          {canRetry ? (
            <button
              onClick={onRetryPayment}
              className="flex-[2] py-2 md:py-3 rounded text-xs md:text-base font-medium bg-amber-600 hover:bg-amber-500 active:bg-amber-400 transition-colors cursor-pointer"
            >
              Retry
            </button>
          ) : (
            <button
              disabled
              className="flex-[2] py-2 md:py-3 rounded text-xs md:text-base font-medium bg-slate-600 opacity-50 cursor-not-allowed"
            >
              Contact Manager
            </button>
          )}
        </div>
      )}

      {isPaid && (
        <button
          onClick={onNewTransaction}
          className="w-full py-2 md:py-3 rounded text-xs md:text-base font-medium bg-amber-600 hover:bg-amber-500 active:bg-amber-400 transition-colors cursor-pointer"
        >
          New Transaction
        </button>
      )}
    </div>
  );
}

