/**
 * App - Root component that routes to Cashier, Customer, or Admin view based on window ID
 */

import { useMemo, useEffect } from 'react';
import CashierView from './views/CashierView';
import CustomerView from './views/CustomerView';
import AdminView from './views/AdminView';
import type { WindowId } from '@shared/ipc-types';

export default function App() {
  // Window ID is static - determined at load time from URL params
  // Use useMemo to compute once and log during initial render
  const windowId = useMemo<WindowId | null>(() => {
    if (window.electronAPI) {
      const id = window.electronAPI.getWindowId();
      console.log(`Window initialized as: ${id}`);
      return id;
    }
    console.error('electronAPI not available - preload script may not be loaded');
    return null;
  }, []);

  // Set document title based on window ID
  useEffect(() => {
    if (windowId) {
      const titles: Record<WindowId, string> = {
        cashier: 'Cashier',
        customer: 'Customer',
        dashboard: 'Dashboard',
      };
      document.title = titles[windowId];
    }
  }, [windowId]);

  if (!windowId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  switch (windowId) {
    case 'cashier':
      return <CashierView />;
    case 'customer':
      return <CustomerView />;
    case 'dashboard':
      return <AdminView />;
  }
}

