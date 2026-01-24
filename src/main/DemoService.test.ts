/**
 * DemoService Tests - Demo order generation
 *
 * These tests verify:
 * - Order patterns are generated correctly
 * - SKUs come from valid catalog products
 * - Different order patterns have appropriate item counts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PRODUCT_CATALOG } from '@shared/catalog';
import { generateDemoOrder } from './DemoService';

describe('DemoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDemoOrder', () => {
    it('should return an array of SKUs', () => {
      const skus = generateDemoOrder();

      expect(Array.isArray(skus)).toBe(true);
      expect(skus.length).toBeGreaterThan(0);
    });

    it('should return valid catalog SKUs', () => {
      const validSkus = PRODUCT_CATALOG.map((p) => p.sku);

      // Run multiple times to cover different patterns
      for (let i = 0; i < 20; i++) {
        const skus = generateDemoOrder();
        for (const sku of skus) {
          expect(validSkus).toContain(sku);
        }
      }
    });

    it('should generate orders with 1-9 items', () => {
      // Run many times to test various patterns
      for (let i = 0; i < 50; i++) {
        const skus = generateDemoOrder();
        expect(skus.length).toBeGreaterThanOrEqual(1);
        expect(skus.length).toBeLessThanOrEqual(9); // Family max: 3 pizza + 2 sides + 4 drinks
      }
    });

    it('should generate combo pattern (pizza + side + drink)', () => {
      // Mock Math.random to force combo pattern (weight 0-40)
      vi.spyOn(Math, 'random').mockReturnValue(0.1); // 10% of 100 = 10, falls in combo range

      const skus = generateDemoOrder();

      expect(skus.length).toBe(3); // 1 pizza + 1 side + 1 drink

      // Check that we have one from each category
      const categories = skus.map((sku) => {
        const product = PRODUCT_CATALOG.find((p) => p.sku === sku);
        return product?.category;
      });

      expect(categories).toContain('pizza');
      expect(categories).toContain('sides');
      expect(categories).toContain('drinks');

      vi.restoreAllMocks();
    });

    it('should generate single item pattern', () => {
      // ORDER_PATTERNS: combo(40), family(25), double(15), single(10), pizza_only(10)
      // Cumulative: 0-40=combo, 40-65=family, 65-80=double, 80-90=single, 90-100=pizza_only
      // For single: need random*100 to be in range 80-90
      // Using 0.85 gives 85, which falls in single range (80-90)
      vi.spyOn(Math, 'random').mockReturnValue(0.85);

      const skus = generateDemoOrder();

      expect(skus.length).toBe(1);

      vi.restoreAllMocks();
    });

    it('should generate pizza_only pattern', () => {
      // For pizza_only: need random*100 to be in range 90-100
      // Using 0.95 gives 95, which falls in pizza_only range (90-100)
      vi.spyOn(Math, 'random').mockReturnValue(0.95);

      const skus = generateDemoOrder();

      expect(skus.length).toBe(1);

      const product = PRODUCT_CATALOG.find((p) => p.sku === skus[0]);
      expect(product?.category).toBe('pizza');

      vi.restoreAllMocks();
    });

    it('should generate double pattern (2 pizzas)', () => {
      // For double: need random*100 to be in range 65-80
      // Using 0.70 gives 70, which falls in double range (65-80)
      vi.spyOn(Math, 'random').mockReturnValue(0.70);

      const skus = generateDemoOrder();

      expect(skus.length).toBe(2);

      // Both should be pizzas
      for (const sku of skus) {
        const product = PRODUCT_CATALOG.find((p) => p.sku === sku);
        expect(product?.category).toBe('pizza');
      }

      vi.restoreAllMocks();
    });
  });

  describe('order distribution', () => {
    it('should produce varied orders over many generations', () => {
      const orderSizes = new Set<number>();

      // Generate many orders
      for (let i = 0; i < 100; i++) {
        const skus = generateDemoOrder();
        orderSizes.add(skus.length);
      }

      // Should have at least 3 different order sizes
      expect(orderSizes.size).toBeGreaterThanOrEqual(3);
    });
  });
});

