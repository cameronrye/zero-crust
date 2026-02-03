/**
 * useTraceEvents - Custom hook for subscribing to trace events (Web version)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TraceEvent, TraceStats } from '../shared/types';
import { useElectronAPI } from '../context/WebAPIContext';

const LOCAL_BUFFER_SIZE = 200;
const UPDATE_THROTTLE_MS = 16; // ~60fps

export interface TraceEventsResult {
  events: TraceEvent[];
  stats: TraceStats | null;
  isConnected: boolean;
  clearEvents: () => void;
  eventsPerSecond: number;
}

export function useTraceEvents(): TraceEventsResult {
  const api = useElectronAPI();
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [stats, setStats] = useState<TraceStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const timestampsRef = useRef<number[]>([]);
  const [eventsPerSecond, setEventsPerSecond] = useState(0);

  const pendingEventsRef = useRef<TraceEvent[]>([]);
  const lastUpdateRef = useRef<number>(0);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingEvents = useCallback(() => {
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }

    if (pendingEventsRef.current.length === 0) return;

    const newEvents = pendingEventsRef.current;
    pendingEventsRef.current = [];
    lastUpdateRef.current = Date.now();

    setEvents((prev) => {
      const combined = [...prev, ...newEvents];
      return combined.slice(-LOCAL_BUFFER_SIZE);
    });
  }, []);

  const addEvent = useCallback((event: TraceEvent) => {
    timestampsRef.current.push(event.timestamp);
    pendingEventsRef.current.push(event);

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (timeSinceLastUpdate >= UPDATE_THROTTLE_MS) {
      flushPendingEvents();
    } else if (!throttleTimerRef.current) {
      const delay = UPDATE_THROTTLE_MS - timeSinceLastUpdate;
      throttleTimerRef.current = setTimeout(flushPendingEvents, delay);
    }
  }, [flushPendingEvents]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    timestampsRef.current = [];
    pendingEventsRef.current = [];
  }, []);

  // Calculate events per second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const tenSecondsAgo = now - 10000;
      timestampsRef.current = timestampsRef.current.filter((t) => t > tenSecondsAgo);
      setEventsPerSecond(timestampsRef.current.length / 10);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Subscribe to trace events and stats
  useEffect(() => {
    let mounted = true;
    let unsubscribeEvents: (() => void) | null = null;
    let unsubscribeStats: (() => void) | null = null;

    // Initialize subscriptions first, then fetch history
    // This prevents race condition where events arrive before history is loaded
    const initializeSubscriptions = async () => {
      // Set up listeners before fetching data
      unsubscribeEvents = api.onTraceEvent((event) => {
        if (mounted) {
          addEvent(event);
        }
      });

      unsubscribeStats = api.onTraceStats((newStats) => {
        if (mounted) {
          setStats(newStats);
        }
      });

      // Now fetch initial data
      try {
        const [history, initialStats] = await Promise.all([
          api.getTraceHistory(LOCAL_BUFFER_SIZE),
          api.getTraceStats(),
        ]);

        if (mounted) {
          setEvents(history);
          timestampsRef.current = history.map((e) => e.timestamp);
          setStats(initialStats);
          setIsConnected(true);
        }
      } catch (err) {
        console.error('Failed to fetch initial trace data:', err);
        // Still mark as connected if subscriptions are active
        if (mounted) {
          setIsConnected(true);
        }
      }
    };

    initializeSubscriptions();

    return () => {
      mounted = false;
      if (unsubscribeEvents) unsubscribeEvents();
      if (unsubscribeStats) unsubscribeStats();
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      // Clear pending events on unmount (they can't be rendered anyway)
      pendingEventsRef.current = [];
      // Clear timestamps to prevent stale data on remount
      timestampsRef.current = [];
    };
  }, [api, addEvent]);

  return {
    events,
    stats,
    isConnected,
    clearEvents,
    eventsPerSecond,
  };
}

