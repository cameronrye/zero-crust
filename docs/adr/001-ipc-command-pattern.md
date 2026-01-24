# ADR-001: IPC Command Pattern with Zod Validation

## Status

Accepted

## Context

Electron applications require Inter-Process Communication (IPC) between the Main process (Node.js) and Renderer processes (Chromium). The renderer process is considered untrusted - it runs web content and could potentially be compromised by XSS or other attacks.

Key challenges:
1. Renderer processes should not have direct access to Node.js APIs
2. All data from renderer must be validated before processing
3. Commands need to be type-safe across process boundaries
4. The API surface exposed to renderers should be minimal

## Decision

We implement a Command Pattern for IPC communication with the following components:

### 1. Discriminated Union Commands (src/shared/ipc-types.ts)

All commands are defined as a discriminated union type:

```typescript
export type Command =
  | { type: 'ADD_ITEM'; payload: { sku: string } }
  | { type: 'REMOVE_ITEM'; payload: { sku: string; index?: number } }
  | { type: 'CHECKOUT'; payload: null }
  // ... other commands
```

### 2. Zod Schema Validation (src/shared/schemas.ts)

Every command is validated at runtime using Zod schemas before processing:

```typescript
const AddItemCommandSchema = z.object({
  type: z.literal('ADD_ITEM'),
  payload: z.object({
    sku: z.string().min(1).max(50),
  }),
});
```

### 3. Preload Script Bridge (src/preload.ts)

The preload script exposes a minimal API via contextBridge:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  sendCommand: (command: Command) => ipcRenderer.invoke(IPC_CHANNELS.COMMAND, command),
  onStateUpdate: (callback) => { /* subscription logic */ },
  // ... other methods
});
```

### 4. Centralized IPC Handlers (src/main/IpcHandlers.ts)

All IPC handling is centralized with sender validation:

```typescript
ipcMain.handle(IPC_CHANNELS.COMMAND, async (event, rawCommand) => {
  if (!validateSender(event.senderFrame)) {
    throw new Error('Unauthorized');
  }
  const result = validateCommand(rawCommand);
  if (!result.success) {
    throw new Error(`Invalid command: ${result.error}`);
  }
  return handleCommand(result.data, windowId);
});
```

### 5. ID-Based Messaging

Renderers send only identifiers (e.g., SKU), never prices or sensitive data. The Main process looks up actual values from trusted sources:

```typescript
// Renderer sends: { type: 'ADD_ITEM', payload: { sku: 'PIZZA-001' } }
// Main process looks up price from catalog - prevents price tampering
```

## Consequences

### Positive

- Type safety across process boundaries with TypeScript
- Runtime validation prevents malformed commands
- Minimal attack surface - renderers can only send predefined commands
- Sender validation prevents spoofed IPC messages
- ID-based messaging prevents price/data tampering
- Exhaustive switch statements catch unhandled command types at compile time

### Negative

- Additional boilerplate for each new command (type + schema + handler)
- Slight performance overhead from Zod validation (negligible for POS use case)
- Developers must update multiple files when adding commands

### Neutral

- Commands are fire-and-forget with state broadcast for responses
- Error handling is centralized in the command handler

## Related Files

- `src/shared/ipc-types.ts` - Command type definitions
- `src/shared/schemas.ts` - Zod validation schemas
- `src/preload.ts` - Context bridge API
- `src/main/IpcHandlers.ts` - IPC handler registration
- `src/main/CommandHandler.ts` - Command routing and execution
- `src/main/SecurityHandlers.ts` - Sender validation

