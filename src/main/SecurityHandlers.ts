/**
 * SecurityHandlers - Centralized security configuration for Electron
 *
 * Implements Electron security best practices (2025/2026):
 * - Navigation control (will-navigate)
 * - Window open prevention (setWindowOpenHandler)
 * - Permission request blocking
 * - IPC sender validation
 *
 * @see https://electronjs.org/docs/latest/tutorial/security
 */

import { app, session, WebContents } from 'electron';
import path from 'node:path';
import { createLogger } from './Logger';

const logger = createLogger('SecurityHandlers');

// Declare Vite globals
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;

/**
 * Validate that an IPC sender is from a trusted source
 * Returns true if the sender frame URL is from our app
 *
 * Security: In production, we verify the sender is loading from our app's
 * bundled files by checking the URL starts with file:// and contains our app path.
 */
export function validateSender(senderFrame: Electron.WebFrameMain): boolean {
  const url = senderFrame.url;

  // In development, accept from dev server
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  }

  // In production, verify sender is from our app's file path
  if (!url.startsWith('file://')) {
    return false;
  }

  // Extract path from file:// URL and verify it's within our app
  try {
    const parsedUrl = new URL(url);
    const filePath = decodeURIComponent(parsedUrl.pathname);

    // Verify the file is within the app's resource path or app path
    const appPath = app.getAppPath();
    const resourcesPath = process.resourcesPath;

    // Normalize paths for comparison
    const normalizedFilePath = path.normalize(filePath);
    const normalizedAppPath = path.normalize(appPath);
    const normalizedResourcesPath = path.normalize(resourcesPath);

    return (
      normalizedFilePath.startsWith(normalizedAppPath) ||
      normalizedFilePath.startsWith(normalizedResourcesPath)
    );
  } catch {
    logger.warn('Failed to parse sender URL', { url });
    return false;
  }
}

/**
 * Check if a navigation URL should be allowed
 */
function isAllowedNavigation(navigationUrl: string): boolean {
  // In development, allow dev server URLs
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return navigationUrl.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  }

  // In production, only allow file:// URLs (local files)
  return navigationUrl.startsWith('file://');
}

/**
 * Initialize all security handlers
 * Should be called after app.whenReady()
 */
export function initializeSecurityHandlers(): void {
  logger.info('Initializing security handlers');

  // Set up permission request handler - deny all by default
  // POS application doesn't need camera, microphone, geolocation, etc.
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      logger.warn('Blocked permission request', {
        permission,
        url: webContents.getURL(),
      });
      callback(false);
    }
  );

  // Also handle permission checks (synchronous permission queries)
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission) => {
      logger.debug('Permission check denied', {
        permission,
        url: webContents?.getURL() ?? 'unknown',
      });
      return false;
    }
  );

  // Handle all newly created web contents (windows, webviews, etc.)
  app.on('web-contents-created', (_event, contents) => {
    setupWebContentsSecurityHandlers(contents);
  });

  logger.info('Security handlers initialized');
}

/**
 * Set up security handlers for a WebContents instance
 */
function setupWebContentsSecurityHandlers(contents: WebContents): void {
  // Prevent navigation to untrusted URLs
  contents.on('will-navigate', (event, navigationUrl) => {
    if (!isAllowedNavigation(navigationUrl)) {
      logger.warn('Blocked navigation attempt', { url: navigationUrl });
      event.preventDefault();
    }
  });

  // Block all new window creation (window.open, target="_blank", etc.)
  contents.setWindowOpenHandler(({ url }) => {
    logger.warn('Blocked window.open attempt', { url });
    return { action: 'deny' };
  });

  // Prevent webview attachment (we don't use webviews)
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    logger.warn('Blocked webview attachment', { src: params.src });

    // Strip away preload scripts
    delete webPreferences.preload;

    // Disable Node.js integration
    webPreferences.nodeIntegration = false;

    // Always prevent webview attachment in this app
    event.preventDefault();
  });
}

