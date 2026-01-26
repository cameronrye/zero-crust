import { app, BrowserWindow, dialog, nativeImage, session } from 'electron';

// Set app name immediately - must be done before app is ready
// This affects macOS menu bar, dock, and other platform UI elements
app.setName('Zero Crust');

// =============================================================================
// GPU Acceleration Handling for Windows
// =============================================================================
// Windows can have GPU driver issues that cause white/blank screens.
// Disable hardware acceleration on Windows to ensure consistent rendering.
// This must be called before app is ready.
// =============================================================================
if (process.platform === 'win32') {
  app.disableHardwareAcceleration();
}

import started from 'electron-squirrel-startup';
import { windowManager } from './main/WindowManager';
import { initializeIpcHandlers } from './main/IpcHandlers';
import { initializeSecurityHandlers } from './main/SecurityHandlers';
import { initializeAutoUpdater, checkForUpdatesManually } from './main/AutoUpdater';
import { initializeAppMenu } from './main/AppMenu';
import { trayManager } from './main/TrayManager';
import { mainStore } from './main/MainStore';
import { persistenceService } from './main/PersistenceService';
import { metricsService } from './main/MetricsService';
import { traceService } from './main/TraceService';
import { rootLogger } from './main/Logger';
import { getAssetPath } from './main/assetPath';

const logger = rootLogger.child('Main');

// =============================================================================
// Global Error Handlers - Prevent silent crashes and ensure observability
// =============================================================================

/**
 * Handle uncaught exceptions in the main process
 * Logs the error and shows a dialog to the user before quitting
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception in main process', {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });

  // Show error dialog to user (non-blocking in production)
  dialog.showErrorBox(
    'Unexpected Error',
    `An unexpected error occurred:\n\n${error.message}\n\nThe application will now close. Please restart.`
  );

  // Exit with error code
  app.exit(1);
});

/**
 * Handle unhandled promise rejections
 * These often indicate bugs in async code
 */
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  const errorStack = reason instanceof Error ? reason.stack : undefined;

  logger.error('Unhandled promise rejection', {
    reason: errorMessage,
    stack: errorStack,
    promise: String(promise),
  });

  // Don't crash the app for unhandled rejections, but log them
  // In production, these would be sent to error tracking service
});

/**
 * Handle renderer process crashes
 * This catches when a BrowserWindow's renderer process dies
 */
app.on('render-process-gone', (_event, webContents, details) => {
  logger.error('Renderer process gone', {
    reason: details.reason,
    exitCode: details.exitCode,
    url: webContents.getURL(),
  });

  // If it was a crash, show error to user
  if (details.reason === 'crashed' || details.reason === 'killed') {
    dialog.showErrorBox(
      'Window Crashed',
      'A window has crashed unexpectedly. The application will attempt to recover.'
    );
  }
});

/**
 * Handle child process crashes (e.g., GPU process)
 */
app.on('child-process-gone', (_event, details) => {
  logger.error('Child process gone', {
    type: details.type,
    reason: details.reason,
    exitCode: details.exitCode,
    serviceName: details.serviceName,
    name: details.name,
  });

  // GPU process crashes are common and Electron handles recovery
  // Only log for observability, don't show dialog for GPU crashes
  if (details.type !== 'GPU') {
    logger.warn('Non-GPU child process terminated', {
      type: details.type,
      reason: details.reason,
    });
  }
});

// =============================================================================
// Application Lifecycle
// =============================================================================

/**
 * Clear all application data
 * Called from the application menu "Clear All Data" option
 */
