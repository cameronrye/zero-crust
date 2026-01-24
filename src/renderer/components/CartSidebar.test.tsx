/**
 * CartSidebar Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CartSidebar } from './CartSidebar';
import type { AppState } from '@shared/ipc-types';
import type { Cents } from '@shared/currency';

describe('CartSidebar', () => {
  const mockHandlers = {
    onRemoveItem: vi.fn(),
    onUpdateQuantity: vi.fn(),
    onClearCart: vi.fn(),
    onCheckout: vi.fn(),
    onProcessPayment: vi.fn(),
    onRetryPayment: vi.fn(),
    onNewTransaction: vi.fn(),
    onCancelCheckout: vi.fn(),
  };

  const emptyState: AppState = {
    cart: [],
    totalInCents: 0 as Cents,
    transactionStatus: 'IDLE',
    version: 1,
    retryCount: 0,
  };

  const stateWithItems: AppState = {
    cart: [
      { sku: 'PIZZA-001', name: 'Pepperoni Pizza', priceInCents: 1299 as Cents, quantity: 2 },
      { sku: 'DRINK-001', name: 'Cola', priceInCents: 199 as Cents, quantity: 1 },
    ],
    totalInCents: 2797 as Cents,
    transactionStatus: 'IDLE',
    version: 1,
    retryCount: 0,
  };

  it('should render the Current Order header', () => {
    render(<CartSidebar state={emptyState} {...mockHandlers} />);
    expect(screen.getByText('Current Order')).toBeInTheDocument();
  });

  it('should display transaction status badge', () => {
    render(<CartSidebar state={emptyState} {...mockHandlers} />);
    expect(screen.getByText('IDLE')).toBeInTheDocument();
  });

  it('should display PENDING status with correct styling', () => {
    const pendingState = { ...emptyState, transactionStatus: 'PENDING' as const };
    render(<CartSidebar state={pendingState} {...mockHandlers} />);
    const statusBadge = screen.getByText('PENDING');
    expect(statusBadge).toHaveClass('bg-amber-500');
  });

  it('should display ERROR status with correct styling', () => {
    const errorState = { ...emptyState, transactionStatus: 'ERROR' as const };
    render(<CartSidebar state={errorState} {...mockHandlers} />);
    const statusBadge = screen.getByText('ERROR');
    expect(statusBadge).toHaveClass('bg-rose-600');
  });

  it('should show empty cart message when cart is empty', () => {
    render(<CartSidebar state={emptyState} {...mockHandlers} />);
    expect(screen.getByText('Cart is empty')).toBeInTheDocument();
  });

  it('should show empty cart message when state is null', () => {
    render(<CartSidebar state={null} {...mockHandlers} />);
    expect(screen.getByText('Cart is empty')).toBeInTheDocument();
  });

  it('should display cart items when cart has items', () => {
    render(<CartSidebar state={stateWithItems} {...mockHandlers} />);
    
    expect(screen.getByText('Pepperoni Pizza')).toBeInTheDocument();
    expect(screen.getByText('Cola')).toBeInTheDocument();
  });

  it('should display the total price', () => {
    render(<CartSidebar state={stateWithItems} {...mockHandlers} />);
    expect(screen.getByText('$27.97')).toBeInTheDocument();
  });

  it('should render PaymentActions component', () => {
    render(<CartSidebar state={stateWithItems} {...mockHandlers} />);
    // PaymentActions renders Clear and Checkout buttons in IDLE state
    expect(screen.getByText('Clear')).toBeInTheDocument();
    expect(screen.getByText('Checkout')).toBeInTheDocument();
  });

  describe('locked state', () => {
    it('should lock cart items when status is PENDING', () => {
      const pendingState: AppState = {
        ...stateWithItems,
        transactionStatus: 'PENDING',
      };
      render(<CartSidebar state={pendingState} {...mockHandlers} />);

      // Remove buttons should be disabled (using aria-label pattern)
      const removeButtons = screen.getAllByLabelText(/Remove.*from cart/);
      removeButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it('should lock cart items when status is PROCESSING', () => {
      const processingState: AppState = {
        ...stateWithItems,
        transactionStatus: 'PROCESSING',
      };
      render(<CartSidebar state={processingState} {...mockHandlers} />);

      const removeButtons = screen.getAllByLabelText(/Remove.*from cart/);
      removeButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('error state', () => {
    it('should show retry button when canRetry is true', () => {
      const errorState: AppState = {
        ...stateWithItems,
        transactionStatus: 'ERROR',
        retryCount: 1,
        errorMessage: 'Payment failed',
      };
      render(<CartSidebar state={errorState} {...mockHandlers} />);
      
      expect(screen.getByText('Retry Payment')).toBeInTheDocument();
    });

    it('should show Contact Manager when retries exhausted', () => {
      const errorState: AppState = {
        ...stateWithItems,
        transactionStatus: 'ERROR',
        retryCount: 3,
        errorMessage: 'Payment failed',
      };
      render(<CartSidebar state={errorState} {...mockHandlers} />);
      
      expect(screen.getByText('Contact Manager')).toBeInTheDocument();
    });
  });
});

