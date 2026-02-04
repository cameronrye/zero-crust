/**
 * StateInspector - State inspection panel for the web demo debugger
 *
 * Features:
 * - JSON tree view of current state
 * - Diff view showing changes between versions
 * - Highlighted changed fields
 */

import { useState, useMemo } from 'react';
import type { TraceEvent } from '../shared/types';

interface StateInspectorProps {
  events: TraceEvent[];
}

interface StateSnapshot {
  eventId: string;
  timestamp: number;
  version: number;
  state: Record<string, unknown>;
}

/** Safely extract a number from an unknown value */
function safeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

/** Check if value is a plain object */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractStateSnapshots(events: TraceEvent[]): StateSnapshot[] {
  return events
    .filter((e) => e.type === 'state_broadcast' && e.payload && isPlainObject(e.payload))
    .map((e) => {
      const payload = e.payload as Record<string, unknown>;
      return {
        eventId: e.id,
        timestamp: e.timestamp,
        version: safeNumber(payload.version, 0),
        state: payload,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

function computeDiff(
  prev: Record<string, unknown> | undefined,
  curr: Record<string, unknown>,
  path = ''
): Set<string> {
  const changes = new Set<string>();

  if (!prev) {
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

export function StateInspector({ events }: Readonly<StateInspectorProps>) {
  const snapshots = useMemo(() => extractStateSnapshots(events), [events]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const currentIndex = selectedIndex ?? (snapshots.length - 1);
  const currentSnapshot = snapshots[currentIndex];
  const previousSnapshot = currentIndex > 0 ? snapshots[currentIndex - 1] : undefined;

  const changedPaths = useMemo(() => {
    if (!currentSnapshot) return new Set<string>();
    return computeDiff(previousSnapshot?.state, currentSnapshot.state);
  }, [currentSnapshot, previousSnapshot]);

  if (snapshots.length === 0) {
    return (
      <div className="h-full flex flex-col bg-slate-900 p-2 md:p-3">
        <h3 className="text-white font-semibold text-xs md:text-sm mb-2">State</h3>
        <div className="flex-1 flex items-center justify-center text-gray-500 text-[10px] md:text-xs">
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
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-1.5 md:p-2 border-b border-slate-700">
        <h3 className="text-white font-semibold text-xs md:text-sm">State</h3>
        <div className="flex items-center gap-1 md:gap-2 text-[10px] md:text-xs">
          <span className="text-gray-400">v{currentSnapshot?.version ?? '-'}</span>
          <span className="text-gray-500 hidden sm:inline">{time}</span>
        </div>
      </div>

      {/* Slider */}
      <div className="px-2 md:px-3 py-1.5 md:py-2 border-b border-slate-700">
        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="text-gray-500 text-[10px] md:text-xs hidden sm:inline">History:</span>
          <input
            type="range"
            min={0}
            max={snapshots.length - 1}
            value={currentIndex}
            onChange={(e) => setSelectedIndex(Number.parseInt(e.target.value, 10))}
            className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <span className="text-gray-400 text-[10px] md:text-xs font-mono w-10 md:w-12 text-right">
            {currentIndex + 1}/{snapshots.length}
          </span>
        </div>
      </div>

      {/* State Tree */}
      <div className="flex-1 overflow-auto p-1.5 md:p-2 text-[10px] md:text-xs font-mono">
        {currentSnapshot && (
          <JsonTree data={currentSnapshot.state} changedPaths={changedPaths} />
        )}
      </div>

      {/* Changed Fields */}
      {changedPaths.size > 0 && (
        <div className="px-2 md:px-3 py-1.5 md:py-2 border-t border-slate-700 bg-slate-800/50">
          <div className="text-[10px] md:text-xs text-amber-400">
            {changedPaths.size} changed
          </div>
        </div>
      )}
    </div>
  );
}

interface JsonTreeProps {
  data: unknown;
  changedPaths: Set<string>;
  path?: string;
  depth?: number;
}

function JsonTree({ data, changedPaths, path = '', depth = 0 }: Readonly<JsonTreeProps>) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  if (data === null) return <span className="text-gray-500">null</span>;
  if (data === undefined) return <span className="text-gray-500">undefined</span>;
  if (typeof data === 'boolean') return <span className="text-purple-400">{String(data)}</span>;
  if (typeof data === 'number') return <span className="text-cyan-400">{data}</span>;
  if (typeof data === 'string') return <span className="text-emerald-400">&quot;{data}&quot;</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-500">[]</span>;

    return (
      <div className="ml-3">
        <span
          className="text-gray-500 cursor-pointer hover:text-gray-300"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? '▶' : '▼'} [{data.length}]
        </span>
        {!collapsed && (
          <div className="ml-2 border-l border-slate-700 pl-2">
            {data.map((item, idx) => {
              const itemPath = path ? `${path}[${idx}]` : `[${idx}]`;
              const isChanged = changedPaths.has(itemPath);
              return (
                <div key={idx} className={isChanged ? 'bg-amber-900/30 -mx-1 px-1 rounded' : ''}>
                  <span className="text-gray-500">{idx}: </span>
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
    if (entries.length === 0) return <span className="text-gray-500">{'{}'}</span>;

    return (
      <div className={depth > 0 ? 'ml-3' : ''}>
        {depth > 0 && (
          <span
            className="text-gray-500 cursor-pointer hover:text-gray-300"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? '▶' : '▼'} {'{'}
            {entries.length}
            {'}'}
          </span>
        )}
        {(!collapsed || depth === 0) && (
          <div className={depth > 0 ? 'ml-2 border-l border-slate-700 pl-2' : ''}>
            {entries.map(([key, value]) => {
              const keyPath = path ? `${path}.${key}` : key;
              const isChanged = changedPaths.has(keyPath);
              return (
                <div key={key} className={isChanged ? 'bg-amber-900/30 -mx-1 px-1 rounded' : ''}>
                  <span className={`text-blue-400 ${isChanged ? 'font-semibold' : ''}`}>{key}</span>
                  <span className="text-gray-500">: </span>
                  <JsonTree data={value} changedPaths={changedPaths} path={keyPath} depth={depth + 1} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-gray-400">{String(data)}</span>;
}
