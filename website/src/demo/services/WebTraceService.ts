/**
 * WebTraceService - Browser-compatible trace service for the web demo
 * 
 * Collects and distributes trace events for the Architecture Debug view.
 * Uses in-memory circular buffer and event emitter pattern.
 */

import type { TraceEvent, TraceEventType, TraceStats } from '../shared/types';

const BUFFER_SIZE = 500;
const STATS_WINDOW_MS = 10000; // 10 second window for events/sec calculation

type TraceListener = (event: TraceEvent) => void;
type StatsListener = (stats: TraceStats) => void;

class WebTraceService {
  private buffer: TraceEvent[] = [];
  private eventListeners: Set<TraceListener> = new Set();
  private statsListeners: Set<StatsListener> = new Set();
  private stateVersion = 0;
  private lastStatsBroadcast = 0;

  /**
   * Record a trace event
   */
  emit(
    type: TraceEventType,
    source: string,
    options: {
      target?: string;
      payload?: unknown;
      latencyMs?: number;
      correlationId?: string;
    } = {}
  ): string {
    const id = crypto.randomUUID();
    const event: TraceEvent = {
      id,
      timestamp: Date.now(),
      type,
      source,
      ...options,
    };

    // Add to circular buffer with batch trimming for better performance
    this.buffer.push(event);
    // Batch trim when buffer exceeds size by 10% to avoid frequent shifts
    if (this.buffer.length > BUFFER_SIZE * 1.1) {
      this.buffer = this.buffer.slice(-BUFFER_SIZE);
    }

    // Notify listeners
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Error in trace listener:', e);
      }
    }

    // Throttle stats broadcasts
    const now = Date.now();
    if (now - this.lastStatsBroadcast > 500) {
      this.broadcastStats();
    }

    return id;
  }

  /**
   * Subscribe to trace events
   */
  subscribe(listener: TraceListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Subscribe to stats updates
   */
  subscribeStats(listener: StatsListener): () => void {
    this.statsListeners.add(listener);
    return () => this.statsListeners.delete(listener);
  }

  /**
   * Get event history
   */
  getHistory(limit?: number): TraceEvent[] {
    if (limit && limit < this.buffer.length) {
      return this.buffer.slice(-limit);
    }
    return [...this.buffer];
  }

  /**
   * Update state version (called when state changes)
   */
  setStateVersion(version: number): void {
    this.stateVersion = version;
  }

  /**
   * Get current stats
   */
  getStats(): TraceStats {
    const now = Date.now();
    const windowStart = now - STATS_WINDOW_MS;
    const recentEvents = this.buffer.filter((e) => e.timestamp >= windowStart);

    // Calculate events per second from recent window
    const eventsPerSecond = recentEvents.length / (STATS_WINDOW_MS / 1000);

    // Calculate average latency and counts from recent window for consistency
    const latencyByType: Record<TraceEventType, number[]> = {
      command_received: [],
      command_processed: [],
      state_broadcast: [],
      ipc_send: [],
      payment_start: [],
      payment_complete: [],
      demo_action: [],
    };

    const countByType: Record<TraceEventType, number> = {
      command_received: 0,
      command_processed: 0,
      state_broadcast: 0,
      ipc_send: 0,
      payment_start: 0,
      payment_complete: 0,
      demo_action: 0,
    };

    // Use recentEvents for consistent stats within the same time window
    for (const event of recentEvents) {
      countByType[event.type]++;
      if (event.latencyMs !== undefined) {
        latencyByType[event.type].push(event.latencyMs);
      }
    }

    const averageLatencyByType: Record<TraceEventType, number> = {} as Record<TraceEventType, number>;
    for (const type of Object.keys(latencyByType) as TraceEventType[]) {
      const latencies = latencyByType[type];
      averageLatencyByType[type] = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;
    }

    return {
      totalEvents: this.buffer.length,
      eventsPerSecond,
      averageLatencyByType,
      eventCountByType: countByType,
      currentStateVersion: this.stateVersion,
      connectedWindowCount: this.eventListeners.size,
      calculatedAt: now,
    };
  }

  private broadcastStats(): void {
    this.lastStatsBroadcast = Date.now();
    const stats = this.getStats();
    for (const listener of this.statsListeners) {
      try {
        listener(stats);
      } catch (e) {
        console.error('Error in stats listener:', e);
      }
    }
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.buffer = [];
    this.broadcastStats();
  }
}

// Singleton instance
export const webTraceService = new WebTraceService();

