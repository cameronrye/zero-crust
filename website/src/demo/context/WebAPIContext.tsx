/**
 * WebAPIContext - React context for providing WebElectronAPI to components
 * 
 * This allows the same React components to work with either:
 * - Real Electron IPC (via window.electronAPI)
 * - Web mock (via WebElectronAPI)
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ElectronAPI, WindowId } from '../shared/types';
import { createWebElectronAPI } from '../services/WebElectronAPI';

interface WebAPIContextValue {
  api: ElectronAPI;
  windowId: WindowId;
}

const WebAPIContext = createContext<WebAPIContextValue | null>(null);

interface WebAPIProviderProps {
  windowId: WindowId;
  children: ReactNode;
}

/**
 * Provider that creates a WebElectronAPI for a specific window
 */
export function WebAPIProvider({ windowId, children }: WebAPIProviderProps) {
  const value = useMemo(() => ({
    api: createWebElectronAPI(windowId),
    windowId,
  }), [windowId]);

  return (
    <WebAPIContext.Provider value={value}>
      {children}
    </WebAPIContext.Provider>
  );
}

/**
 * Hook to access the WebElectronAPI
 */
export function useWebAPI(): WebAPIContextValue {
  const context = useContext(WebAPIContext);
  if (!context) {
    throw new Error('useWebAPI must be used within a WebAPIProvider');
  }
  return context;
}

/**
 * Hook to get just the API (for compatibility with existing hooks)
 */
export function useElectronAPI(): ElectronAPI {
  const { api } = useWebAPI();
  return api;
}

