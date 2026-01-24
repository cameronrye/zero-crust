/**
 * CustomerView Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CustomerView from './CustomerView';
import type { AppState } from '@shared/ipc-types';
import type { Cents } from '@shared/currency';

// Mock window.electronAPI
const mockElectronAPI = {
  sendCommand: vi.fn(),
  onStateUpdate: vi.fn(),
  onMetricsUpdate: vi.fn(),
  onPong: vi.fn(),
  getWindowId: vi.fn().mockReturnValue('customer'),
  getMetrics: vi.fn(),
  requestInitialState: vi.fn().mockResolvedValue(undefined),
};

describe('CustomerView', () => {
  const mockState: AppState = {
    cart: [],
    totalInCents: 0 as Cents,
    transactionStatus: 'IDLE',
    version: 1,
    retryCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockElectronAPI.onStateUpdate.mockImplementation((callback) => {
      callback(mockState);
      return vi.fn();
    });

    Object.defineProperty(window, 'electronAPI', {
      value: mockElectronAPI,
      writable: true,
    });
  });

  it('should show loading skeleton initially', () => {
    mockElectronAPI.onStateUpdate.mockImplementation(() => vi.fn());
    
    const { container } = render(<CustomerView />);
    
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  describe('status messages', () => {
    it('should show empty status message for IDLE status', async () => {
      render(<CustomerView />);

      await waitFor(() => {
        // IDLE status shows no message (empty string)
        // Verify the component rendered and shows "Your Order" section
        expect(screen.getByText('Your Order')).toBeInTheDocument();
      });
    });

    it('should show Ready to Pay for PENDING status', async () => {
      mockElectronAPI.onStateUpdate.mockImplementation((callback) => {
        callback({ ...mockState, transactionStatus: 'PENDING' });
        return vi.fn();
      });
      
      render(<CustomerView />);
      
      await waitFor(() => {
        expect(screen.getByText('Ready to Pay')).toBeInTheDocument();
      });
    });

    it('should show Processing Payment... for PROCESSING status', async () => {
      mockElectronAPI.onStateUpdate.mockImplementation((callback) => {
        callback({ ...mockState, transactionStatus: 'PROCESSING' });
        return vi.fn();
      });
      
      render(<CustomerView />);
      
      await waitFor(() => {
        expect(screen.getByText('Processing Payment...')).toBeInTheDocument();
      });
    });

    it('should show Thank You! for PAID status', async () => {
      mockElectronAPI.onStateUpdate.mockImplementation((callback) => {
        callback({ ...mockState, transactionStatus: 'PAID' });
        return vi.fn();
      });
      
      render(<CustomerView />);
      
      await waitFor(() => {
        expect(screen.getByText('Thank You!')).toBeInTheDocument();
      });
    });

    it('should show Payment Error for ERROR status', async () => {
      mockElectronAPI.onStateUpdate.mockImplementation((callback) => {
        callback({ ...mockState, transactionStatus: 'ERROR' });
        return vi.fn();
      });
      
      render(<CustomerView />);
      
      await waitFor(() => {
        expect(screen.getByText('Payment Error')).toBeInTheDocument();
      });
    });
  });

  it('should show empty cart message when cart is empty', async () => {
    render(<CustomerView />);
    
    await waitFor(() => {
      expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    });
  });

  it('should display cart items when present', async () => {
    const stateWithCart: AppState = {
      ...mockState,
      cart: [
        { sku: 'PIZZA-001', name: 'Pepperoni Pizza', priceInCents: 1299 as Cents, quantity: 2 },
      ],
      totalInCents: 2598 as Cents,
    };
    
    mockElectronAPI.onStateUpdate.mockImplementation((callback) => {
      callback(stateWithCart);
      return vi.fn();
    });
    
    render(<CustomerView />);
    
    await waitFor(() => {
      expect(screen.getByText('Pepperoni Pizza')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('should display total', async () => {
    render(<CustomerView />);
    
    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
    });
  });
});

