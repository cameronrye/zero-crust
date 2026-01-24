/**
 * ProductGrid Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductGrid } from './ProductGrid';

describe('ProductGrid', () => {
  const defaultProps = {
    selectedCategory: 'pizza' as const,
    onCategoryChange: vi.fn(),
    onAddItem: vi.fn(),
    onQuickOrder: vi.fn(),
    isLocked: false,
    demoLoopRunning: false,
  };

  it('should render category tabs', () => {
    render(<ProductGrid {...defaultProps} />);
    
    expect(screen.getByText('pizza')).toBeInTheDocument();
    expect(screen.getByText('sides')).toBeInTheDocument();
    expect(screen.getByText('drinks')).toBeInTheDocument();
  });

  it('should highlight the selected category', () => {
    render(<ProductGrid {...defaultProps} selectedCategory="pizza" />);

    const pizzaTab = screen.getByText('pizza');
    expect(pizzaTab).toHaveClass('bg-amber-600');
  });

  it('should call onCategoryChange when a category tab is clicked', () => {
    const onCategoryChange = vi.fn();
    render(<ProductGrid {...defaultProps} onCategoryChange={onCategoryChange} />);
    
    fireEvent.click(screen.getByText('drinks'));
    expect(onCategoryChange).toHaveBeenCalledWith('drinks');
  });

  it('should display products for the selected category', () => {
    render(<ProductGrid {...defaultProps} selectedCategory="pizza" />);

    // Should show pizza products
    expect(screen.getByText('Classic Pepperoni')).toBeInTheDocument();
  });

  it('should call onAddItem when a product is clicked', () => {
    const onAddItem = vi.fn();
    render(<ProductGrid {...defaultProps} onAddItem={onAddItem} />);

    fireEvent.click(screen.getByText('Classic Pepperoni'));
    expect(onAddItem).toHaveBeenCalledWith('CLASSIC-PEPPERONI');
  });

  it('should show F-key shortcuts on products', () => {
    render(<ProductGrid {...defaultProps} />);
    
    // First product should have F1
    expect(screen.getByText('F1')).toBeInTheDocument();
  });

  describe('locked state', () => {
    it('should disable category tabs when isLocked is true', () => {
      render(<ProductGrid {...defaultProps} isLocked={true} />);
      
      const pizzaTab = screen.getByText('pizza');
      expect(pizzaTab).toBeDisabled();
    });

    it('should disable product buttons when isLocked is true', () => {
      render(<ProductGrid {...defaultProps} isLocked={true} />);

      const productButton = screen.getByText('Classic Pepperoni').closest('button');
      expect(productButton).toBeDisabled();
    });

    it('should apply opacity styling when isLocked is true', () => {
      render(<ProductGrid {...defaultProps} isLocked={true} />);

      const productButton = screen.getByText('Classic Pepperoni').closest('button');
      expect(productButton).toHaveClass('opacity-50');
    });
  });

  it('should display product prices', () => {
    render(<ProductGrid {...defaultProps} />);

    // Multiple products have $5.99 price (Hot-N-Ready Pepperoni and Cheese)
    const priceElements = screen.getAllByText('$5.99');
    expect(priceElements.length).toBeGreaterThan(0);
  });

  describe('Quick Order button', () => {
    it('should render Quick Order button', () => {
      render(<ProductGrid {...defaultProps} />);
      expect(screen.getByText('Quick Order')).toBeInTheDocument();
    });

    it('should call onQuickOrder when Quick Order button is clicked', () => {
      const onQuickOrder = vi.fn();
      render(<ProductGrid {...defaultProps} onQuickOrder={onQuickOrder} />);

      fireEvent.click(screen.getByText('Quick Order'));
      expect(onQuickOrder).toHaveBeenCalledTimes(1);
    });

    it('should disable Quick Order button when isLocked is true', () => {
      render(<ProductGrid {...defaultProps} isLocked={true} />);

      const button = screen.getByText('Quick Order');
      expect(button).toBeDisabled();
    });

    it('should disable Quick Order button when demoLoopRunning is true', () => {
      render(<ProductGrid {...defaultProps} demoLoopRunning={true} />);

      const button = screen.getByText('Quick Order');
      expect(button).toBeDisabled();
    });

    it('should enable Quick Order button when not locked and demo loop not running', () => {
      render(<ProductGrid {...defaultProps} isLocked={false} demoLoopRunning={false} />);

      const button = screen.getByText('Quick Order');
      expect(button).not.toBeDisabled();
    });
  });
});

