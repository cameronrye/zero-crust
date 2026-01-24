/**
 * LoadingSkeleton - Displays loading placeholder for both Cashier and Customer views
 *
 * Shows skeleton UI while waiting for initial state from the Main process.
 *
 * Window Controls Layout:
 * - macOS: Traffic lights on LEFT (~70px), nothing on right
 * - Windows/Linux: Nothing on left, window controls on RIGHT (~140px)
 *
 * Note: The Window Controls Overlay API (env variables) only works on Windows/Linux
 * when titleBarOverlay is enabled. On macOS with titleBarStyle: 'hidden',
 * we must use fixed padding for the traffic light controls.
 */

// Platform-specific padding for window controls
const IS_MAC = navigator.platform.toUpperCase().includes('MAC');
const CASHIER_LEFT_SAFE_AREA = IS_MAC ? '80px' : '1.5rem';
const CASHIER_RIGHT_SAFE_AREA = IS_MAC ? '1rem' : '140px';
const CUSTOMER_LEFT_SAFE_AREA = IS_MAC ? '80px' : '1rem';
const CUSTOMER_RIGHT_SAFE_AREA = IS_MAC ? '1rem' : '140px';

interface LoadingSkeletonProps {
  variant: 'cashier' | 'customer';
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-slate-700 animate-pulse rounded ${className}`} />;
}

function CashierSkeleton() {
  return (
    <div className="min-h-screen bg-slate-900 text-gray-100 flex flex-col">
      {/* MetricsBar skeleton - draggable title bar with safe areas for window controls */}
      <div
        className="flex items-center h-10 bg-slate-800 border-b border-slate-700"
        style={{
          // @ts-expect-error - WebKit-specific CSS property for Electron
          WebkitAppRegion: 'drag',
          // Left padding: space for macOS traffic lights
          paddingLeft: CASHIER_LEFT_SAFE_AREA,
          // Right padding: space for Windows/Linux controls
          paddingRight: CASHIER_RIGHT_SAFE_AREA,
        }}
      >
        <div className="flex items-center gap-6">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="h-5 w-24" />
          ))}
        </div>
        <div className="flex-1" />
        <SkeletonBlock className="h-6 w-20" />
      </div>

      {/* Main content skeleton */}
      <div className="flex flex-1 overflow-hidden">
        {/* Product grid skeleton */}
        <div className="flex-1 flex flex-col p-4">
          {/* Category tabs */}
          <div className="flex gap-2 mb-4">
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-10 w-24" />
            ))}
          </div>
          {/* Product grid */}
          <div className="grid grid-cols-4 gap-3">
            {[...Array(12)].map((_, i) => (
              <SkeletonBlock key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>

        {/* Cart sidebar skeleton */}
        <aside className="w-80 bg-slate-800 p-4 flex flex-col">
          <SkeletonBlock className="h-6 w-32 mb-4" />
          <div className="flex-1 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-16 w-full" />
            ))}
          </div>
          <SkeletonBlock className="h-12 w-full mt-4" />
        </aside>
      </div>
    </div>
  );
}

function CustomerSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 flex flex-col">
      {/* Draggable title bar area */}
      <div
        className="h-10 bg-slate-950 flex items-center justify-center shrink-0"
        style={{
          // @ts-expect-error - WebKit-specific CSS property for Electron
          WebkitAppRegion: 'drag',
          // Left padding: space for macOS traffic lights
          paddingLeft: CUSTOMER_LEFT_SAFE_AREA,
          // Right padding: space for Windows/Linux controls
          paddingRight: CUSTOMER_RIGHT_SAFE_AREA,
        }}
      >
        <SkeletonBlock className="h-4 w-32" />
      </div>

      {/* Main content skeleton */}
      <main className="flex-1 flex flex-col p-8">
        {/* Status message skeleton */}
        <div className="text-center mb-8">
          <SkeletonBlock className="h-10 w-48 mx-auto" />
        </div>

        {/* Order display skeleton */}
        <div className="flex-1 bg-slate-800/50 rounded-lg p-6 mb-6">
          <SkeletonBlock className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center py-3">
                <div className="flex items-center gap-4">
                  <SkeletonBlock className="h-8 w-8 rounded-full" />
                  <SkeletonBlock className="h-5 w-40" />
                </div>
                <SkeletonBlock className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* Total section skeleton */}
        <div className="bg-slate-800/50 rounded-lg p-6">
          <div className="flex justify-between items-center">
            <SkeletonBlock className="h-8 w-20" />
            <SkeletonBlock className="h-10 w-28" />
          </div>
        </div>
      </main>
    </div>
  );
}

export function LoadingSkeleton({ variant }: LoadingSkeletonProps) {
  return variant === 'cashier' ? <CashierSkeleton /> : <CustomerSkeleton />;
}

