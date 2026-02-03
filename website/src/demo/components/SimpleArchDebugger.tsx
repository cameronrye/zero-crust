/**
 * SimpleArchDebugger - Enhanced architecture debugger for the web demo
 *
 * Features:
 * - Event type filtering
 * - Expandable payload inspection
 * - Latency display
 * - Correlation indicators
 * - Event counts by type
 * - Average latency by type
 * - Smart payload summaries
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { TraceEvent, TraceStats, TraceEventType } from '../shared/types';

const FILTER_STORAGE_KEY = 'zeroCrust_debuggerFilters';

const EVENT_TYPE_CONFIG: Record<TraceEventType, { label: string; color: string; bgColor: string }> = {
  command_received: { label: 'CMD RECV', color: 'text-blue-400', bgColor: 'bg-blue-400/20' },
  command_processed: { label: 'CMD PROC', color: 'text-cyan-400', bgColor: 'bg-cyan-400/20' },
  state_broadcast: { label: 'BROADCAST', color: 'text-emerald-400', bgColor: 'bg-emerald-400/20' },
  ipc_send: { label: 'IPC SEND', color: 'text-amber-400', bgColor: 'bg-amber-400/20' },
  payment_start: { label: 'PAY START', color: 'text-purple-400', bgColor: 'bg-purple-400/20' },
  payment_complete: { label: 'PAY DONE', color: 'text-pink-400', bgColor: 'bg-pink-400/20' },
  demo_action: { label: 'DEMO', color: 'text-rose-400', bgColor: 'bg-rose-400/20' },
};

const ALL_EVENT_TYPES: TraceEventType[] = [
  'command_received',
  'command_processed',
  'state_broadcast',
  'ipc_send',
  'payment_start',
  'payment_complete',
  'demo_action',
];

interface SimpleArchDebuggerProps {
  events: TraceEvent[];
  stats: TraceStats | null;
  isConnected: boolean;
  onClear: () => void;
}

/** Safely check if value is a plain object (not array, null, or primitive) */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Format a payload into a human-readable summary */
function formatPayloadSummary(event: TraceEvent): string {
  const payload = event.payload;
  if (!payload || !isPlainObject(payload)) return '';

  // Command events
  if (payload.commandType) {
    return String(payload.commandType);
  }

  // State broadcasts
  if (payload.version !== undefined && payload.cartSize !== undefined) {
    return `v${payload.version} (${payload.cartSize} items)`;
  }

  // Payment events
  if (payload.transactionId) {
    const amount = payload.amount || payload.amountInCents;
    if (amount) {
      return `${payload.transactionId} $${(Number(amount) / 100).toFixed(2)}`;
    }
    return String(payload.transactionId);
  }

  // Demo actions
  if (payload.action) {
    return payload.detail ? `${payload.action}: ${payload.detail}` : String(payload.action);
  }

  // Generic fallback
  const keys = Object.keys(payload);
  if (keys.length === 0) return '';
  if (keys.length === 1) return String(payload[keys[0]]);
  return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
}

/** Load filter settings from localStorage */
function loadFilterSettings(): Set<TraceEventType> {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed)) {
        const validTypes = parsed.filter((t): t is TraceEventType =>
          ALL_EVENT_TYPES.includes(t as TraceEventType)
        );
        if (validTypes.length > 0) {
          return new Set(validTypes);
        }
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return new Set(ALL_EVENT_TYPES);
}

/** Save filter settings to localStorage */
function saveFilterSettings(types: Set<TraceEventType>): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify([...types]));
  } catch {
    // Ignore localStorage errors
  }
}

