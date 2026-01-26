/**
 * DemoService - Generates realistic demo orders for showcasing the app
 *
 * Creates believable QSR order patterns:
 * - Combo-style orders (pizza + side + drink)
 * - Family meals (multiple pizzas + multiple drinks)
 * - Single-item orders (just a drink or side)
 */

import { createLogger } from './Logger';
import { getProductsByCategory, type Product } from '@shared/catalog';

const logger = createLogger('DemoService');

/**
 * Common QSR order patterns with weighted probabilities
 */
const ORDER_PATTERNS = [
  { name: 'combo', weight: 40 },      // Pizza + side + drink
  { name: 'family', weight: 25 },     // Multiple pizzas + sides + drinks
  { name: 'double', weight: 15 },     // Two pizzas (sharing)
  { name: 'single', weight: 10 },     // Just one item
  { name: 'pizza_only', weight: 10 }, // Just pizza
] as const;

type OrderPattern = typeof ORDER_PATTERNS[number]['name'];

/**
 * Generate a random demo order for showcasing the POS system.
 *
 * Creates realistic QSR order patterns with weighted probabilities:
 * - 40% combo orders (pizza + side + drink)
 * - 25% family orders (2-3 pizzas + sides + drinks)
 * - 15% double orders (2 pizzas for sharing)
 * - 10% single item orders
 * - 10% pizza only orders
 *
 * @returns Array of SKUs to add to the cart
 *
 * @example
 * const skus = generateDemoOrder();
 * // Returns something like ['PIZZA-001', 'SIDE-002', 'DRINK-001']
 * for (const sku of skus) {
 *   mainStore.addItem(sku);
 * }
 */
export function generateDemoOrder(): string[] {
  const pattern = selectWeightedPattern();
  logger.debug('Generating demo order', { pattern });

  const skus = generateOrderForPattern(pattern);
  logger.info('Demo order generated', { pattern, itemCount: skus.length });

  return skus;
}

/**
 * Select a pattern based on weighted probability
 */
function selectWeightedPattern(): OrderPattern {
  const totalWeight = ORDER_PATTERNS.reduce((sum, p) => sum + p.weight, 0);
  let random = Math.random() * totalWeight;

  for (const pattern of ORDER_PATTERNS) {
    random -= pattern.weight;
    if (random <= 0) {
      return pattern.name;
    }
  }

  return 'combo'; // Fallback
}

/**
 * Generate SKUs for a specific order pattern
 * Returns empty array if required categories are empty
 */
function generateOrderForPattern(pattern: OrderPattern): string[] {
  const pizzas = getProductsByCategory('pizza');
  const sides = getProductsByCategory('sides');
  const drinks = getProductsByCategory('drinks');
  const skus: string[] = [];

  // Validate required categories are not empty before proceeding
  // This prevents runtime errors if catalog is misconfigured
  if (pizzas.length === 0) {
    logger.warn('Cannot generate demo order: no pizzas in catalog');
    return [];
  }

  switch (pattern) {
    case 'combo':
      // 1 pizza + 1 side + 1 drink
      // Fallback to pizza_only if sides or drinks are empty
      if (sides.length === 0 || drinks.length === 0) {
        logger.warn('Combo pattern missing sides or drinks, falling back to pizza only');
        skus.push(randomFrom(pizzas).sku);
      } else {
        skus.push(randomFrom(pizzas).sku);
        skus.push(randomFrom(sides).sku);
        skus.push(randomFrom(drinks).sku);
      }
      break;

    case 'family':
      // 2-3 pizzas + 1-2 sides + 2-4 drinks
      addMultiple(skus, pizzas, randomBetween(2, 3));
      // Only add sides and drinks if they exist
      if (sides.length > 0) {
        addMultiple(skus, sides, randomBetween(1, 2));
      }
      if (drinks.length > 0) {
        addMultiple(skus, drinks, randomBetween(2, 4));
      }
      break;

    case 'double':
      // 2 pizzas
      skus.push(randomFrom(pizzas).sku);
      skus.push(randomFrom(pizzas).sku);
      break;

    case 'single': {
      // Random single item from any category
      const allProducts = [...pizzas, ...sides, ...drinks];
      if (allProducts.length === 0) {
        logger.warn('No products available for single item order');
        return [];
      }
      skus.push(randomFrom(allProducts).sku);
      break;
    }

    case 'pizza_only':
      // Just 1 pizza
      skus.push(randomFrom(pizzas).sku);
      break;
  }

  return skus;
}



/**
 * Pick a random item from an array
 * Throws if array is empty (caller should ensure non-empty arrays)
 */
function randomFrom<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('Cannot pick random item from empty array');
  }
  // We know items.length > 0, so this index is always valid
  const index = Math.floor(Math.random() * items.length);
  return items[index] as T;
}

/**
 * Generate random integer between min and max (inclusive)
 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Add multiple random products from a category to the SKU list
 */
function addMultiple(skus: string[], products: Product[], count: number): void {
  for (let i = 0; i < count; i++) {
    skus.push(randomFrom(products).sku);
  }
}

