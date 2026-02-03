/**
 * WebStore - Browser-compatible state management for the web demo
 * 
 * Port of MainStore that runs entirely in the browser.
 * Uses in-memory state with no persistence.
 */

import type {
  AppState,
  CartItem,
  TransactionStatus,
  TransactionRecord,
  Metrics,
  Command,
  WindowId,
  InventoryItem,
} from '../shared/types';
import { type Cents, multiplyCents, sumCents, cents } from '../shared/currency';
import { getProductBySku, PRODUCT_CATALOG } from '../shared/catalog';
import { INVENTORY_CONFIG } from '../shared/config';
import { webTraceService } from './WebTraceService';

const MAX_ITEM_QUANTITY = 99;
const STORAGE_KEY_TRANSACTIONS = 'zeroCrust_transactions';
const STORAGE_KEY_METRICS = 'zeroCrust_metrics';
const STORAGE_KEY_INVENTORY = 'zeroCrust_inventory';
const STORAGE_KEY_LAST_RESET_DATE = 'zeroCrust_lastResetDate';
const MAX_STORED_TRANSACTIONS = 100;
const DAILY_RESET_CHECK_INTERVAL = 60000; // Check every minute

/** Check if localStorage is available (browser environment) */
function isStorageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

type StateListener = (state: AppState) => void;
type TransactionsListener = (transactions: TransactionRecord[]) => void;
type MetricsListener = (metrics: Metrics) => void;
type InventoryListener = (inventory: InventoryItem[]) => void;

interface InternalState {
  version: number;
  cart: CartItem[];
  transactionStatus: TransactionStatus;
  errorMessage?: string;
  pendingTransactionId?: string;
  retryCount: number;
  demoLoopRunning: boolean;
}

class WebStore {
  private readonly state: InternalState;
  private readonly stateListeners: Set<StateListener> = new Set();
  private readonly transactionsListeners: Set<TransactionsListener> = new Set();
  private readonly metricsListeners: Set<MetricsListener> = new Set();
  private readonly inventoryListeners: Set<InventoryListener> = new Set();
  private transactions: TransactionRecord[] = [];
  private readonly inventory: Map<string, number> = new Map();
  private metrics: Metrics = {
    transactionsPerMinute: 0,
    averageCartSize: 0,
    totalTransactionsToday: 0,
    totalRevenueToday: cents(0),
    lastUpdated: new Date().toISOString(),
  };
  private recentTransactionTimes: number[] = [];
  private lastResetDate: string = '';
  private dailyResetInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.state = {
      version: 0,
      cart: [],
      transactionStatus: 'IDLE',
      retryCount: 0,
      demoLoopRunning: false,
    };

    // Initialize inventory with default stock
    this.initializeInventory();

    // Load persisted data from localStorage
    this.loadFromStorage();

