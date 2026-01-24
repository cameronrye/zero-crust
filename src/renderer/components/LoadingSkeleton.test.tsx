/**
 * LoadingSkeleton Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LoadingSkeleton } from './LoadingSkeleton';

describe('LoadingSkeleton', () => {
  describe('cashier variant', () => {
    it('should render cashier skeleton layout', () => {
      const { container } = render(<LoadingSkeleton variant="cashier" />);
      
      // Check for skeleton blocks with animation
      const skeletonBlocks = container.querySelectorAll('.animate-pulse');
      expect(skeletonBlocks.length).toBeGreaterThan(0);
    });

    it('should have cashier-specific layout structure', () => {
      const { container } = render(<LoadingSkeleton variant="cashier" />);
      
      // Cashier has a sidebar (w-80)
      const sidebar = container.querySelector('.w-80');
      expect(sidebar).toBeInTheDocument();
    });

    it('should render product grid skeleton', () => {
      const { container } = render(<LoadingSkeleton variant="cashier" />);
      
      // Cashier has a 4-column grid for products
      const productGrid = container.querySelector('.grid-cols-4');
      expect(productGrid).toBeInTheDocument();
    });
  });

  describe('customer variant', () => {
    it('should render customer skeleton layout', () => {
      const { container } = render(<LoadingSkeleton variant="customer" />);
      
      // Check for skeleton blocks with animation
      const skeletonBlocks = container.querySelectorAll('.animate-pulse');
      expect(skeletonBlocks.length).toBeGreaterThan(0);
    });

    it('should have customer-specific background', () => {
      const { container } = render(<LoadingSkeleton variant="customer" />);
      
      // Customer uses slate-950 (darker) background
      const mainDiv = container.querySelector('.bg-slate-950');
      expect(mainDiv).toBeInTheDocument();
    });

    it('should not have cashier sidebar', () => {
      const { container } = render(<LoadingSkeleton variant="customer" />);
      
      // Customer should not have the w-80 sidebar
      const sidebar = container.querySelector('.w-80');
      expect(sidebar).not.toBeInTheDocument();
    });

    it('should render order display skeleton', () => {
      const { container } = render(<LoadingSkeleton variant="customer" />);

      // Customer has slate-800/50 background for order area
      const orderArea = container.querySelector('.bg-slate-800\\/50');
      expect(orderArea).toBeInTheDocument();
    });
  });

  it('should render different layouts for each variant', () => {
    const { container: cashierContainer } = render(<LoadingSkeleton variant="cashier" />);
    const { container: customerContainer } = render(<LoadingSkeleton variant="customer" />);
    
    // Cashier uses bg-slate-900, Customer uses bg-slate-950
    expect(cashierContainer.querySelector('.bg-slate-900')).toBeInTheDocument();
    expect(customerContainer.querySelector('.bg-slate-950')).toBeInTheDocument();
  });
});

