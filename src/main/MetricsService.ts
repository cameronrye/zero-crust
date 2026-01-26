/**
 * MetricsService - Transaction and performance metrics tracking
 *
 * Tracks:
 * - Transactions per minute (rolling window)
 * - Average cart size
 * - Total transactions today
 * - Total revenue today
 *
 * Broadcasts metrics updates to all renderer windows when transactions are recorded.
 */

import { createLogger } from './Logger';
import { broadcastMetrics } from './BroadcastService';
import type { Cents } from '@shared/currency';
import type { CartItem } from '@shared/ipc-types';
import type { TransactionRecord } from './PersistenceService';
import { METRICS_CONFIG } from '@shared/config';

const logger = createLogger('MetricsService');

/**
 * Metrics data exposed to UI
 */
export interface Metrics {
  transactionsPerMinute: number;
  averageCartSize: number;
  totalTransactionsToday: number;
  totalRevenueToday: Cents;
  lastUpdated: string;
}

/**
 * Transaction record for metrics calculation
 */
interface TransactionMetric {
  timestamp: number;
  itemCount: number;
  totalInCents: Cents;
}

/**
 * Summarized metrics for older transactions that have been compacted
 * Uses Cents type for totalRevenue to maintain type safety and prevent precision loss
 */
interface SummarizedMetrics {
  transactionCount: number;
  totalItemCount: number;
  totalRevenue: Cents;
}

/**
 * MetricsService - Tracks transaction metrics in a rolling window
 */
class MetricsService {
  // Rolling window of transactions (last 5 minutes for TPM calculation)
  private recentTransactions: TransactionMetric[] = [];
  // All transactions today (reset at midnight)
  private todayTransactions: TransactionMetric[] = [];
  // Summarized metrics for older compacted transactions
  private summarizedMetrics: SummarizedMetrics = { transactionCount: 0, totalItemCount: 0, totalRevenue: 0 as Cents };
  // Track current day for reset
  private currentDay: string;

  constructor() {
    this.currentDay = this.getTodayKey();
    logger.info('MetricsService initialized', { day: this.currentDay });
  }

  /**
   * Initialize metrics from persisted transactions.
   *
   * Loads today's completed transactions from the persistence layer
   * to restore metrics after app restart.
   *
   * @param transactions - Array of transaction records from persistence
   */
  public initializeFromTransactions(transactions: readonly TransactionRecord[]): void {
    const today = this.getTodayKey();
    let loadedCount = 0;

    for (const txn of transactions) {
      // Only load completed transactions from today
      if (txn.status !== 'completed') {
        continue;
      }

      // Check if transaction is from today
      const txnDate = txn.timestamp.split('T')[0];
      if (txnDate !== today) {
        continue;
      }

      const timestamp = new Date(txn.timestamp).getTime();
      const itemCount = txn.items.reduce((sum, item) => sum + item.quantity, 0);

      const metric: TransactionMetric = {
        timestamp,
        itemCount,
        totalInCents: txn.totalInCents,
      };

      this.todayTransactions.push(metric);

      // Also add to recent transactions if within the 5-minute window
      const now = Date.now();
      if (now - timestamp < METRICS_CONFIG.windowSizeMs) {
        this.recentTransactions.push(metric);
      }

      loadedCount++;
    }

    logger.info('Loaded historical transactions into metrics', {
      loadedCount,
      todayTotal: this.todayTransactions.length,
      recentCount: this.recentTransactions.length,
    });
  }

  /**
   * Get today's date as a string key (YYYY-MM-DD) in local timezone.
   * Uses local date to ensure daily metrics reset at local midnight, not UTC midnight.
   */
  private getTodayKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Check if we need to reset daily metrics
   */
  private checkDayReset(): void {
    const today = this.getTodayKey();
    if (today !== this.currentDay) {
      logger.info('New day detected, resetting daily metrics', {
        previousDay: this.currentDay,
        newDay: today,
      });
      this.todayTransactions = [];
      this.summarizedMetrics = { transactionCount: 0, totalItemCount: 0, totalRevenue: 0 as Cents };
      this.currentDay = today;
    }
  }

