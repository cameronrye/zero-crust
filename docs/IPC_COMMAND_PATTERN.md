# IPC Command Pattern Guide

This guide explains how to add new IPC commands to the Zero Crust POS system.

## Architecture Overview

```
Renderer Process          Preload Script           Main Process
     |                         |                        |
     |  sendCommand(cmd)       |                        |
     |------------------------>|                        |
     |                         |  ipcRenderer.invoke    |
     |                         |----------------------->|
     |                         |                        |
     |                         |     IpcHandlers        |
     |                         |     - validateSender   |
     |                         |     - validateCommand  |
     |                         |                        |
     |                         |     CommandHandler     |
     |                         |     - route command    |
     |                         |     - update MainStore |
     |                         |                        |
     |                         |     BroadcastService   |
     |                         |<-----------------------|
     |  onStateUpdate(state)   |   STATE_UPDATE         |
     |<------------------------|                        |
```

## Adding a New Command

### Step 1: Define the Command Type

Edit `src/shared/ipc-types.ts` to add your command to the discriminated union:

```typescript
export type Command =
  | { type: 'PING'; payload: { source: WindowId; message: string } }
  | { type: 'ADD_ITEM'; payload: { sku: string } }
  // Add your new command:
  | { type: 'APPLY_DISCOUNT'; payload: { code: string } }
```

### Step 2: Create the Zod Schema

Edit `src/shared/schemas.ts` to add validation:

```typescript
const ApplyDiscountCommandSchema = z.object({
  type: z.literal('APPLY_DISCOUNT'),
  payload: z.object({
    code: z.string().min(1).max(20).regex(/^[A-Z0-9]+$/),
  }),
});

// Add to CommandSchema union:
export const CommandSchema = z.union([
  PingCommandSchema,
  AddItemCommandSchema,
  // ...existing schemas
  ApplyDiscountCommandSchema,  // Add here
]);
```

### Step 3: Implement the Handler

Edit `src/main/CommandHandler.ts` to handle the command:

```typescript
export async function handleCommand(
  command: Command,
  source: WindowId
): Promise<CommandResult> {
  switch (command.type) {
    // ...existing cases

    case 'APPLY_DISCOUNT':
      return handleApplyDiscount(command.payload);

    default:
      const _exhaustiveCheck: never = command;
      return { success: false, error: 'Unknown command type' };
  }
}

function handleApplyDiscount(payload: { code: string }): CommandResult {
  const result = mainStore.applyDiscount(payload.code);
  return result;
}
```

### Step 4: Add MainStore Method (if needed)

If your command modifies state, add a method to `src/main/MainStore.ts`:

```typescript
public applyDiscount(code: string): { success: boolean; error?: string } {
  // Validate discount code against trusted source
  const discount = getDiscountByCode(code);
  if (!discount) {
    return { success: false, error: 'Invalid discount code' };
  }

  this.updateState((draft) => {
    draft.discountCode = code;
    draft.discountAmount = discount.amount;
  });

  return { success: true };
}
```

### Step 5: Add React Hook Method (optional)

If renderers need to trigger this command, add to `src/renderer/hooks/usePOSCommands.ts`:

```typescript
const handleApplyDiscount = useCallback(async (code: string): Promise<void> => {
  return window.electronAPI.sendCommand({
    type: 'APPLY_DISCOUNT',
    payload: { code }
  });
}, []);
```

### Step 6: Update AppState (if needed)

If you added new state fields, update `src/shared/ipc-types.ts`:

```typescript
export interface AppState {
  // ...existing fields
  discountCode?: string;
  discountAmount?: Cents;
}
```

## Checklist

Before submitting your command:

- [ ] Command type added to `Command` union in `ipc-types.ts`
- [ ] Zod schema created and added to `CommandSchema` in `schemas.ts`
- [ ] Handler case added to `CommandHandler.ts` switch statement
- [ ] MainStore method added (if state changes)
- [ ] React hook updated (if UI needs to trigger command)
- [ ] AppState updated (if new fields needed)
- [ ] Unit tests written for new functionality
- [ ] TypeScript compiles without errors (`pnpm typecheck`)

## Security Considerations

1. **Never trust renderer input** - Always validate with Zod schemas
2. **Use ID-based messaging** - Send SKUs/codes, look up values in Main
3. **Validate sender** - Already handled by IpcHandlers
4. **Sanitize strings** - Use Zod constraints (min/max length, regex)

## Testing Commands

Write tests in `src/main/CommandHandler.test.ts`:

```typescript
describe('APPLY_DISCOUNT command', () => {
  it('should apply valid discount code', async () => {
    const result = await handleCommand(
      { type: 'APPLY_DISCOUNT', payload: { code: 'SAVE10' } },
      'cashier'
    );
    expect(result.success).toBe(true);
  });

  it('should reject invalid discount code', async () => {
    const result = await handleCommand(
      { type: 'APPLY_DISCOUNT', payload: { code: 'INVALID' } },
      'cashier'
    );
    expect(result.success).toBe(false);
  });
});
```

## Common Patterns

### Commands that Return Data

Use the existing state broadcast pattern - update MainStore, state broadcasts automatically.

### Commands with Side Effects

Handle in CommandHandler, update MainStore as needed:

```typescript
case 'PRINT_RECEIPT':
  await printerService.print(mainStore.getLastTransaction());
  return { success: true };
```

### Async Commands

CommandHandler supports async operations:

```typescript
case 'PROCESS_PAYMENT':
  const result = await paymentService.process(mainStore.getCartTotal());
  if (result.success) {
    mainStore.completeTransaction();
  }
  return result;
```
