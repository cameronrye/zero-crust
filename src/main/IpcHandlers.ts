/**
 * IPC Handlers - Handles commands from renderer processes
 *
 * All IPC communication is centralized here.
 * Commands are validated and routed to the CommandHandler.
 * State updates are automatically broadcast via BroadcastService.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { createLogger } from './Logger';
import { windowManager } from './WindowManager';
import { handleCommand } from './CommandHandler';
import { initializeBroadcastService, broadcastCurrentState } from './BroadcastService';
import { metricsService } from './MetricsService';
import { persistenceService } from './PersistenceService';
import { mainStore } from './MainStore';
import { validateSender } from './SecurityHandlers';
import type { WindowId } from '@shared/ipc-types';
import { IPC_CHANNELS } from '@shared/ipc-types';
import { validateCommand } from '@shared/schemas';

const logger = createLogger('IpcHandlers');

/**
 * Initialize all IPC handlers
 */
export function initializeIpcHandlers(): void {
  logger.info('Initializing IPC handlers');

  // Initialize the broadcast service (MainStore -> Windows)
  initializeBroadcastService();

  // Handle commands from renderer
  ipcMain.handle(IPC_CHANNELS.COMMAND, async (event, rawCommand: unknown) => {
    // Security: Validate sender is from trusted source
    if (!validateSender(event.senderFrame)) {
      logger.warn('Rejected IPC from untrusted sender', {
        url: event.senderFrame.url,
      });
      throw new Error('Unauthorized: IPC from untrusted source');
    }

    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const windowId = getWindowIdFromSender(senderWindow);

    // Validate command with Zod schema
    const validationResult = validateCommand(rawCommand);

    if (!validationResult.success) {
      logger.warn('Invalid command received', {
        source: windowId,
        error: validationResult.error,
        rawCommand: JSON.stringify(rawCommand).slice(0, 200),
      });
      throw new Error(`Invalid command: ${validationResult.error}`);
    }

    const command = validationResult.data;

    logger.debug('Received valid command', {
      type: command.type,
      source: windowId,
      payload: command.payload,
    });

    try {
      const result = await handleCommand(command, windowId);
      if (!result.success) {
        logger.warn('Command failed', {
          type: command.type,
          error: result.error,
        });
      }
      return result;
    } catch (error) {
      logger.error('Command handler error', {
        type: command.type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });

  // Handle request for initial state (when windows load)
  ipcMain.handle(IPC_CHANNELS.REQUEST_STATE, async (event) => {
    // Security: Validate sender is from trusted source
    if (!validateSender(event.senderFrame)) {
      logger.warn('Rejected state request from untrusted sender', {
        url: event.senderFrame.url,
      });
      throw new Error('Unauthorized: IPC from untrusted source');
    }

    logger.debug('Initial state requested');
    broadcastCurrentState();
  });

  // Handle metrics request
  ipcMain.handle(IPC_CHANNELS.GET_METRICS, async (event) => {
    // Security: Validate sender is from trusted source
    if (!validateSender(event.senderFrame)) {
      logger.warn('Rejected metrics request from untrusted sender', {
        url: event.senderFrame.url,
      });
      throw new Error('Unauthorized: IPC from untrusted source');
    }

    logger.debug('Metrics requested');
    return metricsService.getMetrics();
  });

  // Handle transactions request (for transaction history view)
  ipcMain.handle(IPC_CHANNELS.GET_TRANSACTIONS, async (event) => {
    // Security: Validate sender is from trusted source
    if (!validateSender(event.senderFrame)) {
      logger.warn('Rejected transactions request from untrusted sender', {
        url: event.senderFrame.url,
      });
      throw new Error('Unauthorized: IPC from untrusted source');
    }

    logger.debug('Transactions requested');
    return persistenceService.getTransactions();
  });

  // Handle inventory request (for transaction history view)
  ipcMain.handle(IPC_CHANNELS.GET_INVENTORY, async (event) => {
    // Security: Validate sender is from trusted source
    if (!validateSender(event.senderFrame)) {
      logger.warn('Rejected inventory request from untrusted sender', {
        url: event.senderFrame.url,
      });
      throw new Error('Unauthorized: IPC from untrusted source');
    }

    logger.debug('Inventory requested');
    return mainStore.getAllInventory();
  });

  // Handle show receipt request (from transaction history view)
  ipcMain.handle(IPC_CHANNELS.SHOW_RECEIPT, async (event, transactionId: string) => {
    // Security: Validate sender is from trusted source
    if (!validateSender(event.senderFrame)) {
      logger.warn('Rejected show receipt request from untrusted sender', {
        url: event.senderFrame.url,
      });
      throw new Error('Unauthorized: IPC from untrusted source');
    }

    logger.debug('Show receipt requested', { transactionId });

    const transaction = persistenceService.getTransactionById(transactionId);
    if (!transaction) {
      logger.warn('Transaction not found for receipt', { transactionId });
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    // Convert TransactionRecord to ReceiptData format
    windowManager.showReceipt({
      transactionId: transaction.id,
      timestamp: transaction.timestamp,
      items: transaction.items,
      totalInCents: transaction.totalInCents,
    });
  });

  logger.info('IPC handlers initialized');
}

/**
 * Determine window ID from sender
 */
function getWindowIdFromSender(window: BrowserWindow | null): WindowId | 'unknown' {
  if (!window) return 'unknown';

  const windows = windowManager.getAllWindows();
  for (const [id, w] of windows) {
    if (w.id === window.id) {
      return id;
    }
  }
  return 'unknown';
}
