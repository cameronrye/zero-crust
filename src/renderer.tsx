/**
 * Renderer Entry Point
 *
 * This is the entry point for the React application in the renderer process.
 * All communication with the Main process goes through window.electronAPI
 * which is exposed via the preload script.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './renderer/App';
import { ErrorBoundary } from './renderer/components';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
