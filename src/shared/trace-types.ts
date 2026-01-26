/**
 * Trace Types - Shared type definitions for architecture debug tracing
 *
 * These types are used by TraceService in the main process and
 * the Architecture Debug Window in the renderer.
 */

/**
 * Event types that can be traced
 */
export type TraceEventType =
  | 'command_received'
  | 'command_processed'
  | 'state_broadcast'
  | 'ipc_send'
  | 'payment_start'
  | 'payment_complete'
  | 'demo_action';

/**
 * A single trace event
 */
export interface TraceEvent {
  /** Unique identifier for this event */
  id: string;
  /** Links related events (e.g., command_received -> command_processed) */
  correlationId?: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Type of event */
  type: TraceEventType;
  /** Source of the event (e.g., 'cashier', 'main', 'customer') */
  source: string;
  /** Target of the event (e.g., window ID or 'all') */
  target?: string;
  /** Event-specific payload data */
  payload?: unknown;
  /** Processing duration in milliseconds */
  latencyMs?: number;
}

/**
 * Aggregated trace statistics
 */
export interface TraceStats {
  /** Total events in the buffer */
  totalEvents: number;
  /** Events per second (rolling 10s window) */
  eventsPerSecond: number;
  /** Average latency by event type */
  averageLatencyByType: Record<TraceEventType, number>;
  /** Event count by type */
  eventCountByType: Record<TraceEventType, number>;
  /** Current state version */
  currentStateVersion: number;
  /** Number of connected windows */
  connectedWindowCount: number;
  /** Timestamp of stats calculation */
  calculatedAt: number;
}

/**
 * Options for fetching trace history
 */
export interface TraceHistoryOptions {
  /** Maximum number of events to return (default: all) */
  limit?: number;
  /** Filter by event types */
  types?: TraceEventType[];
  /** Filter by source */
  source?: string;
  /** Events after this timestamp */
  after?: number;
}

