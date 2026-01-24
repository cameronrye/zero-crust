/**
 * IpcHandlers Tests - IPC command handling and routing
 *
 * These tests verify:
 * - Command validation with Zod schemas
 * - Command routing to CommandHandler
 * - Error handling for invalid commands
 * - Metrics request handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPC_CHANNELS } from '@shared/ipc-types';

// Mock Electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  BrowserWindow: {
    fromWebContents: vi.fn().mockReturnValue(null),
  },
}));

// Mock dependencies
vi.mock('./WindowManager', () => ({
  windowManager: {
    broadcast: vi.fn(),
    getAllWindows: vi.fn().mockReturnValue(new Map()),
  },
}));

vi.mock('./BroadcastService', () => ({
  initializeBroadcastService: vi.fn(),
  broadcastCurrentState: vi.fn(),
}));

vi.mock('./CommandHandler', () => ({
  handleCommand: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('./MetricsService', () => ({
  metricsService: {
    getMetrics: vi.fn().mockReturnValue({
      transactionsPerMinute: 2.5,
      averageCartSize: 3.0,
      totalTransactionsToday: 15,
      totalRevenueToday: 4500,
      lastUpdated: '2026-01-23T12:00:00.000Z',
    }),
    initializeFromTransactions: vi.fn(),
  },
}));

// Mock SecurityHandlers - always validate sender as trusted in tests
vi.mock('./SecurityHandlers', () => ({
  validateSender: vi.fn().mockReturnValue(true),
}));

// Import after mocking
import { ipcMain } from 'electron';
import { initializeIpcHandlers } from './IpcHandlers';
import { handleCommand } from './CommandHandler';
import { initializeBroadcastService, broadcastCurrentState } from './BroadcastService';
import { metricsService } from './MetricsService';

/**
 * Helper to get a registered handler by channel from mock.calls
 */
function getHandler(channel: string): ((...args: unknown[]) => Promise<unknown>) | undefined {
  const mockHandle = vi.mocked(ipcMain.handle);
  const call = mockHandle.mock.calls.find(([ch]) => ch === channel);
  return call?.[1] as ((...args: unknown[]) => Promise<unknown>) | undefined;
}

describe('IpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeIpcHandlers', () => {
    it('should initialize broadcast service', () => {
      initializeIpcHandlers();

      expect(initializeBroadcastService).toHaveBeenCalledTimes(1);
    });

    it('should register command handler', () => {
      initializeIpcHandlers();

      expect(vi.mocked(ipcMain.handle)).toHaveBeenCalledWith(
        IPC_CHANNELS.COMMAND,
        expect.any(Function)
      );
    });

    it('should register metrics handler', () => {
      initializeIpcHandlers();

      expect(vi.mocked(ipcMain.handle)).toHaveBeenCalledWith(
        IPC_CHANNELS.GET_METRICS,
        expect.any(Function)
      );
    });

    it('should register state request handler', () => {
      initializeIpcHandlers();

      expect(vi.mocked(ipcMain.handle)).toHaveBeenCalledWith(
        IPC_CHANNELS.REQUEST_STATE,
        expect.any(Function)
      );
    });
  });

  describe('command handler', () => {
    it('should validate and route valid commands', async () => {
      initializeIpcHandlers();

      const commandHandler = getHandler(IPC_CHANNELS.COMMAND);
      expect(commandHandler).toBeDefined();

      const validCommand = { type: 'ADD_ITEM', payload: { sku: 'PIZZA-001' } };
      const mockEvent = { sender: {}, senderFrame: { url: 'file://test' } };

      await commandHandler!(mockEvent, validCommand);

      expect(handleCommand).toHaveBeenCalledWith(validCommand, expect.any(String));
    });

    it('should reject invalid commands', async () => {
      initializeIpcHandlers();

      const commandHandler = getHandler(IPC_CHANNELS.COMMAND);
      const invalidCommand = { type: 'INVALID_TYPE', payload: {} };
      const mockEvent = { sender: {}, senderFrame: { url: 'file://test' } };

      await expect(commandHandler!(mockEvent, invalidCommand)).rejects.toThrow('Invalid command');
    });

    it('should reject commands with missing payload', async () => {
      initializeIpcHandlers();

      const commandHandler = getHandler(IPC_CHANNELS.COMMAND);
      const invalidCommand = { type: 'ADD_ITEM' }; // Missing payload
      const mockEvent = { sender: {}, senderFrame: { url: 'file://test' } };

      await expect(commandHandler!(mockEvent, invalidCommand)).rejects.toThrow();
    });
  });

  describe('metrics handler', () => {
    it('should return metrics from MetricsService', async () => {
      initializeIpcHandlers();

      const metricsHandler = getHandler(IPC_CHANNELS.GET_METRICS);
      expect(metricsHandler).toBeDefined();

      const mockEvent = { senderFrame: { url: 'file://test' } };
      const result = await metricsHandler!(mockEvent);

      expect(metricsService.getMetrics).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        transactionsPerMinute: 2.5,
        totalTransactionsToday: 15,
      }));
    });
  });

  describe('state request handler', () => {
    it('should broadcast current state on request', async () => {
      initializeIpcHandlers();

      const stateHandler = getHandler(IPC_CHANNELS.REQUEST_STATE);
      expect(stateHandler).toBeDefined();

      const mockEvent = { senderFrame: { url: 'file://test' } };
      await stateHandler!(mockEvent);

      expect(broadcastCurrentState).toHaveBeenCalled();
    });
  });
});

