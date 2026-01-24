/**
 * CartItemRow Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CartItemRow } from './CartItemRow';
import type { CartItem } from '@shared/ipc-types';
import type { Cents } from '@shared/currency';

describe('CartItemRow', () => {
  const mockItem: CartItem = {
    sku: 'PIZZA-001',
    name: 'Pepperoni Pizza',
    priceInCents: 1299 as Cents,
    quantity: 2,
  };

  const defaultProps = {
    item: mockItem,
    disabled: false,
    onRemove: vi.fn(),
    onUpdateQuantity: vi.fn(),
  };

  it('should display the item name', () => {
    render(<CartItemRow {...defaultProps} />);
    expect(screen.getByText('Pepperoni Pizza')).toBeInTheDocument();
  });

  it('should display the quantity', () => {
    render(<CartItemRow {...defaultProps} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should display the formatted total price', () => {
    render(<CartItemRow {...defaultProps} />);
    // 1299 cents * 2 = $25.98
    expect(screen.getByText('$25.98')).toBeInTheDocument();
  });

  it('should call onRemove when remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<CartItemRow {...defaultProps} onRemove={onRemove} />);

    const removeButton = screen.getByLabelText(/Remove.*from cart/);
    fireEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('should call onUpdateQuantity with decremented value when minus is clicked', () => {
    const onUpdateQuantity = vi.fn();
    render(<CartItemRow {...defaultProps} onUpdateQuantity={onUpdateQuantity} />);

    const minusButton = screen.getByLabelText(/Decrease quantity/);
    fireEvent.click(minusButton);
    expect(onUpdateQuantity).toHaveBeenCalledWith(1);
  });

  it('should call onUpdateQuantity with incremented value when plus is clicked', () => {
    const onUpdateQuantity = vi.fn();
    render(<CartItemRow {...defaultProps} onUpdateQuantity={onUpdateQuantity} />);

    const plusButton = screen.getByLabelText(/Increase quantity/);
    fireEvent.click(plusButton);
    expect(onUpdateQuantity).toHaveBeenCalledWith(3);
  });

  describe('disabled state', () => {
    it('should disable all buttons when disabled is true', () => {
      render(<CartItemRow {...defaultProps} disabled={true} />);

      expect(screen.getByLabelText(/Remove.*from cart/)).toBeDisabled();
      expect(screen.getByLabelText(/Decrease quantity/)).toBeDisabled();
      expect(screen.getByLabelText(/Increase quantity/)).toBeDisabled();
    });

    it('should enable all buttons when disabled is false', () => {
      render(<CartItemRow {...defaultProps} disabled={false} />);

      expect(screen.getByLabelText(/Remove.*from cart/)).not.toBeDisabled();
      expect(screen.getByLabelText(/Decrease quantity/)).not.toBeDisabled();
      expect(screen.getByLabelText(/Increase quantity/)).not.toBeDisabled();
    });
  });
});

