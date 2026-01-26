/**
 * Preload Script - Secure bridge between Main and Renderer processes
 *
 * Exposes a limited API to the renderer via contextBridge.
 * This is the ONLY way for renderer processes to communicate with Main.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  Command,
  AppState,
  WindowId,
  ElectronAPI,
  Metrics,
  TransactionRecord,
  InventoryItem,
} from '@shared/ipc-types';
import { IPC_CHANNELS } from '@shared/ipc-types';
import type { TraceEvent, TraceStats } from '@shared/trace-types';

// Get window ID from URL query parameter (set by WindowManager)
function getWindowIdFromUrl(): WindowId {
  const params = new URLSearchParams(window.location.search);
  const windowId = params.get('windowId');
  if (
    windowId === 'cashier' ||
    windowId === 'customer' ||
    windowId === 'transactions' ||
    windowId === 'debugger'
  ) {
    return windowId;
  }
  // Default to cashier if not specified
  console.warn('Window ID not found in URL, defaulting to cashier');
  return 'cashier';
}

const windowId = getWindowIdFromUrl();

// Expose protected methods to the renderer process
const electronAPI: ElectronAPI = {
  /**
   * Send a command to the Main process
   */
  sendCommand: async (command: Command): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.COMMAND, command);
  },

  /**
   * Subscribe to state updates from Main process
   * Returns an unsubscribe function
   */
  onStateUpdate: (callback: (state: AppState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: AppState) => {
      callback(state);
    };
    ipcRenderer.on(IPC_CHANNELS.STATE_UPDATE, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.STATE_UPDATE, handler);
    };
  },

  /**
   * Subscribe to metrics updates from Main process
   * Returns an unsubscribe function
   */
  onMetricsUpdate: (callback: (metrics: Metrics) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, metrics: Metrics) => {
      callback(metrics);
    };
    ipcRenderer.on(IPC_CHANNELS.METRICS_UPDATE, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.METRICS_UPDATE, handler);
    };
  },

  /**
   * Subscribe to transactions updates from Main process
   * Returns an unsubscribe function
   */
  onTransactionsUpdate: (callback: (transactions: TransactionRecord[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, transactions: TransactionRecord[]) => {
      callback(transactions);
    };
    ipcRenderer.on(IPC_CHANNELS.TRANSACTIONS_UPDATE, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TRANSACTIONS_UPDATE, handler);
    };
  },

  /**
   * Subscribe to inventory updates from Main process
   * Returns an unsubscribe function
   */
  onInventoryUpdate: (callback: (inventory: InventoryItem[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, inventory: InventoryItem[]) => {
      callback(inventory);
    };
    ipcRenderer.on(IPC_CHANNELS.INVENTORY_UPDATE, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.INVENTORY_UPDATE, handler);
    };
  },

  /**
   * Subscribe to pong messages (for ping-pong test)
   * Returns an unsubscribe function
   */
  onPong: (callback: (message: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, message: string) => {
      callback(message);
    };
    ipcRenderer.on(IPC_CHANNELS.PONG, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PONG, handler);
    };
  },

  /**
   * Get the ID of this window
   */
  getWindowId: (): WindowId => {
    return windowId;
  },

  /**
   * Get current metrics from Main process
   */
  getMetrics: async (): Promise<Metrics> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_METRICS);
  },

  /**
   * Request initial state from Main process
   * Call this after subscribing to state updates to get the current state
   */
  requestInitialState: async (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REQUEST_STATE);
  },

  /**
   * Get all transactions from the audit log (for transaction history view)
   */
  getTransactions: async (): Promise<TransactionRecord[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_TRANSACTIONS);
  },

  /**
   * Get current inventory state (for transaction history view)
   */
  getInventory: async (): Promise<InventoryItem[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_INVENTORY);
  },

  /**
   * Show receipt window for a transaction (from transaction history view)
   */
  showReceipt: async (transactionId: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SHOW_RECEIPT, transactionId);
  },

  // Trace API (for Architecture Debug Window)

  /**
   * Subscribe to trace events from Main process
   * Returns an unsubscribe function
   */
  onTraceEvent: (callback: (event: TraceEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, traceEvent: TraceEvent) => {
      callback(traceEvent);
    };
    ipcRenderer.on(IPC_CHANNELS.TRACE_EVENT, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TRACE_EVENT, handler);
    };
  },

  /**
   * Subscribe to trace stats updates from Main process (push-based)
   * Returns an unsubscribe function
   */
  onTraceStats: (callback: (stats: TraceStats) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, stats: TraceStats) => {
      callback(stats);
    };
    ipcRenderer.on(IPC_CHANNELS.TRACE_STATS_UPDATE, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TRACE_STATS_UPDATE, handler);
    };
  },

  /**
   * Get trace event history from Main process
   */
  getTraceHistory: async (limit?: number): Promise<TraceEvent[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_TRACE_HISTORY, { limit });
  },

  /**
   * Get aggregated trace statistics from Main process
   */
  getTraceStats: async (): Promise<TraceStats> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_TRACE_STATS);
  },
};

// Expose the API to the renderer process via contextBridge
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
