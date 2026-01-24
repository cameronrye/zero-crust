/**
 * Product Catalog Tests
 */

import { describe, it, expect } from 'vitest';
import {
  PRODUCT_CATALOG,
  PRODUCT_CATEGORIES,
  getProductBySku,
  getProductsByCategory,
} from './catalog';

describe('Product Catalog', () => {
  describe('PRODUCT_CATALOG', () => {
    it('should contain products', () => {
      expect(PRODUCT_CATALOG.length).toBeGreaterThan(0);
    });

    it('should have valid product structure', () => {
      for (const product of PRODUCT_CATALOG) {
        expect(product.sku).toBeTruthy();
        expect(product.name).toBeTruthy();
        expect(product.description).toBeTruthy();
        expect(typeof product.priceInCents).toBe('number');
        expect(Number.isInteger(product.priceInCents)).toBe(true);
        expect(PRODUCT_CATEGORIES).toContain(product.category);
      }
    });

    it('should have unique SKUs', () => {
      const skus = PRODUCT_CATALOG.map((p) => p.sku);
      const uniqueSkus = new Set(skus);
      expect(uniqueSkus.size).toBe(skus.length);
    });

    it('should have prices stored in cents (integers)', () => {
      for (const product of PRODUCT_CATALOG) {
        expect(Number.isInteger(product.priceInCents)).toBe(true);
        expect(product.priceInCents).toBeGreaterThan(0);
      }
    });
  });

  describe('getProductBySku()', () => {
    it('should find existing product', () => {
      const product = getProductBySku('CLASSIC-PEPPERONI');
      expect(product).toBeDefined();
      expect(product?.name).toBe('Classic Pepperoni');
      expect(product?.priceInCents).toBe(599);
    });

    it('should return undefined for unknown SKU', () => {
      const product = getProductBySku('NONEXISTENT-SKU');
      expect(product).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const product = getProductBySku('classic-pepperoni');
      expect(product).toBeUndefined();
    });
  });

  describe('getProductsByCategory()', () => {
    it('should return all pizzas', () => {
      const pizzas = getProductsByCategory('pizza');
      expect(pizzas.length).toBeGreaterThan(0);
      expect(pizzas.every((p) => p.category === 'pizza')).toBe(true);
    });

    it('should return all drinks', () => {
      const drinks = getProductsByCategory('drinks');
      expect(drinks.length).toBeGreaterThan(0);
      expect(drinks.every((p) => p.category === 'drinks')).toBe(true);
    });

    it('should return all sides', () => {
      const sides = getProductsByCategory('sides');
      expect(sides.length).toBeGreaterThan(0);
      expect(sides.every((p) => p.category === 'sides')).toBe(true);
    });

    it('should return all extras', () => {
      const extras = getProductsByCategory('extras');
      expect(extras.length).toBeGreaterThan(0);
      expect(extras.every((p) => p.category === 'extras')).toBe(true);
    });
  });

  describe('PRODUCT_CATEGORIES', () => {
    it('should contain all categories', () => {
      expect(PRODUCT_CATEGORIES).toContain('pizza');
      expect(PRODUCT_CATEGORIES).toContain('sides');
      expect(PRODUCT_CATEGORIES).toContain('drinks');
      expect(PRODUCT_CATEGORIES).toContain('extras');
    });
  });
});

