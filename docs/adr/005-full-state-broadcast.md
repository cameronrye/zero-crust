# ADR-005: Full State Broadcast Pattern

## Status

Accepted

## Context

When state changes in MainStore, we need to notify all renderer processes. Two approaches were considered:

1. **Delta updates** - Send only what changed (e.g., "item added to cart")
2. **Full state broadcast** - Send the entire AppState on every change

Delta updates are more efficient but introduce complexity:
- Renderers must apply patches in correct order
- Network issues could cause state divergence
- Recovery from missed updates is complex
- Race conditions between multiple updates

## Decision

We broadcast the entire AppState to all renderers on every state change:

### BroadcastService Implementation

```typescript
mainStore.subscribe((state: AppState) => {
  windowManager.broadcast(IPC_CHANNELS.STATE_UPDATE, state);
});
```

### State Structure

```typescript
interface AppState {
  version: number;           // Monotonic counter for ordering
  cart: CartItem[];          // Full cart contents
  totalInCents: Cents;       // Calculated total
  transactionStatus: TransactionStatus;
  errorMessage?: string;
  retryCount: number;
}
```

### Renderer State Handling

```typescript
// usePOSState hook - simply replaces state
onStateUpdate((newState) => {
  setState(newState);
});
```

### Version-Based Ordering

The version number ensures renderers can detect stale updates:

```typescript
private updateState(recipe: (draft: InternalState) => void): void {
  this.state = produce(this.state, (draft) => {
    recipe(draft);
    draft.version++;  // Always increment
  });
  this.notifyListeners();
}
```

## Consequences

### Positive

- Eliminates entire class of sync bugs
- Renderers are always consistent with MainStore
- No complex patch application logic
- Recovery is trivial - just use latest state
- Easy to debug - state is always complete
- Version number enables stale update detection

### Negative

- More data transferred per update
- Serialization/deserialization overhead
- Not suitable for high-frequency updates (not our use case)

### Neutral

- For POS cart sizes (<50 items), overhead is negligible
- State is typically <10KB even with full cart
- IPC is already serializing data anyway

## Performance Analysis

Typical state size:
- Empty cart: ~200 bytes
- 10 items: ~1.5KB
- 50 items: ~7KB

At 10 updates/second (fast cashier), this is 70KB/s - negligible for local IPC.

## When to Reconsider

This decision should be revisited if:
- Cart size limits increase significantly (>100 items)
- Update frequency exceeds 100/second
- Network latency becomes a factor (remote displays)

For these cases, consider hybrid approach: full state on initial sync, deltas for updates.

## Related Files

- `src/main/BroadcastService.ts` - Broadcast implementation
- `src/main/MainStore.ts` - State versioning
- `src/main/WindowManager.ts` - Window broadcast method
- `src/renderer/hooks/usePOSState.ts` - State subscription in React

