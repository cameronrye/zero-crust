# ADR 007: Architecture Debug Window

## Status

Proposed

## Context

Zero Crust demonstrates sophisticated IPC patterns with dual-window synchronization, command validation, and state broadcasting. However, understanding the runtime behavior of these patterns requires reading logs or mentally tracing code paths. A real-time visualization would make the architecture tangible and serve as a compelling demonstration of architectural thinking.

## Decision

Implement an Architecture Debug Window that provides real-time visualization of IPC message flow, state changes, and system health. This feature will be included in production builds as a permanent observability tool, accessible via menu or keyboard shortcut.

## Consequences

- Improved debugging experience for IPC-related issues in both development and production
- Educational tool for understanding Electron architecture patterns
- Compelling interview demonstration piece showcasing observability mindset
- Enables field diagnostics without requiring debug builds
- Slight increase in bundle size (estimated 50-100KB for visualization libraries)
- Minimal runtime overhead when window is closed (no active tracing)

## Privacy and Security

This is a demo application with no real customer data. For production considerations:

- Payment amounts shown are simulated demo data
- No real PII exists in this application
- For production deployment: implement payload sanitization to redact sensitive fields
- Architecture window exposes internal state - consider access controls in production

---

## Implementation Roadmap

### Phase 1: TraceService Foundation

**Goal**: Create the core infrastructure for collecting and distributing trace events.

**Deliverables**:

1. `src/main/TraceService.ts` - Event collection service
   - TraceEvent interface with id, timestamp, type, source, target, payload, latencyMs
   - `correlationId` field to link related events (e.g., command_received -> command_processed)
   - Circular buffer for event history (configurable, default 1000 events)
   - Subscribe/unsubscribe pattern for listeners
   - Event emission methods for each trace type
   - Non-blocking emission: errors are logged but never thrown

