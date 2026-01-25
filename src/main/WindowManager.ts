/**
 * WindowManager - Manages dual-head window setup for POS system
 * 
 * Creates and manages Cashier and Customer windows with proper security settings.
 * Both windows are isolated but synchronized via IPC through the Main process.
 */

import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { createLogger } from './Logger';
import type { WindowId, CartItem } from '@shared/ipc-types';
import type { Cents } from '@shared/currency';
import { formatCurrency, multiplyCents } from '@shared/currency';

const logger = createLogger('WindowManager');

// Declare Vite globals
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

interface WindowConfig {
  id: WindowId;
  title: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  /** Whether to show the menu bar (Windows/Linux only). Defaults to true for cashier. */
  showMenu?: boolean;
}

/**
 * Calculates a safe window position that stays within the display's workArea.
 * Uses workArea instead of bounds to respect taskbar/dock.
 */
function getSafeWindowPosition(
  display: Electron.Display,
  width: number,
  height: number,
  preferredX: number,
  preferredY: number
): { x: number; y: number } {
  const { workArea } = display;

  // Ensure window stays within workArea bounds
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;

  return {
    x: Math.max(workArea.x, Math.min(preferredX, maxX)),
    y: Math.max(workArea.y, Math.min(preferredY, maxY)),
  };
}

class WindowManager {
  private windows: Map<WindowId, BrowserWindow> = new Map();

  /**
   * Create a window with secure settings
   */
  private createWindow(config: WindowConfig): BrowserWindow {
    logger.info('Creating window', { windowId: config.id, title: config.title });

    const window = new BrowserWindow({
      width: config.width,
      height: config.height,
      x: config.x,
      y: config.y,
      title: config.title,
      // Background color shown before content loads - matches app theme
      backgroundColor: '#0f172a', // slate-900
      // Custom title bar: Remove default title bar for themed window chrome
      titleBarStyle: 'hidden',
      // macOS: Position traffic light controls
      ...(process.platform === 'darwin' && {
        trafficLightPosition: { x: 16, y: 12 },
      }),
      // Windows/Linux: Themed window controls overlay
      ...(process.platform !== 'darwin' && {
        titleBarOverlay: {
          color: '#1e293b', // slate-800 - matches header background
          symbolColor: '#fbbf24', // amber-400 - matches theme accent
          height: 40,
        },
      }),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        // Security: Enable context isolation to prevent renderer access to Node
        contextIsolation: true,
        // Security: Disable Node.js integration in renderer
        nodeIntegration: false,
        // Security: Enable process sandboxing
        sandbox: true,
        // Security: Explicitly enable web security (same-origin policy)
        webSecurity: true,
        // Security: Do not allow loading insecure content over HTTPS
        allowRunningInsecureContent: false,
        // Security: Disable experimental features
        experimentalFeatures: false,
      },
    });

