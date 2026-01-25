/**
 * Test setup file for Vitest
 * Adds custom matchers from @testing-library/jest-dom
 */

import '@testing-library/jest-dom/vitest';

/**
 * Mock Electron-specific globals that are undefined in test environment
 *
 * process.resourcesPath is set by Electron in production builds to point
 * to the resources directory. In tests, we mock it to prevent path.join errors.
 */
if (typeof process.resourcesPath === 'undefined') {
  Object.defineProperty(process, 'resourcesPath', {
    value: '/mock/resources',
    writable: true,
    configurable: true,
  });
}

