/**
 * StateInspector - State inspection panel for the Architecture Debug Window
 *
 * Features:
 * - JSON tree view of current state
 * - Diff view showing changes between versions
 * - Highlighted changed fields
 * - State history navigation with slider
 */

import { useState, useMemo, useCallback } from 'react';
import type { TraceEvent } from '@shared/trace-types';

interface StateInspectorProps {
  /** Trace events containing state_broadcast events */
  events: TraceEvent[];
  /** Currently selected event from timeline (optional) */
  selectedEventId?: string;
  /** Callback when an event is selected */
  onEventSelect?: (eventId: string | undefined) => void;
}

/** State snapshot extracted from a state_broadcast event */
interface StateSnapshot {
  eventId: string;
  timestamp: number;
  version: number;
  state: Record<string, unknown>;
}

/**
 * Extract state snapshots from trace events
 */
function extractStateSnapshots(events: TraceEvent[]): StateSnapshot[] {
  return events
    .filter((e) => e.type === 'state_broadcast' && e.payload)
    .map((e) => ({
      eventId: e.id,
      timestamp: e.timestamp,
      version: (e.payload as Record<string, unknown>)?.version as number ?? 0,
      state: e.payload as Record<string, unknown>,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Compute diff between two objects, returning paths that changed
 */
function computeDiff(
  prev: Record<string, unknown> | undefined,
  curr: Record<string, unknown>,
  path = ''
): Set<string> {
  const changes = new Set<string>();

  if (!prev) {
    // All fields are new
    Object.keys(curr).forEach((key) => changes.add(path ? `${path}.${key}` : key));
    return changes;
  }

  const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);

  for (const key of allKeys) {
    const fullPath = path ? `${path}.${key}` : key;
    const prevVal = prev[key];
    const currVal = curr[key];

    if (prevVal === currVal) continue;

    if (
      typeof prevVal === 'object' &&
      typeof currVal === 'object' &&
      prevVal !== null &&
      currVal !== null &&
      !Array.isArray(prevVal) &&
      !Array.isArray(currVal)
    ) {
      // Recurse into nested objects
      const nestedChanges = computeDiff(
        prevVal as Record<string, unknown>,
        currVal as Record<string, unknown>,
        fullPath
      );
      nestedChanges.forEach((c) => changes.add(c));
    } else {
      changes.add(fullPath);
    }
  }

  return changes;
}

export function StateInspector({ events, selectedEventId, onEventSelect }: StateInspectorProps) {
  const snapshots = useMemo(() => extractStateSnapshots(events), [events]);
  const [sliderIndex, setSliderIndex] = useState<number | null>(null);

  // Determine which snapshot to show
  const currentIndex = useMemo(() => {
    if (selectedEventId) {
      const idx = snapshots.findIndex((s) => s.eventId === selectedEventId);
      if (idx >= 0) return idx;
    }
    if (sliderIndex !== null && sliderIndex < snapshots.length) {
      return sliderIndex;
    }
    return snapshots.length - 1;
  }, [snapshots, selectedEventId, sliderIndex]);

  const currentSnapshot = snapshots[currentIndex];
  const previousSnapshot = currentIndex > 0 ? snapshots[currentIndex - 1] : undefined;

  // Compute changed paths
  const changedPaths = useMemo(() => {
    if (!currentSnapshot) return new Set<string>();
    return computeDiff(previousSnapshot?.state, currentSnapshot.state);
  }, [currentSnapshot, previousSnapshot]);

  // Handle slider change
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const idx = parseInt(e.target.value, 10);
      setSliderIndex(idx);
      if (onEventSelect && snapshots[idx]) {
        onEventSelect(snapshots[idx].eventId);
      }
    },
    [onEventSelect, snapshots]
  );

  if (snapshots.length === 0) {
    return (
      <div
        className="flex flex-col h-full bg-slate-900 p-3"
        role="region"
        aria-label="State Inspector"
      >
        <h3 className="text-white font-semibold mb-2">State Inspector</h3>
        <div
          className="flex-1 flex items-center justify-center text-gray-500 text-sm"
          role="status"
        >
          No state broadcasts yet
        </div>
      </div>
    );
  }

  const time = currentSnapshot
    ? new Date(currentSnapshot.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';

  return (
    <div className="flex flex-col h-full bg-slate-900" role="region" aria-label="State Inspector">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-slate-700">
        <h3 className="text-white font-semibold text-sm" id="state-inspector-heading">
          State Inspector
        </h3>
        <div className="flex items-center gap-2 text-xs" role="status" aria-live="polite">
          <span className="text-gray-400" aria-label="State version">
            v{currentSnapshot?.version ?? '-'}
          </span>
          <span className="text-gray-500" aria-label="Timestamp">
            {time}
          </span>
        </div>
      </div>

      {/* Slider for time travel */}
      <div className="px-3 py-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <label htmlFor="state-history-slider" className="text-gray-500 text-xs">
            History:
          </label>
          <input
            id="state-history-slider"
            type="range"
            min={0}
            max={snapshots.length - 1}
            value={currentIndex}
            onChange={handleSliderChange}
            aria-label={`State history navigation, showing version ${currentIndex + 1} of ${snapshots.length}`}
            aria-valuemin={1}
            aria-valuemax={snapshots.length}
            aria-valuenow={currentIndex + 1}
            className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-gray-400 text-xs font-mono w-12 text-right" aria-hidden="true">
            {currentIndex + 1}/{snapshots.length}
          </span>
        </div>
      </div>

      {/* State Tree */}
      <div className="flex-1 overflow-auto p-2" role="tree" aria-label="Application state tree">
        {currentSnapshot && (
          <JsonTree data={currentSnapshot.state} changedPaths={changedPaths} />
        )}
      </div>

      {/* Changed Fields Summary */}
      {changedPaths.size > 0 && (
        <div
          className="px-3 py-2 border-t border-slate-700 bg-slate-800/50"
          role="status"
          aria-live="polite"
        >
          <div className="text-xs text-amber-400">
            {changedPaths.size} field{changedPaths.size !== 1 ? 's' : ''} changed
          </div>
        </div>
      )}
    </div>
  );
}

/** Props for JsonTree component */
interface JsonTreeProps {
  data: unknown;
  changedPaths: Set<string>;
  path?: string;
  depth?: number;
}

/** Recursive JSON tree renderer with diff highlighting */
function JsonTree({ data, changedPaths, path = '', depth = 0 }: JsonTreeProps) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  const handleToggle = () => setCollapsed(!collapsed);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    } else if (e.key === 'ArrowRight' && collapsed) {
      e.preventDefault();
      setCollapsed(false);
    } else if (e.key === 'ArrowLeft' && !collapsed) {
      e.preventDefault();
      setCollapsed(true);
    }
  };

  if (data === null) {
    return <span className="text-gray-500" role="treeitem" aria-label="null value">null</span>;
  }

  if (data === undefined) {
    return <span className="text-gray-500" role="treeitem" aria-label="undefined value">undefined</span>;
  }

  if (typeof data === 'boolean') {
    return (
      <span className="text-purple-400" role="treeitem" aria-label={`boolean: ${data}`}>
        {data.toString()}
      </span>
    );
  }

  if (typeof data === 'number') {
    return (
      <span className="text-cyan-400" role="treeitem" aria-label={`number: ${data}`}>
        {data}
      </span>
    );
  }

  if (typeof data === 'string') {
    return (
      <span className="text-emerald-400" role="treeitem" aria-label={`string: ${data}`}>
        "{data}"
      </span>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-gray-500" role="treeitem" aria-label="empty array">[]</span>;
    }

    return (
      <div className="ml-3" role="treeitem" aria-expanded={!collapsed}>
        <span
          className="text-gray-500 cursor-pointer hover:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded px-0.5"
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="button"
          aria-label={`Array with ${data.length} items, ${collapsed ? 'collapsed' : 'expanded'}`}
        >
          {collapsed ? '▶' : '▼'} [{data.length}]
        </span>
        {!collapsed && (
          <div className="ml-2 border-l border-slate-700 pl-2" role="group">
            {data.map((item, idx) => {
              const itemPath = path ? `${path}[${idx}]` : `[${idx}]`;
              const isChanged = changedPaths.has(itemPath);
              return (
                <div
                  key={idx}
                  className={`${isChanged ? 'bg-amber-900/30 -mx-1 px-1 rounded' : ''}`}
                  aria-label={isChanged ? `Index ${idx}, changed` : `Index ${idx}`}
                >
                  <span className="text-gray-500 text-xs">{idx}: </span>
                  <JsonTree data={item} changedPaths={changedPaths} path={itemPath} depth={depth + 1} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) {
      return <span className="text-gray-500" role="treeitem" aria-label="empty object">{'{}'}</span>;
    }

    return (
      <div className={depth > 0 ? 'ml-3' : ''} role="treeitem" aria-expanded={!collapsed}>
        {depth > 0 && (
          <span
            className="text-gray-500 cursor-pointer hover:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded px-0.5"
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label={`Object with ${entries.length} properties, ${collapsed ? 'collapsed' : 'expanded'}`}
          >
            {collapsed ? '▶' : '▼'} {'{'}
            {entries.length}
            {'}'}
          </span>
        )}
        {(!collapsed || depth === 0) && (
          <div className={depth > 0 ? 'ml-2 border-l border-slate-700 pl-2' : ''} role="group">
            {entries.map(([key, value]) => {
              const keyPath = path ? `${path}.${key}` : key;
              const isChanged = changedPaths.has(keyPath);
              return (
                <div
                  key={key}
                  className={`${isChanged ? 'bg-amber-900/30 -mx-1 px-1 rounded' : ''}`}
                  aria-label={isChanged ? `Property ${key}, changed` : `Property ${key}`}
                >
                  <span className={`text-blue-400 ${isChanged ? 'font-semibold' : ''}`}>
                    {key}
                  </span>
                  <span className="text-gray-500" aria-hidden="true">: </span>
                  <JsonTree
                    data={value}
                    changedPaths={changedPaths}
                    path={keyPath}
                    depth={depth + 1}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-gray-400" role="treeitem">{String(data)}</span>;
}

