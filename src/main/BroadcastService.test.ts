/**
 * BroadcastService Tests - State and metrics broadcasting
 *
 * These tests verify:
 * - initializeBroadcastService subscribes to MainStore
 * - broadcastCurrentState sends current state to all windows
 * - broadcastMetrics sends metrics to all windows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cents } from '@shared/currency';
import { IPC_CHANNELS } from '@shared/ipc-types';

// Mock WindowManager - factory must not reference external variables
vi.mock('./WindowManager', () => ({
  windowManager: {
    broadcast: vi.fn(),
    getAllWindows: vi.fn().mockReturnValue(new Map()),
  },
}));

// Mock MainStore - factory must not reference external variables
vi.mock('./MainStore', () => ({
  mainStore: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    getState: vi.fn().mockReturnValue({
      version: 1,
      cart: [],
      totalInCents: 0,
      transactionStatus: 'IDLE',
      currentTransactionId: null,
      inventory: {},
    }),
  },
}));

// Import after mocking
import {
  initializeBroadcastService,
  broadcastCurrentState,
  broadcastMetrics,
} from './BroadcastService';
import { windowManager } from './WindowManager';
import { mainStore } from './MainStore';

describe('BroadcastService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeBroadcastService', () => {
    it('should subscribe to MainStore state changes', () => {
      initializeBroadcastService();

      expect(mainStore.subscribe).toHaveBeenCalledTimes(1);
      expect(mainStore.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should broadcast initial state after initialization', () => {
      initializeBroadcastService();

      // Should broadcast current state
      expect(windowManager.broadcast).toHaveBeenCalledWith(
        IPC_CHANNELS.STATE_UPDATE,
        expect.objectContaining({ version: 1 })
      );
    });

    it('should broadcast state when store changes', () => {
      initializeBroadcastService();

      // Get the callback that was passed to subscribe
      const mockSubscribe = vi.mocked(mainStore.subscribe);
      const subscribeCallback = mockSubscribe.mock.calls[0]?.[0];
      expect(subscribeCallback).toBeDefined();

      // Clear previous calls
      vi.mocked(windowManager.broadcast).mockClear();

      // Simulate a state change
      const newState = {
        version: 2,
        cart: [{ id: 'item-1', sku: 'TEST', name: 'Test', priceInCents: cents(100), quantity: 1 }],
        totalInCents: cents(100),
        transactionStatus: 'IDLE' as const,
        retryCount: 0,
        demoLoopRunning: false,
      };

      // subscribeCallback is guaranteed to be defined due to the expect above
      if (subscribeCallback) {
        subscribeCallback(newState);
      }

      expect(windowManager.broadcast).toHaveBeenCalledWith(IPC_CHANNELS.STATE_UPDATE, newState);
    });
  });

  describe('broadcastCurrentState', () => {
    it('should get current state and broadcast it', () => {
      broadcastCurrentState();

      expect(mainStore.getState).toHaveBeenCalled();
      expect(windowManager.broadcast).toHaveBeenCalledWith(
        IPC_CHANNELS.STATE_UPDATE,
        expect.objectContaining({ version: 1 })
      );
    });
  });

  describe('broadcastMetrics', () => {
    it('should broadcast metrics to all windows', () => {
      const metrics = {
        transactionsPerMinute: 5.5,
        averageCartSize: 3.2,
        totalTransactionsToday: 42,
        totalRevenueToday: cents(12500),
        lastUpdated: '2026-01-23T12:00:00.000Z',
      };

      broadcastMetrics(metrics);

      expect(windowManager.broadcast).toHaveBeenCalledWith(IPC_CHANNELS.METRICS_UPDATE, metrics);
    });

    it('should handle zero metrics', () => {
      const metrics = {
        transactionsPerMinute: 0,
        averageCartSize: 0,
        totalTransactionsToday: 0,
        totalRevenueToday: cents(0),
        lastUpdated: '2026-01-23T12:00:00.000Z',
      };

      broadcastMetrics(metrics);

      expect(windowManager.broadcast).toHaveBeenCalledWith(IPC_CHANNELS.METRICS_UPDATE, metrics);
    });
  });
});

