/**
 * Asset Path Resolution Utility
 *
 * Resolves asset file paths that work correctly in both development
 * and production (packaged) Electron environments.
 *
 * In development:
 *   - Assets are in the project's /assets folder
 *   - __dirname is in src/main/ or .vite/build/
 *
 * In production (packaged app):
 *   - Assets are copied to resources/assets via extraResource
 *   - Access via process.resourcesPath
 */

import path from 'node:path';

// Declare Vite global to detect development mode
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return !!MAIN_WINDOW_VITE_DEV_SERVER_URL;
}

/**
 * Get the base path to assets folder
 *
 * Development: project_root/assets
 * Production: resources/assets (via extraResource)
 */
export function getAssetsPath(): string {
  if (isDevelopment()) {
    // In development, assets are relative to __dirname
    // __dirname is .vite/build/ during dev, go up to project root
    return path.join(__dirname, '../../assets');
  } else {
    // In production, assets are in resources/assets via extraResource
    return path.join(process.resourcesPath, 'assets');
  }
}

/**
 * Get the path to a specific asset file
 *
 * @param filename - The asset filename (e.g., 'icon.png', 'icon.ico')
 * @returns Full path to the asset
 */
export function getAssetPath(filename: string): string {
  return path.join(getAssetsPath(), filename);
}

/**
 * Get the appropriate icon path based on platform
 *
 * - Windows: .ico format
 * - macOS: .icns format (or .png)
 * - Linux: .png format
 */
export function getAppIconPath(): string {
  if (process.platform === 'win32') {
    return getAssetPath('icon.ico');
  } else if (process.platform === 'darwin') {
    // macOS prefers icns but can use png
    const icnsPath = getAssetPath('icon.icns');
    // In development, icns might not exist, fall back to png
    return icnsPath;
  } else {
    return getAssetPath('icon.png');
  }
}

/**
 * Get the tray icon path based on platform
 *
 * - macOS: Uses template images that adapt to light/dark mode
 * - Windows: Uses ICO format for best quality
 * - Linux: Uses PNG format
 */
export function getTrayIconPath(): string {
  if (process.platform === 'darwin') {
    // macOS: Use template image (automatically adapts to menu bar appearance)
    return getAssetPath('trayTemplate.png');
  } else if (process.platform === 'win32') {
    // Windows: Use ICO format
    return getAssetPath('icon.ico');
  } else {
    // Linux: Use PNG
    return getAssetPath('icon.png');
  }
}

