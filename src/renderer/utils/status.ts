/**
 * Transaction Status UI Constants
 *
 * Centralized styling for transaction status displays across the app.
 * Provides consistent colors and messages for all transaction states.
 */

import type { TransactionStatus } from '@shared/ipc-types';

/**
 * Background colors for status badges (used in sidebars, headers)
 */
export const STATUS_BADGE_COLORS: Record<TransactionStatus, string> = {
  IDLE: 'bg-emerald-500',
  PENDING: 'bg-amber-500',
  PROCESSING: 'bg-amber-500 animate-pulse',
  PAID: 'bg-emerald-500',
  ERROR: 'bg-rose-600',
} as const;

/**
 * Text colors for status displays (used in customer-facing views)
 */
export const STATUS_TEXT_COLORS: Record<TransactionStatus, string> = {
  IDLE: 'text-amber-400',
  PENDING: 'text-amber-400',
  PROCESSING: 'text-amber-400 animate-pulse',
  PAID: 'text-emerald-400',
  ERROR: 'text-rose-400',
} as const;

/**
 * Human-readable status messages for customer-facing displays
 */
export const STATUS_MESSAGES: Record<TransactionStatus, string> = {
  IDLE: '',
  PENDING: 'Ready to Pay',
  PROCESSING: 'Processing Payment...',
  PAID: 'Thank You!',
  ERROR: 'Payment Error',
} as const;

