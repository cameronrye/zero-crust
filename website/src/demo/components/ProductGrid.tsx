/**
 * ProductGrid - Category tabs and product selection grid (Web version)
 *
 * Features:
 * - Category tabs for product filtering
 * - F1-F12 keyboard shortcut indicators
 * - Stock level indicators
 * - Quick Order button for demo transactions
 */

import { PRODUCT_CATALOG, PRODUCT_CATEGORIES, type ProductCategory } from '../shared/catalog';
import { formatCurrency } from '../shared/currency';
import { INVENTORY_CONFIG } from '../shared/config';

interface ProductGridProps {
  selectedCategory: ProductCategory;
  onCategoryChange: (category: ProductCategory) => void;
  onAddItem: (sku: string) => void;
  onDemoOrder: () => void;
  isLocked: boolean;
  demoLoopRunning: boolean;
  /** Show F-key indicators on product buttons */
  showShortcuts?: boolean;
  /** Stock levels by SKU */
  stockBySku?: Map<string, number>;
}

export function ProductGrid({
  selectedCategory,
  onCategoryChange,
  onAddItem,
  onDemoOrder,
  isLocked,
  demoLoopRunning,
  showShortcuts = true,
  stockBySku,
}: Readonly<ProductGridProps>) {
  const categoryProducts = PRODUCT_CATALOG.filter(
    (p) => p.category === selectedCategory
  );

  return (
    <div className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
      {/* Category Tabs */}
      <nav className="flex gap-1 md:gap-2 mb-2 md:mb-4 flex-wrap items-center" aria-label="Product categories">
        {PRODUCT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            disabled={isLocked}
            aria-pressed={selectedCategory === cat}
            className={`px-2 md:px-4 py-1.5 md:py-2 rounded text-xs md:text-base font-medium capitalize transition-colors ${
              selectedCategory === cat
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {cat}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={onDemoOrder}
          disabled={isLocked || demoLoopRunning}
          aria-label="Generate a random demo order"
          className={`px-2 md:px-4 py-1.5 md:py-2 rounded text-xs md:text-base font-medium transition-colors ${
            isLocked || demoLoopRunning
              ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer'
          }`}
        >
          Quick Order
        </button>
      </nav>

      {/* Product Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-1.5 md:gap-3 overflow-y-auto flex-1" aria-label="Products">
        {categoryProducts.map((product, index) => {
          const fKey = index < 12 ? `F${index + 1}` : null;
          const shortcutSuffix = fKey ? `, shortcut ${fKey}` : '';
          const stock = stockBySku?.get(product.sku) ?? INVENTORY_CONFIG.INITIAL_STOCK;
          const isOutOfStock = stock <= 0;
          const isLowStock = stock > 0 && stock <= INVENTORY_CONFIG.LOW_STOCK_THRESHOLD;
          const isDisabled = isLocked || isOutOfStock;

          // Build stock suffix for aria-label
          let stockSuffix = '';
          if (isOutOfStock) stockSuffix = ', out of stock';
          else if (isLowStock) stockSuffix = `, ${stock} left`;

          const ariaLabel = `Add ${product.name} to cart, ${formatCurrency(product.priceInCents)}${shortcutSuffix}${stockSuffix}`;

          // Determine button styling based on state
          let buttonClass = 'hover:border-amber-500 hover:bg-slate-750 cursor-pointer border-slate-700';
          if (isOutOfStock) buttonClass = 'opacity-40 cursor-not-allowed border-slate-700';
          else if (isDisabled) buttonClass = 'opacity-50 cursor-not-allowed border-slate-700';

          return (
            <button
              key={product.sku}
              onClick={() => onAddItem(product.sku)}
              disabled={isDisabled}
              aria-label={ariaLabel}
              className={`bg-slate-800 p-2 md:p-4 rounded-lg text-left border transition-all relative ${buttonClass}`}
            >
              {/* F-key shortcut indicator - hidden on mobile, visible on desktop */}
              {showShortcuts && fKey && !isDisabled && (
                <span
                  className="hidden md:block absolute top-1 right-1 text-[10px] text-gray-500 bg-slate-900/80 px-1.5 py-0.5 rounded font-mono"
                  aria-hidden="true"
                >
                  {fKey}
                </span>
              )}
              <div className="font-semibold text-xs md:text-sm mb-0.5 md:mb-1">{product.name}</div>
              <div className="flex items-center justify-between">
                <span className="text-amber-400 font-bold text-sm md:text-base">
                  {formatCurrency(product.priceInCents)}
                </span>
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
}

