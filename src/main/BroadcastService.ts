/**
 * BroadcastService - Connects MainStore to WindowManager for state broadcasting
 *
 * Subscribes to MainStore changes and broadcasts the entire state to all renderer windows.
 * This ensures both Cashier and Customer displays are always in sync.
 *
 * Why broadcast entire state?
 * - Simplicity over optimization
 * - For a cart with <50 items, sending the whole state is negligible overhead
 * - Eliminates an entire class of sync bugs
 */

import { createLogger } from './Logger';
import { mainStore } from './MainStore';
import { windowManager } from './WindowManager';
import type { AppState, Metrics, TransactionRecord, InventoryItem } from '@shared/ipc-types';
import { IPC_CHANNELS } from '@shared/ipc-types';

const logger = createLogger('BroadcastService');

/**
 * Initialize the broadcast service
 * Subscribes to MainStore and broadcasts state changes to all windows
 */
export function initializeBroadcastService(): void {
  logger.info('Initializing broadcast service');

  // Subscribe to state changes
  mainStore.subscribe((state: AppState) => {
    logger.debug('Broadcasting state update', {
      version: state.version,
      cartItems: state.cart.length,
      totalInCents: state.totalInCents,
      status: state.transactionStatus,
    });

    // Broadcast to all windows via WindowManager
    windowManager.broadcast(IPC_CHANNELS.STATE_UPDATE, state);
  });

  // Broadcast initial state to any windows that are already open
  broadcastCurrentState();

  logger.info('Broadcast service initialized');
}

/**
 * Manually broadcast the current state
 * Useful for sending initial state when windows are ready
 */
export function broadcastCurrentState(): void {
  const state = mainStore.getState();
  logger.debug('Broadcasting current state', { version: state.version });
  windowManager.broadcast(IPC_CHANNELS.STATE_UPDATE, state);
}

/**
 * Broadcast metrics update to all windows
 * Called when transactions are recorded to push real-time updates
 */
export function broadcastMetrics(metrics: Metrics): void {
  logger.debug('Broadcasting metrics update', {
    transactionsPerMinute: metrics.transactionsPerMinute,
    totalTransactionsToday: metrics.totalTransactionsToday,
  });
  windowManager.broadcast(IPC_CHANNELS.METRICS_UPDATE, metrics);
}

/**
 * Broadcast transactions update to all windows
 * Called when transactions are appended or updated
 */
export function broadcastTransactions(transactions: readonly TransactionRecord[]): void {
  logger.debug('Broadcasting transactions update', {
    count: transactions.length,
  });
  windowManager.broadcast(IPC_CHANNELS.TRANSACTIONS_UPDATE, transactions);
}

/**
 * Broadcast inventory update to all windows
 * Called when inventory changes (checkout, restock)
 */
export function broadcastInventory(inventory: InventoryItem[]): void {
  logger.debug('Broadcasting inventory update', {
    count: inventory.length,
  });
  windowManager.broadcast(IPC_CHANNELS.INVENTORY_UPDATE, inventory);
}

