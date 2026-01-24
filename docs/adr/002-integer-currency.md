# ADR-002: Integer-Only Currency (Cents)

## Status

Accepted

## Context

Financial applications must handle currency calculations with precision. JavaScript's floating-point arithmetic introduces errors that are unacceptable for monetary transactions:

```javascript
0.1 + 0.2 = 0.30000000000000004  // Not 0.3!
```

These errors can accumulate over many transactions, leading to accounting discrepancies.

## Decision

All monetary values are stored and calculated as integers representing cents. A branded TypeScript type ensures type safety:

### Branded Cents Type (src/shared/currency.ts)

```typescript
export type Cents = number & { readonly __brand: 'Cents' };

export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new Error(`Cents must be an integer, got: ${value}`);
  }
  return value as Cents;
}
```

### Safe Arithmetic Operations

```typescript
export function addCents(a: Cents, b: Cents): Cents {
  return (a + b) as Cents;
}

export function multiplyCents(amount: Cents, quantity: number): Cents {
  if (!Number.isInteger(quantity)) {
    throw new Error(`Quantity must be an integer, got: ${quantity}`);
  }
  return (amount * quantity) as Cents;
}

export function sumCents(amounts: Cents[]): Cents {
  return amounts.reduce((sum, amount) => (sum + amount) as Cents, 0 as Cents);
}
```

### Display Formatting

```typescript
export function formatCents(amount: Cents): string {
  const dollars = Math.floor(amount / 100);
  const cents = Math.abs(amount % 100);
  return `$${dollars}.${cents.toString().padStart(2, '0')}`;
}
```

### Usage in Application

```typescript
// Product catalog stores prices in cents
const product = { sku: 'PIZZA-001', priceInCents: cents(599) }; // $5.99

// Cart calculations use integer math
const lineTotal = multiplyCents(item.priceInCents, item.quantity);
const cartTotal = sumCents(cart.map(item => multiplyCents(item.priceInCents, item.quantity)));
```

## Consequences

### Positive

- Zero floating-point errors in currency calculations
- Branded type prevents accidentally mixing cents with raw numbers
- Runtime validation catches non-integer values early
- Consistent representation across the entire codebase
- Easy to audit - all currency operations go through utility functions

### Negative

- Developers must remember to use cents() constructor
- Display formatting required for user-facing values
- Slightly more verbose than using raw numbers

### Neutral

- Standard practice in financial software
- Compatible with most payment APIs (which also use cents)

## Related Files

- `src/shared/currency.ts` - Currency utilities and Cents type
- `src/shared/currency.test.ts` - Comprehensive test coverage
- `src/main/MainStore.ts` - Uses Cents for cart totals
- `src/shared/catalog.ts` - Product prices defined in cents

