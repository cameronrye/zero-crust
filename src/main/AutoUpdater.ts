/**
 * AutoUpdater - Handles automatic application updates
 *
 * Uses electron-updater for secure, signed updates.
 * Updates are only checked in production builds.
 *
 * Configuration:
 * - Updates are fetched from the configured publish provider in package.json
 * - For GitHub releases: add "repository" to package.json
 * - For S3/generic: configure "publish" in forge.config.ts
 *
 * @see https://www.electron.build/auto-update
 */

import { autoUpdater, UpdateInfo } from 'electron-updater';
import { dialog, BrowserWindow } from 'electron';
import { createLogger } from './Logger';
import { AUTO_UPDATER_CONFIG } from '@shared/config';

const logger = createLogger('AutoUpdater');

// Declare Vite globals
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;

/**
 * Initialize the auto-updater
 * Only runs in production builds
 */
export function initializeAutoUpdater(): void {
  // Skip in development
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    logger.debug('Skipping auto-updater in development mode');
    return;
  }

  logger.info('Initializing auto-updater');

  // Configure auto-updater behavior
  autoUpdater.autoDownload = false; // Don't auto-download, ask user first
  autoUpdater.autoInstallOnAppQuit = true; // Install on quit if downloaded
  autoUpdater.autoRunAppAfterInstall = true; // Restart app after install

  // Set up event handlers
  setupUpdateEventHandlers();

  // Check for updates (after a short delay to let app fully initialize)
  setTimeout(() => {
    checkForUpdates();
  }, AUTO_UPDATER_CONFIG.initialCheckDelayMs);
}

/**
 * Check for updates manually (internal use)
 */
export async function checkForUpdates(): Promise<void> {
  try {
    logger.info('Checking for updates...');
    await autoUpdater.checkForUpdates();
  } catch (error) {
    logger.error('Error checking for updates', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Check for updates manually with user feedback
 * Called from the application menu
 */
export async function checkForUpdatesManually(): Promise<void> {
  // In development mode, show a message that updates are disabled
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const options = {
      type: 'info' as const,
      title: 'Development Mode',
      message: 'Update checking is disabled in development mode.',
      buttons: ['OK'],
    };
    await (focusedWindow
      ? dialog.showMessageBox(focusedWindow, options)
      : dialog.showMessageBox(options));
    return;
  }

  try {
    logger.info('User initiated update check');
    const result = await autoUpdater.checkForUpdates();

    // If no update is available, inform the user
    if (!result || !result.updateInfo) {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const options = {
        type: 'info' as const,
        title: 'No Updates Available',
        message: 'You are running the latest version.',
        buttons: ['OK'],
      };
      await (focusedWindow
        ? dialog.showMessageBox(focusedWindow, options)
        : dialog.showMessageBox(options));
    }
    // If update is available, the existing event handler will show the download prompt
  } catch (error) {
    logger.error('Error checking for updates', {
      error: error instanceof Error ? error.message : String(error),
    });

    const focusedWindow = BrowserWindow.getFocusedWindow();
    const options = {
      type: 'error' as const,
      title: 'Update Check Failed',
      message: 'Could not check for updates.',
      detail: error instanceof Error ? error.message : String(error),
      buttons: ['OK'],
    };
    await (focusedWindow
      ? dialog.showMessageBox(focusedWindow, options)
      : dialog.showMessageBox(options));
  }
}

/**
 * Set up auto-updater event handlers
 */
function setupUpdateEventHandlers(): void {
  autoUpdater.on('checking-for-update', () => {
    logger.debug('Checking for update...');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    logger.info('Update available', { version: info.version });
    promptUserForUpdate(info);
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    logger.debug('No update available', { currentVersion: info.version });
  });

  autoUpdater.on('error', (error: Error) => {
    logger.error('Auto-updater error', {
      message: error.message,
      stack: error.stack,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    logger.debug('Download progress', {
      percent: progress.percent.toFixed(1),
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    logger.info('Update downloaded', { version: info.version });
    promptUserToRestart(info);
  });
}

/**
 * Prompt user to download an available update
 */
async function promptUserForUpdate(info: UpdateInfo): Promise<void> {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const options = {
    type: 'info' as const,
    title: 'Update Available',
    message: `A new version (${info.version}) is available.`,
    detail: 'Would you like to download it now? The update will be installed when you restart the application.',
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1,
  };

  const result = await (focusedWindow
    ? dialog.showMessageBox(focusedWindow, options)
    : dialog.showMessageBox(options));

  if (result.response === 0) {
    logger.info('User accepted update download');
    autoUpdater.downloadUpdate();
  } else {
    logger.debug('User declined update download');
  }
}

/**
 * Prompt user to restart and install the downloaded update
 */
async function promptUserToRestart(info: UpdateInfo): Promise<void> {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const options = {
    type: 'info' as const,
    title: 'Update Ready',
    message: `Version ${info.version} has been downloaded.`,
    detail: 'The application will restart to install the update.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
  };

  const result = await (focusedWindow
    ? dialog.showMessageBox(focusedWindow, options)
    : dialog.showMessageBox(options));

  if (result.response === 0) {
    logger.info('User accepted restart for update');
    autoUpdater.quitAndInstall();
  } else {
    logger.debug('User deferred restart for update');
  }
}