    // Handle load failures - log for debugging production issues
    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      logger.error('Window failed to load', {
        windowId: config.id,
        errorCode,
        errorDescription,
        validatedURL,
      });
    });

    // Log when page finishes loading
    window.webContents.on('did-finish-load', () => {
      logger.info('Window finished loading', { windowId: config.id });
    });

    // Pass window ID to renderer via URL hash or query parameter
    const windowIdParam = `windowId=${config.id}`;

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const url = `${MAIN_WINDOW_VITE_DEV_SERVER_URL}?${windowIdParam}`;
      window.loadURL(url);
      logger.debug('Loading dev server URL', { url });
    } else {
      const filePath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
      window.loadFile(filePath, { query: { windowId: config.id } });
      logger.debug('Loading file', { filePath });
    }

    // Store reference
    this.windows.set(config.id, window);

    // Hide menu bar on non-cashier windows for Windows/Linux
    // macOS uses a system-wide menu bar, so this only affects Windows/Linux
    if (process.platform !== 'darwin' && config.showMenu === false) {
      window.setMenu(null);
      logger.debug('Menu bar hidden for window', { windowId: config.id });
    }

    // Minimize on close instead of destroying (both windows required for POS)
    window.on('close', (event) => {
      // Allow close during app quit
      if ((this as WindowManager & { isQuitting?: boolean }).isQuitting) {
        return;
      }
      event.preventDefault();
      window.minimize();
      logger.info('Window minimized on close attempt', { windowId: config.id });
    });

    // Clean up on close (only happens during app quit)
    window.on('closed', () => {
      logger.info('Window closed', { windowId: config.id });
      this.windows.delete(config.id);
    });

    return window;
  }

  /**
   * Mark that app is quitting to allow windows to close
   */
  public setQuitting(quitting: boolean): void {
    (this as WindowManager & { isQuitting?: boolean }).isQuitting = quitting;
  }

  /**
   * Show a specific window (restore if minimized, focus if visible)
   * For dashboard, creates the window if it doesn't exist
   */
  public showWindow(windowId: WindowId): void {
    const window = this.windows.get(windowId);
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.show();
      window.focus();
      logger.info('Window shown', { windowId });
    } else if (windowId === 'dashboard') {
      // Dashboard window can be closed, so recreate it if needed
      this.openDashboardWindow();
    } else {
      logger.warn('Window not found', { windowId });
    }
  }

  /**
   * Show all windows (used when app is activated with no visible windows)
   */
  public showAllWindows(): void {
    for (const [windowId, window] of this.windows) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.show();
      logger.info('Window shown', { windowId });
    }
    // Focus the cashier window
    const cashier = this.windows.get('cashier');
    if (cashier) {
      cashier.focus();
    }
  }

  /**
   * Check if any windows are visible (not minimized)
   */
  public hasVisibleWindows(): boolean {
    for (const window of this.windows.values()) {
      if (!window.isMinimized() && window.isVisible()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Reload all windows
   * Used after clearing application data to refresh the UI
   */
  public reloadAllWindows(): void {
    logger.info('Reloading all windows');
    for (const [windowId, window] of this.windows) {
      if (!window.isDestroyed()) {
        window.webContents.reload();
        logger.debug('Window reloaded', { windowId });
      }
    }
  }

  /**
   * Initialize both Cashier and Customer windows
   */
  public initializeWindows(): void {
    logger.info('Initializing dual-head windows');

    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    logger.debug('Detected displays', { 
      count: displays.length, 
      primary: primaryDisplay.id 
    });

    // Cashier window configuration - use safe positioning
    const cashierWidth = 1024;
    const cashierHeight = 768;
    const cashierPos = getSafeWindowPosition(
      primaryDisplay,
      cashierWidth,
      cashierHeight,
      primaryDisplay.workArea.x + 50,
      primaryDisplay.workArea.y + 50
    );
    const cashierConfig: WindowConfig = {
      id: 'cashier',
      title: 'Cashier',
      width: cashierWidth,
      height: cashierHeight,
      ...cashierPos,
    };

    // Customer window configuration
    // If multiple displays, put on secondary; otherwise offset from cashier
    let customerConfig: WindowConfig;
    const customerWidth = 600;
    const customerHeight = 768;

    if (displays.length > 1) {
      const secondaryDisplay = displays.find(d => d.id !== primaryDisplay.id) || primaryDisplay;
      const customerPos = getSafeWindowPosition(
        secondaryDisplay,
        customerWidth,
        customerHeight,
        secondaryDisplay.workArea.x + 50,
        secondaryDisplay.workArea.y + 50
      );
      customerConfig = {
        id: 'customer',
        title: 'Customer',
        width: customerWidth,
        height: customerHeight,
        ...customerPos,
        showMenu: false, // Hide menu bar on Windows/Linux
      };
    } else {
      // Single display: offset customer window to the right of cashier
      const customerPos = getSafeWindowPosition(
        primaryDisplay,
        customerWidth,
        customerHeight,
        cashierPos.x + cashierWidth + 20, // Place next to cashier window
        primaryDisplay.workArea.y + 50
      );
      customerConfig = {
        id: 'customer',
        title: 'Customer',
        width: customerWidth,
        height: customerHeight,
        ...customerPos,
        showMenu: false, // Hide menu bar on Windows/Linux
      };
    }

    // Create windows
    const cashierWindow = this.createWindow(cashierConfig);
    const customerWindow = this.createWindow(customerConfig);

    // Open dashboard window by default
    this.openDashboardWindow();

    // Open DevTools in development
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      cashierWindow.webContents.openDevTools({ mode: 'detach' });
    }

    logger.info('Windows initialized', {
      cashier: cashierWindow.id,
      customer: customerWindow.id,
    });
  }

  /**
   * Get a window by its ID
   */
  public getWindow(id: WindowId): BrowserWindow | undefined {
    return this.windows.get(id);
  }

  /**
   * Get all managed windows
   */
  public getAllWindows(): Map<WindowId, BrowserWindow> {
    return this.windows;
  }

  /**
   * Broadcast a message to all windows
   */
  public broadcast(channel: string, ...args: unknown[]): void {
    for (const [id, window] of this.windows) {
      if (!window.isDestroyed()) {
        logger.debug('Broadcasting to window', { windowId: id, channel });
        window.webContents.send(channel, ...args);
      }
    }
  }

  /**
   * Open the dashboard window
   * If already open, focuses the existing window
   */
  public openDashboardWindow(): void {
    // Check if dashboard window already exists
    const existingDashboard = this.windows.get('dashboard');
    if (existingDashboard && !existingDashboard.isDestroyed()) {
      if (existingDashboard.isMinimized()) {
        existingDashboard.restore();
      }
      existingDashboard.focus();
      logger.info('Focused existing dashboard window');
      return;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { workArea } = primaryDisplay;
    // Dashboard is wide and short, positioned at the bottom of the screen
    const dashboardWidth = Math.min(workArea.width - 40, 1600); // Nearly full width with margin
    const dashboardHeight = 300;
    const dashboardPos = getSafeWindowPosition(
      primaryDisplay,
      dashboardWidth,
      dashboardHeight,
      workArea.x + Math.floor((workArea.width - dashboardWidth) / 2), // Center horizontally
      workArea.y + workArea.height - dashboardHeight - 20 // Position at bottom with margin
    );

    const dashboardConfig: WindowConfig = {
      id: 'dashboard',
      title: 'Zero Crust POS - Dashboard',
      width: dashboardWidth,
      height: dashboardHeight,
      ...dashboardPos,
      showMenu: false, // Hide menu bar on Windows/Linux
    };

    const dashboardWindow = this.createWindow(dashboardConfig);

    // Dashboard window can be closed normally (not minimized)
    dashboardWindow.removeAllListeners('close');
    dashboardWindow.on('closed', () => {
      logger.info('Dashboard window closed');
      this.windows.delete('dashboard');
    });

    logger.info('Dashboard window opened', { windowId: dashboardWindow.id });
  }

  /**
   * Show a receipt in a new window
   */
  public showReceipt(data: ReceiptData): void {
    logger.info('Opening receipt window', { transactionId: data.transactionId });

    const primaryDisplay = screen.getPrimaryDisplay();
    const receiptWidth = 400;
    const receiptHeight = 600;
    const receiptPos = getSafeWindowPosition(
      primaryDisplay,
      receiptWidth,
      receiptHeight,
      primaryDisplay.workArea.x + 200,
      primaryDisplay.workArea.y + 100
    );

    const receiptWindow = new BrowserWindow({
      width: receiptWidth,
      height: receiptHeight,
      ...receiptPos,
      title: `Receipt - ${data.transactionId}`,
      movable: true,
      // Custom title bar: Match main windows
      titleBarStyle: 'hidden',
      // macOS: Position traffic light controls
      ...(process.platform === 'darwin' && {
        trafficLightPosition: { x: 16, y: 12 },
      }),
      // Windows/Linux: Themed window controls overlay
      ...(process.platform !== 'darwin' && {
        titleBarOverlay: {
          color: '#f5f5f5', // Light background for receipt
          symbolColor: '#333333',
          height: 40,
        },
      }),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
      },
    });

    // Generate and load the receipt HTML
    const html = generateReceiptHtml(data);
    receiptWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    logger.debug('Receipt window opened', { transactionId: data.transactionId });
  }
}

/**
 * Receipt data structure
 */
export interface ReceiptData {
  transactionId: string;
  timestamp: string;
  items: CartItem[];
  totalInCents: Cents;
}

/**
 * Generate styled HTML for the receipt
 */
function generateReceiptHtml(data: ReceiptData): string {
  const date = new Date(data.timestamp);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px dashed #ddd;">
          ${item.name}<br/>
          <span style="color: #666; font-size: 12px;">SKU: ${item.sku}</span>
        </td>
        <td style="padding: 8px 0; text-align: center; border-bottom: 1px dashed #ddd;">${item.quantity}</td>
        <td style="padding: 8px 0; text-align: right; border-bottom: 1px dashed #ddd;">${formatCurrency(multiplyCents(item.priceInCents, item.quantity))}</td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${data.transactionId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      background: #f5f5f5;
      padding: 20px;
      padding-top: 48px; /* Extra top padding for traffic lights */
    }
    /* Draggable title bar region */
    .drag-region {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 40px;
      -webkit-app-region: drag;
      app-region: drag;
    }
    .receipt {
      background: white;
      max-width: 360px;
      margin: 0 auto;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-radius: 4px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    .logo { font-size: 28px; margin-bottom: 4px; }
    .store-name { font-size: 20px; font-weight: bold; }
    .tagline { font-size: 12px; color: #666; }
    .meta {
      font-size: 12px;
      color: #666;
      margin-bottom: 16px;
      text-align: center;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .items-table th {
      text-align: left;
      padding: 8px 0;
      border-bottom: 2px solid #333;
      font-size: 12px;
      text-transform: uppercase;
    }
    .items-table th:nth-child(2) { text-align: center; }
    .items-table th:nth-child(3) { text-align: right; }
    .total-section {
      border-top: 2px solid #333;
      padding-top: 12px;
      margin-top: 8px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 18px;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px dashed #ccc;
      font-size: 12px;
      color: #666;
    }
    .thank-you {
      font-size: 16px;
      color: #333;
      margin-bottom: 8px;
    }
    @media print {
      body { background: white; padding: 0; }
      .receipt { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="drag-region"></div>
  <div class="receipt">
    <div class="header">
      <div class="logo">🍕</div>
      <div class="store-name">Zero Crust</div>
      <div class="tagline">Fresh Pizza, Zero Taste</div>
    </div>

    <div class="meta">
      <div><strong>Transaction:</strong> ${data.transactionId}</div>
      <div>${formattedDate} at ${formattedTime}</div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="total-section">
      <div class="total-row">
        <span>TOTAL</span>
        <span>${formatCurrency(data.totalInCents)}</span>
      </div>
    </div>

    <div class="footer">
      <div class="thank-you">Thank you for your order!</div>
      <div>Please come again</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Singleton instance
export const windowManager = new WindowManager();
export default WindowManager;

