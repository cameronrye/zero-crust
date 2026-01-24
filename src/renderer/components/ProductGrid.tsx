/**
 * ProductGrid - Category tabs and product selection grid
 */

import { PRODUCT_CATALOG, PRODUCT_CATEGORIES, type ProductCategory } from '@shared/catalog';
import { formatCurrency } from '@shared/currency';

interface ProductGridProps {
  selectedCategory: ProductCategory;
  onCategoryChange: (category: ProductCategory) => void;
  onAddItem: (sku: string) => void;
  onQuickOrder: () => void;
  isLocked: boolean;
  demoLoopRunning: boolean;
}

export function ProductGrid({
  selectedCategory,
  onCategoryChange,
  onAddItem,
  onQuickOrder,
  isLocked,
  demoLoopRunning,
}: ProductGridProps) {
  const categoryProducts = PRODUCT_CATALOG.filter(
    (p) => p.category === selectedCategory
  );

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden">
      {/* Category Tabs */}
      <nav aria-label="Product categories" role="tablist" className="flex gap-2 mb-4">
        {PRODUCT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={selectedCategory === cat}
            aria-controls={`${cat}-products`}
            onClick={() => onCategoryChange(cat)}
            disabled={isLocked}
            className={`px-4 py-2 rounded font-medium capitalize transition-colors ${
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
          onClick={onQuickOrder}
          disabled={isLocked || demoLoopRunning}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            isLocked || demoLoopRunning
              ? 'bg-slate-600 text-gray-400 cursor-not-allowed'
              : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
          }`}
        >
          Quick Order
        </button>
      </nav>

      {/* Product Grid */}
      <div
        id={`${selectedCategory}-products`}
        role="tabpanel"
        aria-label={`${selectedCategory} products`}
        className="grid grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto flex-1"
      >
        {categoryProducts.map((product, index) => (
          <button
            key={product.sku}
            onClick={() => onAddItem(product.sku)}
            disabled={isLocked}
            aria-label={`Add ${product.name} to cart, ${formatCurrency(product.priceInCents)}${index < 12 ? `, keyboard shortcut F${index + 1}` : ''}`}
            className={`bg-slate-800 p-4 rounded-lg text-left border border-slate-700 transition-all relative ${
              isLocked
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:border-amber-500 hover:bg-slate-750 cursor-pointer'
            }`}
          >
            {/* F-key shortcut badge (only show for first 12 products) */}
            {index < 12 && (
              <span
                aria-hidden="true"
                className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-mono ${
                  isLocked ? 'bg-slate-600 text-gray-400' : 'bg-slate-600 text-gray-300'
                }`}
              >
                F{index + 1}
              </span>
            )}
            <div className="font-semibold text-sm mb-1">{product.name}</div>
            <div className="text-amber-400 font-bold">
              {formatCurrency(product.priceInCents)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

