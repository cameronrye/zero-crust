# ADR-006: Architecture Debug Window

## Status

Accepted

## Context

Zero Crust demonstrates sophisticated IPC patterns with dual-window synchronization, command validation, and state broadcasting. However, understanding the runtime behavior of these patterns requires reading logs or mentally tracing code paths.

Key challenges:

1. IPC message flow is invisible without logging
2. State synchronization between windows is difficult to debug
3. Payment processing flow spans multiple services
4. No way to visualize the architecture at runtime

A real-time visualization would make the architecture tangible and serve as a compelling demonstration of architectural thinking.

## Decision

We implement an Architecture Debug Window that provides real-time visualization of IPC message flow, state changes, and system health. This feature is included in production builds as a permanent observability tool.

### 1. TraceService (src/main/TraceService.ts)

Central event collection service with lazy activation:

```typescript
interface TraceEvent {
  id: string;
  correlationId?: string;  // Links related events (e.g., command flow)
  timestamp: number;
  type: TraceEventType;
  source: string;
  target?: string;
  payload?: unknown;
  latencyMs?: number;
}

class TraceService {
  private buffer: TraceEvent[] = [];
  private listeners: Set<TraceListener> = new Set();

  // Only buffers events when listeners are active
  emit(event: Omit<TraceEvent, 'id' | 'timestamp'>): void {
    if (this.listeners.size === 0) return;  // Lazy activation
    // ... buffer and broadcast
  }

  subscribe(listener: TraceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
```

### 2. Instrumentation Hooks

Services emit trace events without modifying core logic:

```typescript
// IpcHandlers.ts - command received
traceService.emit({
  type: 'command_received',
  source: windowId,
  target: 'main',
  payload: { commandType: command.type },
  correlationId,
});

// BroadcastService.ts - state broadcast
traceService.emit({
  type: 'state_broadcast',
  source: 'main',
  payload: { version: state.version, cartSize: state.cart.length },
});
```

### 3. Architecture View UI

Four-panel layout with real-time visualization:

- **ArchGraph**: Node graph showing Main Process, Cashier, Customer, and Transaction History windows with animated edges
- **ArchTimeline**: Virtualized event timeline with filtering and expandable rows
- **ArchStats**: Live statistics (events/sec, latency, state version)
- **StateInspector**: JSON tree view with diff highlighting and time travel

### 4. Window Integration

- Accessible via View > Architecture menu or Cmd/Ctrl+Shift+A
- Opens as separate window (800x600, bottom-left position)
- Available in both development and production builds

### Key Design Principles

1. **Lazy Activation**: TraceService only buffers events when Architecture window is open
2. **Non-Blocking**: Trace emission never throws; errors are logged
3. **Memory Bounded**: Circular buffer capped at 1000 events
4. **Event Correlation**: Related events linked via correlationId

## Consequences

### Positive

- Real-time visibility into IPC message flow
- Improved debugging experience for synchronization issues
- Educational tool for understanding Electron architecture
- Enables field diagnostics without debug builds
- Compelling demonstration of observability mindset
- Zero overhead when window is closed (lazy activation)

### Negative

- Additional bundle size (~50KB for visualization libraries)
- Slight runtime overhead when window is open (<1ms per event)
- Exposes internal state (acceptable for demo; production would need access controls)

### Neutral

- Uses CSS animations instead of framer-motion to minimize bundle size
- Custom JSON tree component instead of react-json-view for better control

## Privacy and Security

This is a demo application with no real customer data. For production considerations:

- Payment amounts shown are simulated demo data
- No real PII exists in this application
- For production deployment: implement payload sanitization to redact sensitive fields
- Architecture window exposes internal state - consider access controls in production

## Related Files

- `src/main/TraceService.ts` - Event collection with circular buffer
- `src/shared/trace-types.ts` - TraceEvent and TraceEventType definitions
- `src/renderer/views/ArchitectureView.tsx` - Main view with four-panel layout
- `src/renderer/components/ArchGraph.tsx` - Node graph with animated edges
- `src/renderer/components/ArchTimeline.tsx` - Virtualized event timeline
- `src/renderer/components/ArchStats.tsx` - Live statistics panel
- `src/renderer/components/StateInspector.tsx` - JSON tree with diff view
- `src/renderer/hooks/useTraceEvents.ts` - Trace subscription hook
- `src/main/WindowManager.ts` - openArchitectureWindow() method
- `src/main/AppMenu.ts` - Menu integration with keyboard shortcut
