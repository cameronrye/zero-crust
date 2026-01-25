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

---

## Implementation Roadmap

### Phase 1: TraceService Foundation

**Goal**: Create the core infrastructure for collecting and distributing trace events.

**Deliverables**:

1. `src/main/TraceService.ts` - Event collection service
   - TraceEvent interface with id, timestamp, type, source, target, payload, latencyMs
   - Circular buffer for event history (configurable, default 1000 events)
   - Subscribe/unsubscribe pattern for listeners
   - Event emission methods for each trace type

2. `src/shared/trace-types.ts` - Shared type definitions
   - TraceEvent type
   - TraceEventType union ('command_received', 'command_processed', 'state_broadcast', 'ipc_send', 'payment_start', 'payment_complete')
   - TraceStats interface for aggregated metrics

3. New IPC channels in `src/shared/ipc-types.ts`
   - `pos:trace-event` - Real-time event stream
   - `pos:get-trace-history` - Fetch historical events
   - `pos:get-trace-stats` - Fetch aggregated statistics

4. Preload API extensions
   - `onTraceEvent(callback)` - Subscribe to trace events
   - `getTraceHistory()` - Fetch event buffer
   - `getTraceStats()` - Fetch current statistics

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

**Design Principle**: Use wrapper functions or middleware pattern to keep instrumentation separate from business logic. Instrumentation should be lightweight and always-on, with minimal overhead when no listeners are subscribed.

**Estimated Effort**: 3-4 hours

---

### Phase 3: Architecture View UI

**Goal**: Create the React component for visualizing the architecture.

**Deliverables**:

1. `src/renderer/views/ArchitectureView.tsx` - Main view component
   - Three-panel layout: Graph | Timeline | Stats
   - Responsive design matching existing theme

2. `src/renderer/components/ArchGraph.tsx` - Node graph visualization
   - Static node positions for Main, Cashier, Customer, Dashboard
   - Use @xyflow/react (React Flow) for rendering
   - Custom node components matching Zero Crust theme

3. `src/renderer/components/ArchTimeline.tsx` - Event timeline
   - Virtualized scrolling list (react-window)
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

1. Add 'architecture' to WindowId type
2. Update WindowManager.openArchitectureWindow()
   - Positioned at bottom-left by default
   - Appropriate size (800x600)
   - Available in both development and production

3. Update App.tsx routing
   - Add case for 'architecture' window ID

4. Menu integration
   - Add "View > Architecture" menu item
   - Keyboard shortcut (Cmd/Ctrl+Shift+A)
   - Available in all builds

5. Dashboard integration
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

| Purpose        | Recommended             | Alternatives        |
| :------------- | :---------------------- | :------------------ |
| Node Graph     | @xyflow/react           | cytoscape, d3-force |
| Animations     | framer-motion           | react-spring, CSS   |
| Virtualization | @tanstack/react-virtual | react-window        |
| JSON View      | react-json-view         | custom              |

### Architecture Principles

1. **Separation of Concerns**: TraceService only collects; UI only displays
2. **Production-Ready**: Feature available in all builds with minimal overhead
3. **Lazy Activation**: Tracing only active when Architecture window is open
4. **Non-Blocking**: Trace emission must not slow down main operations
5. **Memory Bounded**: Circular buffer prevents unbounded growth (max 1000 events)
6. **Type Safe**: Full TypeScript coverage for trace events
7. **Privacy Aware**: Sensitive data (if any) redacted from trace payloads

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
- Phase 5: Window integration

**MVP Effort**: ~15-18 hours

This provides a working demo that shows:

- Live command flow from Cashier to Main
- State broadcasts to all windows
- Event timeline with filtering
- Basic statistics

The MVP will be production-ready and included in release builds.

---

## Production Considerations

### Performance

- **Idle Overhead**: When Architecture window is closed, TraceService has zero active listeners and minimal memory footprint
- **Active Overhead**: When open, expect <1ms per traced event (primarily serialization)
- **Memory**: Circular buffer capped at 1000 events (~500KB worst case)

### Bundle Size Impact

| Library                 | Size (gzipped) | Purpose             |
| :---------------------- | :------------- | :------------------ |
| @xyflow/react           | ~45KB          | Node graph          |
| framer-motion           | ~30KB          | Animations          |
| @tanstack/react-virtual | ~5KB           | List virtualization |

**Total**: ~80KB additional bundle size

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
