/**
 * usePOSCommands - Custom hook for POS command handlers (Web version)
 */

import { useCallback } from 'react';
import { useElectronAPI } from '../context/WebAPIContext';

export interface POSCommands {
  handleAddItem: (sku: string) => Promise<void>;
  handleRemoveItem: (sku: string, index: number) => Promise<void>;
  handleUpdateQuantity: (sku: string, index: number, quantity: number) => Promise<void>;
  handleClearCart: () => Promise<void>;
  handleCheckout: () => Promise<void>;
  handleProcessPayment: () => Promise<void>;
  handleRetryPayment: () => Promise<void>;
  handleNewTransaction: () => Promise<void>;
  handleCancelCheckout: () => Promise<void>;
  handleDemoOrder: () => Promise<void>;
  handleStartDemoLoop: () => Promise<void>;
  handleStopDemoLoop: () => Promise<void>;
}

export function usePOSCommands(): POSCommands {
  const api = useElectronAPI();

  const handleAddItem = useCallback(async (sku: string): Promise<void> => {
    return api.sendCommand({ type: 'ADD_ITEM', payload: { sku } });
  }, [api]);

  const handleRemoveItem = useCallback(async (sku: string, index: number): Promise<void> => {
    return api.sendCommand({ type: 'REMOVE_ITEM', payload: { sku, index } });
  }, [api]);

  const handleUpdateQuantity = useCallback(async (sku: string, index: number, quantity: number): Promise<void> => {
    return api.sendCommand({ type: 'UPDATE_QUANTITY', payload: { sku, index, quantity } });
  }, [api]);

  const handleClearCart = useCallback(async (): Promise<void> => {
    return api.sendCommand({ type: 'CLEAR_CART', payload: null });
  }, [api]);

  const handleCheckout = useCallback(async (): Promise<void> => {
    return api.sendCommand({ type: 'CHECKOUT', payload: null });
  }, [api]);

  const handleProcessPayment = useCallback(async (): Promise<void> => {
    return api.sendCommand({ type: 'PROCESS_PAYMENT', payload: null });
  }, [api]);

  const handleRetryPayment = useCallback(async (): Promise<void> => {
    return api.sendCommand({ type: 'RETRY_PAYMENT', payload: null });
  }, [api]);

  const handleNewTransaction = useCallback(async (): Promise<void> => {
    return api.sendCommand({ type: 'NEW_TRANSACTION', payload: null });
  }, [api]);

  const handleCancelCheckout = useCallback(async (): Promise<void> => {
    return api.sendCommand({ type: 'CANCEL_CHECKOUT', payload: null });
  }, [api]);

  const handleDemoOrder = useCallback(async (): Promise<void> => {
    return api.sendCommand({ type: 'DEMO_ORDER', payload: null });
  }, [api]);

  const handleStartDemoLoop = useCallback(async (): Promise<void> => {
    return api.sendCommand({ type: 'START_DEMO_LOOP', payload: null });
  }, [api]);

  const handleStopDemoLoop = useCallback(async (): Promise<void> => {
    return api.sendCommand({ type: 'STOP_DEMO_LOOP', payload: null });
  }, [api]);

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

