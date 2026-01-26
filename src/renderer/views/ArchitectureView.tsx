/**
 * ArchitectureView - Debugger Window
 *
 * Real-time visualization of IPC message flow, state changes, and system health.
 * Four-panel layout: Graph | Timeline | Stats + State Inspector
 *
 * Features:
 * - Live event stream from TraceService
 * - Node graph showing architecture components with animated message flow
 * - Event timeline with filtering and expansion
 * - Statistics panel with metrics
 * - State inspector with diff view and time travel
 * - Animation controls (play/pause, speed)
 */

import { useState } from 'react';
import { SectionErrorBoundary } from '../components';
import { ArchGraph } from '../components/ArchGraph';
import { ArchTimeline } from '../components/ArchTimeline';
import { ArchStats } from '../components/ArchStats';
import { StateInspector } from '../components/StateInspector';
import { useTraceEvents } from '../hooks';
import { DRAG_REGION_STYLE, WINDOW_SAFE_AREAS } from '../utils/platform';

/** Available animation speed options */
const SPEED_OPTIONS = [
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
];

export default function ArchitectureView() {
  const { events, stats, isConnected, clearEvents, filter, setFilter, eventsPerSecond } =
    useTraceEvents();

  // Animation controls state
  const [isPaused, setIsPaused] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1);

  // Selected event for state inspection
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();

  // Toggle between stats and state inspector in right panel
  const [rightPanelView, setRightPanelView] = useState<'stats' | 'state'>('stats');

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-gray-100">
      {/* Header / Title Bar */}
      <header
        className="flex items-center h-10 bg-slate-800 border-b border-slate-700"
        style={DRAG_REGION_STYLE}
      >
        <h1
          className="text-sm font-semibold text-white"
          style={{
            // @ts-expect-error - WebKit-specific CSS property for Electron
            WebkitAppRegion: 'no-drag',
          }}
        >
          Debugger
        </h1>

        {/* Animation Controls */}
        <div
          className="flex items-center gap-3 ml-4"
          style={{
            // @ts-expect-error - WebKit-specific CSS property for Electron
            WebkitAppRegion: 'no-drag',
          }}
        >
          {/* Play/Pause Button */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              isPaused
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-gray-300'
            }`}
            title={isPaused ? 'Resume animations' : 'Pause animations'}
          >
            {isPaused ? (
              <>
                <span>▶</span> Play
              </>
            ) : (
              <>
                <span>❚❚</span> Pause
              </>
            )}
          </button>

          {/* Speed Selector */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500 text-xs">Speed:</span>
            {SPEED_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setAnimationSpeed(option.value)}
                className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                  animationSpeed === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-gray-400'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1" />
        <div
          className="flex items-center gap-2 text-xs"
          style={{
            // @ts-expect-error - WebKit-specific CSS property for Electron
            WebkitAppRegion: 'no-drag',
          }}
        >
          <span className="text-gray-400">{events.length} events</span>
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`}
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Graph */}
        <div className="w-1/3 min-w-75 border-r border-slate-700">
          <SectionErrorBoundary sectionName="Architecture Graph">
            <ArchGraph events={events} isPaused={isPaused} animationSpeed={animationSpeed} />
          </SectionErrorBoundary>
        </div>

        {/* Center Panel: Timeline */}
        <div className="flex-1 min-w-100">
          <SectionErrorBoundary sectionName="Event Timeline">
            <ArchTimeline
              events={events}
              filter={filter}
              onFilterChange={setFilter}
              selectedEventId={selectedEventId}
              onEventSelect={setSelectedEventId}
            />
          </SectionErrorBoundary>
        </div>

        {/* Right Panel: Stats / State Inspector */}
        <div className="w-64 min-w-52 flex flex-col border-l border-slate-700">
          {/* Panel Tabs */}
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => setRightPanelView('stats')}
              className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                rightPanelView === 'stats'
                  ? 'bg-slate-800 text-white border-b-2 border-amber-500'
                  : 'bg-slate-900 text-gray-400 hover:text-gray-300'
              }`}
            >
              Stats
            </button>
            <button
              onClick={() => setRightPanelView('state')}
              className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                rightPanelView === 'state'
                  ? 'bg-slate-800 text-white border-b-2 border-amber-500'
                  : 'bg-slate-900 text-gray-400 hover:text-gray-300'
              }`}
            >
              State
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden">
            {rightPanelView === 'stats' ? (
              <SectionErrorBoundary sectionName="Statistics">
                <ArchStats
                  stats={stats}
                  eventsPerSecond={eventsPerSecond}
                  isConnected={isConnected}
                  onClear={clearEvents}
                />
              </SectionErrorBoundary>
            ) : (
              <SectionErrorBoundary sectionName="State Inspector">
                <StateInspector
                  events={events}
                  selectedEventId={selectedEventId}
                  onEventSelect={setSelectedEventId}
                />
              </SectionErrorBoundary>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="flex items-center h-6 px-2 bg-slate-800 border-t border-slate-700 text-xs text-gray-500"
        style={{ paddingLeft: WINDOW_SAFE_AREAS.left, paddingRight: WINDOW_SAFE_AREAS.right }}
      >
        <span>Press Cmd/Ctrl+Shift+A to toggle this window</span>
        <div className="flex-1" />
        <span>{eventsPerSecond.toFixed(1)} events/sec</span>
      </footer>
    </div>
  );
}

