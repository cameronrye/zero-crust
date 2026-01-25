/**
 * IPC Types - Shared type definitions for IPC communication between Main and Renderer processes
 * Uses discriminated unions for type-safe command handling
 */

import type { Cents } from './currency';

// Window identifiers
export type WindowId = 'cashier' | 'customer' | 'transactions';

// Command types - Discriminated union for all IPC commands
export type Command =
  | { type: 'PING'; payload: { source: WindowId; message: string } }
  | { type: 'ADD_ITEM'; payload: { sku: string } }
  | { type: 'REMOVE_ITEM'; payload: { sku: string; index?: number } }
  | { type: 'UPDATE_QUANTITY'; payload: { sku: string; index: number; quantity: number } }
  | { type: 'CLEAR_CART'; payload: null }
  | { type: 'CHECKOUT'; payload: null }
  | { type: 'CANCEL_CHECKOUT'; payload: null }
  | { type: 'PROCESS_PAYMENT'; payload: null }
  | { type: 'RETRY_PAYMENT'; payload: null }
  | { type: 'NEW_TRANSACTION'; payload: null }
  | { type: 'DEMO_ORDER'; payload: null }
  | { type: 'START_DEMO_LOOP'; payload: null }
  | { type: 'STOP_DEMO_LOOP'; payload: null };

// Extract command type literals
export type CommandType = Command['type'];

// Transaction status
export type TransactionStatus = 'IDLE' | 'PENDING' | 'PROCESSING' | 'PAID' | 'ERROR';

// Cart item
export interface CartItem {
  /** Unique identifier for this cart entry */
  id: string;
  sku: string;
  name: string;
  /** Price in cents (integer-only math) */
  priceInCents: Cents;
  quantity: number;
}

// Application state broadcast to renderers
export interface AppState {
  /** Incrementing version number to detect stale updates */
  version: number;
  cart: CartItem[];
  /** Total in cents */
  totalInCents: Cents;
  transactionStatus: TransactionStatus;
  /** Error message if transactionStatus is ERROR */
  errorMessage?: string;
  /** Number of payment retry attempts (for UI display) */
  retryCount: number;
  /** Whether the demo loop is currently running */
  demoLoopRunning: boolean;
}

/**
 * Metrics data exposed to UI
 */
export interface Metrics {
  transactionsPerMinute: number;
  averageCartSize: number;
  totalTransactionsToday: number;
  totalRevenueToday: Cents;
  lastUpdated: string;
}

/**
 * Transaction record for transaction history view
 */
export type AdminTransactionStatus = 'pending' | 'completed' | 'voided';

export interface TransactionRecord {
  id: string;
  timestamp: string;
  items: CartItem[];
  totalInCents: Cents;
  status: AdminTransactionStatus;
  retryCount?: number;
  lastError?: string;
}

/**
 * Inventory item for transaction history view
 */
export interface InventoryItem {
  sku: string;
  name: string;
  quantity: number;
  priceInCents: Cents;
}

// IPC Channel names
export const IPC_CHANNELS = {
  // Renderer -> Main
  COMMAND: 'pos:command',
  GET_METRICS: 'pos:get-metrics',
  REQUEST_STATE: 'pos:request-state',
  GET_TRANSACTIONS: 'pos:get-transactions',
  GET_INVENTORY: 'pos:get-inventory',
  SHOW_RECEIPT: 'pos:show-receipt',
  // Main -> Renderer
  STATE_UPDATE: 'pos:state-update',
  METRICS_UPDATE: 'pos:metrics-update',
  TRANSACTIONS_UPDATE: 'pos:transactions-update',
  INVENTORY_UPDATE: 'pos:inventory-update',
  PONG: 'pos:pong',
} as const;

// API exposed to renderer via contextBridge
export interface ElectronAPI {
  sendCommand: (command: Command) => Promise<void>;
  onStateUpdate: (callback: (state: AppState) => void) => () => void;
  onMetricsUpdate: (callback: (metrics: Metrics) => void) => () => void;
  onTransactionsUpdate: (callback: (transactions: TransactionRecord[]) => void) => () => void;
  onInventoryUpdate: (callback: (inventory: InventoryItem[]) => void) => () => void;
  onPong: (callback: (message: string) => void) => () => void;
  getWindowId: () => WindowId;
  getMetrics: () => Promise<Metrics>;
  requestInitialState: () => Promise<void>;
  getTransactions: () => Promise<TransactionRecord[]>;
  getInventory: () => Promise<InventoryItem[]>;
  showReceipt: (transactionId: string) => Promise<void>;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

