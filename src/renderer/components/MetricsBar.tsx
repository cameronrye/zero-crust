/**
 * MetricsBar - Displays real-time transaction metrics and autoplay control
 *
 * This bar serves as the custom title bar for the cashier window.
 * It is draggable to allow window movement on all platforms.
 *
 * Window Controls Layout:
 * - macOS: Traffic lights on LEFT (~70px), nothing on right
 * - Windows/Linux: Nothing on left, window controls on RIGHT (~140px)
 *
 * Note: The Window Controls Overlay API (env variables) only works on Windows/Linux
 * when titleBarOverlay is enabled. On macOS with titleBarStyle: 'hidden',
 * we must use fixed padding for the traffic light controls.
 */

import type { Metrics } from '@shared/ipc-types';
import { formatCurrency } from '@shared/currency';

// Platform-specific padding for window controls
// macOS: ~70px for traffic lights on the left
// Windows/Linux: ~140px for window controls on the right (handled via env())
const IS_MAC = navigator.platform.toUpperCase().includes('MAC');
const LEFT_SAFE_AREA = IS_MAC ? '80px' : '1.5rem';
const RIGHT_SAFE_AREA = IS_MAC ? '1rem' : '140px';

interface MetricsBarProps {
  metrics: Metrics;
  isLocked: boolean;
  demoLoopRunning: boolean;
  onToggleDemoLoop: () => void;
}

export function MetricsBar({
  metrics,
  isLocked,
  demoLoopRunning,
  onToggleDemoLoop,
}: MetricsBarProps) {
  return (
    <div
      className="flex items-center py-2 bg-slate-800 border-b border-slate-700 text-sm h-10"
      style={{
        // Make the bar draggable for window movement
        // @ts-expect-error - WebKit-specific CSS property for Electron
        WebkitAppRegion: 'drag',
        // Left padding: space for macOS traffic lights
        paddingLeft: LEFT_SAFE_AREA,
        // Right padding: space for Windows/Linux controls
        paddingRight: RIGHT_SAFE_AREA,
      }}
    >
      <div
        className="flex items-center gap-6"
        style={{
          // @ts-expect-error - WebKit-specific CSS property for Electron
          WebkitAppRegion: 'no-drag',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400">TPM:</span>
          <span className="font-medium text-emerald-400">
            {metrics.transactionsPerMinute.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Avg Cart:</span>
          <span className="font-medium text-amber-400">
            {metrics.averageCartSize.toFixed(1)} items
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Today:</span>
          <span className="font-medium text-amber-400">
            {metrics.totalTransactionsToday} txns
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Revenue:</span>
          <span className="font-medium text-emerald-400">
            {formatCurrency(metrics.totalRevenueToday)}
          </span>
        </div>
      </div>
      <div className="flex-1" />
      <button
        onClick={onToggleDemoLoop}
        disabled={isLocked && !demoLoopRunning}
        style={{
          // @ts-expect-error - WebKit-specific CSS property for Electron
          WebkitAppRegion: 'no-drag',
        }}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors w-20 ${
          demoLoopRunning
            ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer animate-pulse'
            : isLocked
              ? 'bg-slate-600 text-gray-400 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
        }`}
      >
        {demoLoopRunning ? 'Stop' : 'Autoplay'}
      </button>
    </div>
  );
}

