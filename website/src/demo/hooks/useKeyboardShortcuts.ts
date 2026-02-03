/**
 * useKeyboardShortcuts - Custom hook for keyboard shortcut handling
 *
 * Handles F1-F12 keyboard shortcuts for quick product selection.
 * Only active when the POS is in IDLE state.
 */

import { useEffect } from 'react';
import { PRODUCT_CATALOG, type ProductCategory } from '../shared/catalog';

export interface KeyboardShortcutsOptions {
  /** Callback to add an item by SKU (can be sync or async) */
  onAddItem: (sku: string) => void | Promise<void>;
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
 */
export function useKeyboardShortcuts({
  onAddItem,
  selectedCategory,
  isEnabled,
}: KeyboardShortcutsOptions): void {
  useEffect(() => {
    const fKeyRegex = /^F(\d+)$/;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEnabled) return;

      const match = fKeyRegex.exec(e.key);
      if (!match) return;

      const matchedGroup = match[1];
      if (!matchedGroup) return;

      const fNum = Number.parseInt(matchedGroup, 10);
      if (fNum < 1 || fNum > 12) return;

      const products = PRODUCT_CATALOG.filter((p) => p.category === selectedCategory);
      const productIndex = fNum - 1;
      const product = products[productIndex];

      if (product) {
        e.preventDefault();
        // Fire and forget - log errors for debugging
        Promise.resolve(onAddItem(product.sku)).catch((err) => {
          console.error('Failed to add item via keyboard shortcut:', err);
        });
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEnabled, selectedCategory, onAddItem]);
}
