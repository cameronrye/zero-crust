/**
 * PaymentService Tests - Payment state machine transitions
 *
 * These tests verify:
 * - Payment state transitions (IDLE -> PENDING -> PROCESSING -> PAID/ERROR)
 * - Retry logic with exponential backoff
 * - Error handling and message generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  processPayment,
  calculateBackoffDelay,
  shouldRetry,
  getErrorMessage,
  getRetryMessage,
  paymentService,
  type PaymentRequest,
} from './PaymentService';
import { cents } from '@shared/currency';

describe('PaymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentService.reset();
  });

  describe('calculateBackoffDelay', () => {
    it('should return 1000ms for first retry (retryCount=0)', () => {
      expect(calculateBackoffDelay(0)).toBe(1000);
    });

    it('should return 2000ms for second retry (retryCount=1)', () => {
      expect(calculateBackoffDelay(1)).toBe(2000);
    });

    it('should return 4000ms for third retry (retryCount=2)', () => {
      expect(calculateBackoffDelay(2)).toBe(4000);
    });

    it('should cap at 4000ms (maxDelayMs)', () => {
      expect(calculateBackoffDelay(3)).toBe(4000);
      expect(calculateBackoffDelay(10)).toBe(4000);
    });
  });

  describe('shouldRetry', () => {
    it('should return true when retryCount < 3', () => {
      expect(shouldRetry(0)).toBe(true);
      expect(shouldRetry(1)).toBe(true);
      expect(shouldRetry(2)).toBe(true);
    });

    it('should return false when retryCount >= 3', () => {
      expect(shouldRetry(3)).toBe(false);
      expect(shouldRetry(4)).toBe(false);
      expect(shouldRetry(10)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return correct message for PAYMENT_DECLINED', () => {
      expect(getErrorMessage('PAYMENT_DECLINED')).toBe(
        'Card declined. Please try a different payment method.'
      );
    });

    it('should return correct message for PAYMENT_TIMEOUT', () => {
      expect(getErrorMessage('PAYMENT_TIMEOUT')).toBe('Payment timed out. Please try again.');
    });

    it('should return correct message for PAYMENT_NETWORK_ERROR', () => {
      expect(getErrorMessage('PAYMENT_NETWORK_ERROR')).toBe(
        'Network error. Please check connection and try again.'
      );
    });

    it('should return correct message for PAYMENT_INSUFFICIENT_FUNDS', () => {
      expect(getErrorMessage('PAYMENT_INSUFFICIENT_FUNDS')).toBe(
        'Insufficient funds. Please try a different card.'
      );
    });
  });

  describe('getRetryMessage', () => {
    it('should show 3 remaining attempts at start', () => {
      expect(getRetryMessage(0)).toBe('Payment failed. 3 retry attempts remaining.');
    });

    it('should show 2 remaining attempts after 1 retry', () => {
      expect(getRetryMessage(1)).toBe('Payment failed. 2 retry attempts remaining.');
    });

    it('should show 1 remaining attempt after 2 retries', () => {
      expect(getRetryMessage(2)).toBe('Payment failed. 1 retry attempt remaining.');
    });

    it('should show manager contact message after max retries', () => {
      expect(getRetryMessage(3)).toBe(
        'Maximum retry attempts reached. Please contact a manager.'
      );
      expect(getRetryMessage(4)).toBe(
        'Maximum retry attempts reached. Please contact a manager.'
      );
    });
  });

  describe('PaymentService class', () => {
    it('should start with retry count 0', () => {
      expect(paymentService.getRetryCount()).toBe(0);
    });

    it('should not be processing initially', () => {
      expect(paymentService.isPaymentProcessing()).toBe(false);
    });

    it('should allow retry initially', () => {
      expect(paymentService.canRetry()).toBe(true);
    });

    it('should reset state correctly', () => {
      paymentService.reset();
      expect(paymentService.getRetryCount()).toBe(0);
      expect(paymentService.isPaymentProcessing()).toBe(false);
    });

    it('should return correct next retry delay', () => {
      expect(paymentService.getNextRetryDelay()).toBe(1000); // First retry
    });
  });

  describe('processPayment', () => {
    it('should return a result with success or error', async () => {
      const request: PaymentRequest = {
        amountInCents: cents(599),
        transactionId: 'TXN-TEST-001',
      };

      // Mock Math.random to force success (< 0.9)
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await processPayment(request);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);

      vi.restoreAllMocks();
    }, 10000); // Increase timeout for 2.5s delay

    it('should return error on payment failure', async () => {
      const request: PaymentRequest = {
        amountInCents: cents(599),
        transactionId: 'TXN-TEST-002',
      };

      // Mock Math.random to force failure (< 0.1 failure rate)
      vi.spyOn(Math, 'random').mockReturnValue(0.05);

      const result = await processPayment(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBeDefined();
      expect(result.errorMessage).toBeDefined();

      vi.restoreAllMocks();
    }, 10000);
  });
});

