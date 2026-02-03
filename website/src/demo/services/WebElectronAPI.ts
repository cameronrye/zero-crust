/**
 * WebElectronAPI - Browser-compatible mock of the Electron API
 * 
 * Provides the same interface as window.electronAPI but uses
 * WebStore and WebTraceService instead of IPC.
 */

import type {
  ElectronAPI,
  Command,
  AppState,
  Metrics,
  TransactionRecord,
  InventoryItem,
  WindowId,
  TraceEvent,
  TraceStats,
} from '../shared/types';
import { webStore } from './WebStore';
import { webTraceService } from './WebTraceService';

/**
 * Create a WebElectronAPI instance for a specific window
 */
export function createWebElectronAPI(windowId: WindowId): ElectronAPI {
  return {
    sendCommand: async (command: Command): Promise<void> => {
      await webStore.handleCommand(command, windowId);
    },

    onStateUpdate: (callback: (state: AppState) => void): (() => void) => {
      // Immediately send current state
      setTimeout(() => callback(webStore.getState()), 0);
      return webStore.subscribe(callback);
    },

    onMetricsUpdate: (callback: (metrics: Metrics) => void): (() => void) => {
      setTimeout(() => callback(webStore.getMetrics()), 0);
      return webStore.subscribeMetrics(callback);
    },

    onTransactionsUpdate: (callback: (transactions: TransactionRecord[]) => void): (() => void) => {
      setTimeout(() => callback(webStore.getTransactions()), 0);
      return webStore.subscribeTransactions(callback);
    },

    onInventoryUpdate: (callback: (inventory: InventoryItem[]) => void): (() => void) => {
      // Send initial inventory
      setTimeout(() => callback(webStore.getInventory()), 0);
      // Subscribe to inventory updates
      return webStore.subscribeInventory(callback);
    },

    onPong: (callback: (message: string) => void): (() => void) => {
      // In web demo, simulate a pong response for connectivity checks
      const timeoutId = setTimeout(() => callback('pong'), 0);
      return () => clearTimeout(timeoutId);
    },

    getWindowId: (): WindowId => {
      return windowId;
    },

    getMetrics: async (): Promise<Metrics> => {
      return webStore.getMetrics();
    },

    requestInitialState: async (): Promise<void> => {
      // State is already sent via onStateUpdate subscription
    },

    getTransactions: async (): Promise<TransactionRecord[]> => {
      return webStore.getTransactions();
    },

    getInventory: async (): Promise<InventoryItem[]> => {
      return webStore.getInventory();
    },

    showReceipt: async (transactionId: string): Promise<void> => {
      // Receipt display not implemented in web demo
      console.info(`[Web Demo] Receipt view not available. Transaction: ${transactionId}`);
    },

    onTraceEvent: (callback: (event: TraceEvent) => void): (() => void) => {
      return webTraceService.subscribe(callback);
    },

    onTraceStats: (callback: (stats: TraceStats) => void): (() => void) => {
      setTimeout(() => callback(webTraceService.getStats()), 0);
      return webTraceService.subscribeStats(callback);
    },

    getTraceHistory: async (limit?: number): Promise<TraceEvent[]> => {
      return webTraceService.getHistory(limit);
    },

    getTraceStats: async (): Promise<TraceStats> => {
      return webTraceService.getStats();
    },
  };
}

/**
 * Context for providing WebElectronAPI to React components
 */
export type WebElectronAPIContextValue = {
  api: ElectronAPI;
  windowId: WindowId;
};

