/**
 * Product Catalog - Browser-compatible version
 */

import { type Cents, cents } from './currency';

export interface Product {
  sku: string;
  name: string;
  description: string;
  priceInCents: Cents;
  category: ProductCategory;
  initialStock: number;
}

export type ProductCategory = 'pizza' | 'sides' | 'drinks' | 'extras';

export const PRODUCT_CATALOG: readonly Product[] = [
  // Pizzas
  {
    sku: 'CLASSIC-PEPPERONI',
    name: 'Classic Pepperoni',
    description: 'Classic pepperoni pizza, ready when you are',
    priceInCents: cents(599),
    category: 'pizza',
    initialStock: -1,
  },
  {
    sku: 'CLASSIC-CHEESE',
    name: 'Classic Cheese',
    description: 'Classic cheese pizza, ready when you are',
    priceInCents: cents(599),
    category: 'pizza',
    initialStock: -1,
  },
  {
    sku: 'LOADED-PEPPERONI',
    name: 'Loaded Pepperoni',
    description: 'Extra pepperoni and cheese on our largest pizza',
    priceInCents: cents(899),
    category: 'pizza',
    initialStock: -1,
  },
  {
    sku: 'DEEP-DISH',
    name: 'Deep Dish',
    description: 'Crispy, cheesy corners with premium toppings',
    priceInCents: cents(1099),
    category: 'pizza',
    initialStock: -1,
  },
  {
    sku: 'STUFFED-CRUST',
    name: 'Stuffed Crust Pizza',
    description: 'Premium pizza with cheese-stuffed crust',
    priceInCents: cents(1199),
    category: 'pizza',
    initialStock: -1,
  },
  {
    sku: 'VEGGIE-SUPREME',
    name: 'Veggie Supreme',
    description: 'Fresh vegetables on a crispy thin crust',
    priceInCents: cents(999),
    category: 'pizza',
    initialStock: -1,
  },
  // Sides
  {
    sku: 'BREADSTICKS-8PC',
    name: 'Breadsticks (8 piece)',
    description: 'Fresh-baked, buttery breadsticks with marinara sauce',
    priceInCents: cents(399),
    category: 'sides',
    initialStock: -1,
  },
  {
    sku: 'ITALIAN-CHEESE-BREAD',
    name: 'Italian Cheese Bread',
    description: 'Oven-baked bread topped with cheese and Italian spices',
    priceInCents: cents(499),
    category: 'sides',
    initialStock: -1,
  },
  {
    sku: 'CHEESE-PUFFS',
    name: 'Cheese Puffs',
    description: 'Bite-sized, cheese-filled dough puffs',
    priceInCents: cents(499),
    category: 'sides',
    initialStock: -1,
  },
  {
    sku: 'WINGS-8PC',
    name: 'Wings (8 piece)',
    description: 'Crispy chicken wings with your choice of sauce',
    priceInCents: cents(699),
    category: 'sides',
    initialStock: -1,
  },
  {
    sku: 'MOZZARELLA-STICKS',
    name: 'Mozzarella Sticks',
    description: 'Golden-fried mozzarella with marinara',
    priceInCents: cents(549),
    category: 'sides',
    initialStock: -1,
  },
  {
    sku: 'GARLIC-KNOTS',
    name: 'Garlic Knots (6 piece)',
    description: 'Fresh-baked knots with garlic butter',
    priceInCents: cents(349),
    category: 'sides',
    initialStock: -1,
  },
  // Drinks
  {
    sku: 'COLA-2L',
    name: 'Cola 2-Liter',
    description: 'Cola 2-liter bottle',
    priceInCents: cents(299),
    category: 'drinks',
    initialStock: -1,
  },
  {
    sku: 'CITRUS-SODA-2L',
    name: 'Citrus Soda 2-Liter',
    description: 'Citrus soda 2-liter bottle',
    priceInCents: cents(299),
    category: 'drinks',
    initialStock: -1,
  },
  {
    sku: 'WATER-BOTTLE',
    name: 'Bottled Water',
    description: 'Refreshing bottled water',
    priceInCents: cents(199),
    category: 'drinks',
    initialStock: -1,
  },
  {
    sku: 'LEMONADE-2L',
    name: 'Lemonade 2-Liter',
    description: 'Fresh-squeezed style lemonade',
    priceInCents: cents(349),
    category: 'drinks',
    initialStock: -1,
  },
  {
    sku: 'ICED-TEA-2L',
    name: 'Iced Tea 2-Liter',
    description: 'Sweet iced tea 2-liter bottle',
    priceInCents: cents(299),
    category: 'drinks',
    initialStock: -1,
  },
  {
    sku: 'ROOT-BEER-2L',
    name: 'Root Beer 2-Liter',
    description: 'Classic root beer 2-liter bottle',
    priceInCents: cents(299),
    category: 'drinks',
    initialStock: -1,
  },
  // Extras
  {
    sku: 'MARINARA-CUP',
    name: 'Marinara Sauce Cup',
    description: 'Extra marinara dipping sauce',
    priceInCents: cents(69),
    category: 'extras',
    initialStock: -1,
  },
  {
    sku: 'RANCH-CUP',
    name: 'Ranch Dipping Cup',
    description: 'Creamy ranch dipping sauce',
    priceInCents: cents(69),
    category: 'extras',
    initialStock: -1,
  },
  {
    sku: 'BUTTER-CUP',
    name: 'Butter Dipping Cup',
    description: 'Garlic butter dipping sauce',
    priceInCents: cents(69),
    category: 'extras',
    initialStock: -1,
  },
  {
    sku: 'BBQ-CUP',
    name: 'BBQ Sauce Cup',
    description: 'Smoky BBQ dipping sauce',
    priceInCents: cents(69),
    category: 'extras',
    initialStock: -1,
  },
  {
    sku: 'HOT-SAUCE-CUP',
    name: 'Hot Sauce Cup',
    description: 'Spicy hot sauce for wings',
    priceInCents: cents(69),
    category: 'extras',
    initialStock: -1,
  },
  {
    sku: 'PARMESAN-PKT',
    name: 'Parmesan Packet',
    description: 'Grated parmesan cheese packet',
    priceInCents: cents(49),
    category: 'extras',
    initialStock: -1,
  },
] as const;

const productBySku: Map<string, Product> = new Map(
  PRODUCT_CATALOG.map((p) => [p.sku, p])
);

export function getProductBySku(sku: string): Product | undefined {
  return productBySku.get(sku);
}

export function getProductsByCategory(category: ProductCategory): Product[] {
  return PRODUCT_CATALOG.filter((p) => p.category === category);
}

export const PRODUCT_CATEGORIES: ProductCategory[] = ['pizza', 'sides', 'drinks', 'extras'];

