/**
 * MainStore Tests - State broadcast consistency
 *
 * These tests verify:
 * - Version numbers increment correctly on state changes
 * - State broadcasts are triggered on mutations
 * - State is properly cloned to prevent mutations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cents } from '@shared/currency';

// Mock electron-store before importing MainStore (must use class-based mock)
vi.mock('electron-store', () => {
  class MockStore {
    private store: Record<string, unknown> = {
      inventory: {},
      transactions: [],
      lastUpdated: new Date().toISOString(),
    };
    public path = '/mock/path/zero-crust-data.json';

    get(key: string, defaultValue?: unknown) {
      return this.store[key] ?? defaultValue;
    }

    set(key: string, value: unknown) {
      this.store[key] = value;
    }

    clear() {
      this.store = {
        inventory: {},
        transactions: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  return { default: MockStore };
});

// Mock the catalog to provide test products
vi.mock('@shared/catalog', () => ({
  PRODUCT_CATALOG: [
    {
      sku: 'TEST-PIZZA',
      name: 'Test Pizza',
      description: 'A test pizza',
      priceInCents: 599,
      category: 'pizza',
      initialStock: 10,
    },
    {
      sku: 'TEST-DRINK',
      name: 'Test Drink',
      description: 'A test drink',
      priceInCents: 199,
      category: 'drinks',
      initialStock: 20,
    },
  ],
  getProductBySku: (sku: string) => {
    const products: Record<string, unknown> = {
      'TEST-PIZZA': {
        sku: 'TEST-PIZZA',
        name: 'Test Pizza',
        priceInCents: 599,
        category: 'pizza',
        initialStock: 10,
      },
      'TEST-DRINK': {
        sku: 'TEST-DRINK',
        name: 'Test Drink',
        priceInCents: 199,
        category: 'drinks',
        initialStock: 20,
      },
    };
    return products[sku];
  },
}));

describe('MainStore - State Broadcast Consistency', () => {
  let MainStore: typeof import('./MainStore').default;

  beforeEach(async () => {
    vi.resetModules();
    // Re-import MainStore to get a fresh instance
    const module = await import('./MainStore');
    MainStore = module.default;
  });

  describe('version number increments', () => {
    it('should start with version 0', () => {
      const store = new MainStore();
      const state = store.getState();
      expect(state.version).toBe(0);
    });

    it('should increment version when adding an item', () => {
      const store = new MainStore();
      const initialVersion = store.getState().version;

      store.addItem('TEST-PIZZA');

      const newVersion = store.getState().version;
      expect(newVersion).toBe(initialVersion + 1);
    });

    it('should increment version when removing an item', () => {
      const store = new MainStore();
      store.addItem('TEST-PIZZA');
      const versionAfterAdd = store.getState().version;

      store.removeItem('TEST-PIZZA', 0);

      const versionAfterRemove = store.getState().version;
      expect(versionAfterRemove).toBe(versionAfterAdd + 1);
    });

    it('should increment version when updating quantity', () => {
      const store = new MainStore();
      store.addItem('TEST-PIZZA');
      const versionAfterAdd = store.getState().version;

      store.updateQuantity('TEST-PIZZA', 0, 5);

      const versionAfterUpdate = store.getState().version;
      expect(versionAfterUpdate).toBe(versionAfterAdd + 1);
    });

    it('should increment version when clearing cart', () => {
      const store = new MainStore();
      store.addItem('TEST-PIZZA');
      const versionAfterAdd = store.getState().version;

      store.clearCart();

      const versionAfterClear = store.getState().version;
      expect(versionAfterClear).toBe(versionAfterAdd + 1);
    });

    it('should increment version on transaction status change', () => {
      const store = new MainStore();
      store.addItem('TEST-PIZZA');
      const versionAfterAdd = store.getState().version;

      store.startCheckout();

      const versionAfterCheckout = store.getState().version;
      expect(versionAfterCheckout).toBe(versionAfterAdd + 1);
    });

    it('should increment version multiple times for multiple operations', () => {
      const store = new MainStore();
      const initialVersion = store.getState().version;

      store.addItem('TEST-PIZZA');
      store.addItem('TEST-DRINK');
      store.updateQuantity('TEST-PIZZA', 0, 3);
      store.removeItem('TEST-DRINK', 1);

      const finalVersion = store.getState().version;
      expect(finalVersion).toBe(initialVersion + 4);
    });
  });

  describe('state change listeners', () => {
    it('should notify listeners on state change', () => {
      const store = new MainStore();
      const listener = vi.fn();

      store.subscribe(listener);
      store.addItem('TEST-PIZZA');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          cart: expect.arrayContaining([
            expect.objectContaining({ sku: 'TEST-PIZZA' }),
          ]),
        })
      );
    });

    it('should notify listeners for each state change', () => {
      const store = new MainStore();
      const listener = vi.fn();

      store.subscribe(listener);
      store.addItem('TEST-PIZZA');
      store.addItem('TEST-DRINK');
      store.clearCart();

      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('should allow unsubscribing from state changes', () => {
      const store = new MainStore();
      const listener = vi.fn();

      const unsubscribe = store.subscribe(listener);
      store.addItem('TEST-PIZZA');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      store.addItem('TEST-DRINK');
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });

  describe('state immutability', () => {
    it('should return cloned state to prevent external mutations', () => {
      const store = new MainStore();
      store.addItem('TEST-PIZZA');

      const state1 = store.getState();
      const state2 = store.getState();

      // Should be equal in value but different references
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
      expect(state1.cart).not.toBe(state2.cart);
    });

    it('should not allow external mutation of returned state', () => {
      const store = new MainStore();
      store.addItem('TEST-PIZZA');

      const state = store.getState();
      state.cart.push({
        id: 'hacked-id',
        sku: 'HACKED',
        name: 'Hacked Item',
        priceInCents: cents(0),
        quantity: 100,
      });

      // Original store state should be unchanged
      const freshState = store.getState();
      expect(freshState.cart).toHaveLength(1);
      expect(freshState.cart[0]?.sku).toBe('TEST-PIZZA');
    });
  });
});

