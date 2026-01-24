/**
 * Header Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from './Header';

describe('Header', () => {
  const defaultProps = {
    transactionStatus: 'IDLE' as const,
    isLocked: false,
    onDemoOrder: vi.fn(),
  };

  it('should display LOADING when transactionStatus is null', () => {
    render(<Header {...defaultProps} transactionStatus={null} />);
    expect(screen.getByText('LOADING')).toBeInTheDocument();
  });

  it('should display the current transaction status', () => {
    render(<Header {...defaultProps} transactionStatus="PENDING" />);
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('should render Demo Order button', () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByText('Demo Order')).toBeInTheDocument();
  });

  it('should call onDemoOrder when Demo Order button is clicked', () => {
    const onDemoOrder = vi.fn();
    render(<Header {...defaultProps} onDemoOrder={onDemoOrder} />);
    
    fireEvent.click(screen.getByText('Demo Order'));
    expect(onDemoOrder).toHaveBeenCalledTimes(1);
  });

  it('should disable Demo Order button when isLocked is true', () => {
    render(<Header {...defaultProps} isLocked={true} />);
    
    const button = screen.getByText('Demo Order');
    expect(button).toBeDisabled();
  });

  it('should enable Demo Order button when isLocked is false', () => {
    render(<Header {...defaultProps} isLocked={false} />);
    
    const button = screen.getByText('Demo Order');
    expect(button).not.toBeDisabled();
  });

  describe('status colors', () => {
    it('should show IDLE status with correct styling', () => {
      render(<Header {...defaultProps} transactionStatus="IDLE" />);
      const statusBadge = screen.getByText('IDLE');
      expect(statusBadge).toHaveClass('bg-emerald-500');
    });

    it('should show PROCESSING status with pulse animation', () => {
      render(<Header {...defaultProps} transactionStatus="PROCESSING" />);
      const statusBadge = screen.getByText('PROCESSING');
      expect(statusBadge).toHaveClass('animate-pulse');
    });

    it('should show ERROR status with error color', () => {
      render(<Header {...defaultProps} transactionStatus="ERROR" />);
      const statusBadge = screen.getByText('ERROR');
      expect(statusBadge).toHaveClass('bg-rose-600');
    });
  });
});

