/**
 * Currency Utilities - Integer-Only Math for Financial Transactions
 * Browser-compatible version for web demo
 */

/**
 * Branded type for cents to ensure type safety
 */
export type Cents = number & { readonly __brand: 'Cents' };

/**
 * Create a Cents value from an integer
 * @throws Error if value is not an integer
 */
export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new Error(`Cents must be an integer, got: ${value}`);
  }
  return value as Cents;
}

/**
 * Safely create a Cents value by rounding to nearest integer
 * Use this when the input might be a float (e.g., from calculations)
 */
export function safeCents(value: number): Cents {
  return Math.round(value) as Cents;
}

/**
 * Convert cents to dollars
 */
export function centsToDollars(amount: Cents | number): number {
  return amount / 100;
}

/**
 * Format cents as a currency string
 */
export function formatCurrency(
  amount: Cents | number,
  locale: string = 'en-US',
  currency: string = 'USD'
): string {
  const dollars = centsToDollars(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Multiply cents by a quantity
 */
export function multiplyCents(amount: Cents | number, quantity: number): Cents {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Quantity must be a non-negative integer, got: ${quantity}`);
  }
  return (amount * quantity) as Cents;
}

/**
 * Calculate total from an array of cent amounts
 */
export function sumCents(amounts: (Cents | number)[]): Cents {
  return amounts.reduce((sum, amount) => sum + amount, 0) as Cents;
}

export const ZERO_CENTS: Cents = 0 as Cents;

