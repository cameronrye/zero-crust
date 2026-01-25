/**
 * Configuration Constants - Centralized configuration for the POS system
 *
 * All magic numbers and configurable values are defined here to:
 * - Make the codebase easier to understand
 * - Allow easy tuning of parameters
 * - Prepare for environment-based configuration
 */

/**
 * Payment gateway configuration
 */
export const PAYMENT_CONFIG = {
  /** Processing delay in milliseconds (simulates real gateway latency) */
  processingDelayMs: 2500,
  /** Probability of payment failure (0.0 to 1.0) for simulation */
  failureRate: 0.1,
} as const;

/**
 * Payment retry configuration
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry attempts before giving up */
  maxRetries: 3,
  /** Base delay in milliseconds for exponential backoff (first retry) */
  baseDelayMs: 1000,
  /** Maximum delay in milliseconds for exponential backoff (cap) */
  maxDelayMs: 4000,
} as const;

/**
 * Metrics service configuration
 */
export const METRICS_CONFIG = {
  /** Rolling window size in milliseconds for TPM calculation (5 minutes) */
  windowSizeMs: 5 * 60 * 1000,
  /** Maximum number of detailed transactions to keep in memory */
  maxDetailedTransactions: 1000,
  /** Number of transactions to compact when memory limit is reached */
  compactionBatchSize: 200,
} as const;

/**
 * Auto-updater configuration
 */
export const AUTO_UPDATER_CONFIG = {
  /** Delay before checking for updates after app launch (milliseconds) */
  initialCheckDelayMs: 5000,
} as const;

/**
 * Demo service configuration
 */
export const DEMO_CONFIG = {
  /** Delay between demo orders in milliseconds */
  orderIntervalMs: 8000,
  /** Minimum delay between demo orders (randomized) */
  minOrderIntervalMs: 5000,
  /** Maximum delay between demo orders (randomized) */
  maxOrderIntervalMs: 12000,
} as const;

/**
 * Demo loop timing configuration (in milliseconds)
 * All ranges are [min, max] for random variation to simulate human behavior
 */
export const DEMO_LOOP_TIMING = {
  /** Delay between adding each item to cart */
  itemAddDelay: [300, 800] as const,
  /** Delay after cart is complete before checkout */
  preCheckoutDelay: [1500, 3000] as const,
  /** Delay after successful payment before new transaction */
  postPaymentDelay: [2000, 4000] as const,
  /** Delay after payment error before retry */
  retryDelay: [1000, 2000] as const,
  /** Delay after max retries before starting fresh */
  errorRecoveryDelay: [2000, 3000] as const,
} as const;

/**
 * UI configuration
 */
export const UI_CONFIG = {
  /** Debounce delay for state broadcasts (milliseconds) */
  stateBroadcastDebounceMs: 16,
  /** Animation duration for transitions (milliseconds) */
  transitionDurationMs: 200,
} as const;

/**
 * Logging configuration
 */
export const LOGGING_CONFIG = {
  /** Maximum log entries to keep in memory (for crash reports) */
  maxLogEntries: 1000,
  /** Log level for development */
  devLogLevel: 'debug' as const,
  /** Log level for production */
  prodLogLevel: 'info' as const,
} as const;

