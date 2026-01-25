/**
 * CashierView Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CashierView from './CashierView';
import type { AppState, Metrics } from '@shared/ipc-types';
import type { Cents } from '@shared/currency';

// Mock window.electronAPI
const mockElectronAPI = {
  sendCommand: vi.fn(),
  onStateUpdate: vi.fn(),
  onMetricsUpdate: vi.fn(),
  onPong: vi.fn(),
  getWindowId: vi.fn().mockReturnValue('cashier'),
  getMetrics: vi.fn(),
  requestInitialState: vi.fn().mockResolvedValue(undefined),
};

describe('CashierView', () => {
  const mockState: AppState = {
    cart: [],
    totalInCents: 0 as Cents,
    transactionStatus: 'IDLE',
    version: 1,
    retryCount: 0,
    demoLoopRunning: false,
  };

  const mockMetrics: Metrics = {
    transactionsPerMinute: 1.5,
    averageCartSize: 2.0,
    totalTransactionsToday: 10,
    totalRevenueToday: 50000 as Cents,
    lastUpdated: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock to call callback with state immediately
    mockElectronAPI.onStateUpdate.mockImplementation((callback) => {
      callback(mockState);
      return vi.fn(); // Return unsubscribe function
    });

    mockElectronAPI.onMetricsUpdate.mockImplementation((callback) => {
      callback(mockMetrics);
      return vi.fn();
    });

    mockElectronAPI.getMetrics.mockResolvedValue(mockMetrics);

    // Assign mock to window
    Object.defineProperty(window, 'electronAPI', {
      value: mockElectronAPI,
      writable: true,
    });
  });

  it('should show loading skeleton initially', () => {
    // Don't trigger state update immediately
    mockElectronAPI.onStateUpdate.mockImplementation(() => vi.fn());
    
    const { container } = render(<CashierView />);
    
    // Check for skeleton animation
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render category tabs', async () => {
    render(<CashierView />);
    
    await waitFor(() => {
      expect(screen.getByText('pizza')).toBeInTheDocument();
      expect(screen.getByText('sides')).toBeInTheDocument();
      expect(screen.getByText('drinks')).toBeInTheDocument();
    });
  });

  it('should render Current Order section', async () => {
    render(<CashierView />);
    
    await waitFor(() => {
      expect(screen.getByText('Current Order')).toBeInTheDocument();
    });
  });

  it('should display empty cart message', async () => {
    render(<CashierView />);
    
    await waitFor(() => {
      expect(screen.getByText('Cart is empty')).toBeInTheDocument();
    });
  });

  it('should display metrics bar', async () => {
    render(<CashierView />);
    
    await waitFor(() => {
      expect(screen.getByText('TPM:')).toBeInTheDocument();
    });
  });

  it('should subscribe to state updates', () => {
    render(<CashierView />);
    
    expect(mockElectronAPI.onStateUpdate).toHaveBeenCalled();
  });

  it('should subscribe to metrics updates', () => {
    render(<CashierView />);
    
    expect(mockElectronAPI.onMetricsUpdate).toHaveBeenCalled();
  });

  it('should display Quick Order button', async () => {
    render(<CashierView />);

    await waitFor(() => {
      expect(screen.getByText('Quick Order')).toBeInTheDocument();
    });
  });

  it('should display Autoplay button', async () => {
    render(<CashierView />);

    await waitFor(() => {
      expect(screen.getByText('Autoplay')).toBeInTheDocument();
    });
  });

  it('should display transaction status in cart sidebar', async () => {
    render(<CashierView />);

    await waitFor(() => {
      expect(screen.getByText('IDLE')).toBeInTheDocument();
    });
  });
});