    // Check for daily reset and start periodic check
    this.checkDailyReset();
    this.startDailyResetCheck();
  }

  /**
   * Get today's date as a string (YYYY-MM-DD) in local timezone
   */
  private getTodayDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
   * Check if we need to reset daily metrics (new day started)
   */
  private checkDailyReset(): void {
    const today = this.getTodayDateString();

    // Load last reset date from storage if not already loaded
    if (!this.lastResetDate && isStorageAvailable()) {
      try {
        this.lastResetDate = localStorage.getItem(STORAGE_KEY_LAST_RESET_DATE) ?? '';
      } catch {
        this.lastResetDate = '';
      }
    }

    // If it's a new day, reset daily metrics
    if (this.lastResetDate && this.lastResetDate !== today) {
      this.resetDailyMetrics();
    }

    // Update last reset date
    this.lastResetDate = today;
    if (isStorageAvailable()) {
      try {
        localStorage.setItem(STORAGE_KEY_LAST_RESET_DATE, today);
      } catch {
        // Ignore storage errors
      }
    }
  }

  /**
   * Reset daily metrics (called at midnight)
   */
  private resetDailyMetrics(): void {
    // Filter transactions to only include today's
    const today = this.getTodayDateString();
    const todayTransactions = this.transactions.filter((t) => {
      const txDate = new Date(t.timestamp);
      // Check for invalid date
      if (Number.isNaN(txDate.getTime())) {
        return false;
      }
      const txDateStr = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}-${String(txDate.getDate()).padStart(2, '0')}`;
      return txDateStr === today;
    });

    // Recalculate today's metrics
    const completedToday = todayTransactions.filter((t) => t.status === 'completed');
    const totalItemsToday = completedToday.reduce(
      (sum, t) => sum + t.items.reduce((s, i) => s + i.quantity, 0),
      0
    );

    this.metrics = {
      transactionsPerMinute: 0,
      averageCartSize: completedToday.length > 0 ? totalItemsToday / completedToday.length : 0,
      totalTransactionsToday: completedToday.length,
      totalRevenueToday: sumCents(completedToday.map((t) => t.totalInCents)),
      lastUpdated: new Date().toISOString(),
    };

    this.recentTransactionTimes = [];
    this.saveToStorage();
    this.notifyMetricsListeners();
  }

  /**
   * Start periodic check for daily reset
   */
  private startDailyResetCheck(): void {
    this.dailyResetInterval = setInterval(() => {
      this.checkDailyReset();
    }, DAILY_RESET_CHECK_INTERVAL);
  }

  /**
   * Initialize inventory with default stock levels
   */
  private initializeInventory(): void {
    for (const product of PRODUCT_CATALOG) {
      this.inventory.set(product.sku, INVENTORY_CONFIG.INITIAL_STOCK);
    }
  }

  /**
   * Load transactions and metrics from localStorage
   */
  private loadFromStorage(): void {
    if (!isStorageAvailable()) return;

    try {
      const storedTransactions = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
      if (storedTransactions) {
        const parsed = JSON.parse(storedTransactions) as TransactionRecord[];
        // Validate and load transactions
        if (Array.isArray(parsed)) {
          this.transactions = parsed.slice(-MAX_STORED_TRANSACTIONS);
          this.recalculateMetricsFromTransactions();
        }
      }

      const storedMetrics = localStorage.getItem(STORAGE_KEY_METRICS);
      if (storedMetrics) {
        const parsed = JSON.parse(storedMetrics) as Partial<Metrics>;
        // Merge with default metrics, keeping persisted values
        if (parsed && typeof parsed === 'object') {
          this.metrics = {
            ...this.metrics,
            totalTransactionsToday: parsed.totalTransactionsToday ?? this.metrics.totalTransactionsToday,
            totalRevenueToday: parsed.totalRevenueToday ?? this.metrics.totalRevenueToday,
            averageCartSize: parsed.averageCartSize ?? this.metrics.averageCartSize,
            lastUpdated: parsed.lastUpdated ?? this.metrics.lastUpdated,
            // TPM is recalculated from recent activity
            transactionsPerMinute: 0,
          };
        }
      }

      const storedInventory = localStorage.getItem(STORAGE_KEY_INVENTORY);
      if (storedInventory) {
        const parsed = JSON.parse(storedInventory) as Record<string, number>;
        if (parsed && typeof parsed === 'object') {
          for (const [sku, quantity] of Object.entries(parsed)) {
            // Validate that quantity is a valid integer (or -1 for unlimited)
            if (typeof quantity === 'number' && Number.isFinite(quantity) && (quantity === -1 || quantity >= 0)) {
              this.inventory.set(sku, Math.floor(quantity));
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }
  }

  /**
   * Save transactions, metrics, and inventory to localStorage
   */
  private saveToStorage(): void {
    if (!isStorageAvailable()) return;

    try {
      // Keep only recent transactions to prevent unbounded growth
      const recentTransactions = this.transactions.slice(-MAX_STORED_TRANSACTIONS);
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(recentTransactions));
      localStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify(this.metrics));
      localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(Object.fromEntries(this.inventory)));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  /**
   * Recalculate metrics from stored transactions
   */
  private recalculateMetricsFromTransactions(): void {
    const completedTransactions = this.transactions.filter((t) => t.status === 'completed');
    const totalItems = completedTransactions.reduce(
      (sum, t) => sum + t.items.reduce((s, i) => s + i.quantity, 0),
      0
    );

    this.metrics = {
      transactionsPerMinute: 0, // Will be updated as new transactions come in
      averageCartSize: completedTransactions.length > 0 ? totalItems / completedTransactions.length : 0,
      totalTransactionsToday: completedTransactions.length,
      totalRevenueToday: sumCents(completedTransactions.map((t) => t.totalInCents)),
      lastUpdated: new Date().toISOString(),
    };
  }

  private calculateTotal(cart: CartItem[]): Cents {
    const amounts = cart.map((item) => multiplyCents(item.priceInCents, item.quantity));
    return sumCents(amounts);
  }

  getState(): AppState {
    return {
      version: this.state.version,
      cart: [...this.state.cart],
      totalInCents: this.calculateTotal(this.state.cart),
      transactionStatus: this.state.transactionStatus,
      errorMessage: this.state.errorMessage,
      retryCount: this.state.retryCount,
      demoLoopRunning: this.state.demoLoopRunning,
    };
  }

  subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  subscribeTransactions(listener: TransactionsListener): () => void {
    this.transactionsListeners.add(listener);
    return () => this.transactionsListeners.delete(listener);
  }

  subscribeMetrics(listener: MetricsListener): () => void {
    this.metricsListeners.add(listener);
    return () => this.metricsListeners.delete(listener);
  }

  subscribeInventory(listener: InventoryListener): () => void {
    this.inventoryListeners.add(listener);
    return () => this.inventoryListeners.delete(listener);
  }

  private notifyStateListeners(): void {
    const state = this.getState();
    webTraceService.setStateVersion(state.version);
    webTraceService.emit('state_broadcast', 'main', {
      target: 'all',
      payload: {
        version: state.version,
        cartSize: state.cart.length,
        totalInCents: state.totalInCents,
        transactionStatus: state.transactionStatus,
        errorMessage: state.errorMessage,
        retryCount: state.retryCount,
        demoLoopRunning: state.demoLoopRunning,
        cart: state.cart,
      },
    });
    for (const listener of this.stateListeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('Error in state listener:', e);
      }
    }
  }

  private notifyTransactionsListeners(): void {
    for (const listener of this.transactionsListeners) {
      try {
        listener([...this.transactions]);
      } catch (e) {
        console.error('Error in transactions listener:', e);
      }
    }
  }

  private notifyMetricsListeners(): void {
    for (const listener of this.metricsListeners) {
      try {
        listener({ ...this.metrics });
      } catch (e) {
        console.error('Error in metrics listener:', e);
      }
    }
  }

  private notifyInventoryListeners(): void {
    const inventoryList = this.getInventory();
    for (const listener of this.inventoryListeners) {
      try {
        listener(inventoryList);
      } catch (e) {
        console.error('Error in inventory listener:', e);
      }
    }
  }

  private updateState(updater: (state: InternalState) => void): void {
    updater(this.state);
    this.state.version++;
    this.notifyStateListeners();
  }

  // Command handler - main entry point
  async handleCommand(command: Command, source: WindowId = 'cashier'): Promise<void> {
    const correlationId = crypto.randomUUID();
    const startTime = Date.now();

    webTraceService.emit('command_received', source, {
      target: 'main',
      correlationId,
      payload: { commandType: command.type },
    });

    // Process command
    await this.processCommand(command);

    const latencyMs = Date.now() - startTime;
    webTraceService.emit('command_processed', 'main', {
      correlationId,
      latencyMs,
      payload: { commandType: command.type, success: true },
    });
  }

  private async processCommand(command: Command): Promise<void> {
    switch (command.type) {
      case 'ADD_ITEM':
        this.addItem(command.payload.sku);
        break;
      case 'REMOVE_ITEM':
        this.removeItem(command.payload.sku, command.payload.index);
        break;
      case 'UPDATE_QUANTITY':
        this.updateQuantity(command.payload.sku, command.payload.index, command.payload.quantity);
        break;
      case 'CLEAR_CART':
        this.clearCart();
        break;
      case 'CHECKOUT':
        this.startCheckout();
        break;
      case 'CANCEL_CHECKOUT':
        this.cancelCheckout();
        break;
      case 'PROCESS_PAYMENT':
      case 'RETRY_PAYMENT':
        await this.processPayment();
        break;
      case 'NEW_TRANSACTION':
        this.resetTransaction();
        break;
      case 'DEMO_ORDER':
      case 'START_DEMO_LOOP':
      case 'STOP_DEMO_LOOP':
        // Demo loop commands use lazy import to avoid circular dependency
        // WebDemoLoopService imports WebStore, so we can't import it at module level
        await this.handleDemoCommand(command.type);
        break;
    }
  }

  /**
   * Handle demo-related commands with lazy import to break circular dependency
   */
  private async handleDemoCommand(type: 'DEMO_ORDER' | 'START_DEMO_LOOP' | 'STOP_DEMO_LOOP'): Promise<void> {
    try {
      const { webDemoLoopService } = await import('./WebDemoLoopService');
      switch (type) {
        case 'DEMO_ORDER':
          webDemoLoopService.generateSingleOrder();
          break;
        case 'START_DEMO_LOOP':
          webDemoLoopService.start();
          break;
        case 'STOP_DEMO_LOOP':
          webDemoLoopService.stop();
          break;
      }
    } catch (error) {
      console.error('Failed to load demo loop service. Demo features may not work correctly:', error);
      // Set demo loop as not running to reflect the error state
      this.updateState((state) => {
        state.demoLoopRunning = false;
      });
    }
  }

  addItem(sku: string): { success: boolean; error?: string } {
    const product = getProductBySku(sku);
    if (!product) {
      return { success: false, error: `Unknown product: ${sku}` };
    }

    const existingItem = this.state.cart.find((item) => item.sku === sku);
    if (existingItem && existingItem.quantity >= MAX_ITEM_QUANTITY) {
      return { success: false, error: `Maximum quantity reached` };
    }

    // Check stock availability (only deduct if not already in cart - existing items don't need stock check)
    const currentStock = this.inventory.get(sku) ?? 0;
    // -1 indicates unlimited stock (special value from INVENTORY_CONFIG)
    const isUnlimitedStock = currentStock === -1;

    if (!isUnlimitedStock && currentStock <= 0) {
      return { success: false, error: `Out of stock: ${product.name}` };
    }

    // Only deduct from inventory for items with limited stock
    if (!isUnlimitedStock) {
      this.inventory.set(sku, currentStock - 1);
    }

    this.updateState((state) => {
      const existingIndex = state.cart.findIndex((item) => item.sku === sku);
      if (existingIndex >= 0) {
        state.cart[existingIndex].quantity++;
      } else {
        state.cart.push({
          id: crypto.randomUUID(),
          sku: product.sku,
          name: product.name,
          priceInCents: product.priceInCents,
          quantity: 1,
        });
      }
    });

    this.notifyInventoryListeners();
    return { success: true };
  }

  removeItem(sku: string, index?: number): { success: boolean; error?: string } {
    const targetIndex = index ?? this.state.cart.findIndex((item) => item.sku === sku);

    if (targetIndex < 0 || targetIndex >= this.state.cart.length) {
      return { success: false, error: 'Item not found' };
    }

    // Get the item to restore its quantity to inventory (skip unlimited stock)
    const item = this.state.cart[targetIndex];
    if (item) {
      const currentStock = this.inventory.get(item.sku) ?? 0;
      // Don't modify unlimited stock (-1)
      if (currentStock !== -1) {
        this.inventory.set(item.sku, currentStock + item.quantity);
      }
    }

    this.updateState((state) => {
      state.cart.splice(targetIndex, 1);
    });

    this.notifyInventoryListeners();
    return { success: true };
  }

  updateQuantity(sku: string, index: number, quantity: number): { success: boolean; error?: string } {
    if (quantity <= 0) {
      return this.removeItem(sku, index);
    }

    if (quantity > MAX_ITEM_QUANTITY) {
      return { success: false, error: `Maximum quantity is ${MAX_ITEM_QUANTITY}` };
    }

    if (index < 0 || index >= this.state.cart.length) {
      return { success: false, error: 'Invalid cart index' };
    }

    // Verify the item exists at the given index
    const item = this.state.cart[index];
    if (!item) {
      return { success: false, error: 'Item not found at index' };
    }

    // Verify the SKU matches the item at the given index
    if (item.sku !== sku) {
      return { success: false, error: 'SKU mismatch - item may have been modified' };
    }

    // Calculate inventory change
    const oldQuantity = item.quantity;
    const quantityDelta = quantity - oldQuantity;
    const currentStock = this.inventory.get(sku) ?? 0;
    const isUnlimitedStock = currentStock === -1;

    // Check if we have enough stock for increase (skip for unlimited stock)
    if (!isUnlimitedStock && quantityDelta > 0 && quantityDelta > currentStock) {
      return { success: false, error: `Only ${currentStock} more available` };
    }

    // Update inventory (skip for unlimited stock)
    if (!isUnlimitedStock) {
      this.inventory.set(sku, currentStock - quantityDelta);
    }

    this.updateState((state) => {
      if (state.cart[index]) {
        state.cart[index].quantity = quantity;
      }
    });

    this.notifyInventoryListeners();
    return { success: true };
  }

  clearCart(): void {
    // Restore inventory for all cart items (skip unlimited stock)
    for (const item of this.state.cart) {
      const currentStock = this.inventory.get(item.sku) ?? 0;
      // Don't modify unlimited stock (-1)
      if (currentStock !== -1) {
        this.inventory.set(item.sku, currentStock + item.quantity);
      }
    }

    this.updateState((state) => {
      state.cart = [];
      state.transactionStatus = 'IDLE';
      state.errorMessage = undefined;
    });

    this.notifyInventoryListeners();
  }

  startCheckout(): { success: boolean; error?: string } {
    if (this.state.cart.length === 0) {
      return { success: false, error: 'Cart is empty' };
    }

    if (this.state.transactionStatus !== 'IDLE') {
      return { success: false, error: 'Transaction already in progress' };
    }

    this.updateState((state) => {
      state.transactionStatus = 'PENDING';
      state.errorMessage = undefined;
    });

    return { success: true };
  }

  cancelCheckout(): void {
    this.updateState((state) => {
      state.transactionStatus = 'IDLE';
      state.errorMessage = undefined;
    });
  }

  async processPayment(): Promise<void> {
    if (this.state.transactionStatus !== 'PENDING' && this.state.transactionStatus !== 'ERROR') {
      return;
    }

    const transactionId = this.state.pendingTransactionId || `TXN-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    const amount = this.calculateTotal(this.state.cart);

    this.updateState((state) => {
      state.transactionStatus = 'PROCESSING';
      state.pendingTransactionId = transactionId;
    });

    webTraceService.emit('payment_start', 'main', {
      target: 'gateway',
      payload: { transactionId, amount },
    });

    try {
      // Simulate payment processing delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 90% success rate for demo
      const success = Math.random() > 0.1;

      if (success) {
        webTraceService.emit('payment_complete', 'gateway', {
          target: 'main',
          payload: { transactionId, success: true },
        });
        this.handlePaymentSuccess(transactionId);
      } else {
        webTraceService.emit('payment_complete', 'gateway', {
          target: 'main',
          payload: { transactionId, success: false, error: 'Card declined' },
        });
        this.handlePaymentFailure('Payment declined - please try again');
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      webTraceService.emit('payment_complete', 'gateway', {
        target: 'main',
        payload: { transactionId, success: false, error: 'Processing error' },
      });
      this.handlePaymentFailure('Payment processing failed - please try again');
    }
  }

  private handlePaymentSuccess(transactionId: string): void {
    const items = [...this.state.cart];
    const total = this.calculateTotal(items);
    const timestamp = new Date().toISOString();

    // Record transaction
    this.transactions.push({
      id: transactionId,
      timestamp,
      items,
      totalInCents: total,
      status: 'completed',
    });

    // Update metrics
    this.recentTransactionTimes.push(Date.now());
    const oneMinuteAgo = Date.now() - 60000;
    this.recentTransactionTimes = this.recentTransactionTimes.filter((t) => t > oneMinuteAgo);

    const totalItems = this.transactions.reduce(
      (sum, t) => sum + t.items.reduce((s, i) => s + i.quantity, 0),
      0
    );

    this.metrics = {
      transactionsPerMinute: this.recentTransactionTimes.length,
      averageCartSize: this.transactions.length > 0 ? totalItems / this.transactions.length : 0,
      totalTransactionsToday: this.transactions.filter((t) => t.status === 'completed').length,
      totalRevenueToday: sumCents(
        this.transactions.filter((t) => t.status === 'completed').map((t) => t.totalInCents)
      ),
      lastUpdated: new Date().toISOString(),
    };

    this.updateState((state) => {
      state.cart = [];
      state.transactionStatus = 'PAID';
      state.errorMessage = undefined;
      state.retryCount = 0;
      state.pendingTransactionId = undefined;
    });

    // Persist to localStorage
    this.saveToStorage();

    this.notifyTransactionsListeners();
    this.notifyMetricsListeners();
  }

  private handlePaymentFailure(errorMessage: string): void {
    this.updateState((state) => {
      state.transactionStatus = 'ERROR';
      state.errorMessage = errorMessage;
      state.retryCount++;
    });
  }

  resetTransaction(): void {
    this.updateState((state) => {
      state.transactionStatus = 'IDLE';
      state.errorMessage = undefined;
      state.retryCount = 0;
      state.pendingTransactionId = undefined;
    });
  }

  setDemoLoopRunning(running: boolean): void {
    this.updateState((state) => {
      state.demoLoopRunning = running;
    });
  }

  getTransactions(): TransactionRecord[] {
    return [...this.transactions];
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  getInventory(): InventoryItem[] {
    return PRODUCT_CATALOG.map((product) => ({
      sku: product.sku,
      name: product.name,
      quantity: this.inventory.get(product.sku) ?? 0,
      priceInCents: product.priceInCents,
    }));
  }

  getStock(sku: string): number {
    return this.inventory.get(sku) ?? 0;
  }

  /**
   * Clear all stored data and reset to initial state
   */
  clearAllData(): void {
    this.transactions = [];
    this.recentTransactionTimes = [];
    this.metrics = {
      transactionsPerMinute: 0,
      averageCartSize: 0,
      totalTransactionsToday: 0,
      totalRevenueToday: cents(0),
      lastUpdated: new Date().toISOString(),
    };

    // Reset inventory to initial stock
    this.initializeInventory();

    // Reset last reset date to today
    this.lastResetDate = this.getTodayDateString();

    // Clear localStorage
    if (isStorageAvailable()) {
      try {
        localStorage.removeItem(STORAGE_KEY_TRANSACTIONS);
        localStorage.removeItem(STORAGE_KEY_METRICS);
        localStorage.removeItem(STORAGE_KEY_INVENTORY);
        localStorage.setItem(STORAGE_KEY_LAST_RESET_DATE, this.lastResetDate);
      } catch (error) {
        console.warn('Failed to clear localStorage:', error);
      }
    }

    // Reset state
    this.updateState((state) => {
      state.cart = [];
      state.transactionStatus = 'IDLE';
      state.errorMessage = undefined;
      state.retryCount = 0;
      state.pendingTransactionId = undefined;
    });

    this.notifyTransactionsListeners();
    this.notifyMetricsListeners();
    this.notifyInventoryListeners();
  }
}

// Singleton instance
export const webStore = new WebStore();

