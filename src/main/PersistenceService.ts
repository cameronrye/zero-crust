/**
 * PersistenceService - Data persistence layer using electron-store
 *
 * Handles JSON-based persistence for:
 * - Inventory state (survives restarts)
 * - Transaction log (append-only audit trail)
 *
 * Design decisions:
 * - Uses electron-store for simplicity (JSON-based, atomic writes)
 * - Converts Map to plain objects for serialization
 * - Append-only transaction log for audit trail
 * - Graceful handling of first-run (empty store)
 */

import Store from 'electron-store';
import { createLogger } from './Logger';
import type { AdminTransactionStatus, TransactionRecord } from '@shared/ipc-types';

const logger = createLogger('PersistenceService');

// Re-export types from shared module for backward compatibility
export type { TransactionRecord } from '@shared/ipc-types';

/**
 * Alias for AdminTransactionStatus for use within this module
 * Re-exported as TransactionStatus for backward compatibility
 */
export type TransactionStatus = AdminTransactionStatus;

/**
 * Serializable inventory format (Maps don't serialize to JSON)
 */
export interface PersistedInventory {
  [sku: string]: number;
}

/**
 * Store schema - defines the shape of persisted data
 * Note: Index signature required for electron-store/conf compatibility with noUncheckedIndexedAccess
 */
interface StoreSchema {
  inventory: PersistedInventory;
  transactions: TransactionRecord[];
  lastUpdated: string;
  [key: string]: unknown;
}

/**
 * Typed store interface for our wrapper
 * This works around conf library type incompatibility with noUncheckedIndexedAccess
 */
interface TypedStore {
  readonly path: string;
  get<K extends keyof StoreSchema>(key: K, defaultValue?: StoreSchema[K]): StoreSchema[K];
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void;
  clear(): void;
}

/**
 * PersistenceService class - wraps electron-store with typed methods
 */
class PersistenceService {
  private store: TypedStore;
  private initialized: boolean = false;

  constructor() {
    // Cast through unknown to work around conf library type incompatibility
    this.store = new Store<StoreSchema>({
      name: 'zero-crust-data',
      // Required for electron-store v11+ when running in test environments
      projectName: 'zero-crust',
      defaults: {
        inventory: {},
        transactions: [],
        lastUpdated: new Date().toISOString(),
      },
    }) as unknown as TypedStore;

    logger.info('PersistenceService created', {
      path: this.store.path,
    });
  }

  /**
   * Initialize the persistence service.
   *
   * Should be called once on application startup.
   * Subsequent calls are ignored with a warning.
   */
  public initialize(): void {
    if (this.initialized) {
      logger.warn('PersistenceService already initialized');
      return;
    }

    logger.info('Initializing PersistenceService', {
      storagePath: this.store.path,
      hasExistingData: Object.keys(this.store.get('inventory', {})).length > 0,
      transactionCount: this.store.get('transactions', []).length,
    });

    this.initialized = true;
  }

  /**
   * Load inventory from persistent storage.
   *
   * Converts the stored JSON object format back to a Map for runtime use.
   *
   * @returns Map of SKU to quantity for all inventory items
   *
   * @example
   * const inventory = persistenceService.loadInventory();
   * const pepperoniStock = inventory.get('PIZZA-001') ?? 0;
   */
  public loadInventory(): Map<string, number> {
    const persisted = this.store.get('inventory', {});
    const inventory = new Map<string, number>();

    for (const [sku, quantity] of Object.entries(persisted)) {
      inventory.set(sku, quantity);
    }

    logger.debug('Loaded inventory', {
      itemCount: inventory.size,
    });

    return inventory;
  }

  /**
   * Save inventory to persistent storage.
   *
   * Converts the runtime Map to a JSON-serializable object.
   *
   * @param inventory - Map of SKU to quantity to persist
   */
  public saveInventory(inventory: Map<string, number>): void {
    const persisted: PersistedInventory = {};

    for (const [sku, quantity] of inventory) {
      persisted[sku] = quantity;
    }

    this.store.set('inventory', persisted);
    this.store.set('lastUpdated', new Date().toISOString());

    logger.debug('Saved inventory', {
      itemCount: inventory.size,
    });
  }