  /**
   * Compact older transactions to prevent unbounded memory growth.
   * Summarizes the oldest transactions into aggregate metrics.
   */
  private compactOldTransactions(): void {
    if (this.todayTransactions.length <= METRICS_CONFIG.maxDetailedTransactions) {
      return;
    }

    // Take the oldest transactions and summarize them
    const toCompact = this.todayTransactions.slice(0, METRICS_CONFIG.compactionBatchSize);
    this.todayTransactions = this.todayTransactions.slice(METRICS_CONFIG.compactionBatchSize);

    const compactedCount = toCompact.length;
    const compactedItems = toCompact.reduce((sum, t) => sum + t.itemCount, 0);
    // Cast to Cents to maintain type safety - reduce produces a number but we know it's cents
    const compactedRevenue = toCompact.reduce((sum, t) => sum + t.totalInCents, 0) as Cents;

    this.summarizedMetrics.transactionCount += compactedCount;
    this.summarizedMetrics.totalItemCount += compactedItems;
    // Use addCents for type-safe addition of branded Cents values
    this.summarizedMetrics.totalRevenue = (this.summarizedMetrics.totalRevenue + compactedRevenue) as Cents;

    logger.debug('Compacted old transactions', {
      compactedCount,
      remainingDetailed: this.todayTransactions.length,
      totalSummarized: this.summarizedMetrics.transactionCount,
    });
  }

  /**
   * Clean up old transactions from rolling window
   */
  private cleanupOldTransactions(): void {
    const cutoff = Date.now() - METRICS_CONFIG.windowSizeMs;
    this.recentTransactions = this.recentTransactions.filter(
      (t) => t.timestamp > cutoff
    );
  }

  /**
   * Record a completed transaction for metrics tracking.
   *
   * Updates both the rolling window (for TPM calculation) and daily totals.
   * Automatically broadcasts updated metrics to all renderer windows.
   *
   * @param items - Array of cart items from the completed transaction
   * @param totalInCents - Total transaction amount in cents
   *
   * @example
   * metricsService.recordTransaction(
   *   [{ sku: 'PIZZA-001', name: 'Pepperoni', priceInCents: 1299, quantity: 2 }],
   *   2598 as Cents
   * );
   */
  public recordTransaction(items: CartItem[], totalInCents: Cents): void {
    this.checkDayReset();

    const metric: TransactionMetric = {
      timestamp: Date.now(),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      totalInCents,
    };

    this.recentTransactions.push(metric);
    this.todayTransactions.push(metric);

    // Compact old transactions to prevent unbounded memory growth
    this.compactOldTransactions();

    logger.debug('Transaction recorded', {
      itemCount: metric.itemCount,
      totalInCents: metric.totalInCents,
      recentCount: this.recentTransactions.length,
      todayCount: this.todayTransactions.length,
    });

    // Broadcast updated metrics to all windows
    broadcastMetrics(this.getMetrics());
  }

  /**
   * Get the current metrics snapshot.
   *
   * Returns calculated metrics including:
   * - Transactions per minute (based on 5-minute rolling window)
   * - Average cart size (items per transaction today)
   * - Total transactions today
   * - Total revenue today
   *
   * @returns Metrics object with current statistics
   *
   * @example
   * const metrics = metricsService.getMetrics();
   * console.log(`TPM: ${metrics.transactionsPerMinute}`);
   * console.log(`Revenue: $${metrics.totalRevenueToday / 100}`);
   */
  public getMetrics(): Metrics {
    this.checkDayReset();
    this.cleanupOldTransactions();

    // Transactions per minute (based on 5-minute rolling window)
    const windowMinutes = METRICS_CONFIG.windowSizeMs / 60000;
    const transactionsPerMinute =
      this.recentTransactions.length > 0
        ? Math.round((this.recentTransactions.length / windowMinutes) * 10) / 10
        : 0;

    // Include both summarized and detailed transactions for totals
    const detailedItems = this.todayTransactions.reduce(
      (sum, t) => sum + t.itemCount,
      0
    );
    const totalItems = this.summarizedMetrics.totalItemCount + detailedItems;
    const totalTransactionCount = this.summarizedMetrics.transactionCount + this.todayTransactions.length;

    // Average cart size (items per transaction)
    const averageCartSize =
      totalTransactionCount > 0
        ? Math.round((totalItems / totalTransactionCount) * 10) / 10
        : 0;

    // Total revenue today (summarized + detailed)
    const detailedRevenue = this.todayTransactions.reduce(
      (sum, t) => sum + t.totalInCents,
      0
    );
    const totalRevenueToday = (this.summarizedMetrics.totalRevenue + detailedRevenue) as Cents;

    return {
      transactionsPerMinute,
      averageCartSize,
      totalTransactionsToday: totalTransactionCount,
      totalRevenueToday,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Reset all metrics data.
   *
   * Clears both rolling window and daily transaction data.
   * Primarily used for testing purposes.
   */
  public reset(): void {
    this.recentTransactions = [];
    this.todayTransactions = [];
    this.summarizedMetrics = { transactionCount: 0, totalItemCount: 0, totalRevenue: 0 as Cents };
    this.currentDay = this.getTodayKey();
    logger.debug('MetricsService reset');
  }
}

// Singleton instance
export const metricsService = new MetricsService();
export default MetricsService;

