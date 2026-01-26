/**
 * useTraceEvents - Custom hook for subscribing to trace events
 *
 * Subscribes to trace events from the Main process via IPC.
 * Uses push-based updates for both events and stats (no polling).
 * Automatically cleans up subscriptions on unmount.
 *
 * Performance optimizations:
 * - Batches incoming events to limit UI updates to ~60fps
 * - Uses refs to avoid unnecessary re-renders
 * - Throttles state updates during high event volume
 *
 * @example
 * ```tsx
 * const { events, stats, isConnected, clearEvents } = useTraceEvents();
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TraceEvent, TraceStats, TraceEventType } from '@shared/trace-types';

/** Maximum events to keep in local buffer */
const LOCAL_BUFFER_SIZE = 500;

/** Rolling window for events per second calculation (ms) */
const ROLLING_WINDOW_MS = 10_000;

/** Minimum interval between state updates (ms) - targets ~60fps */
const UPDATE_THROTTLE_MS = 16;

/**
 * Filter options for trace events
 */
export interface TraceEventFilter {
  /** Filter by event types */
  types?: TraceEventType[];
  /** Filter by source */
  source?: string;
}

/**
 * Return type for the useTraceEvents hook
 */
export interface TraceEventsResult {
  /** Trace events in the local buffer */
  events: TraceEvent[];
  /** Current trace statistics from main process */
  stats: TraceStats | null;
  /** Whether connected to the trace event stream */
  isConnected: boolean;
  /** Clear the local event buffer */
  clearEvents: () => void;
  /** Current filter settings */
  filter: TraceEventFilter;
  /** Update filter settings */
  setFilter: (filter: TraceEventFilter) => void;
  /** Events per second (locally calculated) */
  eventsPerSecond: number;
}

/**
 * Custom hook that subscribes to trace events from the Main process.
 *
 * The hook automatically:
 * - Fetches trace history on mount
 * - Subscribes to new trace events
 * - Maintains a local circular buffer
 * - Computes derived statistics
 * - Unsubscribes on unmount
 */
export function useTraceEvents(): TraceEventsResult {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [stats, setStats] = useState<TraceStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [filter, setFilter] = useState<TraceEventFilter>({});
  const timestampsRef = useRef<number[]>([]);
  const [eventsPerSecond, setEventsPerSecond] = useState(0);

  // Throttling state for batched updates
  const pendingEventsRef = useRef<TraceEvent[]>([]);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Calculate events per second from recent timestamps
  const updateEventsPerSecond = useCallback(() => {
    const now = Date.now();
    const cutoff = now - ROLLING_WINDOW_MS;
    timestampsRef.current = timestampsRef.current.filter((t) => t > cutoff);
    const eps =
      timestampsRef.current.length > 0
        ? (timestampsRef.current.length / ROLLING_WINDOW_MS) * 1000
        : 0;
    setEventsPerSecond(eps);
  }, []);

  // Flush pending events to state (batched update)
  const flushPendingEvents = useCallback(() => {
    if (pendingEventsRef.current.length === 0) return;

    const eventsToAdd = pendingEventsRef.current;
    pendingEventsRef.current = [];
    lastUpdateRef.current = Date.now();
    throttleTimerRef.current = null;

    setEvents((prev) => {
      const updated = [...prev, ...eventsToAdd];
      if (updated.length > LOCAL_BUFFER_SIZE) {
        return updated.slice(-LOCAL_BUFFER_SIZE);
      }
      return updated;
    });
  }, []);

  // Add event to buffer with throttling for 60fps updates
  const addEvent = useCallback((event: TraceEvent) => {
    timestampsRef.current.push(event.timestamp);
    pendingEventsRef.current.push(event);

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    // If enough time has passed, flush immediately
    if (timeSinceLastUpdate >= UPDATE_THROTTLE_MS) {
      flushPendingEvents();
    } else if (!throttleTimerRef.current) {
      // Schedule a flush for the remaining time
      const delay = UPDATE_THROTTLE_MS - timeSinceLastUpdate;
      throttleTimerRef.current = setTimeout(flushPendingEvents, delay);
    }
  }, [flushPendingEvents]);

  // Clear events buffer
  const clearEvents = useCallback(() => {
    // Clear any pending throttled updates
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    pendingEventsRef.current = [];
    setEvents([]);
    timestampsRef.current = [];
    setEventsPerSecond(0);
  }, []);

  // Subscribe to trace events and stats (push-based)
  useEffect(() => {
    let mounted = true;

    // Fetch initial history
    window.electronAPI
      .getTraceHistory(LOCAL_BUFFER_SIZE)
      .then((history) => {
        if (mounted) {
          setEvents(history);
          timestampsRef.current = history.map((e) => e.timestamp);
          setIsConnected(true);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch trace history:', err);
      });

    // Fetch initial stats
    window.electronAPI
      .getTraceStats()
      .then((initialStats) => {
        if (mounted) {
          setStats(initialStats);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch initial trace stats:', err);
      });

    // Subscribe to new events (push-based)
    const unsubscribeEvents = window.electronAPI.onTraceEvent((event) => {
      if (mounted) {
        addEvent(event);
      }
    });

    // Subscribe to stats updates (push-based)
    const unsubscribeStats = window.electronAPI.onTraceStats((newStats) => {
      if (mounted) {
        setStats(newStats);
      }
    });

    // Update local events per second calculation
    const epsInterval = setInterval(updateEventsPerSecond, 500);

    return () => {
      mounted = false;
      unsubscribeEvents();
      unsubscribeStats();
      clearInterval(epsInterval);
      // Clean up throttle timer
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [addEvent, updateEventsPerSecond]);

  // Apply filter to events
  const filteredEvents = events.filter((event) => {
    if (filter.types && filter.types.length > 0 && !filter.types.includes(event.type)) {
      return false;
    }
    if (filter.source && event.source !== filter.source) {
      return false;
    }
    return true;
  });

  return {
    events: filteredEvents,
    stats,
    isConnected,
    clearEvents,
    filter,
    setFilter,
    eventsPerSecond,
  };
}

