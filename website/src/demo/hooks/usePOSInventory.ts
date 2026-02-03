/**
 * usePOSInventory - Custom hook for subscribing to inventory updates
 */

import { useState, useEffect, useMemo } from 'react';
import { useElectronAPI } from '../context/WebAPIContext';
import type { InventoryItem } from '../shared/types';

export interface POSInventoryResult {
  inventory: InventoryItem[];
  stockBySku: Map<string, number>;
  isLoading: boolean;
}

/**
 * Hook to subscribe to real-time inventory updates
 */
export function usePOSInventory(): POSInventoryResult {
  const api = useElectronAPI();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = api.onInventoryUpdate((newInventory) => {
      setInventory(newInventory);
      setIsLoading(false);
    });

    return unsubscribe;
  }, [api]);

  const stockBySku = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of inventory) {
      map.set(item.sku, item.quantity);
    }
    return map;
  }, [inventory]);

  return { inventory, stockBySku, isLoading };
}
