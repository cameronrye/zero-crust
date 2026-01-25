/**
 * TrayManager - System tray / menu bar integration
 *
 * Provides cross-platform tray icon support:
 * - macOS: Menu bar icon (top-right, uses template images for light/dark mode)
 * - Windows: System tray icon (bottom-right notification area)
 * - Linux: Taskbar notification area icon
 */

import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'node:path';
import { createLogger } from './Logger';
import type { WindowId } from '@shared/ipc-types';

const logger = createLogger('TrayManager');

// Callback types for tray menu actions
type ShowWindowCallback = (windowId: WindowId) => void;
type ClearAllDataCallback = () => Promise<void>;
type CheckForUpdatesCallback = () => Promise<void>;

export interface TrayCallbacks {
  showWindow: ShowWindowCallback;
  showAllWindows: () => void;
  clearAllData: ClearAllDataCallback;
  checkForUpdates: CheckForUpdatesCallback;
}

class TrayManager {
  private tray: Tray | null = null;

  /**
   * Get the appropriate icon path based on platform
   * - macOS: Uses template images that adapt to light/dark mode
   * - Windows: Uses ICO format for best quality
   * - Linux: Uses PNG format
   */
  private getIconPath(): string {
    const assetsPath = path.join(__dirname, '../../assets');

    if (process.platform === 'darwin') {
      // macOS: Use template image (automatically adapts to menu bar appearance)
      return path.join(assetsPath, 'trayTemplate.png');
    } else if (process.platform === 'win32') {
      // Windows: Use ICO format
      return path.join(assetsPath, 'icon.ico');
    } else {
      // Linux: Use PNG
      return path.join(assetsPath, 'icon.png');
    }
  }

  /**
   * Create the tray icon with context menu
   */
  public initialize(callbacks: TrayCallbacks): void {
    if (this.tray) {
      logger.warn('Tray already initialized');
      return;
    }

    const iconPath = this.getIconPath();
    let icon = nativeImage.createFromPath(iconPath);

    // Fallback to main icon if tray-specific icon doesn't exist
    if (icon.isEmpty()) {
      logger.warn('Tray icon not found, falling back to main icon', { iconPath });
      const fallbackPath = path.join(__dirname, '../../assets/icon.png');
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
    this.tray.setToolTip('Zero Crust POS');

    // Build context menu
    const contextMenu = this.buildContextMenu(callbacks);
    this.tray.setContextMenu(contextMenu);

    // Click handler - show all windows
    this.tray.on('click', () => {
      logger.debug('Tray icon clicked');
      callbacks.showAllWindows();
    });

    // Double-click handler (Windows/macOS) - show all windows
    this.tray.on('double-click', () => {
      logger.debug('Tray icon double-clicked');
      callbacks.showAllWindows();
    });

    logger.info('Tray initialized', { platform: process.platform });
  }

  /**
   * Build the context menu for the tray icon
   */
  private buildContextMenu(callbacks: TrayCallbacks): Menu {
    const { showWindow, showAllWindows, clearAllData, checkForUpdates } = callbacks;

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Zero Crust POS',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Show All Windows',
        click: () => showAllWindows(),
      },
      { type: 'separator' },
      {
        label: 'Show Cashier',
        click: () => showWindow('cashier'),
      },
      {
        label: 'Show Customer Display',
        click: () => showWindow('customer'),
      },
      {
        label: 'Show Dashboard',
        click: () => showWindow('dashboard'),
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
      logger.info('Tray destroyed');
    }
  }
}

// Singleton instance
export const trayManager = new TrayManager();
export default TrayManager;

