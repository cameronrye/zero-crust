/**
 * MainStore - Centralized State Management for the Main Process
 *
 * This is the single source of truth for application state.
 * All state mutations happen here and are broadcast to all renderers.
 *
 * Key features:
 * - Integer-only math for currency (cents)
 * - State versioning for detecting stale updates
 * - Uses structuredClone() to prevent accidental mutations
 * - Immutable updates with immer
 */

import { produce, enableMapSet } from 'immer';
import { randomUUID } from 'node:crypto';
import { createLogger } from './Logger';

// Enable Map and Set support in immer
// Required because InternalState.inventory is a Map<string, number>
enableMapSet();
import { persistenceService, type TransactionRecord } from './PersistenceService';
import { metricsService } from './MetricsService';
import { broadcastTransactions, broadcastInventory } from './BroadcastService';
import type { AppState, CartItem, TransactionStatus, InventoryItem } from '@shared/ipc-types';
import { type Cents, multiplyCents, sumCents } from '@shared/currency';
import { getProductBySku, PRODUCT_CATALOG } from '@shared/catalog';

const logger = createLogger('MainStore');

/**
 * Maximum quantity per cart item.
 * Prevents integer overflow and unrealistic order sizes.
 */
const MAX_ITEM_QUANTITY = 99;

/**
 * Safe clone utility with fallback to JSON parse/stringify
 * structuredClone is preferred but this provides a safety net
 */
function safeClone<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch (error) {
    logger.warn('structuredClone failed, using JSON fallback', { error });
    return JSON.parse(JSON.stringify(value));
  }
}

// Inventory map type (SKU -> quantity)
export type Inventory = Map<string, number>;

/**
 * Internal state shape (includes inventory which is not broadcast)
 */
interface InternalState {
  version: number;
  cart: CartItem[];
  transactionStatus: TransactionStatus;
  errorMessage?: string;
  inventory: Inventory;
  /** Current pending transaction ID (for crash recovery) */
  pendingTransactionId?: string;
  /** Number of payment retry attempts */
  retryCount: number;
  /** Whether the demo loop is currently running */
  demoLoopRunning: boolean;
}

/**
 * State change listener type
 */
export type StateChangeListener = (state: AppState) => void;

/**
 * MainStore Class - Single source of truth for POS state
 */
class MainStore {
  private state: InternalState;
  private listeners: Set<StateChangeListener> = new Set();

  constructor() {
    // Initialize persistence service
    persistenceService.initialize();

    // Initialize with default state, loading persisted inventory if available
    this.state = {
      version: 0,
      cart: [],
      transactionStatus: 'IDLE',
      inventory: this.initializeInventory(),
      retryCount: 0,
      demoLoopRunning: false,
    };

    // Check for pending transactions on startup (crash recovery)
    this.checkPendingTransactions();

    // Initialize metrics from persisted transactions (restore today's metrics)
    const transactions = persistenceService.getTransactions();
    metricsService.initializeFromTransactions(transactions);

    logger.info('MainStore initialized', {
      version: this.state.version,
      inventorySource: persistenceService.hasPersistedInventory() ? 'persisted' : 'catalog',
      storagePath: persistenceService.getStoragePath(),
    });
  }

  /**
   * Check for pending transactions on startup (crash recovery)
   */
  private checkPendingTransactions(): void {
    const pending = persistenceService.getPendingTransactions();
    if (pending.length > 0) {
      logger.warn('Found pending transactions on startup', {
        count: pending.length,
        transactionIds: pending.map((t) => t.id),
      });
      // For now, void any pending transactions from previous session
      // In a production system, we might show a UI to resume or void
      for (const transaction of pending) {
        persistenceService.updateTransactionStatus(transaction.id, 'voided', {
          lastError: 'Voided on startup - previous session interrupted',
        });
        logger.info('Voided pending transaction', { id: transaction.id });
      }
    }
  }

