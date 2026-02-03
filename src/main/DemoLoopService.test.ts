/**
 * DemoLoopService Tests - Continuous demo transaction loop
 *
 * These tests verify:
 * - Start/stop functionality
 * - State transitions during demo loop
 * - Error handling and recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cents } from '@shared/currency';

// Mock dependencies before importing DemoLoopService
vi.mock('./Logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./MainStore', () => ({
  mainStore: {
    getState: vi.fn(() => ({ transactionStatus: 'IDLE' })),
    setDemoLoopRunning: vi.fn(),
    clearCart: vi.fn(),
    addItem: vi.fn(() => ({ success: true })),
    startCheckout: vi.fn(() => ({ success: true })),
    startPaymentProcessing: vi.fn(() => ({ success: true, transactionId: 'TXN-TEST' })),
    handlePaymentSuccess: vi.fn(),
    handlePaymentFailure: vi.fn(),
    resetTransaction: vi.fn(),
    cancelCheckout: vi.fn(),
    getCartTotal: vi.fn(() => 1000),
  },
}));

vi.mock('./PaymentService', () => ({
  paymentService: {
    process: vi.fn(() => Promise.resolve({ success: true, transactionId: 'PAY-TEST' })),
    reset: vi.fn(),
  },
}));

vi.mock('./DemoService', () => ({
  generateDemoOrder: vi.fn(() => ['PIZZA-001', 'DRINK-001']),
}));

import { demoLoopService } from './DemoLoopService';
import { mainStore } from './MainStore';

describe('DemoLoopService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Ensure loop is stopped before each test
    demoLoopService.stop();
  });

  afterEach(() => {
    demoLoopService.stop();
    vi.useRealTimers();
  });

  describe('start()', () => {
    it('should start successfully when in IDLE state', () => {
      vi.mocked(mainStore.getState).mockReturnValue({
        transactionStatus: 'IDLE',
        version: 1,
        cart: [],
        totalInCents: cents(0),
        retryCount: 0,
        demoLoopRunning: false,
      });

      const result = demoLoopService.start();

      expect(result.success).toBe(true);
      expect(demoLoopService.isLoopRunning()).toBe(true);
      expect(mainStore.setDemoLoopRunning).toHaveBeenCalledWith(true);
    });

    it('should fail to start when already running', () => {
      vi.mocked(mainStore.getState).mockReturnValue({
        transactionStatus: 'IDLE',
        version: 1,
        cart: [],
        totalInCents: cents(0),
        retryCount: 0,
        demoLoopRunning: false,
      });

      demoLoopService.start();
      const result = demoLoopService.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('already running');
    });

    it('should fail to start when transaction is in progress', () => {
      vi.mocked(mainStore.getState).mockReturnValue({
        transactionStatus: 'PROCESSING',
        version: 1,
        cart: [],
        totalInCents: cents(0),
        retryCount: 0,
        demoLoopRunning: false,
      });

      const result = demoLoopService.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Complete current transaction');
    });
  });

  describe('stop()', () => {
    it('should stop successfully when running', () => {
      vi.mocked(mainStore.getState).mockReturnValue({
        transactionStatus: 'IDLE',
        version: 1,
        cart: [],
        totalInCents: cents(0),
        retryCount: 0,
        demoLoopRunning: false,
      });

      demoLoopService.start();
      const result = demoLoopService.stop();

      expect(result.success).toBe(true);
      expect(demoLoopService.isLoopRunning()).toBe(false);
      expect(mainStore.setDemoLoopRunning).toHaveBeenCalledWith(false);
    });

    it('should succeed when not running', () => {
      const result = demoLoopService.stop();

      expect(result.success).toBe(true);
    });
  });

  describe('isLoopRunning()', () => {
    it('should return false initially', () => {
      expect(demoLoopService.isLoopRunning()).toBe(false);
    });
  });
});

