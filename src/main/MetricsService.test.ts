/**
 * MetricsService Tests - Transaction metrics tracking
 *
 * These tests verify:
 * - Transaction recording
 * - Transactions per minute calculation (rolling window)
 * - Average cart size calculation
 * - Daily metrics reset
 * - Revenue tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cents } from '@shared/currency';

// Mock BroadcastService to prevent actual broadcasting
vi.mock('./BroadcastService', () => ({
  broadcastMetrics: vi.fn(),
}));

// Import after mocking
import MetricsService from './MetricsService';
import { broadcastMetrics } from './BroadcastService';

describe('MetricsService', () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-23T12:00:00.000Z'));
    metricsService = new MetricsService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with zero metrics', () => {
      const metrics = metricsService.getMetrics();

      expect(metrics.transactionsPerMinute).toBe(0);
      expect(metrics.averageCartSize).toBe(0);
      expect(metrics.totalTransactionsToday).toBe(0);
      expect(metrics.totalRevenueToday).toBe(0);
    });
  });

  describe('recordTransaction', () => {
    it('should record a transaction and update metrics', () => {
      const items = [
        { sku: 'PIZZA-001', name: 'Pepperoni', priceInCents: cents(599), quantity: 2 },
        { sku: 'DRINK-001', name: 'Soda', priceInCents: cents(199), quantity: 1 },
      ];
      const total = cents(1397);

      metricsService.recordTransaction(items, total);

      const metrics = metricsService.getMetrics();
      expect(metrics.totalTransactionsToday).toBe(1);
      expect(metrics.totalRevenueToday).toBe(1397);
      expect(metrics.averageCartSize).toBe(3); // 2 + 1 items
    });

    it('should broadcast metrics after recording', () => {
      const items = [{ sku: 'TEST', name: 'Test', priceInCents: cents(100), quantity: 1 }];

      metricsService.recordTransaction(items, cents(100));

      expect(broadcastMetrics).toHaveBeenCalledTimes(1);
      expect(broadcastMetrics).toHaveBeenCalledWith(expect.objectContaining({
        totalTransactionsToday: 1,
      }));
    });

    it('should accumulate multiple transactions', () => {
      const items = [{ sku: 'TEST', name: 'Test', priceInCents: cents(500), quantity: 2 }];

      metricsService.recordTransaction(items, cents(1000));
      metricsService.recordTransaction(items, cents(1000));
      metricsService.recordTransaction(items, cents(1000));

      const metrics = metricsService.getMetrics();
      expect(metrics.totalTransactionsToday).toBe(3);
      expect(metrics.totalRevenueToday).toBe(3000);
    });
  });

  describe('transactionsPerMinute', () => {
    it('should calculate TPM based on 5-minute window', () => {
      const items = [{ sku: 'TEST', name: 'Test', priceInCents: cents(100), quantity: 1 }];

      // Add 10 transactions
      for (let i = 0; i < 10; i++) {
        metricsService.recordTransaction(items, cents(100));
      }

      const metrics = metricsService.getMetrics();
      // 10 transactions in 5 minutes = 2 per minute
      expect(metrics.transactionsPerMinute).toBe(2);
    });

    it('should exclude transactions older than 5 minutes from TPM', () => {
      const items = [{ sku: 'TEST', name: 'Test', priceInCents: cents(100), quantity: 1 }];

      // Add 5 transactions
      for (let i = 0; i < 5; i++) {
        metricsService.recordTransaction(items, cents(100));
      }

      // Advance time by 6 minutes (past the 5-minute window)
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Add 5 more transactions
      for (let i = 0; i < 5; i++) {
        metricsService.recordTransaction(items, cents(100));
      }

      const metrics = metricsService.getMetrics();
      // Only the 5 recent transactions should count in TPM
      expect(metrics.transactionsPerMinute).toBe(1); // 5 transactions / 5 minutes
      // But all 10 should count in daily totals
      expect(metrics.totalTransactionsToday).toBe(10);
    });
  });

  describe('averageCartSize', () => {
    it('should calculate average items per transaction', () => {
      metricsService.recordTransaction(
        [{ sku: 'A', name: 'A', priceInCents: cents(100), quantity: 3 }],
        cents(300)
      );
      metricsService.recordTransaction(
        [{ sku: 'B', name: 'B', priceInCents: cents(100), quantity: 5 }],
        cents(500)
      );

      const metrics = metricsService.getMetrics();
      // (3 + 5) / 2 = 4
      expect(metrics.averageCartSize).toBe(4);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      const items = [{ sku: 'TEST', name: 'Test', priceInCents: cents(100), quantity: 1 }];
      metricsService.recordTransaction(items, cents(100));

      metricsService.reset();

      const metrics = metricsService.getMetrics();
      expect(metrics.totalTransactionsToday).toBe(0);
      expect(metrics.totalRevenueToday).toBe(0);
      expect(metrics.transactionsPerMinute).toBe(0);
    });
  });
});