2. `src/shared/trace-types.ts` - Shared type definitions
   - TraceEvent type with correlationId for event linking
   - TraceEventType union ('command_received', 'command_processed', 'state_broadcast', 'ipc_send', 'payment_start', 'payment_complete')
   - TraceStats interface for aggregated metrics

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
```

3. New IPC channels in `src/shared/ipc-types.ts`
   - `pos:trace-event` - Real-time event stream (Main -> Renderer)
   - `pos:get-trace-history` - Fetch historical events with optional pagination
   - `pos:get-trace-stats` - Fetch aggregated statistics

4. Preload API extensions (following existing unsubscribe pattern)
   - `onTraceEvent(callback: (event: TraceEvent) => void): () => void` - Subscribe to trace events, returns unsubscribe function
   - `getTraceHistory(limit?: number): Promise<TraceEvent[]>` - Fetch event buffer
   - `getTraceStats(): Promise<TraceStats>` - Fetch current statistics

**Estimated Effort**: 4-6 hours

---

### Phase 2: Instrumentation Hooks

**Goal**: Add trace emission points to existing services without modifying core logic.

**Deliverables**:

1. Instrument `IpcHandlers.ts`
   - Emit 'command_received' when command arrives
   - Include source window, command type, timestamp

2. Instrument `CommandHandler.ts`
   - Emit 'command_processed' after handling
   - Include processing duration, success/failure, result summary

3. Instrument `BroadcastService.ts`
   - Emit 'state_broadcast' when state is sent
   - Include state version, cart size, target windows

4. Instrument `WindowManager.ts`
   - Emit 'ipc_send' for each window message
   - Include target window, channel, payload size

5. Instrument `PaymentService.ts`
   - Emit 'payment_start' and 'payment_complete'
   - Include payment status, duration, retry count

**Design Principle**: Use wrapper functions or middleware pattern to keep instrumentation separate from business logic.

**Clarification on "Always-On" vs "Lazy Activation"**:
- Instrumentation hooks are always in place (code paths exist)
- TraceService only serializes and buffers events when there are active subscribers
- When Architecture window is closed: zero overhead (no listeners = no work)
- When Architecture window is open: events are captured and streamed

This means the hooks have negligible cost, but actual tracing work only happens on demand.

**Estimated Effort**: 3-4 hours

---

### Phase 3: Architecture View UI

**Goal**: Create the React component for visualizing the architecture.

**Prerequisites**: Install required dependencies:

```bash
pnpm add @xyflow/react @tanstack/react-virtual
```

**Deliverables**:

1. `src/renderer/views/ArchitectureView.tsx` - Main view component
   - Three-panel layout: Graph | Timeline | Stats
   - Responsive design matching existing theme

2. `src/renderer/components/ArchGraph.tsx` - Node graph visualization
   - Static node positions for Main Process, Cashier, Customer, Transaction History
   - Use @xyflow/react (React Flow) for rendering
   - Custom node components matching Zero Crust theme
   - Note: "Main Process" node represents the Electron main process, distinct from the existing "transactions" (TransactionHistoryView) window

3. `src/renderer/components/ArchTimeline.tsx` - Event timeline
   - Virtualized scrolling list (@tanstack/react-virtual)
   - Color-coded by event type
   - Expandable rows for payload inspection
   - Filter controls by type/source

4. `src/renderer/components/ArchStats.tsx` - Live statistics panel
   - Events per second (rolling 10s window)
   - Average latency by event type
   - Current state version
   - Active window count

5. `src/renderer/hooks/useTraceEvents.ts` - Hook for trace subscription
   - Subscribe to trace events via IPC
   - Manage local event buffer
   - Compute derived statistics

**Estimated Effort**: 8-10 hours

---

### Phase 4: Animated Message Flow

**Goal**: Add visual animations showing messages flowing between nodes.

**Deliverables**:

1. Animated edges in ArchGraph
   - Particle animation along edges when events occur
   - Color matches event type
   - Speed indicates latency

2. Node pulse effects
   - Nodes pulse when sending/receiving
   - Different colors for send vs receive

3. Connection status indicators
   - Show which windows are connected
   - Gray out disconnected windows

4. Animation controls
   - Play/pause animation
   - Speed control (1x, 2x, 0.5x)
   - Clear history button

**Libraries**: framer-motion for animations, or custom CSS animations

**Estimated Effort**: 6-8 hours

---

### Phase 5: Window Integration

**Goal**: Integrate the Architecture view into the application.

**Deliverables**:

1. Add 'architecture' to WindowId type in `src/shared/ipc-types.ts`

2. Update `src/preload.ts` to handle 'architecture' window ID
   - Add 'architecture' to the valid windowId check in `getWindowIdFromUrl()`

3. Update WindowManager.openArchitectureWindow()
   - Positioned at bottom-left by default
   - Appropriate size (800x600)
   - Available in both development and production

4. Update App.tsx routing
   - Add case for 'architecture' window ID
   - Import and render ArchitectureView

5. Menu integration
   - Add "View > Architecture" menu item
   - Keyboard shortcut (Cmd/Ctrl+Shift+A)
   - Available in all builds

6. Transaction History integration
   - Button to open Architecture window
   - Quick-access from metrics bar

**Estimated Effort**: 2-3 hours

---

### Phase 6: State Inspection

**Goal**: Add ability to inspect state changes in detail.

**Deliverables**:

1. `src/renderer/components/StateInspector.tsx`
   - JSON tree view of current state
   - Diff view showing changes between versions
   - Highlight changed fields

2. State history navigation
   - Slider to scrub through state versions
   - "Time travel" to see state at any point

3. Click-to-inspect on timeline
   - Click event to see associated state
   - Show before/after for state-changing events

**Libraries**: react-json-view or custom tree component

**Estimated Effort**: 4-5 hours

---

### Phase 7: Polish and Documentation

**Goal**: Production-quality finish and documentation.

**Deliverables**:

1. Performance optimization
   - Throttle UI updates to 60fps
   - Virtualize long lists
   - Lazy load heavy components

2. Accessibility
   - Keyboard navigation
   - Screen reader labels
   - High contrast mode support

3. Documentation
   - Update README with Architecture Debug section
   - Add screenshots to docs
   - Document trace event schema

4. Testing
   - Unit tests for TraceService
   - Component tests for ArchitectureView
   - Integration test for full flow

**Estimated Effort**: 4-6 hours

---

## Summary

| Phase | Description              | Effort | Dependencies |
| :---- | :----------------------- | :----- | :----------- |
| 1     | TraceService Foundation  | 4-6h   | None         |
| 2     | Instrumentation Hooks    | 3-4h   | Phase 1      |
| 3     | Architecture View UI     | 8-10h  | Phase 1      |
| 4     | Animated Message Flow    | 6-8h   | Phase 3      |
| 5     | Window Integration       | 2-3h   | Phase 3      |
| 6     | State Inspection         | 4-5h   | Phase 3      |
| 7     | Polish and Documentation | 4-6h   | All          |

**Total Estimated Effort**: 31-42 hours

---

## Technical Decisions

### Library Choices

| Purpose        | Recommended             | Alternatives        | Size (gzipped) |
| :------------- | :---------------------- | :------------------ | :------------- |
| Node Graph     | @xyflow/react           | cytoscape, d3-force | ~45KB          |
| Animations     | framer-motion           | react-spring, CSS   | ~30KB          |
| Virtualization | @tanstack/react-virtual | react-window        | ~5KB           |
| JSON View      | react-json-view         | custom              | ~15KB          |

Note: For MVP, consider CSS-only animations to avoid framer-motion dependency initially.

### Architecture Principles

1. **Separation of Concerns**: TraceService only collects; UI only displays
2. **Production-Ready**: Feature available in all builds with minimal overhead
3. **Lazy Activation**: Instrumentation hooks exist everywhere, but TraceService only serializes/buffers when subscribers are active (Architecture window open)
4. **Non-Blocking**: Trace emission must not slow down main operations; errors are logged but never thrown
5. **Memory Bounded**: Circular buffer prevents unbounded growth (max 1000 events)
6. **Type Safe**: Full TypeScript coverage for trace events
7. **Privacy Aware**: Demo app has no real PII; production would require payload sanitization
8. **Event Correlation**: Related events linked via correlationId for tracing command flows

### File Structure

```text
src/
  main/
    TraceService.ts          # Event collection
  shared/
    trace-types.ts           # Shared type definitions
  renderer/
    views/
      ArchitectureView.tsx   # Main view
    components/
      ArchGraph.tsx          # Node graph
      ArchTimeline.tsx       # Event timeline
      ArchStats.tsx          # Statistics panel
      StateInspector.tsx     # State diff view
    hooks/
      useTraceEvents.ts      # Trace subscription hook
