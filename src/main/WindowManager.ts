/**
 * WindowManager - Manages dual-head window setup for POS system
 * 
 * Creates and manages Cashier and Customer windows with proper security settings.
 * Both windows are isolated but synchronized via IPC through the Main process.
 */

import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { createLogger } from './Logger';
import { getAppIconPath } from './assetPath';
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
  private receiptWindows: Set<BrowserWindow> = new Set();
  // Track the last focused window (for restoring z-order)
  private lastFocusedWindow: BrowserWindow | null = null;
  // Track which window should be focused when restoring
  private windowToFocusOnRestore: BrowserWindow | null = null;
  // Track which windows were visible before "Hide All" was called
  private hiddenWindowState: Set<WindowId> = new Set();
  private hiddenReceiptWindows: Set<BrowserWindow> = new Set();
  // Track if app is quitting to allow windows to close
  private isQuitting = false;

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
      // Window icon - important for Windows taskbar visibility
      icon: getAppIconPath(),
      // Background color shown before content loads - matches app theme
      backgroundColor: '#0f172a', // slate-900
      // macOS: Custom title bar with traffic light controls
      ...(process.platform === 'darwin' && {
        titleBarStyle: 'hidden' as const,
        trafficLightPosition: { x: 16, y: 12 },
      }),
      // Windows/Linux: Custom title bar with overlay controls that match app theme
      ...((process.platform === 'win32' || process.platform === 'linux') && {
        titleBarStyle: 'hidden' as const,
        titleBarOverlay: {
          color: '#1e293b', // slate-800 - matches header background
          symbolColor: '#f59e0b', // amber-500 - matches accent color
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
      if (this.isQuitting) {
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
      // Clear last focused if this window was it
      if (this.lastFocusedWindow === window) {
        this.lastFocusedWindow = null;
      }
    });

    // Track focus for z-order preservation
    window.on('focus', () => {
      this.lastFocusedWindow = window;
    });

    return window;
  }

  /**
   * Mark that app is quitting to allow windows to close
   */
  public setQuitting(quitting: boolean): void {
    this.isQuitting = quitting;
  }

  /**
   * Show a specific window (restore if minimized, focus if visible)
   * For transactions window, creates the window if it doesn't exist
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
    } else if (windowId === 'transactions') {
      // Transactions window can be closed, so recreate it if needed
      this.openTransactionsWindow();
    } else {
      logger.warn('Window not found', { windowId });
    }
  }

  /**
   * Show all windows that were previously visible before hideAllWindows was called.
   * Restores the previously focused window to the top.
   * If no state was saved, shows all main windows.
   */
  public showAllWindows(): void {
    // If we have saved state, restore those windows
    if (this.hiddenWindowState.size > 0 || this.hiddenReceiptWindows.size > 0) {
      this.restoreWindowsWithFocus();
      return;
    }

    // No saved state - show all main windows
    const windowsToShow = new Set<WindowId>(['cashier', 'customer', 'transactions'] as WindowId[]);

    for (const [windowId, window] of this.windows) {
      if (windowsToShow.has(windowId)) {
        if (window.isMinimized()) {
          window.restore();
        }
        window.show();
        logger.info('Window shown', { windowId });
      }
    }

    // Focus the cashier window
    const cashier = this.windows.get('cashier');
    if (cashier) {
      cashier.focus();
    }
  }

  /**
   * Restore windows and bring the previously focused window to the top
   */
  private restoreWindowsWithFocus(): void {
    // First, show all main windows that were visible
    for (const windowId of this.hiddenWindowState) {
      const window = this.windows.get(windowId);
      if (window && !window.isDestroyed()) {
        if (window.isMinimized()) {
          window.restore();
        }
        window.show();
        logger.info('Window restored', { windowId });
      }
    }

    // Show all receipt windows that were visible
    for (const receiptWindow of this.hiddenReceiptWindows) {
      if (!receiptWindow.isDestroyed()) {
        receiptWindow.show();
        logger.info('Receipt window restored');
      }
    }

    // Bring the previously focused window to the top using moveTop() and focus()
    if (this.windowToFocusOnRestore && !this.windowToFocusOnRestore.isDestroyed()) {
      this.windowToFocusOnRestore.moveTop();
      this.windowToFocusOnRestore.focus();
      logger.debug('Restored focus to previously focused window');
    } else {
      // Fallback: focus the cashier window
      const cashier = this.windows.get('cashier');
      if (cashier && !cashier.isDestroyed()) {
        cashier.focus();
      }
    }

    // Clear the saved state
    this.hiddenWindowState.clear();
    this.hiddenReceiptWindows.clear();
    this.windowToFocusOnRestore = null;
  }

  /**
   * Show windows when tray icon is clicked.
   * If windows were hidden via "Hide All", restore those exact windows with focus.
   * If no saved state, show primary windows (cashier + customer).
   * If windows are already visible, just focus the cashier.
   */
  public showPrimaryWindowsIfNoneVisible(): void {
    // If any windows are already visible, bring the last focused window to front
    // This preserves z-order (e.g., if a receipt window was on top, it stays on top)
    if (this.hasVisibleWindows()) {
      if (this.lastFocusedWindow && !this.lastFocusedWindow.isDestroyed()) {
        this.lastFocusedWindow.moveTop();
        this.lastFocusedWindow.focus();
        logger.debug('Focused last focused window to preserve z-order');
      } else {
        // Fallback: focus the cashier window
        const cashier = this.windows.get('cashier');
        if (cashier && this.isWindowVisible('cashier')) {
          cashier.focus();
          logger.debug('Focused existing visible cashier window');
        }
      }
      return;
    }

    // If we have saved state from "Hide All", restore those windows with focus
    if (this.hiddenWindowState.size > 0 || this.hiddenReceiptWindows.size > 0) {
      logger.debug('Restoring previously hidden windows', {
        mainWindowCount: this.hiddenWindowState.size,
        receiptCount: this.hiddenReceiptWindows.size,
      });
      this.restoreWindowsWithFocus();
      return;
    }

    // No saved state - show only cashier and customer (not transactions window)
    const primaryWindows: WindowId[] = ['cashier', 'customer'];
    for (const windowId of primaryWindows) {
      const window = this.windows.get(windowId);
      if (window) {
        if (window.isMinimized()) {
          window.restore();
        }
        window.show();
        logger.info('Window shown', { windowId });
      }
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
   * Check if a specific window is visible
   */
  public isWindowVisible(windowId: WindowId): boolean {
    const window = this.windows.get(windowId);
    if (!window) return false;
    return !window.isMinimized() && window.isVisible();
  }

  /**
   * Hide a specific window
   */
  public hideWindow(windowId: WindowId): void {
    const window = this.windows.get(windowId);
    if (window) {
      window.hide();
      logger.info('Window hidden', { windowId });
    } else {
      logger.warn('Window not found for hiding', { windowId });
    }
  }

  /**
   * Hide all windows (including receipt windows)
   * Remembers which windows were visible and which was focused so they can be restored
   */
  public hideAllWindows(): void {
    // Save which window was focused before hiding (for z-order restoration)
    this.windowToFocusOnRestore = this.lastFocusedWindow;

    // Clear previous state
    this.hiddenWindowState.clear();
    this.hiddenReceiptWindows.clear();

    // Hide main windows and track which were visible
    for (const [windowId, window] of this.windows) {
      if (!window.isDestroyed()) {
        if (this.isWindowVisible(windowId)) {
          this.hiddenWindowState.add(windowId);
        }
        window.hide();
        logger.info('Window hidden', { windowId });
      }
    }

    // Hide receipt windows and track which were visible
    for (const receiptWindow of this.receiptWindows) {
      if (!receiptWindow.isDestroyed()) {
        if (receiptWindow.isVisible()) {
          this.hiddenReceiptWindows.add(receiptWindow);
        }
        receiptWindow.hide();
        logger.info('Receipt window hidden');
      }
    }

    logger.debug('Saved hidden window state', {
      mainWindows: Array.from(this.hiddenWindowState),
      receiptCount: this.hiddenReceiptWindows.size,
      windowToFocus: this.windowToFocusOnRestore ? 'saved' : 'none',
    });
  }

  /**
   * Toggle visibility of a specific window
   */
  public toggleWindow(windowId: WindowId): void {
    if (this.isWindowVisible(windowId)) {
      this.hideWindow(windowId);
    } else {
      this.showWindow(windowId);
    }
  }

  /**
   * Toggle visibility of all windows
   */
  public toggleAllWindows(): void {
    if (this.hasVisibleWindows()) {
      this.hideAllWindows();
    } else {
      this.showAllWindows();
    }
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

    // Open transactions window by default
    this.openTransactionsWindow();

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
   * Open the transactions window
   * If already open, focuses the existing window
   */
  public openTransactionsWindow(): void {
    // Check if transactions window already exists
    const existingTransactions = this.windows.get('transactions');
    if (existingTransactions && !existingTransactions.isDestroyed()) {
      if (existingTransactions.isMinimized()) {
        existingTransactions.restore();
      }
      existingTransactions.focus();
      logger.info('Focused existing transactions window');
      return;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { workArea } = primaryDisplay;
    // Transactions window is wide and short, positioned at the bottom of the screen
    const transactionsWidth = Math.min(workArea.width - 40, 1600); // Nearly full width with margin
    const transactionsHeight = 300;
    const transactionsPos = getSafeWindowPosition(
      primaryDisplay,
      transactionsWidth,
      transactionsHeight,
      workArea.x + Math.floor((workArea.width - transactionsWidth) / 2), // Center horizontally
      workArea.y + workArea.height - transactionsHeight - 20 // Position at bottom with margin
    );

    const transactionsConfig: WindowConfig = {
      id: 'transactions',
      title: 'Transaction History',
      width: transactionsWidth,
      height: transactionsHeight,
      ...transactionsPos,
      showMenu: false, // Hide menu bar on Windows/Linux
    };

    const transactionsWindow = this.createWindow(transactionsConfig);

    // Transactions window can be closed normally (not minimized)
    transactionsWindow.removeAllListeners('close');
    transactionsWindow.on('closed', () => {
      logger.info('Transactions window closed');
      this.windows.delete('transactions');
    });

    logger.info('Transactions window opened', { windowId: transactionsWindow.id });
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
      icon: getAppIconPath(),
      movable: true,
      // macOS: Custom title bar with traffic light controls
      ...(process.platform === 'darwin' && {
        titleBarStyle: 'hidden' as const,
        trafficLightPosition: { x: 16, y: 12 },
      }),
      // Windows/Linux: Use standard frame to avoid blank window issues
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
      },
    });

    // Track the receipt window
    this.receiptWindows.add(receiptWindow);

    // Remove from tracking when closed
    receiptWindow.on('closed', () => {
      this.receiptWindows.delete(receiptWindow);
      // Clear last focused if this window was it
      if (this.lastFocusedWindow === receiptWindow) {
        this.lastFocusedWindow = null;
      }
      logger.debug('Receipt window removed from tracking', { transactionId: data.transactionId });
    });

    // Track focus for z-order preservation
    receiptWindow.on('focus', () => {
      this.lastFocusedWindow = receiptWindow;
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

