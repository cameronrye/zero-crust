/**
 * CommandHandler - Central routing for all IPC commands
 *
 * This module follows the Command Pattern / CQRS approach:
 * - Every action is represented as a command object
 * - Commands are validated, logged, and routed to appropriate handlers
 * - Enables logging/replay and shows familiarity with enterprise event-driven architecture
 */

import { createLogger } from './Logger';
import { mainStore } from './MainStore';
import { windowManager } from './WindowManager';
import { paymentService, getRetryMessage } from './PaymentService';
import { generateDemoOrder } from './DemoService';
import { demoLoopService } from './DemoLoopService';
import type { WindowId } from '@shared/ipc-types';
import { IPC_CHANNELS } from '@shared/ipc-types';
import type { ValidatedCommand } from '@shared/schemas';

const logger = createLogger('CommandHandler');

/**
 * Result of executing a command.
 */
export interface CommandResult {
  /** Whether the command executed successfully */
  success: boolean;
  /** Error message if the command failed */
  error?: string;
}

/**
 * Handle a validated command from a renderer process.
 *
 * Routes commands to the appropriate handler based on command type.
 * Uses exhaustive pattern matching to ensure all command types are handled.
 *
 * @param command - The validated command object with type and payload
 * @param sourceWindow - The window ID that sent the command, or 'unknown'
 * @returns Promise resolving to CommandResult indicating success/failure
 *
 * @example
 * const result = await handleCommand(
 *   { type: 'ADD_ITEM', payload: { sku: 'PIZZA-001' } },
 *   'cashier'
 * );
 * if (!result.success) {
 *   console.error('Command failed:', result.error);
 * }
 */
export async function handleCommand(
  command: ValidatedCommand,
  sourceWindow: WindowId | 'unknown'
): Promise<CommandResult> {
  logger.info('Handling command', {
    type: command.type,
    source: sourceWindow,
  });

  switch (command.type) {
    case 'PING':
      return handlePing(command.payload);

    case 'ADD_ITEM':
      return handleAddItem(command.payload);

    case 'REMOVE_ITEM':
      return handleRemoveItem(command.payload);

    case 'UPDATE_QUANTITY':
      return handleUpdateQuantity(command.payload);

    case 'CLEAR_CART':
      return handleClearCart();

    case 'CHECKOUT':
      return handleCheckout();

    case 'CANCEL_CHECKOUT':
      return handleCancelCheckout();

    case 'PROCESS_PAYMENT':
      return handleProcessPayment();

    case 'RETRY_PAYMENT':
      return handleRetryPayment();

    case 'NEW_TRANSACTION':
      return handleNewTransaction();

    case 'DEMO_ORDER':
      return handleDemoOrder();

    case 'START_DEMO_LOOP':
      return handleStartDemoLoop();

    case 'STOP_DEMO_LOOP':
      return handleStopDemoLoop();

    default: {
      // TypeScript exhaustiveness check
      const _exhaustiveCheck: never = command;
      logger.error('Unknown command type', { command: _exhaustiveCheck });
      return { success: false, error: 'Unknown command type' };
    }
  }
}

/**
 * Handle PING command - for IPC communication testing
 */
function handlePing(payload: { source: WindowId; message: string }): CommandResult {
  const pongMessage = `PONG from Main! Original: "${payload.message}" from ${payload.source} at ${new Date().toISOString()}`;

  logger.info('Handling PING', { source: payload.source, message: payload.message });

  // Broadcast PONG to all windows
  windowManager.broadcast(IPC_CHANNELS.PONG, pongMessage);

  logger.debug('Sent PONG to all windows', { message: pongMessage });
  return { success: true };
}

/**
 * Handle ADD_ITEM command
 */
function handleAddItem(payload: { sku: string }): CommandResult {
  const result = mainStore.addItem(payload.sku);

  if (!result.success) {
    logger.warn('Failed to add item', { sku: payload.sku, error: result.error });
  }

  return result;
}

