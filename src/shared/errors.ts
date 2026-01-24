/**
 * Centralized Error Handling - Standardized error types and utilities
 *
 * Provides:
 * - Typed error codes for consistent error handling
 * - User-friendly error messages
 * - Error classification (user vs. system errors)
 */

/**
 * Application error codes
 * Organized by domain for easy categorization
 */
export type AppErrorCode =
  // Payment errors
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_TIMEOUT'
  | 'PAYMENT_NETWORK_ERROR'
  | 'PAYMENT_INSUFFICIENT_FUNDS'
  | 'PAYMENT_ALREADY_PROCESSING'
  // Cart errors
  | 'CART_ITEM_NOT_FOUND'
  | 'CART_INVALID_QUANTITY'
  | 'CART_EMPTY'
  // Product errors
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_OUT_OF_STOCK'
  // System errors
  | 'SYSTEM_IPC_ERROR'
  | 'SYSTEM_VALIDATION_ERROR'
  | 'SYSTEM_UNKNOWN_ERROR';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'warning' | 'error' | 'critical';

/**
 * User-friendly error messages for each error code
 */
const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  // Payment errors
  PAYMENT_DECLINED: 'Card declined. Please try a different payment method.',
  PAYMENT_TIMEOUT: 'Payment timed out. Please try again.',
  PAYMENT_NETWORK_ERROR: 'Network error. Please check connection and try again.',
  PAYMENT_INSUFFICIENT_FUNDS: 'Insufficient funds. Please try a different card.',
  PAYMENT_ALREADY_PROCESSING: 'A payment is already being processed.',
  // Cart errors
  CART_ITEM_NOT_FOUND: 'Item not found in cart.',
  CART_INVALID_QUANTITY: 'Invalid quantity specified.',
  CART_EMPTY: 'Cart is empty. Please add items before checkout.',
  // Product errors
  PRODUCT_NOT_FOUND: 'Product not found in catalog.',
  PRODUCT_OUT_OF_STOCK: 'Product is currently out of stock.',
  // System errors
  SYSTEM_IPC_ERROR: 'Communication error. Please try again.',
  SYSTEM_VALIDATION_ERROR: 'Invalid data received.',
  SYSTEM_UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};

/**
 * Severity mapping for each error code
 */
const ERROR_SEVERITY: Record<AppErrorCode, ErrorSeverity> = {
  // Payment errors - typically warnings (user can retry)
  PAYMENT_DECLINED: 'warning',
  PAYMENT_TIMEOUT: 'warning',
  PAYMENT_NETWORK_ERROR: 'warning',
  PAYMENT_INSUFFICIENT_FUNDS: 'warning',
  PAYMENT_ALREADY_PROCESSING: 'warning',
  // Cart errors - warnings
  CART_ITEM_NOT_FOUND: 'warning',
  CART_INVALID_QUANTITY: 'warning',
  CART_EMPTY: 'warning',
  // Product errors - warnings
  PRODUCT_NOT_FOUND: 'warning',
  PRODUCT_OUT_OF_STOCK: 'warning',
  // System errors - more severe
  SYSTEM_IPC_ERROR: 'error',
  SYSTEM_VALIDATION_ERROR: 'error',
  SYSTEM_UNKNOWN_ERROR: 'critical',
};

/**
 * Custom error class for application errors
 *
 * Provides structured error information with:
 * - Typed error codes
 * - User-friendly messages
 * - Severity levels
 * - Optional context data
 *
 * @example
 * throw new AppError('PAYMENT_DECLINED', { transactionId: 'TXN-123' });
 *
 * @example
 * try {
 *   await processPayment();
 * } catch (error) {
 *   if (error instanceof AppError) {
 *     console.log(error.userMessage);
 *   }
 * }
 */
export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly userMessage: string;
  public readonly severity: ErrorSeverity;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(code: AppErrorCode, context?: Record<string, unknown>) {
    const userMessage = ERROR_MESSAGES[code];
    super(userMessage);

    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
    this.severity = ERROR_SEVERITY[code];
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Check if an error is a user-recoverable error (can retry)
   */
  public isRecoverable(): boolean {
    return this.severity === 'warning';
  }

  /**
   * Convert to a plain object for logging or IPC
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Get user-friendly error message for an error code
 */
export function getErrorMessage(code: AppErrorCode): string {
  return ERROR_MESSAGES[code];
}

/**
 * Check if an unknown error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Wrap an unknown error as an AppError
 * Useful for catching and normalizing errors from external sources
 */
export function wrapError(error: unknown, fallbackCode: AppErrorCode = 'SYSTEM_UNKNOWN_ERROR'): AppError {
  if (isAppError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new AppError(fallbackCode, { originalError: message });
}

