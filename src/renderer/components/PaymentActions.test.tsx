/**
 * PaymentActions Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentActions } from './PaymentActions';
import type { Cents } from '@shared/currency';

describe('PaymentActions', () => {
  const defaultProps = {
    status: 'IDLE' as const,
    totalInCents: 2599 as Cents,
    cartLength: 2,
    canRetry: true,
    onClearCart: vi.fn(),
    onCheckout: vi.fn(),
    onProcessPayment: vi.fn(),
    onRetryPayment: vi.fn(),
    onNewTransaction: vi.fn(),
    onCancelCheckout: vi.fn(),
  };

  it('should display the total price', () => {
    render(<PaymentActions {...defaultProps} />);
    expect(screen.getByText('$25.99')).toBeInTheDocument();
  });

  describe('IDLE state', () => {
    it('should show Clear and Checkout buttons', () => {
      render(<PaymentActions {...defaultProps} status="IDLE" />);
      
      expect(screen.getByText('Clear')).toBeInTheDocument();
      expect(screen.getByText('Checkout')).toBeInTheDocument();
    });

    it('should call onClearCart when Clear is clicked', () => {
      const onClearCart = vi.fn();
      render(<PaymentActions {...defaultProps} onClearCart={onClearCart} />);
      
      fireEvent.click(screen.getByText('Clear'));
      expect(onClearCart).toHaveBeenCalledTimes(1);
    });

    it('should call onCheckout when Checkout is clicked', () => {
      const onCheckout = vi.fn();
      render(<PaymentActions {...defaultProps} onCheckout={onCheckout} />);
      
      fireEvent.click(screen.getByText('Checkout'));
      expect(onCheckout).toHaveBeenCalledTimes(1);
    });

    it('should disable buttons when cart is empty', () => {
      render(<PaymentActions {...defaultProps} cartLength={0} />);
      
      expect(screen.getByText('Clear')).toBeDisabled();
      expect(screen.getByText('Checkout')).toBeDisabled();
    });
  });

  describe('PENDING state', () => {
    it('should show Cancel and Process Payment buttons', () => {
      render(<PaymentActions {...defaultProps} status="PENDING" />);
      
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Process Payment')).toBeInTheDocument();
    });

    it('should call onCancelCheckout when Cancel is clicked', () => {
      const onCancelCheckout = vi.fn();
      render(<PaymentActions {...defaultProps} status="PENDING" onCancelCheckout={onCancelCheckout} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      expect(onCancelCheckout).toHaveBeenCalledTimes(1);
    });

    it('should call onProcessPayment when Process Payment is clicked', () => {
      const onProcessPayment = vi.fn();
      render(<PaymentActions {...defaultProps} status="PENDING" onProcessPayment={onProcessPayment} />);
      
      fireEvent.click(screen.getByText('Process Payment'));
      expect(onProcessPayment).toHaveBeenCalledTimes(1);
    });
  });

  describe('PROCESSING state', () => {
    it('should show processing spinner and text', () => {
      render(<PaymentActions {...defaultProps} status="PROCESSING" />);
      
      expect(screen.getByText('Processing Payment...')).toBeInTheDocument();
    });
  });

  describe('ERROR state', () => {
    it('should display error message', () => {
      render(<PaymentActions {...defaultProps} status="ERROR" errorMessage="Network timeout" />);
      
      expect(screen.getByText('Network timeout')).toBeInTheDocument();
    });

    it('should show Retry Payment button when canRetry is true', () => {
      render(<PaymentActions {...defaultProps} status="ERROR" canRetry={true} />);
      
      expect(screen.getByText('Retry Payment')).toBeInTheDocument();
    });

    it('should show Contact Manager when canRetry is false', () => {
      render(<PaymentActions {...defaultProps} status="ERROR" canRetry={false} />);
      
      expect(screen.getByText('Contact Manager')).toBeInTheDocument();
    });

    it('should call onRetryPayment when Retry Payment is clicked', () => {
      const onRetryPayment = vi.fn();
      render(<PaymentActions {...defaultProps} status="ERROR" onRetryPayment={onRetryPayment} />);
      
      fireEvent.click(screen.getByText('Retry Payment'));
      expect(onRetryPayment).toHaveBeenCalledTimes(1);
    });
  });

  describe('PAID state', () => {
    it('should show New Transaction button', () => {
      render(<PaymentActions {...defaultProps} status="PAID" />);
      
      expect(screen.getByText('New Transaction')).toBeInTheDocument();
    });

    it('should call onNewTransaction when New Transaction is clicked', () => {
      const onNewTransaction = vi.fn();
      render(<PaymentActions {...defaultProps} status="PAID" onNewTransaction={onNewTransaction} />);
      
      fireEvent.click(screen.getByText('New Transaction'));
      expect(onNewTransaction).toHaveBeenCalledTimes(1);
    });
  });
});

