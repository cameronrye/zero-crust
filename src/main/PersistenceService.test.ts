/**
 * PersistenceService Tests
 *
 * Tests for the data persistence layer.
 * Note: These tests use mocked electron-store since we can't use the real
 * electron-store in a Node.js test environment without Electron.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron-store before importing PersistenceService
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

// Import after mocking
import PersistenceService from './PersistenceService';
import type { TransactionRecord } from './PersistenceService';
import { cents } from '@shared/currency';

describe('PersistenceService', () => {
  let service: PersistenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PersistenceService();
  });

  describe('initialization', () => {
    it('should create a service instance', () => {
      expect(service).toBeDefined();
    });

    it('should return storage path', () => {
      expect(service.getStoragePath()).toBe('/mock/path/zero-crust-data.json');
    });
  });

  describe('inventory persistence', () => {
    it('should return empty map when no persisted inventory', () => {
      const inventory = service.loadInventory();
      expect(inventory).toBeInstanceOf(Map);
      expect(inventory.size).toBe(0);
    });

    it('should save and conceptually load inventory', () => {
      const inventory = new Map<string, number>();
      inventory.set('SKU-001', 10);
      inventory.set('SKU-002', 5);

      // Save should not throw
      expect(() => service.saveInventory(inventory)).not.toThrow();
    });

    it('should report no persisted inventory initially', () => {
      expect(service.hasPersistedInventory()).toBe(false);
    });
  });

  describe('transaction log', () => {
    it('should append transactions', () => {
      const transaction: TransactionRecord = {
        id: 'TXN-TEST-001',
        timestamp: new Date().toISOString(),
        items: [
          {
            id: 'cart-item-1',
            sku: 'HOT-N-READY',
            name: 'Hot-N-Ready Pepperoni',
            priceInCents: cents(599),
            quantity: 2,
          },
        ],
        totalInCents: cents(1198),
        status: 'completed',
      };

      expect(() => service.appendTransaction(transaction)).not.toThrow();
    });

    it('should return empty transactions initially', () => {
      const transactions = service.getTransactions();
      expect(Array.isArray(transactions)).toBe(true);
      expect(transactions.length).toBe(0);
    });

    it('should return transaction count', () => {
      expect(service.getTransactionCount()).toBe(0);
    });
  });

  describe('data clearing', () => {
    it('should clear all data without throwing', () => {
      expect(() => service.clearAll()).not.toThrow();
    });
  });
});