async function clearAllApplicationData(): Promise<void> {
  logger.info('Clearing all application data');

  try {
    // Clear electron-store persisted data (inventory, transactions)
    persistenceService.clearAll();

    // Clear browser session data (cookies, localStorage, indexedDB, cache)
    await session.defaultSession.clearStorageData({
      storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'],
    });
    await session.defaultSession.clearCache();

    // Reset MainStore state
    mainStore.clearCart();
    mainStore.resetTransaction();

    // Reset metrics (Average Cart, Today's Transactions, Revenue, etc.)
    metricsService.reset();

    logger.info('All application data cleared successfully');

    // Show confirmation to user
    const focusedWindow = BrowserWindow.getFocusedWindow();
    await dialog.showMessageBox(focusedWindow ?? (undefined as never), {
      type: 'info',
      title: 'Data Cleared',
      message: 'All application data has been cleared.',
      detail: 'The application will reload to apply changes.',
      buttons: ['OK'],
    });

    // Reload all windows to reflect cleared state
    windowManager.reloadAllWindows();
  } catch (error) {
    logger.error('Failed to clear application data', {
      error: error instanceof Error ? error.message : String(error),
    });

    const focusedWindow = BrowserWindow.getFocusedWindow();
    await dialog.showMessageBox(focusedWindow ?? (undefined as never), {
      type: 'error',
      title: 'Error',
      message: 'Failed to clear application data.',
      detail: error instanceof Error ? error.message : String(error),
      buttons: ['OK'],
    });
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  logger.info('Application ready, initializing');

  // Configure the About panel with custom icon and version
  const iconPath = getAssetPath('icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  app.setAboutPanelOptions({
    applicationName: 'Zero Crust',
    applicationVersion: app.getVersion(),
    version: '', // Hide build number on macOS
    copyright: 'Copyright 2026 Cameron Rye',
    ...(!icon.isEmpty() ? { iconPath } : {}),
  });

  // Set dock icon for macOS during development
  // In production, the packaged app uses the icon from packagerConfig
  if (process.platform === 'darwin' && app.dock) {
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon);
      logger.debug('Dock icon set', { iconPath });
    } else {
      logger.warn('Failed to load dock icon', { iconPath });
    }
  }

  // Set up application menu (replaces "Electron" with "Zero Crust" in menu bar)
  // Pass callbacks for menu actions
  initializeAppMenu({
    showWindow: (windowId) => windowManager.showWindow(windowId),
    clearAllData: clearAllApplicationData,
    checkForUpdates: checkForUpdatesManually,
  });

  // Initialize system tray / menu bar icon
  // Provides quick access to windows and actions from the notification area
  trayManager.initialize({
    toggleWindow: (windowId) => windowManager.toggleWindow(windowId),
    toggleAllWindows: () => windowManager.toggleAllWindows(),
    showAllWindows: () => windowManager.showAllWindows(),
    showPrimaryWindowsIfNoneVisible: () => windowManager.showPrimaryWindowsIfNoneVisible(),
    isWindowVisible: (windowId) => windowManager.isWindowVisible(windowId),
    hasVisibleWindows: () => windowManager.hasVisibleWindows(),
    clearAllData: clearAllApplicationData,
    checkForUpdates: checkForUpdatesManually,
  });

  // Initialize security handlers first (permission blocking, navigation control, etc.)
  initializeSecurityHandlers();

  // Initialize IPC handlers before creating windows
  initializeIpcHandlers();

  // Create the dual-head windows
  windowManager.initializeWindows();

  // Initialize auto-updater (only runs in production)
  initializeAutoUpdater();
});

// Graceful shutdown - handle pending transactions before quitting
app.on('before-quit', () => {
  logger.info('Application shutting down, cleaning up...');
  // Allow windows to close during quit
  windowManager.setQuitting(true);
  // Dispose TraceService to clean up pending timeouts
  traceService.dispose();
  mainStore.shutdown();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (process.platform !== 'darwin') {
    logger.info('Quitting application');
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    logger.info('Reactivating application, reinitializing windows');
    windowManager.initializeWindows();
  } else if (!windowManager.hasVisibleWindows()) {
    // If windows exist but are all minimized, restore them
    logger.info('Restoring minimized windows');
    windowManager.showAllWindows();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
