/**
 * Platform Utilities - Cross-platform detection and safe area constants
 *
 * Provides consistent platform detection and window control safe areas
 * for macOS, Windows, and Linux window styling.
 *
 * Window Controls Layout:
 * - macOS: Traffic lights on LEFT (~70px), nothing on right
 * - Windows/Linux: Nothing on left, window controls on RIGHT (~140px)
 */

/**
 * Detects if the current platform is macOS
 * Uses navigator.platform which is available in renderer process
 */
export const IS_MAC = typeof navigator !== 'undefined'
  && navigator.platform.toUpperCase().includes('MAC');

/**
 * Detects if the current platform is Windows
 */
export const IS_WINDOWS = typeof navigator !== 'undefined'
  && navigator.platform.toUpperCase().includes('WIN');

/**
 * Detects if the current platform is Linux
 */
export const IS_LINUX = typeof navigator !== 'undefined'
  && navigator.platform.toUpperCase().includes('LINUX');

/**
 * Safe area constants for window control regions
 *
 * These values provide padding to avoid overlapping with:
 * - macOS: Traffic light buttons (close, minimize, maximize) on the left
 * - Windows/Linux: Window control buttons (minimize, maximize, close) on the right
 */
export const WINDOW_SAFE_AREAS = {
  /**
   * Left safe area - space for macOS traffic lights
   * 80px on macOS, 1rem default padding on other platforms
   */
  left: IS_MAC ? '80px' : '1rem',

  /**
   * Right safe area - space for Windows/Linux title bar overlay controls
   * Windows and Linux use titleBarOverlay which places controls on the right (~140px)
   * macOS uses standard padding (traffic lights are on the left)
   */
  right: (IS_WINDOWS || IS_LINUX) ? '140px' : '1rem',
} as const;

/**
 * CSS style object for draggable title bar regions
 * Includes WebkitAppRegion for Electron window dragging
 */
export const DRAG_REGION_STYLE = {
  WebkitAppRegion: 'drag',
  paddingLeft: WINDOW_SAFE_AREAS.left,
  paddingRight: WINDOW_SAFE_AREAS.right,
} as const;

