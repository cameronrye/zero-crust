/**
 * TraceService - Collects and distributes trace events for the Debugger Window
 *
 * Design principles:
 * - Lazy activation: Only serializes/buffers when there are active subscribers
 * - Non-blocking: Errors are logged but never thrown
 * - Memory bounded: Circular buffer prevents unbounded growth
 * - Event correlation: Related events linked via correlationId
 */

import { createLogger } from './Logger';
import { windowManager } from './WindowManager';
import { mainStore } from './MainStore';
import { IPC_CHANNELS } from '@shared/ipc-types';
import type {
  TraceEvent,
  TraceEventType,
  TraceStats,
  TraceHistoryOptions,
} from '@shared/trace-types';

const logger = createLogger('TraceService');

/** Default maximum events to keep in buffer */
const DEFAULT_BUFFER_SIZE = 1000;

/** Window for calculating events per second (ms) */
const ROLLING_WINDOW_MS = 10_000;

/** Minimum interval between stats broadcasts (ms) - prevents flooding */
const STATS_BROADCAST_THROTTLE_MS = 500;

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a correlation ID for linking related events
 */
export function generateCorrelationId(): string {
  return `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type TraceEventListener = (event: TraceEvent) => void;

class TraceService {
  private buffer: TraceEvent[] = [];
  private bufferSize: number;
  private listeners: Set<TraceEventListener> = new Set();
  private recentTimestamps: number[] = [];
  private lastStatsBroadcast: number = 0;
  private pendingStatsBroadcast: ReturnType<typeof setTimeout> | null = null;

  constructor(bufferSize: number = DEFAULT_BUFFER_SIZE) {
    this.bufferSize = bufferSize;
    logger.info('TraceService initialized', { bufferSize });
  }

  /**
   * Check if there are any active listeners
   * When no listeners, trace events are ignored (lazy activation)
   */
  hasListeners(): boolean {
    return this.listeners.size > 0;
  }

  /**
   * Subscribe to trace events
   * Returns an unsubscribe function
   */
  subscribe(listener: TraceEventListener): () => void {
    this.listeners.add(listener);
    logger.debug('Trace listener subscribed', { listenerCount: this.listeners.size });

    return () => {
      this.listeners.delete(listener);
      logger.debug('Trace listener unsubscribed', { listenerCount: this.listeners.size });
    };
  }

  /**
   * Emit a trace event
   * Only processes if there are active listeners (lazy activation)
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
  ): void {
    // Lazy activation: skip if no listeners
    if (!this.hasListeners()) {
      return;
    }

    try {
      const event: TraceEvent = {
        id: generateEventId(),
        timestamp: Date.now(),
        type,
        source,
        ...options,
      };

      // Add to circular buffer
      this.buffer.push(event);
      if (this.buffer.length > this.bufferSize) {
        this.buffer.shift();
      }

      // Track timestamp for rate calculation
      this.recentTimestamps.push(event.timestamp);
      this.pruneRecentTimestamps();

      // Notify listeners
      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch (error) {
          // Non-blocking: log but don't throw
          logger.warn('Trace listener error', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Broadcast stats update (throttled)
      this.scheduleBroadcastStats();
    } catch (error) {
      // Non-blocking: log but don't throw
      logger.warn('Trace emit error', {
        error: error instanceof Error ? error.message : String(error),
        type,
        source,
      });
    }
  }

  /**
   * Get trace event history
   */
  getHistory(options: TraceHistoryOptions = {}): TraceEvent[] {
    let events = [...this.buffer];

    // Apply filters
    if (options.types && options.types.length > 0) {
      events = events.filter((e) => options.types!.includes(e.type));
    }
    if (options.source) {
      events = events.filter((e) => e.source === options.source);
    }
    if (options.after) {
      events = events.filter((e) => e.timestamp > options.after!);
    }

    // Apply limit (return most recent)
    if (options.limit && options.limit < events.length) {
      events = events.slice(-options.limit);
    }

    return events;
  }

  /**
   * Get aggregated trace statistics
   */
  getStats(): TraceStats {
    this.pruneRecentTimestamps();

    // Calculate events per second
    const eventsPerSecond =
      this.recentTimestamps.length > 0
        ? (this.recentTimestamps.length / ROLLING_WINDOW_MS) * 1000
        : 0;

    // Calculate averages and counts by type
    const eventTypes: TraceEventType[] = [
      'command_received',
      'command_processed',
      'state_broadcast',
      'ipc_send',
      'payment_start',
      'payment_complete',
      'demo_action',
    ];

    const averageLatencyByType = {} as Record<TraceEventType, number>;
    const eventCountByType = {} as Record<TraceEventType, number>;

    for (const type of eventTypes) {
      const eventsOfType = this.buffer.filter((e) => e.type === type);
      eventCountByType[type] = eventsOfType.length;

      const eventsWithLatency = eventsOfType.filter((e) => e.latencyMs !== undefined);
      if (eventsWithLatency.length > 0) {
        const totalLatency = eventsWithLatency.reduce((sum, e) => sum + (e.latencyMs || 0), 0);
        averageLatencyByType[type] = totalLatency / eventsWithLatency.length;
      } else {
        averageLatencyByType[type] = 0;
      }
    }

    return {
      totalEvents: this.buffer.length,
      eventsPerSecond,
      averageLatencyByType,
      eventCountByType,
      currentStateVersion: mainStore.getState().version,
      connectedWindowCount: windowManager.getAllWindows().size,
      calculatedAt: Date.now(),
    };
  }

  /**
   * Clear all events from the buffer
   */
  clear(): void {
    this.buffer = [];
    this.recentTimestamps = [];
    logger.info('Trace buffer cleared');
  }

  /**
   * Prune timestamps outside the rolling window
   */
  private pruneRecentTimestamps(): void {
    const cutoff = Date.now() - ROLLING_WINDOW_MS;
    this.recentTimestamps = this.recentTimestamps.filter((t) => t > cutoff);
  }

  /**
   * Schedule a throttled stats broadcast
   * Ensures stats are broadcast at most once per STATS_BROADCAST_THROTTLE_MS
   */
  private scheduleBroadcastStats(): void {
    const now = Date.now();
    const timeSinceLastBroadcast = now - this.lastStatsBroadcast;

    if (timeSinceLastBroadcast >= STATS_BROADCAST_THROTTLE_MS) {
      // Enough time has passed, broadcast immediately
      this.broadcastStats();
    } else if (!this.pendingStatsBroadcast) {
      // Schedule a broadcast for later
      const delay = STATS_BROADCAST_THROTTLE_MS - timeSinceLastBroadcast;
      this.pendingStatsBroadcast = setTimeout(() => {
        this.pendingStatsBroadcast = null;
        this.broadcastStats();
      }, delay);
    }
    // If there's already a pending broadcast, do nothing
  }

  /**
   * Broadcast current stats to the Debugger window
   */
  private broadcastStats(): void {
    this.lastStatsBroadcast = Date.now();
    const debuggerWindow = windowManager.getWindow('debugger');
    if (debuggerWindow && !debuggerWindow.isDestroyed()) {
      const stats = this.getStats();
      debuggerWindow.webContents.send(IPC_CHANNELS.TRACE_STATS_UPDATE, stats);
    }
  }

  /**
   * Dispose of the TraceService and clean up resources.
   *
   * Clears any pending timeouts to prevent errors during shutdown.
   * Should be called when the application is quitting.
   */
  dispose(): void {
    if (this.pendingStatsBroadcast) {
      clearTimeout(this.pendingStatsBroadcast);
      this.pendingStatsBroadcast = null;
    }
    this.listeners.clear();
    logger.info('TraceService disposed');
  }
}

// Singleton instance
export const traceService = new TraceService();

/**
 * Broadcast trace events to the Debugger window
 * Called by IpcHandlers when setting up the trace event stream
 */
export function initializeTraceEventBroadcast(): void {
  traceService.subscribe((event) => {
    // Broadcast to debugger window only
    const debuggerWindow = windowManager.getWindow('debugger');
    if (debuggerWindow && !debuggerWindow.isDestroyed()) {
      debuggerWindow.webContents.send(IPC_CHANNELS.TRACE_EVENT, event);
    }
  });
  logger.info('Trace event broadcast initialized');
}