export function SimpleArchDebugger({ events, stats, isConnected, onClear }: SimpleArchDebuggerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [enabledTypes, setEnabledTypes] = useState<Set<TraceEventType>>(() => loadFilterSettings());
  const [showStats, setShowStats] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter events by enabled types
  const filteredEvents = useMemo(() => {
    return events.filter((e) => enabledTypes.has(e.type)).slice(-200);
  }, [events, enabledTypes]);

  // Calculate stats by type
  const statsByType = useMemo(() => {
    const counts: Record<TraceEventType, number> = {} as Record<TraceEventType, number>;
    const latencies: Record<TraceEventType, number[]> = {} as Record<TraceEventType, number[]>;

    for (const type of ALL_EVENT_TYPES) {
      counts[type] = 0;
      latencies[type] = [];
    }

    for (const event of events) {
      counts[event.type]++;
      if (event.latencyMs !== undefined) {
        latencies[event.type].push(event.latencyMs);
      }
    }

    const avgLatencies: Record<TraceEventType, number | null> = {} as Record<TraceEventType, number | null>;
    for (const type of ALL_EVENT_TYPES) {
      const arr = latencies[type];
      avgLatencies[type] = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    }

    return { counts, avgLatencies };
  }, [events]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredEvents.length, autoScroll]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return (
      date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) +
      '.' +
      String(date.getMilliseconds()).padStart(3, '0')
    );
  };

  const toggleType = useCallback((type: TraceEventType) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      saveFilterSettings(next);
      return next;
    });
  }, []);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const enableAll = useCallback(() => {
    const allTypes = new Set(ALL_EVENT_TYPES);
    setEnabledTypes(allTypes);
    saveFilterSettings(allTypes);
  }, []);

  const disableAll = useCallback(() => {
    const noTypes = new Set<TraceEventType>();
    setEnabledTypes(noTypes);
    saveFilterSettings(noTypes);
  }, []);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm">Debugger</h3>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-gray-400 text-xs">{isConnected ? 'Live' : 'Disconnected'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">
            {filteredEvents.length}/{events.length} events
          </span>
          <button
            onClick={() => setShowStats(!showStats)}
            className={`px-2 py-0.5 rounded text-xs ${showStats ? 'bg-purple-600 text-white' : 'bg-slate-700 text-gray-400'}`}
          >
            Stats
          </button>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-0.5 rounded text-xs ${autoScroll ? 'bg-amber-600 text-white' : 'bg-slate-700 text-gray-400'}`}
          >
            {autoScroll ? 'Auto-scroll' : 'Manual'}
          </button>
          <button
            onClick={onClear}
            className="px-2 py-0.5 rounded text-xs bg-slate-700 hover:bg-slate-600 text-gray-300"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-700 text-xs shrink-0 flex-wrap">
        <span className="text-gray-500 mr-1">Filter:</span>
        {ALL_EVENT_TYPES.map((type) => {
          const config = EVENT_TYPE_CONFIG[type];
          const isEnabled = enabledTypes.has(type);
          const count = statsByType.counts[type];
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-2 py-0.5 rounded transition-colors ${
                isEnabled ? `${config.bgColor} ${config.color}` : 'bg-slate-800 text-gray-600'
              }`}
            >
              {config.label}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
        <div className="flex-1" />
        <button onClick={enableAll} className="px-1.5 py-0.5 rounded text-gray-500 hover:text-gray-300">
          All
        </button>
        <button onClick={disableAll} className="px-1.5 py-0.5 rounded text-gray-500 hover:text-gray-300">
          None
        </button>
      </div>

      {/* Stats Panel (collapsible) */}
      {showStats && (
        <div className="px-3 py-2 border-b border-slate-700 text-xs shrink-0 bg-slate-900/50">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Total Events:</span>
              <span className="text-blue-400 font-mono">{stats?.totalEvents ?? events.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">State Version:</span>
              <span className="text-amber-400 font-mono">{stats?.currentStateVersion ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Events/sec:</span>
              <span className="text-emerald-400 font-mono">{stats?.eventsPerSecond?.toFixed(1) ?? '0.0'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Windows:</span>
              <span className="text-purple-400 font-mono">{stats?.connectedWindowCount ?? 0}</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700">
            <div className="text-gray-500 mb-1">Average Latency by Type:</div>
            <div className="grid grid-cols-4 gap-1">
              {ALL_EVENT_TYPES.map((type) => {
                const config = EVENT_TYPE_CONFIG[type];
                const avg = statsByType.avgLatencies[type];
                if (avg === null) return null;
                return (
                  <div key={type} className="flex items-center gap-1">
                    <span className={`${config.color} text-[10px]`}>{config.label}:</span>
                    <span className="text-gray-300 font-mono">{avg.toFixed(0)}ms</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Event Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 font-mono text-xs">
        {filteredEvents.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            {events.length === 0
              ? 'No events yet. Interact with the demo to see trace events.'
              : 'No events match the current filter.'}
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredEvents.map((event) => {
              const config = EVENT_TYPE_CONFIG[event.type];
              const isExpanded = expandedIds.has(event.id);
              const hasCorrelation = !!event.correlationId;
              const summary = formatPayloadSummary(event);

              return (
                <div key={event.id}>
                  <div
                    onClick={() => event.payload && toggleExpanded(event.id)}
                    className={`flex items-start gap-2 py-1 px-2 rounded hover:bg-slate-800/50 ${
                      event.payload ? 'cursor-pointer' : ''
                    } ${isExpanded ? 'bg-slate-800/30' : ''}`}
                  >
                    {/* Expand indicator */}
                    <span className="text-gray-600 w-3 shrink-0">
                      {event.payload ? (isExpanded ? '▼' : '▶') : ''}
                    </span>

                    {/* Timestamp */}
                    <span className="text-gray-500 shrink-0">{formatTime(event.timestamp)}</span>

                    {/* Event type */}
                    <span className={`${config.color} shrink-0 w-20`}>{config.label}</span>

                    {/* Source → Target */}
                    <span className="text-gray-400 shrink-0 w-16 truncate">{event.source}</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-gray-400 shrink-0 w-16 truncate">{event.target || 'all'}</span>

                    {/* Correlation indicator */}
                    {hasCorrelation && <span className="text-amber-500 shrink-0" title={`Correlation: ${event.correlationId}`}>⟲</span>}

                    {/* Latency */}
                    {event.latencyMs !== undefined && (
                      <span className="text-cyan-500 shrink-0 w-12 text-right">{event.latencyMs}ms</span>
                    )}

                    {/* Payload summary */}
                    {summary && (
                      <span className="text-gray-500 truncate flex-1" title={summary}>
                        {summary}
                      </span>
                    )}
                  </div>

                  {/* Expanded payload */}
                  {isExpanded && event.payload != null && (
                    <div className="ml-8 mr-2 mb-2 p-2 bg-slate-900 rounded border border-slate-700 overflow-x-auto">
                      <pre className="text-[10px] text-gray-300 whitespace-pre-wrap break-all">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
