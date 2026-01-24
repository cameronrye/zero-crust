/**
 * usePOSCommands - Custom hook for POS command handlers
 *
 * Extracts all IPC command logic from CashierView into a reusable hook.
 * Each command is memoized with useCallback to prevent unnecessary re-renders.
 *
 * @example
 * ```tsx
 * const commands = usePOSCommands();
 * commands.handleAddItem('PIZZA-001');
 * commands.handleCheckout();
 * ```
 */

import { useCallback } from 'react';

/**
 * Command handlers returned by the usePOSCommands hook
 * All handlers return promises that resolve when the command is sent,
 * or reject if there's an error. This allows callers to handle errors.
 */
export interface POSCommands {
  /** Add an item to the cart by SKU */
  handleAddItem: (sku: string) => Promise<void>;
  /** Remove an item from the cart by SKU and index */
  handleRemoveItem: (sku: string, index: number) => Promise<void>;
  /** Update quantity of a cart item */
  handleUpdateQuantity: (sku: string, index: number, quantity: number) => Promise<void>;
  /** Clear all items from the cart */
  handleClearCart: () => Promise<void>;
  /** Initiate checkout (moves to PENDING state) */
  handleCheckout: () => Promise<void>;
  /** Process payment (moves to PROCESSING state) */
  handleProcessPayment: () => Promise<void>;
  /** Retry a failed payment */
  handleRetryPayment: () => Promise<void>;
  /** Start a new transaction after payment completion */
  handleNewTransaction: () => Promise<void>;
  /** Cancel checkout and return to IDLE state */
  handleCancelCheckout: () => Promise<void>;
  /** Generate a demo order for showcasing */
  handleDemoOrder: () => Promise<void>;
  /** Start the continuous demo loop */
  handleStartDemoLoop: () => Promise<void>;
  /** Stop the continuous demo loop */
  handleStopDemoLoop: () => Promise<void>;
}

/**
 * Custom hook that provides memoized POS command handlers.
 *
 * All handlers communicate with the Main process via the electronAPI
 * exposed through the preload script.
 *
 * @returns Object containing all POS command handlers
 */
export function usePOSCommands(): POSCommands {
  const handleAddItem = useCallback(async (sku: string): Promise<void> => {
    return window.electronAPI.sendCommand({ type: 'ADD_ITEM', payload: { sku } });
  }, []);

  const handleRemoveItem = useCallback(async (sku: string, index: number): Promise<void> => {
    return window.electronAPI.sendCommand({ type: 'REMOVE_ITEM', payload: { sku, index } });
  }, []);

  const handleUpdateQuantity = useCallback(async (sku: string, index: number, quantity: number): Promise<void> => {
    return window.electronAPI.sendCommand({ type: 'UPDATE_QUANTITY', payload: { sku, index, quantity } });
  }, []);

  const handleClearCart = useCallback(async (): Promise<void> => {
    return window.electronAPI.sendCommand({ type: 'CLEAR_CART', payload: null });
  }, []);

  const handleCheckout = useCallback(async (): Promise<void> => {
    return window.electronAPI.sendCommand({ type: 'CHECKOUT', payload: null });
  }, []);

  const handleProcessPayment = useCallback(async (): Promise<void> => {
    return window.electronAPI.sendCommand({ type: 'PROCESS_PAYMENT', payload: null });
  }, []);

  const handleRetryPayment = useCallback(async (): Promise<void> => {
    return window.electronAPI.sendCommand({ type: 'RETRY_PAYMENT', payload: null });
  }, []);

  const handleNewTransaction = useCallback(async (): Promise<void> => {
    return window.electronAPI.sendCommand({ type: 'NEW_TRANSACTION', payload: null });
  }, []);

  const handleCancelCheckout = useCallback(async (): Promise<void> => {
    return window.electronAPI.sendCommand({ type: 'CANCEL_CHECKOUT', payload: null });
  }, []);

  const handleDemoOrder = useCallback(async (): Promise<void> => {
    return window.electronAPI.sendCommand({ type: 'DEMO_ORDER', payload: null });
  }, []);

  const handleStartDemoLoop = useCallback(async (): Promise<void> => {
    return window.electronAPI.sendCommand({ type: 'START_DEMO_LOOP', payload: null });
  }, []);

  const handleStopDemoLoop = useCallback(async (): Promise<void> => {
    return window.electronAPI.sendCommand({ type: 'STOP_DEMO_LOOP', payload: null });
  }, []);

  return {
    handleAddItem,
    handleRemoveItem,
    handleUpdateQuantity,
    handleClearCart,
    handleCheckout,
    handleProcessPayment,
    handleRetryPayment,
    handleNewTransaction,
    handleCancelCheckout,
    handleDemoOrder,
    handleStartDemoLoop,
    handleStopDemoLoop,
  };
}

