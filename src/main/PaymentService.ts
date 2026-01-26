/**
 * PaymentService - Mock Payment Gateway with retry logic
 *
 * Simulates the asynchronous nature of hardware/payment integrations:
 * - 2.5 second processing delay
 * - 10% random failure rate
 * - Exponential backoff retry (1s, 2s, 4s)
 * - Max 3 retry attempts
 */

import { createLogger } from './Logger';
import { traceService, generateCorrelationId } from './TraceService';
import type { Cents } from '@shared/currency';
import { PAYMENT_CONFIG, RETRY_CONFIG } from '@shared/config';

const logger = createLogger('PaymentService');

/**
 * Payment error codes (subset of AppErrorCode for payment domain)
 */
export type PaymentErrorCode =
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_TIMEOUT'
  | 'PAYMENT_NETWORK_ERROR'
  | 'PAYMENT_INSUFFICIENT_FUNDS';

/**
 * Payment result from the mock gateway
 */
export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  errorCode?: PaymentErrorCode;
  errorMessage?: string;
  processingTimeMs?: number;
}

/**
 * Payment request details
 */
export interface PaymentRequest {
  amountInCents: Cents;
  transactionId: string;
  retryCount?: number;
}

/**
 * Error messages for different error codes
 */
const ERROR_MESSAGES: Record<PaymentErrorCode, string> = {
  PAYMENT_DECLINED: 'Card declined. Please try a different payment method.',
  PAYMENT_TIMEOUT: 'Payment timed out. Please try again.',
  PAYMENT_NETWORK_ERROR: 'Network error. Please check connection and try again.',
  PAYMENT_INSUFFICIENT_FUNDS: 'Insufficient funds. Please try a different card.',
};

/**
 * Simulate a delay (for mock payment processing)
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random payment transaction ID
 */
