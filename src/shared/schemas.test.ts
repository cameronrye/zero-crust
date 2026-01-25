/**
 * Zod Schema Validation Tests
 *
 * Tests runtime validation of IPC commands - critical for security.
 */

import { describe, it, expect } from 'vitest';
import { validateCommand, CommandSchema, WindowIdSchema } from './schemas';

describe('WindowIdSchema', () => {
  it('should accept valid window IDs', () => {
    expect(WindowIdSchema.safeParse('cashier').success).toBe(true);
    expect(WindowIdSchema.safeParse('customer').success).toBe(true);
    expect(WindowIdSchema.safeParse('dashboard').success).toBe(true);
  });

  it('should reject invalid window IDs', () => {
    expect(WindowIdSchema.safeParse('admin').success).toBe(false);
    expect(WindowIdSchema.safeParse('').success).toBe(false);
    expect(WindowIdSchema.safeParse(123).success).toBe(false);
  });
});

describe('CommandSchema', () => {
  describe('PING command', () => {
    it('should validate correct PING command', () => {
      const command = {
        type: 'PING',
        payload: { source: 'cashier', message: 'Hello' },
      };
      const result = CommandSchema.safeParse(command);
      expect(result.success).toBe(true);
    });

    it('should reject PING with invalid source', () => {
      const command = {
        type: 'PING',
        payload: { source: 'hacker', message: 'Hello' },
      };
      const result = CommandSchema.safeParse(command);
      expect(result.success).toBe(false);
    });

    it('should reject PING with empty message', () => {
      const command = {
        type: 'PING',
        payload: { source: 'cashier', message: '' },
      };
      const result = CommandSchema.safeParse(command);
      expect(result.success).toBe(false);
    });
  });

  describe('ADD_ITEM command', () => {
    it('should validate correct ADD_ITEM command', () => {
      const command = { type: 'ADD_ITEM', payload: { sku: 'PIZZA-001' } };
      expect(CommandSchema.safeParse(command).success).toBe(true);
    });

    it('should reject ADD_ITEM with empty SKU', () => {
      const command = { type: 'ADD_ITEM', payload: { sku: '' } };
      expect(CommandSchema.safeParse(command).success).toBe(false);
    });
  });

  describe('UPDATE_QUANTITY command', () => {
    it('should validate correct UPDATE_QUANTITY command', () => {
      const command = {
        type: 'UPDATE_QUANTITY',
        payload: { sku: 'PIZZA-001', index: 0, quantity: 3 },
      };
      expect(CommandSchema.safeParse(command).success).toBe(true);
    });

    it('should reject zero quantity', () => {
      const command = {
        type: 'UPDATE_QUANTITY',
        payload: { sku: 'PIZZA-001', index: 0, quantity: 0 },
      };
      expect(CommandSchema.safeParse(command).success).toBe(false);
    });

    it('should reject negative quantity', () => {
      const command = {
        type: 'UPDATE_QUANTITY',
        payload: { sku: 'PIZZA-001', index: 0, quantity: -1 },
      };
      expect(CommandSchema.safeParse(command).success).toBe(false);
    });

    it('should reject quantity over 999', () => {
      const command = {
        type: 'UPDATE_QUANTITY',
        payload: { sku: 'PIZZA-001', index: 0, quantity: 1000 },
      };
      expect(CommandSchema.safeParse(command).success).toBe(false);
    });
  });

  describe('null payload commands', () => {
    it('should validate CLEAR_CART', () => {
      const command = { type: 'CLEAR_CART', payload: null };
      expect(CommandSchema.safeParse(command).success).toBe(true);
    });

    it('should validate CHECKOUT', () => {
      const command = { type: 'CHECKOUT', payload: null };
      expect(CommandSchema.safeParse(command).success).toBe(true);
    });

    it('should validate CANCEL_CHECKOUT', () => {
      const command = { type: 'CANCEL_CHECKOUT', payload: null };
      expect(CommandSchema.safeParse(command).success).toBe(true);
    });
  });

  describe('invalid commands', () => {
    it('should reject unknown command type', () => {
      const command = { type: 'HACK_SYSTEM', payload: {} };
      expect(CommandSchema.safeParse(command).success).toBe(false);
    });

    it('should reject missing type', () => {
      const command = { payload: { sku: 'test' } };
      expect(CommandSchema.safeParse(command).success).toBe(false);
    });

    it('should reject null input', () => {
      expect(CommandSchema.safeParse(null).success).toBe(false);
    });

    it('should reject non-object input', () => {
      expect(CommandSchema.safeParse('string').success).toBe(false);
      expect(CommandSchema.safeParse(123).success).toBe(false);
    });
  });
});

describe('validateCommand helper', () => {
  it('should return success with data for valid command', () => {
    const result = validateCommand({ type: 'CLEAR_CART', payload: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('CLEAR_CART');
    }
  });

  it('should return error message for invalid command', () => {
    const result = validateCommand({ type: 'INVALID' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    }
  });
});

