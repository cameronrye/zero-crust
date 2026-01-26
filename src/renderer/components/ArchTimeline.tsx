/**
 * ArchTimeline - Virtualized event timeline for the Architecture Debug Window
 *
 * Features:
 * - Virtualized scrolling for performance
 * - Color-coded by event type
 * - Expandable rows for payload inspection
 * - Filter controls by type/source
 */
'use no memo'; // Opt-out of React Compiler due to @tanstack/react-virtual incompatibility

import { useRef, useState, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { TraceEvent, TraceEventType } from '@shared/trace-types';
import type { TraceEventFilter } from '../hooks/useTraceEvents';

interface ArchTimelineProps {
  events: TraceEvent[];
  filter: TraceEventFilter;
  onFilterChange: (filter: TraceEventFilter) => void;
  /** Currently selected event ID for state inspection */
  selectedEventId?: string;
  /** Callback when an event is selected for inspection */
  onEventSelect?: (eventId: string | undefined) => void;
}

/** Event type display configuration */
const EVENT_TYPE_CONFIG: Record<TraceEventType, { label: string; bgColor: string; textColor: string }> = {
  command_received: { label: 'CMD RECV', bgColor: 'bg-blue-900/50', textColor: 'text-blue-400' },
  command_processed: { label: 'CMD PROC', bgColor: 'bg-cyan-900/50', textColor: 'text-cyan-400' },
  state_broadcast: { label: 'BROADCAST', bgColor: 'bg-emerald-900/50', textColor: 'text-emerald-400' },
  ipc_send: { label: 'IPC SEND', bgColor: 'bg-amber-900/50', textColor: 'text-amber-400' },
  payment_start: { label: 'PAY START', bgColor: 'bg-purple-900/50', textColor: 'text-purple-400' },
  payment_complete: { label: 'PAY DONE', bgColor: 'bg-pink-900/50', textColor: 'text-pink-400' },
  demo_action: { label: 'DEMO', bgColor: 'bg-rose-900/50', textColor: 'text-rose-400' },
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

/** Extract inline summary from event payload based on event type */
function getPayloadSummary(event: TraceEvent): string | null {
  const payload = event.payload as Record<string, unknown> | undefined;
  if (!payload) return null;

  switch (event.type) {
    case 'command_received':
    case 'command_processed': {
      // Show command type (e.g., ADD_ITEM, CHECKOUT)
      const commandType = payload.commandType as string | undefined;
      return commandType ?? null;
    }
    case 'state_broadcast': {
      // Show state version and cart info
      const version = payload.version as number | undefined;
      const cartSize = payload.cartSize as number | undefined;
      if (version !== undefined) {
        const parts = [`v${version}`];
        if (cartSize !== undefined) {
          parts.push(`${cartSize} item${cartSize !== 1 ? 's' : ''}`);
        }
        return parts.join(' | ');
      }
      return null;
    }
    case 'payment_start':
    case 'payment_complete': {
      // Show payment amount if available
      const amount = payload.amount as number | undefined;
      if (amount !== undefined) {
        return `$${(amount / 100).toFixed(2)}`;
      }
      return null;
    }
    case 'demo_action': {
      // Show demo action type
      const action = payload.action as string | undefined;
      const detail = payload.detail as string | undefined;
      if (action) {
        return detail ? `${action}: ${detail}` : action;
      }
      return null;
    }
    default:
      return null;
  }
}

export function ArchTimeline({
  events,
  filter,
  onFilterChange,
  selectedEventId,
  onEventSelect,
}: ArchTimelineProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);

  // Virtualizer for efficient rendering
  // Row heights: collapsed = 40px (py-2 = 8px top + 8px bottom + ~24px content)
  //              expanded = 140px (row + payload preview)
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(
      (index: number) => {
        const eventId = events[index]?.id;
        return eventId && expandedIds.has(eventId) ? 140 : 40;
      },
      [expandedIds, events]
    ),
    overscan: 5,
  });

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && events.length > 0 && parentRef.current) {
      parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, [events.length, autoScroll]);

  // Toggle row expansion
  const toggleExpand = (id: string) => {
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

  // Toggle event type filter
  const toggleTypeFilter = (type: TraceEventType) => {
    const currentTypes = filter.types ?? [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type];
    onFilterChange({ ...filter, types: newTypes.length > 0 ? newTypes : undefined });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900" role="region" aria-label="Event Timeline">
      {/* Filter Bar */}
      <div
        className="flex items-center gap-2 p-2 border-b border-slate-700 flex-wrap"
        role="toolbar"
        aria-label="Event type filters"
      >
        {ALL_EVENT_TYPES.map((type) => {
          const config = EVENT_TYPE_CONFIG[type];
          const isActive = !filter.types || filter.types.includes(type);
          return (
            <button
              key={type}
              onClick={() => toggleTypeFilter(type)}
              aria-pressed={isActive}
              aria-label={`Filter ${config.label} events`}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-opacity ${config.bgColor} ${config.textColor} ${isActive ? 'opacity-100' : 'opacity-30'}`}
            >
              {config.label}
            </button>
          );
        })}
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            aria-label="Enable auto-scroll to latest events"
            className="rounded border-slate-600"
          />
          Auto-scroll
        </label>
      </div>

      {/* Events List */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        role="log"
        aria-label="Trace events"
        aria-live="polite"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const event = events[virtualRow.index];
            if (!event) return null;
            const config = EVENT_TYPE_CONFIG[event.type];
            const isExpanded = expandedIds.has(event.id);
            const isSelected = selectedEventId === event.id;
            const isStateBroadcast = event.type === 'state_broadcast';
            const payloadSummary = getPayloadSummary(event);
            const hasCorrelation = !!event.correlationId;
            const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              fractionalSecondDigits: 3,
            });

            const handleClick = () => {
              toggleExpand(event.id);
              // Select state_broadcast events for inspection
              if (isStateBroadcast && onEventSelect) {
                onEventSelect(isSelected ? undefined : event.id);
              }
            };

            const handleKeyDown = (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            };

            const eventDescription = `${config.label} from ${event.source}${event.target ? ` to ${event.target}` : ''}${event.latencyMs !== undefined ? `, ${event.latencyMs}ms` : ''}`;

            return (
              <div
                key={event.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={`absolute top-0 left-0 w-full border-b border-slate-800 ${config.bgColor} ${
                  isSelected ? 'ring-1 ring-amber-500 ring-inset' : ''
                }`}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
                role="article"
                aria-label={eventDescription}
              >
                <div
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-inset ${
                    isSelected ? 'bg-amber-900/20' : ''
                  }`}
                  onClick={handleClick}
                  onKeyDown={handleKeyDown}
                  tabIndex={0}
                  role="button"
                  aria-expanded={isExpanded}
                  aria-selected={isSelected}
                >
                  {/* Time - fixed width */}
                  <span className="text-gray-500 font-mono text-xs w-24 shrink-0" aria-label="Time">
                    {time}
                  </span>

                  {/* Event type badge - fixed width */}
                  <span
                    className={`${config.textColor} font-mono text-xs w-20 shrink-0 font-semibold`}
                    aria-label="Event type"
                  >
                    {config.label}
                  </span>

                  {/* Source/Target - fixed width */}
                  <span className="text-gray-300 text-xs w-28 shrink-0 truncate" aria-label="Source">
                    {event.source}
                    {event.target && (
                      <span className="text-gray-500"> → {event.target}</span>
                    )}
                  </span>

                  {/* Correlation indicator - fixed width */}
                  <span className="w-5 shrink-0 text-center">
                    {hasCorrelation && (
                      <span
                        className="text-orange-400 text-xs"
                        title={`Correlation: ${event.correlationId}`}
                        aria-label="Correlated event"
                      >
                        ⟲
                      </span>
                    )}
                  </span>

                  {/* Payload summary - flexible, takes remaining space */}
                  <span
                    className="text-slate-300 text-xs font-mono flex-1 truncate"
                    title={payloadSummary ?? undefined}
                    aria-label="Event details"
                  >
                    {payloadSummary ?? ''}
                  </span>

                  {/* Latency - fixed width, right-aligned */}
                  <span className="text-amber-400 text-xs w-16 shrink-0 text-right font-mono" aria-label="Latency">
                    {event.latencyMs !== undefined ? `${event.latencyMs}ms` : ''}
                  </span>

                  {/* State inspect indicator - fixed width */}
                  <span className="w-4 shrink-0 text-center">
                    {isStateBroadcast && (
                      <span
                        className={`text-xs ${isSelected ? 'text-amber-400' : 'text-gray-600'}`}
                        title="Click to inspect state"
                        aria-label={isSelected ? 'State selected for inspection' : 'Click to inspect state'}
                      >
                        ⬤
                      </span>
                    )}
                  </span>

                  {/* Expand indicator - fixed width */}
                  <span className="text-gray-500 text-xs w-4 shrink-0 text-center" aria-hidden="true">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </div>
                {isExpanded && event.payload !== undefined && event.payload !== null && (
                  <pre
                    className="px-2 pb-2 text-xs text-gray-400 overflow-x-auto"
                    aria-label="Event payload"
                  >
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

