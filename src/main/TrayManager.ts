/**
 * TrayManager - System tray / menu bar integration
 *
 * Provides cross-platform tray icon support:
 * - macOS: Menu bar icon (top-right, uses template images for light/dark mode)
 * - Windows: System tray icon (bottom-right notification area)
 * - Linux: Taskbar notification area icon
 */

import { Tray, Menu, nativeImage, app } from 'electron';
import { createLogger } from './Logger';
import { getTrayIconPath, getAssetPath } from './assetPath';
import type { WindowId } from '@shared/ipc-types';

const logger = createLogger('TrayManager');

// Callback types for tray menu actions
type ToggleWindowCallback = (windowId: WindowId) => void;
type ClearAllDataCallback = () => Promise<void>;
type CheckForUpdatesCallback = () => Promise<void>;
type IsWindowVisibleCallback = (windowId: WindowId) => boolean;
type HasVisibleWindowsCallback = () => boolean;

export interface TrayCallbacks {
  toggleWindow: ToggleWindowCallback;
  toggleAllWindows: () => void;
  showAllWindows: () => void;
  showPrimaryWindowsIfNoneVisible: () => void;
  isWindowVisible: IsWindowVisibleCallback;
  hasVisibleWindows: HasVisibleWindowsCallback;
  clearAllData: ClearAllDataCallback;
  checkForUpdates: CheckForUpdatesCallback;
}

class TrayManager {
  private tray: Tray | null = null;
  private callbacks: TrayCallbacks | null = null;

  /**
   * Create the tray icon with context menu
   */
  public initialize(callbacks: TrayCallbacks): void {
    if (this.tray) {
      logger.warn('Tray already initialized');
      return;
    }

    this.callbacks = callbacks;

    const iconPath = getTrayIconPath();
    let icon = nativeImage.createFromPath(iconPath);

    // Fallback to main icon if tray-specific icon doesn't exist
    if (icon.isEmpty()) {
      logger.warn('Tray icon not found, falling back to main icon', { iconPath });
      const fallbackPath = getAssetPath('icon.png');
      icon = nativeImage.createFromPath(fallbackPath);

      // Resize for tray (16x16 is standard)
      if (!icon.isEmpty()) {
        icon = icon.resize({ width: 16, height: 16 });
      }
    }

    // Mark as template image on macOS for automatic light/dark mode adaptation
    if (process.platform === 'darwin') {
      icon.setTemplateImage(true);
    }

    if (icon.isEmpty()) {
      logger.error('Failed to load any tray icon');
      return;
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip('Zero Crust');

    // Build initial context menu
    this.updateContextMenu();

    // Click handler - show primary windows only if none are visible
    // Respects manually hidden windows (dashboard, etc.)
    this.tray.on('click', () => {
      logger.debug('Tray icon clicked');
      callbacks.showPrimaryWindowsIfNoneVisible();
      this.updateContextMenu();
    });

    // Double-click handler (Windows/macOS) - same behavior as click
    this.tray.on('double-click', () => {
      logger.debug('Tray icon double-clicked');
      callbacks.showPrimaryWindowsIfNoneVisible();
      this.updateContextMenu();
    });

    logger.info('Tray initialized', { platform: process.platform });
  }

  /**
   * Update the context menu based on current window visibility
   * Call this whenever window visibility changes
   */
  public updateContextMenu(): void {
    if (!this.tray || !this.callbacks) return;

    const contextMenu = this.buildContextMenu(this.callbacks);
    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Build the context menu for the tray icon with dynamic show/hide labels
   */
  private buildContextMenu(callbacks: TrayCallbacks): Menu {
    const { toggleWindow, toggleAllWindows, isWindowVisible, hasVisibleWindows, clearAllData, checkForUpdates } = callbacks;

    // Determine labels based on current visibility
    const anyVisible = hasVisibleWindows();
    const allWindowsLabel = anyVisible ? 'Hide All Windows' : 'Show All Windows';

    const cashierVisible = isWindowVisible('cashier');
    const customerVisible = isWindowVisible('customer');
    const dashboardVisible = isWindowVisible('dashboard');

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Zero Crust',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: allWindowsLabel,
        click: () => {
          toggleAllWindows();
          this.updateContextMenu();
        },
      },
      { type: 'separator' },
      {
        label: cashierVisible ? 'Hide Cashier' : 'Show Cashier',
        click: () => {
          toggleWindow('cashier');
          this.updateContextMenu();
        },
      },
      {
        label: customerVisible ? 'Hide Customer Display' : 'Show Customer Display',
        click: () => {
          toggleWindow('customer');
          this.updateContextMenu();
        },
      },
      {
        label: dashboardVisible ? 'Hide Dashboard' : 'Show Dashboard',
        click: () => {
          toggleWindow('dashboard');
          this.updateContextMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Check for Updates...',
        click: async () => await checkForUpdates(),
      },
      {
        label: 'Clear All Data...',
        click: async () => await clearAllData(),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit(),
      },
    ];

    return Menu.buildFromTemplate(template);
  }

  /**
   * Destroy the tray icon
   */
  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      this.callbacks = null;
      logger.info('Tray destroyed');
    }
  }
}

// Singleton instance
export const trayManager = new TrayManager();
export default TrayManager;

