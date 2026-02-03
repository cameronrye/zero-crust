/**
 * Transaction Status UI Constants (Web version)
 */

import type { TransactionStatus } from '../shared/types';

export const STATUS_BADGE_COLORS: Record<TransactionStatus, string> = {
  IDLE: 'bg-slate-500',
  PENDING: 'bg-amber-500',
  PROCESSING: 'bg-amber-500 animate-pulse',
  PAID: 'bg-emerald-500',
  ERROR: 'bg-rose-600',
} as const;

export const STATUS_TEXT_COLORS: Record<TransactionStatus, string> = {
  IDLE: 'text-slate-400',
  PENDING: 'text-amber-400',
  PROCESSING: 'text-amber-400 animate-pulse',
  PAID: 'text-emerald-400',
  ERROR: 'text-rose-400',
} as const;

export const STATUS_MESSAGES: Record<TransactionStatus, string> = {
  IDLE: '',
  PENDING: 'Ready to Pay',
  PROCESSING: 'Processing Payment...',
  PAID: 'Thank You!',
  ERROR: 'Payment Error',
} as const;

