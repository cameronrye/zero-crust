/**
 * Currency Utils Tests - Verify integer-only math for monetary calculations
 */

import { describe, it, expect } from 'vitest';
import {
  cents,
  dollarsToCents,
  centsToDollars,
  formatCurrency,
  addCents,
  subtractCents,
  multiplyCents,
  sumCents,
  isValidCents,
  ZERO_CENTS,
} from './currency';

describe('Currency Utils', () => {
  describe('cents()', () => {
    it('should create cents from integer', () => {
      expect(cents(599)).toBe(599);
      expect(cents(0)).toBe(0);
      expect(cents(100)).toBe(100);
    });

    it('should throw for non-integer values', () => {
      expect(() => cents(5.99)).toThrow('Cents must be an integer');
      expect(() => cents(0.1)).toThrow('Cents must be an integer');
    });

    it('should allow negative cents', () => {
      expect(cents(-100)).toBe(-100);
    });
  });

  describe('dollarsToCents()', () => {
    it('should convert dollars to cents correctly', () => {
      expect(dollarsToCents(5.99)).toBe(599);
      expect(dollarsToCents(0)).toBe(0);
      expect(dollarsToCents(1)).toBe(100);
      expect(dollarsToCents(10.5)).toBe(1050);
    });

    it('should handle floating point precision issues', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
      expect(dollarsToCents(0.1 + 0.2)).toBe(30);
      expect(dollarsToCents(19.99)).toBe(1999);
    });

    it('should round to nearest cent', () => {
      expect(dollarsToCents(1.999)).toBe(200);
      expect(dollarsToCents(1.994)).toBe(199);
    });
  });

  describe('centsToDollars()', () => {
    it('should convert cents to dollars', () => {
      expect(centsToDollars(599)).toBe(5.99);
      expect(centsToDollars(0)).toBe(0);
      expect(centsToDollars(100)).toBe(1);
    });
  });

  describe('formatCurrency()', () => {
    it('should format cents as USD currency string', () => {
      expect(formatCurrency(599)).toBe('$5.99');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(1000)).toBe('$10.00');
      expect(formatCurrency(69)).toBe('$0.69');
    });

    it('should handle large amounts', () => {
      expect(formatCurrency(1234567)).toBe('$12,345.67');
    });

    it('should handle negative amounts', () => {
      expect(formatCurrency(-599)).toBe('-$5.99');
    });
  });

  describe('addCents()', () => {
    it('should add two cent amounts', () => {
      expect(addCents(100, 200)).toBe(300);
      expect(addCents(0, 599)).toBe(599);
    });
  });

  describe('subtractCents()', () => {
    it('should subtract cent amounts', () => {
      expect(subtractCents(500, 200)).toBe(300);
      expect(subtractCents(599, 599)).toBe(0);
    });

    it('should allow negative results', () => {
      expect(subtractCents(100, 200)).toBe(-100);
    });
  });

  describe('multiplyCents()', () => {
    it('should multiply cents by quantity', () => {
      expect(multiplyCents(599, 2)).toBe(1198);
      expect(multiplyCents(100, 0)).toBe(0);
      expect(multiplyCents(69, 3)).toBe(207);
    });

    it('should throw for non-integer quantity', () => {
      expect(() => multiplyCents(100, 1.5)).toThrow(
        'Quantity must be a non-negative integer'
      );
    });

    it('should throw for negative quantity', () => {
      expect(() => multiplyCents(100, -1)).toThrow(
        'Quantity must be a non-negative integer'
      );
    });
  });

  describe('sumCents()', () => {
    it('should sum array of cent amounts', () => {
      expect(sumCents([100, 200, 300])).toBe(600);
      expect(sumCents([599, 399, 69])).toBe(1067);
      expect(sumCents([])).toBe(0);
    });
  });

  describe('isValidCents()', () => {
    it('should return true for valid cent values', () => {
      expect(isValidCents(0)).toBe(true);
      expect(isValidCents(100)).toBe(true);
      expect(isValidCents(999999)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isValidCents(-1)).toBe(false);
      expect(isValidCents(1.5)).toBe(false);
      expect(isValidCents('100')).toBe(false);
      expect(isValidCents(null)).toBe(false);
      expect(isValidCents(undefined)).toBe(false);
    });
  });

  describe('ZERO_CENTS', () => {
    it('should be zero', () => {
      expect(ZERO_CENTS).toBe(0);
    });
  });
});

