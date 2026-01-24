/**
 * MetricsBar Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetricsBar } from './MetricsBar';
import type { Metrics } from '@shared/ipc-types';
import type { Cents } from '@shared/currency';

describe('MetricsBar', () => {
  const mockMetrics: Metrics = {
    transactionsPerMinute: 2.5,
    averageCartSize: 3.2,
    totalTransactionsToday: 42,
    totalRevenueToday: 125099 as Cents,
    lastUpdated: new Date().toISOString(),
  };

  const defaultProps = {
    metrics: mockMetrics,
    isLocked: false,
    demoLoopRunning: false,
    onToggleDemoLoop: vi.fn(),
  };

  it('should display transactions per minute', () => {
    render(<MetricsBar {...defaultProps} />);

    expect(screen.getByText('TPM:')).toBeInTheDocument();
    expect(screen.getByText('2.5')).toBeInTheDocument();
  });

  it('should display average cart size', () => {
    render(<MetricsBar {...defaultProps} />);

    expect(screen.getByText('Avg Cart:')).toBeInTheDocument();
    expect(screen.getByText('3.2 items')).toBeInTheDocument();
  });

  it('should display total transactions today', () => {
    render(<MetricsBar {...defaultProps} />);

    expect(screen.getByText('Today:')).toBeInTheDocument();
    expect(screen.getByText('42 txns')).toBeInTheDocument();
  });

  it('should display total revenue today formatted as currency', () => {
    render(<MetricsBar {...defaultProps} />);

    expect(screen.getByText('Revenue:')).toBeInTheDocument();
    expect(screen.getByText('$1,250.99')).toBeInTheDocument();
  });

  it('should format decimal values correctly', () => {
    const metricsWithDecimals: Metrics = {
      transactionsPerMinute: 0.0,
      averageCartSize: 0.0,
      totalTransactionsToday: 0,
      totalRevenueToday: 0 as Cents,
      lastUpdated: new Date().toISOString(),
    };
    render(<MetricsBar {...defaultProps} metrics={metricsWithDecimals} />);

    expect(screen.getByText('0.0')).toBeInTheDocument();
    expect(screen.getByText('0.0 items')).toBeInTheDocument();
    expect(screen.getByText('0 txns')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('should show Autoplay button when not running', () => {
    render(<MetricsBar {...defaultProps} />);

    expect(screen.getByText('Autoplay')).toBeInTheDocument();
  });

  it('should show Stop button when demo loop is running', () => {
    render(<MetricsBar {...defaultProps} demoLoopRunning={true} />);

    expect(screen.getByText('Stop')).toBeInTheDocument();
  });

  it('should call onToggleDemoLoop when autoplay button is clicked', () => {
    const onToggleDemoLoop = vi.fn();
    render(<MetricsBar {...defaultProps} onToggleDemoLoop={onToggleDemoLoop} />);

    fireEvent.click(screen.getByText('Autoplay'));
    expect(onToggleDemoLoop).toHaveBeenCalled();
  });

  it('should disable Autoplay when isLocked and not running', () => {
    render(<MetricsBar {...defaultProps} isLocked={true} demoLoopRunning={false} />);

    const autoplayButton = screen.getByText('Autoplay');
    expect(autoplayButton).toBeDisabled();
  });

  it('should enable Stop button when demo loop is running even if locked', () => {
    render(<MetricsBar {...defaultProps} isLocked={true} demoLoopRunning={true} />);

    const stopButton = screen.getByText('Stop');
    expect(stopButton).not.toBeDisabled();
  });
});