  /**
   * Initialize inventory - loads from persistence and merges with catalog
   *
   * Always ensures all catalog products exist in inventory:
   * - Existing persisted items keep their stock levels
   * - New catalog items (not in persistence) get their initialStock
   * - Old persisted items (not in catalog) are removed
   */
  private initializeInventory(): Inventory {
    const inventory = new Map<string, number>();
    const persisted = persistenceService.hasPersistedInventory()
      ? persistenceService.loadInventory()
      : new Map<string, number>();

    let addedFromCatalog = 0;
    let loadedFromPersistence = 0;

    // Iterate through catalog - the source of truth for what products exist
    for (const product of PRODUCT_CATALOG) {
      if (persisted.has(product.sku)) {
        // Use persisted stock level
        inventory.set(product.sku, persisted.get(product.sku)!);
        loadedFromPersistence++;
      } else {
        // New product - use initial stock from catalog
        inventory.set(product.sku, product.initialStock);
        addedFromCatalog++;
      }
    }

    // Persist the merged inventory (removes old SKUs, adds new ones)
    if (addedFromCatalog > 0 || inventory.size !== persisted.size) {
      persistenceService.saveInventory(inventory);
      logger.info('Merged inventory with catalog', {
        total: inventory.size,
        fromPersistence: loadedFromPersistence,
        addedFromCatalog,
        removedOldSkus: persisted.size - loadedFromPersistence,
      });
    } else {
      logger.info('Loaded persisted inventory', { itemCount: inventory.size });
    }

    return inventory;
  }

  /**
   * Persist current inventory state
   */
  private persistInventory(): void {
    persistenceService.saveInventory(this.state.inventory);
  }

  /**
   * Broadcast current transactions to all windows (for admin dashboard)
   */
  private broadcastTransactionsUpdate(): void {
    const transactions = persistenceService.getTransactions();
    broadcastTransactions(transactions);
  }

  /**
   * Broadcast current inventory to all windows (for admin dashboard)
   */
  private broadcastInventoryUpdate(): void {
    const inventory = this.getAllInventory();
    broadcastInventory(inventory);
  }

  /**
   * Calculate cart total in cents
   */
  private calculateTotal(cart: CartItem[]): Cents {
    const amounts = cart.map((item) => multiplyCents(item.priceInCents, item.quantity));
    return sumCents(amounts);
  }

  /**
   * Get the public AppState (for broadcasting to renderers)
   * Uses safeClone to prevent mutations
   */
  public getState(): AppState {
    const appState: AppState = {
      version: this.state.version,
      cart: this.state.cart,
      totalInCents: this.calculateTotal(this.state.cart),
      transactionStatus: this.state.transactionStatus,
      errorMessage: this.state.errorMessage,
      retryCount: this.state.retryCount,
      demoLoopRunning: this.state.demoLoopRunning,
    };

    // Clone to prevent accidental mutations by listeners
    return safeClone(appState);
  }

