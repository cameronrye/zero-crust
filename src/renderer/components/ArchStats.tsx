/**
 * ArchStats - Live statistics panel for the Architecture Debug Window
 *
 * Displays:
 * - Events per second (rolling 10s window)
 * - Average latency by event type
 * - Current state version
 * - Active window count
 */

import type { TraceStats, TraceEventType } from '@shared/trace-types';

interface ArchStatsProps {
  stats: TraceStats | null;
  eventsPerSecond: number;
  isConnected: boolean;
  onClear: () => void;
}

/** Event type display configuration */
const EVENT_TYPE_CONFIG: Record<TraceEventType, { label: string; color: string }> = {
  command_received: { label: 'Cmd Recv', color: 'text-blue-400' },
  command_processed: { label: 'Cmd Proc', color: 'text-cyan-400' },
  state_broadcast: { label: 'Broadcast', color: 'text-emerald-400' },
  ipc_send: { label: 'IPC Send', color: 'text-amber-400' },
  payment_start: { label: 'Pay Start', color: 'text-purple-400' },
  payment_complete: { label: 'Pay Done', color: 'text-pink-400' },
  demo_action: { label: 'Demo', color: 'text-rose-400' },
};

export function ArchStats({ stats, eventsPerSecond, isConnected, onClear }: ArchStatsProps) {
  return (
    <div
      className="flex flex-col h-full bg-slate-900 border-l border-slate-700 p-3 text-sm"
      role="region"
      aria-label="Statistics Panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold" id="stats-heading">
          Statistics
        </h3>
        <div className="flex items-center gap-2" role="status" aria-live="polite">
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`}
            aria-hidden="true"
          />
          <span className="text-gray-400 text-xs">
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="space-y-3 mb-4">
        <StatItem
          label="Events/sec"
          value={eventsPerSecond.toFixed(1)}
          valueColor="text-emerald-400"
        />
        <StatItem
          label="Total Events"
          value={stats?.totalEvents.toString() ?? '-'}
          valueColor="text-blue-400"
        />
        <StatItem
          label="State Version"
          value={stats?.currentStateVersion.toString() ?? '-'}
          valueColor="text-amber-400"
        />
        <StatItem
          label="Windows"
          value={stats?.connectedWindowCount.toString() ?? '-'}
          valueColor="text-purple-400"
        />
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700 my-3" />

      {/* Event Counts */}
      <div className="flex-1 overflow-y-auto">
        <h4 className="text-gray-400 text-xs uppercase mb-2">Event Counts</h4>
        <div className="space-y-1">
          {(Object.keys(EVENT_TYPE_CONFIG) as TraceEventType[]).map((type) => {
            const config = EVENT_TYPE_CONFIG[type];
            const count = stats?.eventCountByType[type] ?? 0;
            return (
              <div key={type} className="flex items-center justify-between">
                <span className={`${config.color} text-xs`}>{config.label}</span>
                <span className="text-gray-300 font-mono text-xs">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Average Latency */}
        <h4 className="text-gray-400 text-xs uppercase mt-4 mb-2">Avg Latency (ms)</h4>
        <div className="space-y-1">
          {(Object.keys(EVENT_TYPE_CONFIG) as TraceEventType[]).map((type) => {
            const config = EVENT_TYPE_CONFIG[type];
            const latency = stats?.averageLatencyByType[type] ?? 0;
            if (latency === 0) return null;
            return (
              <div key={type} className="flex items-center justify-between">
                <span className={`${config.color} text-xs`}>{config.label}</span>
                <span className="text-gray-300 font-mono text-xs">{latency.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clear Button */}
      <button
        onClick={onClear}
        aria-label="Clear all trace events from the buffer"
        className="mt-3 w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-300 rounded text-xs font-medium transition-colors"
      >
        Clear Events
      </button>
    </div>
  );
}

/** Individual stat display item */
function StatItem({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div className="flex items-center justify-between" role="group" aria-label={label}>
      <span className="text-gray-400" id={`stat-${label.replace(/\s+/g, '-').toLowerCase()}`}>
        {label}
      </span>
      <span
        className={`${valueColor} font-mono font-medium`}
        aria-labelledby={`stat-${label.replace(/\s+/g, '-').toLowerCase()}`}
      >
        {value}
      </span>
    </div>
  );
}

