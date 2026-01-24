/**
 * Currency Utilities - Integer-Only Math for Financial Transactions
 *
 * All monetary values are stored as integers (cents) to prevent floating-point errors.
 * Example: $5.99 is stored as 599 cents
 *
 * Why? Financial transactions cannot tolerate floating-point errors.
 * 0.1 + 0.2 = 0.30000000000000004 in JavaScript, which is unacceptable for money.
 */

/**
 * Branded type for cents to ensure type safety
 * This prevents accidentally mixing cents with regular numbers
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
 * Convert dollars to cents
 * Uses rounding to handle floating-point edge cases
 * @param dollars - Amount in dollars (e.g., 5.99)
 * @returns Amount in cents (e.g., 599)
 */
export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100) as Cents;
}

/**
 * Convert cents to dollars
 * @param amount - Amount in cents (e.g., 599)
 * @returns Amount in dollars (e.g., 5.99)
 */
export function centsToDollars(amount: Cents | number): number {
  return amount / 100;
}

/**
 * Format cents as a currency string
 * @param amount - Amount in cents
 * @param locale - Locale for formatting (default: 'en-US')
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted currency string (e.g., "$5.99")
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
 * Add two cent amounts safely
 */
export function addCents(a: Cents | number, b: Cents | number): Cents {
  return (a + b) as Cents;
}

/**
 * Subtract cents safely
 */
export function subtractCents(a: Cents | number, b: Cents | number): Cents {
  return (a - b) as Cents;
}

/**
 * Multiply cents by a quantity (always integer)
 * @throws Error if quantity is not a positive integer
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

/**
 * Check if an amount is valid (non-negative integer)
 */
export function isValidCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Zero cents constant for convenience
 */
export const ZERO_CENTS: Cents = 0 as Cents;

