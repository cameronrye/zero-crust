/**
 * useKeyboardShortcuts - Custom hook for keyboard shortcut handling
 *
 * Handles F1-F12 keyboard shortcuts for quick product selection.
 * Only active when the POS is in IDLE state.
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   onAddItem: (sku) => commands.handleAddItem(sku),
 *   selectedCategory: 'pizza',
 *   isEnabled: !isLocked,
 * });
 * ```
 */

import { useEffect } from 'react';
import { PRODUCT_CATALOG, type ProductCategory } from '@shared/catalog';

/**
 * Options for the useKeyboardShortcuts hook
 */
export interface KeyboardShortcutsOptions {
  /** Callback to add an item by SKU */
  onAddItem: (sku: string) => void;
  /** Currently selected product category */
  selectedCategory: ProductCategory;
  /** Whether keyboard shortcuts are enabled */
  isEnabled: boolean;
}

/**
 * Custom hook that registers F1-F12 keyboard shortcuts for quick product selection.
 *
 * Shortcuts are only active when isEnabled is true (typically when transaction
 * status is IDLE). F-keys map to products in the currently selected category.
 *
 * @param options - Configuration options for keyboard shortcuts
 */
export function useKeyboardShortcuts({
  onAddItem,
  selectedCategory,
  isEnabled,
}: KeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEnabled) return;

      const match = e.key.match(/^F(\d+)$/);
      if (!match) return;

      const matchedGroup = match[1];
      if (!matchedGroup) return;

      const fNum = parseInt(matchedGroup, 10);
      if (fNum < 1 || fNum > 12) return;

      const products = PRODUCT_CATALOG.filter((p) => p.category === selectedCategory);
      const productIndex = fNum - 1;
      const product = products[productIndex];

      if (product) {
        e.preventDefault();
        onAddItem(product.sku);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEnabled, selectedCategory, onAddItem]);
}