```

---

## MVP Scope (Interview Demo)

For a minimal viable demo, implement:

- Phase 1: TraceService (simplified)
- Phase 2: Instrument CommandHandler and BroadcastService only
- Phase 3: Basic ArchitectureView with static graph and timeline
- Phase 4 Lite: CSS-only edge highlighting (no framer-motion) to show message direction
- Phase 5: Window integration

**MVP Effort**: ~16-20 hours

This provides a working demo that shows:

- Live command flow from Cashier to Main Process
- State broadcasts to all windows
- Visual edge highlighting when messages flow (CSS transitions)
- Event timeline with filtering
- Basic statistics

The MVP will be production-ready and included in release builds.

**MVP Dependencies** (install before starting):

```bash
pnpm add @xyflow/react @tanstack/react-virtual
```

---

## Production Considerations

### Performance Targets

| Metric | Target | Notes |
| :----- | :----- | :---- |
| Trace emission latency | <1ms per event | Primarily serialization cost |
| Memory overhead (closed) | <100KB | TraceService instance only |
| Memory overhead (open) | <500KB | Circular buffer at capacity |
| CPU overhead (closed) | 0% | No polling, no listeners |
| Max events/second without UI jank | 100+ | Virtualized list handles volume |

### Performance Details

- **Idle Overhead**: When Architecture window is closed, TraceService has zero active listeners and minimal memory footprint
- **Active Overhead**: When open, expect <1ms per traced event (primarily serialization)
- **Memory**: Circular buffer capped at 1000 events (~500KB worst case)

### Bundle Size Impact

| Library                 | Size (gzipped) | Purpose             | Required for MVP |
| :---------------------- | :------------- | :------------------ | :--------------- |
| @xyflow/react           | ~45KB          | Node graph          | Yes              |
| @tanstack/react-virtual | ~5KB           | List virtualization | Yes              |
| framer-motion           | ~30KB          | Animations          | No (Phase 4)     |
| react-json-view         | ~15KB          | State inspection    | No (Phase 6)     |

**MVP Total**: ~50KB additional bundle size
**Full Feature Total**: ~95KB additional bundle size

### User Experience

- Architecture window opens via View menu or Cmd/Ctrl+Shift+A
- Window remembers position and size between sessions
- Can be opened alongside Cashier/Customer windows without interference
- Useful for franchise support teams diagnosing issues remotely

---

## Future Enhancements (Post-MVP)

1. **Export/Import**: Save trace sessions for later analysis
2. **Replay Mode**: Replay recorded sessions at variable speed
3. **Breakpoints**: Pause on specific event types
4. **Network Simulation**: Inject artificial latency for testing
5. **Performance Profiling**: Flame graph of command processing
6. **Remote Debugging**: Connect to running instance via WebSocket
