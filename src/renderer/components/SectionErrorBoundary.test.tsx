/**
 * SectionErrorBoundary Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionErrorBoundary } from './SectionErrorBoundary';

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test section error');
  }
  return <div>Section content</div>;
}

describe('SectionErrorBoundary', () => {
  // Suppress console.error for cleaner test output
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('should render children when no error occurs', () => {
    render(
      <SectionErrorBoundary sectionName="Test Section">
        <div>Test content</div>
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render inline error UI when an error occurs', () => {
    render(
      <SectionErrorBoundary sectionName="Cart">
        <ThrowError shouldThrow={true} />
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Cart encountered an error')).toBeInTheDocument();
  });

  it('should render retry button in error state', () => {
    render(
      <SectionErrorBoundary sectionName="Product Grid">
        <ThrowError shouldThrow={true} />
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should call onError callback when error occurs', () => {
    const onError = vi.fn();

    render(
      <SectionErrorBoundary sectionName="Metrics" onError={onError}>
        <ThrowError shouldThrow={true} />
      </SectionErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <SectionErrorBoundary sectionName="Test" fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('should recover when retry button is clicked', () => {
    // Use a stateful wrapper to control error throwing
    let shouldThrow = true;

    function ControlledError() {
      if (shouldThrow) {
        throw new Error('Controlled error');
      }
      return <div>Recovered content</div>;
    }

    const { rerender } = render(
      <SectionErrorBoundary sectionName="Test">
        <ControlledError />
      </SectionErrorBoundary>
    );

    // Should show error state
    expect(screen.getByText('Test encountered an error')).toBeInTheDocument();

    // Fix the error condition
    shouldThrow = false;

    // Click retry
    fireEvent.click(screen.getByText('Retry'));

    // Force rerender to pick up the new state
    rerender(
      <SectionErrorBoundary sectionName="Test">
        <ControlledError />
      </SectionErrorBoundary>
    );

    // Should show recovered content
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });

  it('should log error to console', () => {
    render(
      <SectionErrorBoundary sectionName="Logging Test">
        <ThrowError shouldThrow={true} />
      </SectionErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      '[SectionErrorBoundary:Logging Test] Error:',
      expect.any(Error)
    );
  });
});

