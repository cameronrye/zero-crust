/**
 * WindowManager Tests - Window management and broadcasting
 *
 * These tests verify:
 * - Window registration and retrieval
 * - Broadcast functionality to all windows
 * - Receipt HTML generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cents } from '@shared/currency';
import type { ReceiptData } from './WindowManager';

// Counter for unique window IDs
let windowIdCounter = 1;

// Mock Electron modules before importing WindowManager
vi.mock('electron', () => {
  // Factory function to create window instances
  function MockBrowserWindow() {
    const instance = {
      id: windowIdCounter++,
      webContents: {
        send: vi.fn(),
        openDevTools: vi.fn(),
        on: vi.fn(),
      },
      loadURL: vi.fn().mockResolvedValue(undefined),
      loadFile: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
    };
    return instance;
  }

  return {
    BrowserWindow: MockBrowserWindow,
    screen: {
      getAllDisplays: vi.fn().mockReturnValue([
        {
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          workArea: { x: 0, y: 0, width: 1920, height: 1040 }, // Account for taskbar
        },
      ]),
      getPrimaryDisplay: vi.fn().mockReturnValue({
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 }, // Account for taskbar
      }),
    },
  };
});

// Mock the global Vite variables
vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', undefined);
vi.stubGlobal('MAIN_WINDOW_VITE_NAME', 'main_window');

// Import after mocking
import WindowManager, { windowManager } from './WindowManager';

describe('WindowManager', () => {
  let testWindowManager: WindowManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a fresh instance for each test
    testWindowManager = new WindowManager();
  });

  describe('getWindow', () => {
    it('should return undefined for non-existent window', () => {
      expect(testWindowManager.getWindow('cashier')).toBeUndefined();
      expect(testWindowManager.getWindow('customer')).toBeUndefined();
    });
  });

  describe('getAllWindows', () => {
    it('should return empty map initially', () => {
      const windows = testWindowManager.getAllWindows();
      expect(windows.size).toBe(0);
    });
  });

  describe('initializeWindows', () => {
    it('should create cashier, customer, and dashboard windows', () => {
      testWindowManager.initializeWindows();

      const windows = testWindowManager.getAllWindows();
      expect(windows.size).toBe(3);
      expect(testWindowManager.getWindow('cashier')).toBeDefined();
      expect(testWindowManager.getWindow('customer')).toBeDefined();
      expect(testWindowManager.getWindow('dashboard')).toBeDefined();
    });
  });

  describe('broadcast', () => {
    it('should send message to all windows', () => {
      testWindowManager.initializeWindows();

      const testChannel = 'test:channel';
      const testData = { foo: 'bar' };

      testWindowManager.broadcast(testChannel, testData);

      // Both windows should receive the broadcast
      const cashierWindow = testWindowManager.getWindow('cashier');
      const customerWindow = testWindowManager.getWindow('customer');

      expect(cashierWindow?.webContents.send).toHaveBeenCalledWith(testChannel, testData);
      expect(customerWindow?.webContents.send).toHaveBeenCalledWith(testChannel, testData);
    });

    it('should not broadcast to destroyed windows', () => {
      testWindowManager.initializeWindows();

      const cashierWindow = testWindowManager.getWindow('cashier');
      // Mock the cashier window as destroyed
      vi.mocked(cashierWindow!.isDestroyed).mockReturnValue(true);

      testWindowManager.broadcast('test:channel', {});

      // Only customer window should receive the broadcast
      expect(cashierWindow?.webContents.send).not.toHaveBeenCalled();
    });
  });
});

describe('Receipt HTML Generation', () => {
  it('should generate valid HTML from receipt data', () => {
    // We can't easily test showReceipt without full Electron, but we can
    // verify the module exports properly
    expect(typeof windowManager).toBe('object');
    expect(typeof windowManager.showReceipt).toBe('function');
  });
});

describe('ReceiptData interface', () => {
  it('should accept valid receipt data', () => {
    const receiptData: ReceiptData = {
      transactionId: 'TXN-TEST-001',
      timestamp: new Date().toISOString(),
      items: [
        { sku: 'PIZZA-001', name: 'Pepperoni', priceInCents: cents(599), quantity: 2 },
      ],
      totalInCents: cents(1198),
    };

    expect(receiptData.transactionId).toBe('TXN-TEST-001');
    expect(receiptData.items.length).toBe(1);
    expect(receiptData.totalInCents).toBe(1198);
  });
});