  /**
   * Check if persisted inventory data exists.
   *
   * @returns True if inventory has been saved previously, false on first run
   */
  public hasPersistedInventory(): boolean {
    const inventory = this.store.get('inventory', {});
    return Object.keys(inventory).length > 0;
  }

  /**
   * Append a transaction to the audit log.
   *
   * Transactions are immutable once appended. Use updateTransactionStatus
   * to change status of pending transactions.
   *
   * @param transaction - The transaction record to append
   */
  public appendTransaction(transaction: TransactionRecord): void {
    const transactions = this.store.get('transactions', []);
    transactions.push(transaction);
    this.store.set('transactions', transactions);
    this.store.set('lastUpdated', new Date().toISOString());

    logger.info('Transaction appended', {
      id: transaction.id,
      itemCount: transaction.items.length,
      totalInCents: transaction.totalInCents,
    });
  }

  /**
   * Get all transactions from the audit log.
   *
   * @returns Read-only array of all transaction records
   */
  public getTransactions(): readonly TransactionRecord[] {
    return this.store.get('transactions', []);
  }

  /**
   * Get transactions filtered by status.
   *
   * @param status - The transaction status to filter by
   * @returns Array of transactions matching the specified status
   */
  public getTransactionsByStatus(status: TransactionStatus): TransactionRecord[] {
    return this.getTransactions().filter((t) => t.status === status);
  }

  /**
   * Get all pending transactions.
   *
   * Used for crash recovery to find transactions that were
   * interrupted during payment processing.
   *
   * @returns Array of transactions with 'pending' status
   */
  public getPendingTransactions(): TransactionRecord[] {
    return this.getTransactionsByStatus('pending');
  }

  /**
   * Check if there are any pending transactions.
   *
   * @returns True if pending transactions exist
   */
  public hasPendingTransactions(): boolean {
    return this.getPendingTransactions().length > 0;
  }

  /**
   * Update a transaction's status.
   *
   * Used to complete or void pending transactions.
   *
   * @param transactionId - The ID of the transaction to update
   * @param status - The new status to set
   * @param updates - Optional additional updates (retryCount, lastError)
   * @returns True if the transaction was found and updated, false otherwise
   */
  public updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    updates?: { retryCount?: number; lastError?: string }
  ): boolean {
    const transactions = [...this.store.get('transactions', [])];
    const index = transactions.findIndex((t) => t.id === transactionId);

    const existingTransaction = transactions[index];
    if (index === -1 || !existingTransaction) {
      logger.warn('Transaction not found for status update', { transactionId });
      return false;
    }

    transactions[index] = {
      ...existingTransaction,
      status,
      ...(updates?.retryCount !== undefined && { retryCount: updates.retryCount }),
      ...(updates?.lastError !== undefined && { lastError: updates.lastError }),
    };

    this.store.set('transactions', transactions);
    this.store.set('lastUpdated', new Date().toISOString());

    logger.info('Transaction status updated', {
      id: transactionId,
      status,
      retryCount: updates?.retryCount,
    });

    return true;
  }

  /**
   * Find a transaction by its ID.
   *
   * @param transactionId - The transaction ID to search for
   * @returns The transaction record, or undefined if not found
   */
  public getTransactionById(transactionId: string): TransactionRecord | undefined {
    return this.getTransactions().find((t) => t.id === transactionId);
  }

  /**
   * Get the total number of transactions in the log.
   *
   * @returns Count of all transactions (all statuses)
   */
  public getTransactionCount(): number {
    return this.store.get('transactions', []).length;
  }

  /**
   * Get the file path where data is persisted.
   *
   * Useful for debugging or displaying storage location.
   *
   * @returns Absolute path to the storage file
   */
  public getStoragePath(): string {
    return this.store.path;
  }

  /**
   * Clear all persisted data.
   *
   * Use with caution - this removes all inventory and transaction history.
   * Primarily intended for testing or factory reset scenarios.
   */
  public clearAll(): void {
    logger.warn('Clearing all persisted data');
    this.store.clear();
  }
}

// Singleton instance
export const persistenceService = new PersistenceService();
export default PersistenceService;

