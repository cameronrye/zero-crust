/**
 * Shared Types for Web Demo
 * Browser-compatible version of ipc-types.ts
 */

import type { Cents } from './currency';

// Window identifiers
export type WindowId = 'cashier' | 'customer' | 'transactions' | 'debugger';

// Command types
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

export type CommandType = Command['type'];

// Transaction status
export type TransactionStatus = 'IDLE' | 'PENDING' | 'PROCESSING' | 'PAID' | 'ERROR';

// Cart item
export interface CartItem {
  id: string;
  sku: string;
  name: string;
  priceInCents: Cents;
  quantity: number;
}

// Application state
export interface AppState {
  version: number;
  cart: CartItem[];
  totalInCents: Cents;
  transactionStatus: TransactionStatus;
  errorMessage?: string;
  retryCount: number;
  demoLoopRunning: boolean;
}

// Metrics
export interface Metrics {
  transactionsPerMinute: number;
  averageCartSize: number;
  totalTransactionsToday: number;
  totalRevenueToday: Cents;
  lastUpdated: string;
}

// Transaction record
export type AdminTransactionStatus = 'pending' | 'completed' | 'voided';

export interface TransactionRecord {
  id: string;
  /** ISO 8601 timestamp string for human readability and JSON serialization */
  timestamp: string;
  items: CartItem[];
  totalInCents: Cents;
  status: AdminTransactionStatus;
  retryCount?: number;
  lastError?: string;
}

// Inventory item
export interface InventoryItem {
  sku: string;
  name: string;
  quantity: number;
  priceInCents: Cents;
}

// Trace event types
export type TraceEventType =
  | 'command_received'
  | 'command_processed'
  | 'state_broadcast'
  | 'ipc_send'
  | 'payment_start'
  | 'payment_complete'
  | 'demo_action';

export interface TraceEvent {
  id: string;
  correlationId?: string;
  /** Unix timestamp in milliseconds (Date.now()) for fast comparison and math */
  timestamp: number;
  type: TraceEventType;
  source: string;
  target?: string;
  payload?: unknown;
  latencyMs?: number;
}

export interface TraceStats {
  totalEvents: number;
  eventsPerSecond: number;
  averageLatencyByType: Record<TraceEventType, number>;
  eventCountByType: Record<TraceEventType, number>;
  currentStateVersion: number;
  connectedWindowCount: number;
  calculatedAt: number;
}

// ElectronAPI interface (for compatibility)
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
  onTraceEvent: (callback: (event: TraceEvent) => void) => () => void;
  onTraceStats: (callback: (stats: TraceStats) => void) => () => void;
  getTraceHistory: (limit?: number) => Promise<TraceEvent[]>;
  getTraceStats: () => Promise<TraceStats>;
}

