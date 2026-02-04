/**
 * Configuration Constants - Web Demo Version
 *
 * Timing and configuration for the demo mode.
 */

/**
 * Inventory configuration
 */
export const INVENTORY_CONFIG = {
  /** Sentinel value representing unlimited stock quantity */
  UNLIMITED_STOCK: -1,
  /** Initial stock quantity for each product */
  INITIAL_STOCK: 500,
  /** Low stock threshold for visual indicator */
  LOW_STOCK_THRESHOLD: 5,
} as const;

/**
 * Payment retry configuration
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry attempts before giving up */
  maxRetries: 3,
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
