/**
 * Application Menu - Custom menu for Zero Crust
 *
 * Creates a native application menu with proper branding.
 * On macOS, this replaces "Electron" with "Zero Crust" in the menu bar.
 */

import { Menu, shell, dialog, BrowserWindow } from 'electron';
import type { WindowId } from '@shared/ipc-types';

const APP_NAME = 'Zero Crust';

// Callback type for showing windows
type ShowWindowCallback = (windowId: WindowId) => void;

// Callback type for clearing all data
type ClearAllDataCallback = () => Promise<void>;

// Callback type for checking for updates
type CheckForUpdatesCallback = () => Promise<void>;

interface MenuCallbacks {
  showWindow: ShowWindowCallback;
  clearAllData: ClearAllDataCallback;
  checkForUpdates: CheckForUpdatesCallback;
}

/**
 * Helper to show clear all data confirmation dialog
 */
async function confirmClearAllData(
  clearAllData: ClearAllDataCallback
): Promise<void> {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const result = await dialog.showMessageBox(focusedWindow ?? (undefined as never), {
    type: 'warning',
    title: 'Clear All Data',
    message: 'Are you sure you want to clear all data?',
    detail:
      'This will remove all transactions, inventory data, and reset the application. This action cannot be undone.',
    buttons: ['Cancel', 'Clear All Data'],
    defaultId: 0,
    cancelId: 0,
  });

  if (result.response === 1) {
    await clearAllData();
  }
}

/**
 * Build and set the application menu
 */
export function initializeAppMenu(callbacks: MenuCallbacks): void {
  const { showWindow, clearAllData, checkForUpdates } = callbacks;
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: 'about' as const, label: `About ${APP_NAME}` },
              { type: 'separator' as const },
              {
                label: 'Check for Updates...',
                click: async () => await checkForUpdates(),
              },
              { type: 'separator' as const },
              {
                label: 'Clear All Data...',
                click: async () => await confirmClearAllData(clearAllData),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const, label: `Hide ${APP_NAME}` },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const, label: `Quit ${APP_NAME}` },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: isMac
        ? [{ role: 'close' as const }]
        : [
            {
              label: 'Check for Updates...',
              click: async () => await checkForUpdates(),
            },
            {
              label: 'Clear All Data...',
              click: async () => await confirmClearAllData(clearAllData),
            },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
            ]
          : [
              { role: 'delete' as const },
              { type: 'separator' as const },
              { role: 'selectAll' as const },
            ]),
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        {
          label: 'Show Cashier',
          accelerator: 'CmdOrCtrl+1',
          click: () => showWindow('cashier'),
        },
        {
          label: 'Show Customer',
          accelerator: 'CmdOrCtrl+2',
          click: () => showWindow('customer'),
        },
        {
          label: 'Show Transactions',
          accelerator: 'CmdOrCtrl+3',
          click: () => showWindow('transactions'),
        },
        {
          label: 'Show Debugger',
          accelerator: 'CmdOrCtrl+4',
          click: () => showWindow('debugger'),
        },
        { type: 'separator' as const },
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
            ]
          : []),
      ],
    },

    // Help menu
    {
      role: 'help' as const,
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/cameronrye/zero-crust');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