  /**
   * Subscribe to state changes
   * Returns an unsubscribe function
   */
  public subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (error) {
        logger.error('Error in state listener', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Update state with immer produce and auto-increment version
   * This ensures version is updated atomically with other state changes
   */
  private updateState(recipe: (draft: InternalState) => void): void {
    this.state = produce(this.state, (draft) => {
      recipe(draft);
      draft.version++;
    });
    logger.debug('State changed', {
      version: this.state.version,
      cartItems: this.state.cart.length,
      status: this.state.transactionStatus,
    });
    this.notifyListeners();
  }

  /**
   * Add an item to the cart by SKU
   *
   * SECURITY: ID-Based Messaging Pattern
   * - Renderer sends ONLY the SKU (untrusted)
   * - Main process looks up price from trusted catalog
   * - Prevents UI price tampering attacks
   */
  public addItem(sku: string): { success: boolean; error?: string } {
    const product = getProductBySku(sku);

    if (!product) {
      logger.warn('Attempted to add unknown SKU', { sku });
      return { success: false, error: `Unknown product: ${sku}` };
    }

    // Check inventory (skip for unlimited stock)
    const stock = this.state.inventory.get(sku) ?? 0;
    if (stock !== -1 && stock <= 0) {
      logger.warn('Product out of stock', { sku });
      return { success: false, error: `Out of stock: ${product.name}` };
    }

    // Check if adding would exceed max quantity
    const existingItem = this.state.cart.find((item) => item.sku === sku);
    if (existingItem && existingItem.quantity >= MAX_ITEM_QUANTITY) {
      logger.warn('Max quantity reached for item', { sku, maxQuantity: MAX_ITEM_QUANTITY });
      return { success: false, error: `Maximum quantity (${MAX_ITEM_QUANTITY}) reached for ${product.name}` };
    }

    this.updateState((draft) => {
      // Check if item already exists in cart
      const existingIndex = draft.cart.findIndex((item) => item.sku === sku);

      if (existingIndex >= 0) {
        // Increment quantity - we know the item exists since findIndex returned >= 0
        const draftItem = draft.cart[existingIndex];
        if (draftItem) {
          draftItem.quantity++;
        }
      } else {
        // Add new item with unique ID for stable React keys
        draft.cart.push({
          id: randomUUID(),
          sku: product.sku,
          name: product.name,
          priceInCents: product.priceInCents,
          quantity: 1,
        });
      }
    });

    logger.info('Item added to cart', { sku, name: product.name });
    return { success: true };
  }

  /**
   * Remove an item from the cart
   * If index is provided, removes that specific item
   * Otherwise removes the first matching SKU
   */
  public removeItem(sku: string, index?: number): { success: boolean; error?: string } {
    const targetIndex =
      index !== undefined
        ? index
        : this.state.cart.findIndex((item) => item.sku === sku);

    if (targetIndex < 0 || targetIndex >= this.state.cart.length) {
      logger.warn('Attempted to remove non-existent cart item', { sku, index });
      return { success: false, error: 'Item not found in cart' };
    }

    const targetItem = this.state.cart[targetIndex];
    if (!targetItem || targetItem.sku !== sku) {
      logger.warn('SKU mismatch during removal', {
        expectedSku: sku,
        actualSku: targetItem?.sku,
        index,
      });
      return { success: false, error: 'SKU mismatch' };
    }

    this.updateState((draft) => {
      draft.cart.splice(targetIndex, 1);
    });

    logger.info('Item removed from cart', { sku, index: targetIndex });
    return { success: true };
  }

  /**
   * Update the quantity of a cart item
   */
  public updateQuantity(
    sku: string,
    index: number,
    quantity: number
  ): { success: boolean; error?: string } {
    if (quantity <= 0) {
      return this.removeItem(sku, index);
    }

    // Validate maximum quantity limit
    if (quantity > MAX_ITEM_QUANTITY) {
      logger.warn('Quantity exceeds maximum allowed', { sku, quantity, maxQuantity: MAX_ITEM_QUANTITY });
      return { success: false, error: `Maximum quantity is ${MAX_ITEM_QUANTITY}` };
    }

    if (index < 0 || index >= this.state.cart.length) {
      logger.warn('Invalid cart index for quantity update', { index });
      return { success: false, error: 'Invalid cart index' };
    }

    const cartItem = this.state.cart[index];
    if (!cartItem || cartItem.sku !== sku) {
      logger.warn('SKU mismatch during quantity update', {
        expectedSku: sku,
        actualSku: cartItem?.sku,
      });
      return { success: false, error: 'SKU mismatch' };
    }

    this.updateState((draft) => {
      const item = draft.cart[index];
      if (item) {
        item.quantity = quantity;
      }
    });

    logger.info('Cart item quantity updated', { sku, index, quantity });
    return { success: true };
  }

  /**
   * Clear the entire cart
   */
  public clearCart(): void {
    this.updateState((draft) => {
      draft.cart = [];
      draft.transactionStatus = 'IDLE';
      draft.errorMessage = undefined;
    });

    logger.info('Cart cleared');
  }

  /**
   * Start checkout process
   */
  public startCheckout(): { success: boolean; error?: string } {
    if (this.state.cart.length === 0) {
      logger.warn('Attempted checkout with empty cart');
      return { success: false, error: 'Cart is empty' };
    }

    if (this.state.transactionStatus !== 'IDLE') {
      logger.warn('Invalid checkout state', { status: this.state.transactionStatus });
      return { success: false, error: 'Transaction already in progress' };
    }

    this.updateState((draft) => {
      draft.transactionStatus = 'PENDING';
      draft.errorMessage = undefined;
    });

    logger.info('Checkout started');
    return { success: true };
  }

  /**
   * Cancel checkout and return to IDLE
   */
  public cancelCheckout(): void {
    this.updateState((draft) => {
      draft.transactionStatus = 'IDLE';
      draft.errorMessage = undefined;
    });

    logger.info('Checkout cancelled');
  }

  /**
   * Set transaction status (for payment flow)
   */
  public setTransactionStatus(status: TransactionStatus, errorMessage?: string): void {
    this.updateState((draft) => {
      draft.transactionStatus = status;
      draft.errorMessage = errorMessage;
    });

    logger.info('Transaction status updated', { status, errorMessage });
  }

  /**
   * Generate a unique transaction ID using crypto for better uniqueness.
   * Format: TXN-{uuid-first-12-chars}
   */
  private generateTransactionId(): string {
    const uuid = randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase();
    return `TXN-${uuid}`;
  }

  /**
   * Reset to IDLE after PAID state (ready for next customer)
   */
  public resetTransaction(): void {
    this.updateState((draft) => {
      draft.transactionStatus = 'IDLE';
      draft.errorMessage = undefined;
      draft.retryCount = 0;
      draft.pendingTransactionId = undefined;
    });

    logger.info('Transaction reset');
  }

  /**
   * Set the demo loop running state
   * Used by DemoLoopService to broadcast loop status to renderers
   */
  public setDemoLoopRunning(running: boolean): void {
    this.updateState((draft) => {
      draft.demoLoopRunning = running;
    });
    logger.info('Demo loop state changed', { running });
  }

  /**
   * Get inventory for a SKU (for display purposes)
   */
  public getInventory(sku: string): number {
    return this.state.inventory.get(sku) ?? 0;
  }

  /**
   * Get all inventory items with product details (for admin dashboard)
   */
  public getAllInventory(): InventoryItem[] {
    const items: InventoryItem[] = [];

    for (const [sku, quantity] of this.state.inventory) {
      const product = getProductBySku(sku);
      if (product) {
        items.push({
          sku,
          name: product.name,
          quantity,
          priceInCents: product.priceInCents,
        });
      }
    }

    return items;
  }

  /**
   * Start payment processing
   * Creates a pending transaction and sets status to PROCESSING
   */
  public startPaymentProcessing(): { success: boolean; transactionId: string; error?: string } {
    if (this.state.transactionStatus !== 'PENDING' && this.state.transactionStatus !== 'ERROR') {
      logger.warn('Cannot start payment - invalid state', {
        status: this.state.transactionStatus,
      });
      return { success: false, transactionId: '', error: 'Invalid transaction state' };
    }

    if (this.state.cart.length === 0) {
      logger.warn('Cannot start payment - cart is empty');
      return { success: false, transactionId: '', error: 'Cart is empty' };
    }

    // Generate transaction ID if not already set
    const transactionId = this.state.pendingTransactionId || this.generateTransactionId();

    // Create pending transaction in persistence (for crash recovery)
    if (!this.state.pendingTransactionId) {
      const pendingTransaction: TransactionRecord = {
        id: transactionId,
        timestamp: new Date().toISOString(),
        items: safeClone(this.state.cart),
        totalInCents: this.calculateTotal(this.state.cart),
        status: 'pending',
        retryCount: this.state.retryCount,
      };
      persistenceService.appendTransaction(pendingTransaction);

      // Broadcast transaction update to admin dashboard
      this.broadcastTransactionsUpdate();
    }

    this.updateState((draft) => {
      draft.transactionStatus = 'PROCESSING';
      draft.errorMessage = undefined;
      draft.pendingTransactionId = transactionId;
    });

    logger.info('Payment processing started', { transactionId });

    return { success: true, transactionId };
  }

  /**
   * Handle payment success
   * Returns receipt data for display
   */
  public handlePaymentSuccess(paymentTransactionId: string): {
    transactionId: string;
    timestamp: string;
    items: CartItem[];
    totalInCents: Cents;
  } | null {
    const transactionId = this.state.pendingTransactionId;

    if (!transactionId) {
      logger.error('No pending transaction ID for payment success');
      return null;
    }

    // Capture cart data before clearing
    const transactionItems = safeClone(this.state.cart);
    const transactionTotal = this.calculateTotal(transactionItems);
    const timestamp = new Date().toISOString();

    // Deduct inventory for all cart items
    this.updateState((draft) => {
      for (const item of draft.cart) {
        const currentStock = draft.inventory.get(item.sku) ?? 0;
        if (currentStock !== -1) {
          draft.inventory.set(item.sku, currentStock - item.quantity);
        }
      }
      draft.cart = [];
      draft.transactionStatus = 'PAID';
      draft.errorMessage = undefined;
      draft.retryCount = 0;
      draft.pendingTransactionId = undefined;
    });

    // Persist inventory changes
    this.persistInventory();

    // Update pending transaction to completed
    persistenceService.updateTransactionStatus(transactionId, 'completed');

    // Record transaction in metrics
    metricsService.recordTransaction(transactionItems, transactionTotal);

    // Broadcast updates to admin dashboard
    this.broadcastTransactionsUpdate();
    this.broadcastInventoryUpdate();

    logger.info('Payment successful', {
      transactionId,
      paymentTransactionId,
      itemCount: transactionItems.length,
      totalInCents: transactionTotal,
    });

    // Return receipt data
    return {
      transactionId,
      timestamp,
      items: transactionItems,
      totalInCents: transactionTotal,
    };
  }

  /**
   * Handle payment failure
   */
  public handlePaymentFailure(errorMessage: string): void {
    const transactionId = this.state.pendingTransactionId;

    this.updateState((draft) => {
      draft.transactionStatus = 'ERROR';
      draft.errorMessage = errorMessage;
      draft.retryCount++;
    });

    // Update pending transaction with error info
    if (transactionId) {
      persistenceService.updateTransactionStatus(transactionId, 'pending', {
        retryCount: this.state.retryCount,
        lastError: errorMessage,
      });

      // Broadcast transaction update to admin dashboard
      this.broadcastTransactionsUpdate();
    }

    logger.warn('Payment failed', {
      transactionId,
      errorMessage,
      retryCount: this.state.retryCount,
    });
  }

  /**
   * Get the current cart total in cents
   */
  public getCartTotal(): Cents {
    return this.calculateTotal(this.state.cart);
  }

  /**
   * Get the pending transaction ID
   */
  public getPendingTransactionId(): string | undefined {
    return this.state.pendingTransactionId;
  }

  /**
   * Check if we can retry the payment
   */
  public canRetryPayment(): boolean {
    return this.state.transactionStatus === 'ERROR' && this.state.retryCount < 3;
  }

  /**
   * Graceful shutdown - handles pending transactions before app exit.
   * Called from the before-quit handler to ensure data integrity.
   */
  public shutdown(): void {
    const pendingId = this.state.pendingTransactionId;

    if (pendingId) {
      logger.info('Shutdown: voiding pending transaction', { id: pendingId });
      persistenceService.updateTransactionStatus(pendingId, 'voided', {
        lastError: 'Voided on application shutdown',
      });
    }

    // Persist current inventory state
    this.persistInventory();

    logger.info('MainStore shutdown complete');
  }
}

// Singleton instance
export const mainStore = new MainStore();
export default MainStore;