function generatePaymentId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PAY-${timestamp}-${random}`;
}

/**
 * Calculate exponential backoff delay for payment retries.
 *
 * Uses exponential backoff formula: baseDelay * 2^retryCount,
 * capped at maxDelayMs (4 seconds).
 *
 * @param retryCount - Number of retry attempts made (0-indexed)
 * @returns Delay in milliseconds before next retry attempt
 *
 * @example
 * calculateBackoffDelay(0) // Returns 1000 (1s)
 * calculateBackoffDelay(1) // Returns 2000 (2s)
 * calculateBackoffDelay(2) // Returns 4000 (4s)
 * calculateBackoffDelay(3) // Returns 4000 (capped at max)
 */
export function calculateBackoffDelay(retryCount: number): number {
  const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, retryCount);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

/**
 * Determine if a payment should be retried based on the current retry count.
 *
 * @param retryCount - Number of retry attempts already made
 * @returns True if more retries are allowed, false if max retries exceeded
 *
 * @example
 * shouldRetry(0) // Returns true
 * shouldRetry(2) // Returns true
 * shouldRetry(3) // Returns false (max is 3)
 */
export function shouldRetry(retryCount: number): boolean {
  return retryCount < RETRY_CONFIG.maxRetries;
}

/**
 * Get a user-friendly error message for a payment error code.
 *
 * @param errorCode - The payment error code from the gateway
 * @returns A human-readable error message suitable for display to the cashier
 *
 * @example
 * getErrorMessage('DECLINED') // Returns 'Card declined. Please try a different payment method.'
 */
export function getErrorMessage(errorCode: PaymentErrorCode): string {
  return ERROR_MESSAGES[errorCode] || 'An unexpected error occurred.';
}

/**
 * Get a retry status message indicating remaining attempts.
 *
 * @param retryCount - Number of retry attempts already made
 * @returns A message indicating remaining retries or max retries reached
 *
 * @example
 * getRetryMessage(0) // Returns 'Payment failed. 3 retry attempts remaining.'
 * getRetryMessage(2) // Returns 'Payment failed. 1 retry attempt remaining.'
 * getRetryMessage(3) // Returns 'Maximum retry attempts reached. Please contact a manager.'
 */
export function getRetryMessage(retryCount: number): string {
  const remaining = RETRY_CONFIG.maxRetries - retryCount;
  if (remaining <= 0) {
    return 'Maximum retry attempts reached. Please contact a manager.';
  }
  return `Payment failed. ${remaining} retry attempt${remaining !== 1 ? 's' : ''} remaining.`;
}

/**
 * Process a mock payment
 *
 * Simulates real payment gateway behavior:
 * - Takes ~2.5 seconds to process
 * - Has a 10% chance of random failure
 * - Returns structured result with error codes
 */
export async function processPayment(request: PaymentRequest): Promise<PaymentResult> {
  const startTime = Date.now();

  logger.info('Processing payment', {
    transactionId: request.transactionId,
    amountInCents: request.amountInCents,
    retryCount: request.retryCount ?? 0,
  });

  // Simulate payment processing delay
  await delay(PAYMENT_CONFIG.processingDelayMs);

  // Simulate random payment failures based on configured failure rate
  const failureRoll = Math.random();
  if (failureRoll < PAYMENT_CONFIG.failureRate) {
    // Randomize the type of failure
    const errorTypes: PaymentErrorCode[] = [
      'PAYMENT_DECLINED',
      'PAYMENT_TIMEOUT',
      'PAYMENT_NETWORK_ERROR',
      'PAYMENT_INSUFFICIENT_FUNDS',
    ];
    const randomIndex = Math.floor(Math.random() * errorTypes.length);
    // Array has 4 elements and randomIndex is 0-3, so this is always valid
    const errorCode = errorTypes[randomIndex] ?? 'PAYMENT_DECLINED';

    const processingTimeMs = Date.now() - startTime;

    logger.warn('Payment failed', {
      transactionId: request.transactionId,
      errorCode,
      processingTimeMs,
      retryCount: request.retryCount ?? 0,
    });

    return {
      success: false,
      errorCode,
      errorMessage: getErrorMessage(errorCode),
      processingTimeMs,
    };
  }

  // Success!
  const paymentId = generatePaymentId();
  const processingTimeMs = Date.now() - startTime;

  logger.info('Payment successful', {
    transactionId: request.transactionId,
    paymentId,
    amountInCents: request.amountInCents,
    processingTimeMs,
  });

  return {
    success: true,
    transactionId: paymentId,
    processingTimeMs,
  };
}

/**
 * PaymentService class - Manages payment state and retry logic.
 *
 * Provides a stateful wrapper around the payment processing functions,
 * tracking retry counts and preventing concurrent payment attempts.
 *
 * Uses a Promise-based lock pattern to prevent race conditions in
 * concurrent payment processing attempts.
 *
 * @example
 * const result = await paymentService.process({
 *   amountInCents: 1999 as Cents,
 *   transactionId: 'TXN-123'
 * });
 * if (!result.success && paymentService.canRetry()) {
 *   // Wait for backoff delay before retrying
 *   await delay(paymentService.getNextRetryDelay());
 *   const retryResult = await paymentService.process(request);
 * }
 */
class PaymentService {
  private currentRetryCount: number = 0;
  /**
   * Promise-based lock to prevent race conditions.
   * If non-null, a payment is currently being processed.
   */
  private activePaymentPromise: Promise<PaymentResult> | null = null;

  /**
   * Get the current number of retry attempts made.
   *
   * @returns The number of failed payment attempts for the current transaction
   */
  public getRetryCount(): number {
    return this.currentRetryCount;
  }

  /**
   * Check if a payment is currently being processed.
   *
   * Use this to prevent duplicate payment submissions.
   *
   * @returns True if a payment is in progress, false otherwise
   */
  public isPaymentProcessing(): boolean {
    return this.activePaymentPromise !== null;
  }

  /**
   * Check if the payment can be retried.
   *
   * @returns True if retry attempts remain (< 3 attempts), false if max retries exceeded
   */
  public canRetry(): boolean {
    return shouldRetry(this.currentRetryCount);
  }

  /**
   * Get the recommended delay before the next retry attempt.
   *
   * Uses exponential backoff based on the current retry count.
   *
   * @returns Delay in milliseconds before the next retry should be attempted
   */
  public getNextRetryDelay(): number {
    return calculateBackoffDelay(this.currentRetryCount);
  }

  /**
   * Process a payment request through the mock gateway.
   *
   * Handles state management, prevents concurrent payments, and
   * automatically increments retry count on failure.
   *
   * @param request - The payment request containing amount and transaction ID
   * @returns Promise resolving to PaymentResult with success status and details
   *
   * @throws Never throws - all errors are captured in the PaymentResult
   *
   * @example
   * const result = await paymentService.process({
   *   amountInCents: 2499 as Cents,
   *   transactionId: 'TXN-ABC123'
   * });
   * if (result.success) {
   *   console.log('Payment ID:', result.transactionId);
   * } else {
   *   console.log('Error:', result.errorMessage);
   * }
   */
  public async process(request: PaymentRequest): Promise<PaymentResult> {
    // Promise-based lock: check if a payment is already in progress
    // This prevents race conditions where two calls could pass the check
    // before either sets the lock
    if (this.activePaymentPromise !== null) {
      logger.warn('Payment already in progress');
      return {
        success: false,
        errorCode: 'PAYMENT_NETWORK_ERROR',
        errorMessage: 'A payment is already being processed.',
      };
    }

    // Create the payment promise and store it as the lock
    this.activePaymentPromise = this.doProcessPayment(request);

    try {
      return await this.activePaymentPromise;
    } finally {
      // Release the lock when done (success or failure)
      this.activePaymentPromise = null;
    }
  }

  /**
   * Internal method that performs the actual payment processing.
   * Called by process() after acquiring the lock.
   */
  private async doProcessPayment(request: PaymentRequest): Promise<PaymentResult> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();

    // Emit trace event for payment start (main -> gateway)
    traceService.emit('payment_start', 'main', {
      target: 'gateway',
      correlationId,
      payload: {
        transactionId: request.transactionId,
        amountInCents: request.amountInCents,
        retryCount: this.currentRetryCount,
      },
    });

    const result = await processPayment({
      ...request,
      retryCount: this.currentRetryCount,
    });

    const latencyMs = Date.now() - startTime;

    if (result.success) {
      // Reset retry count on successful payment
      this.currentRetryCount = 0;
    } else {
      this.currentRetryCount++;
    }

    // Emit trace event for payment complete (gateway -> main)
    traceService.emit('payment_complete', 'gateway', {
      target: 'main',
      correlationId,
      latencyMs,
      payload: {
        transactionId: request.transactionId,
        success: result.success,
        errorCode: result.errorCode,
        paymentId: result.transactionId,
        retryCount: this.currentRetryCount,
      },
    });

    return result;
  }

  /**
   * Reset the payment service state.
   *
   * Call this after a successful payment or when starting a new transaction
   * to reset the retry counter.
   */
  public reset(): void {
    this.currentRetryCount = 0;
    // Note: We don't clear activePaymentPromise here as that could cause
    // issues with in-flight payments. The promise will naturally resolve.
    logger.debug('PaymentService reset');
  }
}

// Singleton instance
export const paymentService = new PaymentService();
export default PaymentService;

