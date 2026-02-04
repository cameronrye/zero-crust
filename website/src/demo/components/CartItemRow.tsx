/**
 * CartItemRow - Individual cart item display with quantity controls (Web version)
 */

import type { CartItem } from '../shared/types';
import { formatCurrency, multiplyCents } from '../shared/currency';

interface CartItemRowProps {
  item: CartItem;
  disabled: boolean;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}

export function CartItemRow({
  item,
  disabled,
  onRemove,
  onUpdateQuantity,
}: Readonly<CartItemRowProps>) {
  const itemTotal = multiplyCents(item.priceInCents, item.quantity);

  return (
    <article className="bg-slate-700 rounded p-2 md:p-3" aria-label={`${item.name}, quantity ${item.quantity}`}>
      <div className="flex justify-between items-start mb-1 md:mb-2">
        <span className="font-medium text-xs md:text-sm">{item.name}</span>
        <button
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${item.name} from cart`}
          className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center text-gray-400 hover:text-rose-400 active:text-rose-300 disabled:opacity-50 cursor-pointer"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={() => onUpdateQuantity(item.quantity - 1)}
            disabled={disabled || item.quantity <= 1}
            aria-label={`Decrease quantity of ${item.name}`}
            className="w-8 h-8 md:w-10 md:h-10 rounded bg-slate-600 hover:bg-slate-500 active:bg-slate-400 disabled:opacity-50 text-sm md:text-base font-medium cursor-pointer"
          >
            <span aria-hidden="true">−</span>
          </button>
          <span className="w-6 md:w-8 text-center text-sm md:text-base" aria-label={`Quantity: ${item.quantity}`}>{item.quantity}</span>
          <button
            onClick={() => onUpdateQuantity(item.quantity + 1)}
            disabled={disabled}
            aria-label={`Increase quantity of ${item.name}`}
            className="w-8 h-8 md:w-10 md:h-10 rounded bg-slate-600 hover:bg-slate-500 active:bg-slate-400 disabled:opacity-50 text-sm md:text-base font-medium cursor-pointer"
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
        <span className="text-amber-400 text-sm md:text-base" aria-label={`Item total: ${formatCurrency(itemTotal)}`}>
          {formatCurrency(itemTotal)}
        </span>
      </div>
    </article>
  );
}

