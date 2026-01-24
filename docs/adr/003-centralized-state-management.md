# ADR-003: Centralized State Management with MainStore

## Status

Accepted

## Context

A dual-head POS system has multiple renderer processes (Cashier and Customer displays) that must stay synchronized. State management options considered:

1. **Distributed state** - Each renderer manages its own state, syncing via IPC
2. **Centralized state** - Single source of truth in Main process, broadcast to renderers
3. **Shared memory** - Use SharedArrayBuffer or similar for direct memory sharing

## Decision

We implement a centralized state management pattern with MainStore as the single source of truth:

### MainStore (src/main/MainStore.ts)

```typescript
class MainStore {
  private state: InternalState;
  private listeners: Set<StateChangeListener> = new Set();

  // Immutable updates with Immer
  private updateState(recipe: (draft: InternalState) => void): void {
    this.state = produce(this.state, (draft) => {
      recipe(draft);
      draft.version++;
    });
    this.notifyListeners();
  }

  // Clone state to prevent mutations
  public getState(): AppState {
    return structuredClone(appState);
  }

  // Pub/sub for state changes
  public subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
```

### Key Design Decisions

1. **Immer for Immutable Updates**: Enables writing mutable-style code that produces immutable updates
2. **State Versioning**: Each update increments a version number for detecting stale updates
3. **structuredClone**: Prevents accidental mutations by listeners
4. **Internal vs Public State**: Inventory is internal-only; AppState is broadcast to renderers

### State Flow

```
Renderer (Cashier)                Main Process                 Renderer (Customer)
      |                               |                              |
      |-- sendCommand(ADD_ITEM) ----->|                              |
      |                               |                              |
      |                         MainStore.addItem()                  |
      |                         updateState(draft => ...)            |
      |                         notifyListeners()                    |
      |                               |                              |
      |<-- STATE_UPDATE --------------|-------- STATE_UPDATE ------->|
      |                               |                              |
```

### BroadcastService (src/main/BroadcastService.ts)

Connects MainStore to WindowManager for automatic state broadcasting:

```typescript
export function initializeBroadcastService(): void {
  mainStore.subscribe((state: AppState) => {
    windowManager.broadcast(IPC_CHANNELS.STATE_UPDATE, state);
  });
}
```

## Consequences

### Positive

- Single source of truth eliminates sync bugs
- Renderers are stateless - easy to reason about
- State changes are atomic and versioned
- Immer makes complex updates readable
- Easy to add new subscribers (e.g., logging, analytics)

### Negative

- All state changes require IPC round-trip
- Main process is a bottleneck (acceptable for POS scale)
- Slightly higher latency than local state

### Neutral

- Renderers receive full state on each update (see ADR-005)
- State is serialized/deserialized on each broadcast

## Related Files

- `src/main/MainStore.ts` - Centralized state store
- `src/main/BroadcastService.ts` - State broadcast to windows
- `src/main/WindowManager.ts` - Window management and broadcasting
- `src/renderer/hooks/usePOSState.ts` - React hook for state subscription