/**
 * Handle REMOVE_ITEM command
 */
function handleRemoveItem(payload: { sku: string; index?: number }): CommandResult {
  const result = mainStore.removeItem(payload.sku, payload.index);

  if (!result.success) {
    logger.warn('Failed to remove item', {
      sku: payload.sku,
      index: payload.index,
      error: result.error,
    });
  }

  return result;
}

/**
 * Handle UPDATE_QUANTITY command
 */
function handleUpdateQuantity(payload: {
  sku: string;
  index: number;
  quantity: number;
}): CommandResult {
  const result = mainStore.updateQuantity(payload.sku, payload.index, payload.quantity);

  if (!result.success) {
    logger.warn('Failed to update quantity', {
      sku: payload.sku,
      index: payload.index,
      quantity: payload.quantity,
      error: result.error,
    });
  }

  return result;
}

/**
 * Handle CLEAR_CART command
 */
function handleClearCart(): CommandResult {
  mainStore.clearCart();
  return { success: true };
}

/**
 * Handle CHECKOUT command
 */
function handleCheckout(): CommandResult {
  return mainStore.startCheckout();
}

/**
 * Handle CANCEL_CHECKOUT command
 */
function handleCancelCheckout(): CommandResult {
  mainStore.cancelCheckout();
  paymentService.reset();
  return { success: true };
}

/**
 * Handle PROCESS_PAYMENT command
 * Initiates the mock payment gateway
 */
async function handleProcessPayment(): Promise<CommandResult> {
  // Start payment processing in store (creates pending transaction)
  const startResult = mainStore.startPaymentProcessing();
  if (!startResult.success) {
    return { success: false, error: startResult.error };
  }

  // Process payment via mock gateway
  const paymentResult = await paymentService.process({
    amountInCents: mainStore.getCartTotal(),
    transactionId: startResult.transactionId,
  });

  if (paymentResult.success) {
    const receiptData = mainStore.handlePaymentSuccess(paymentResult.transactionId!);

    // Open receipt window on success
    if (receiptData) {
      windowManager.showReceipt(receiptData);
    }

    return { success: true };
  } else {
    const errorMessage = paymentResult.errorMessage || 'Payment failed';
    const retryMessage = getRetryMessage(paymentService.getRetryCount());
    mainStore.handlePaymentFailure(`${errorMessage} ${retryMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle RETRY_PAYMENT command
 * Retries payment after a failure
 */
async function handleRetryPayment(): Promise<CommandResult> {
  if (!mainStore.canRetryPayment()) {
    return {
      success: false,
      error: 'Maximum retry attempts reached. Please contact a manager.',
    };
  }

  // Reuse the same payment flow
  return handleProcessPayment();
}

/**
 * Handle NEW_TRANSACTION command
 * Resets state after PAID to start a new transaction
 */
function handleNewTransaction(): CommandResult {
  mainStore.resetTransaction();
  paymentService.reset();
  return { success: true };
}

/**
 * Handle DEMO_ORDER command
 * Generates a realistic demo order for showcasing
 */
function handleDemoOrder(): CommandResult {
  // Only allow when idle
  if (mainStore.getState().transactionStatus !== 'IDLE') {
    return {
      success: false,
      error: 'Cannot generate demo order while transaction is in progress',
    };
  }

  // Clear existing cart
  mainStore.clearCart();

  // Generate demo order
  const skus = generateDemoOrder();

  // Add all items
  for (const sku of skus) {
    mainStore.addItem(sku);
  }

  logger.info('Demo order created', { itemCount: skus.length });
  return { success: true };
}

/**
 * Handle START_DEMO_LOOP command
 * Starts the continuous demo transaction loop
 */
function handleStartDemoLoop(): CommandResult {
  return demoLoopService.start();
}

/**
 * Handle STOP_DEMO_LOOP command
 * Stops the continuous demo transaction loop
 */
function handleStopDemoLoop(): CommandResult {
  return demoLoopService.stop();
}
