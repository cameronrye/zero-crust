/**
 * CartSidebar - Cart display with items list and payment actions
 */

import type { AppState, CartItem, TransactionStatus } from '@shared/ipc-types';
import type { Cents } from '@shared/currency';
import { CartItemRow } from './CartItemRow';
import { PaymentActions } from './PaymentActions';

const STATUS_COLORS: Record<TransactionStatus, string> = {
  IDLE: 'bg-emerald-500',
  PENDING: 'bg-amber-500',
  PROCESSING: 'bg-amber-500 animate-pulse',
  PAID: 'bg-emerald-500',
  ERROR: 'bg-rose-600',
};

interface CartSidebarProps {
  state: AppState | null;
  onRemoveItem: (sku: string, index: number) => void;
  onUpdateQuantity: (sku: string, index: number, quantity: number) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  onProcessPayment: () => void;
  onRetryPayment: () => void;
  onNewTransaction: () => void;
  onCancelCheckout: () => void;
}

export function CartSidebar({
  state,
  onRemoveItem,
  onUpdateQuantity,
  onClearCart,
  onCheckout,
  onProcessPayment,
  onRetryPayment,
  onNewTransaction,
  onCancelCheckout,
}: CartSidebarProps) {
  const status = state?.transactionStatus ?? 'IDLE';
  const isLocked = status !== 'IDLE';
  const isError = status === 'ERROR';
  const canRetry = isError && (state?.retryCount ?? 0) < 3;

  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col min-h-0">
      <div className="p-4 border-b border-slate-700 shrink-0 flex items-center justify-between">
        <h2 className="font-bold text-lg">Current Order</h2>
        <span className={`px-3 py-1 rounded text-sm font-bold ${STATUS_COLORS[status]}`}>
          {status}
        </span>
      </div>

      {/* Cart Items - scrollable container */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {!state || state.cart.length === 0 ? (
          <p className="text-gray-500 italic text-center py-8">Cart is empty</p>
        ) : (
          <div className="space-y-3">
            {state.cart.map((item: CartItem, index: number) => (
              <CartItemRow
                key={`${item.sku}-${index}`}
                item={item}
                disabled={isLocked}
                onRemove={() => onRemoveItem(item.sku, index)}
                onUpdateQuantity={(qty) => onUpdateQuantity(item.sku, index, qty)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Payment Actions - fixed at bottom */}
      <div className="shrink-0">
        <PaymentActions
          status={status}
          totalInCents={state?.totalInCents ?? (0 as Cents)}
          errorMessage={state?.errorMessage}
          cartLength={state?.cart.length ?? 0}
          canRetry={canRetry}
          onClearCart={onClearCart}
          onCheckout={onCheckout}
          onProcessPayment={onProcessPayment}
          onRetryPayment={onRetryPayment}
          onNewTransaction={onNewTransaction}
          onCancelCheckout={onCancelCheckout}
        />
      </div>
    </div>
  );
}

