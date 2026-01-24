/**
 * Header - Top navigation bar with status and demo controls
 *
 * This header serves as the custom title bar for the window.
 * It is draggable to allow window movement on all platforms.
 * On macOS, traffic light controls appear on the left.
 * On Windows/Linux, window controls overlay appears on the right.
 *
 * Note: The Window Controls Overlay API (env variables) only works on Windows/Linux
 * when titleBarOverlay is enabled. On macOS with titleBarStyle: 'hidden',
 * we must use fixed padding for the traffic light controls.
 */

import type { TransactionStatus } from '@shared/ipc-types';

// Platform-specific padding for window controls
const IS_MAC = navigator.platform.toUpperCase().includes('MAC');
const LEFT_SAFE_AREA = IS_MAC ? '80px' : '1.5rem';
const RIGHT_SAFE_AREA = IS_MAC ? '1.5rem' : '140px';

const STATUS_COLORS: Record<TransactionStatus, string> = {
  IDLE: 'bg-emerald-500',
  PENDING: 'bg-amber-500',
  PROCESSING: 'bg-amber-500 animate-pulse',
  PAID: 'bg-emerald-500',
  ERROR: 'bg-rose-600',
};

interface HeaderProps {
  transactionStatus: TransactionStatus | null;
  isLocked: boolean;
  onDemoOrder: () => void;
}

export function Header({ transactionStatus, isLocked, onDemoOrder }: HeaderProps) {
  const status = transactionStatus ?? 'IDLE';

  return (
    <header
      className="flex items-center justify-between h-10 bg-slate-800 border-b-2 border-amber-500/50"
      style={{
        // Make the header draggable for window movement
        // @ts-expect-error - WebKit-specific CSS property for Electron
        WebkitAppRegion: 'drag',
        // Left padding: space for macOS traffic lights
        paddingLeft: LEFT_SAFE_AREA,
        // Right padding: space for Windows/Linux controls
        paddingRight: RIGHT_SAFE_AREA,
      }}
    >
      {/* App title - visible on macOS where traffic lights are on the left */}
      <h1 className="text-lg font-bold text-amber-400 select-none">Zero Crust POS</h1>

      {/* Controls - must be non-draggable */}
      <div
        className="flex items-center gap-4"
        style={{
          // @ts-expect-error - WebKit-specific CSS property for Electron
          WebkitAppRegion: 'no-drag',
        }}
      >
        <button
          onClick={onDemoOrder}
          disabled={isLocked}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            isLocked
              ? 'bg-slate-600 text-gray-400 cursor-not-allowed'
              : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
          }`}
        >
          Demo Order
        </button>
        <span className={`px-3 py-1 rounded text-sm font-bold ${STATUS_COLORS[status]}`}>
          {transactionStatus ?? 'LOADING'}
        </span>
      </div>
    </header>
  );
}

