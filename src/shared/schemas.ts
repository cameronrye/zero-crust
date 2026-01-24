/**
 * Zod Schemas - Runtime validation for IPC commands
 *
 * These schemas validate all commands received from renderer processes.
 * This is a security-critical layer - never trust renderer input.
 */

import { z } from 'zod';

// Window ID schema
export const WindowIdSchema = z.enum(['cashier', 'customer']);

// Individual command schemas
const PingCommandSchema = z.object({
  type: z.literal('PING'),
  payload: z.object({
    source: WindowIdSchema,
    message: z.string().min(1).max(500),
  }),
});

const AddItemCommandSchema = z.object({
  type: z.literal('ADD_ITEM'),
  payload: z.object({
    sku: z.string().min(1).max(50),
  }),
});

const RemoveItemCommandSchema = z.object({
  type: z.literal('REMOVE_ITEM'),
  payload: z.object({
    sku: z.string().min(1).max(50),
    index: z.number().int().nonnegative().optional(),
  }),
});

const UpdateQuantityCommandSchema = z.object({
  type: z.literal('UPDATE_QUANTITY'),
  payload: z.object({
    sku: z.string().min(1).max(50),
    index: z.number().int().nonnegative(),
    quantity: z.number().int().positive().max(99),
  }),
});

const ClearCartCommandSchema = z.object({
  type: z.literal('CLEAR_CART'),
  payload: z.null(),
});

const CheckoutCommandSchema = z.object({
  type: z.literal('CHECKOUT'),
  payload: z.null(),
});

const CancelCheckoutCommandSchema = z.object({
  type: z.literal('CANCEL_CHECKOUT'),
  payload: z.null(),
});

const ProcessPaymentCommandSchema = z.object({
  type: z.literal('PROCESS_PAYMENT'),
  payload: z.null(),
});

const RetryPaymentCommandSchema = z.object({
  type: z.literal('RETRY_PAYMENT'),
  payload: z.null(),
});

const NewTransactionCommandSchema = z.object({
  type: z.literal('NEW_TRANSACTION'),
  payload: z.null(),
});

const DemoOrderCommandSchema = z.object({
  type: z.literal('DEMO_ORDER'),
  payload: z.null(),
});

const StartDemoLoopCommandSchema = z.object({
  type: z.literal('START_DEMO_LOOP'),
  payload: z.null(),
});

const StopDemoLoopCommandSchema = z.object({
  type: z.literal('STOP_DEMO_LOOP'),
  payload: z.null(),
});

// Discriminated union of all commands
export const CommandSchema = z.discriminatedUnion('type', [
  PingCommandSchema,
  AddItemCommandSchema,
  RemoveItemCommandSchema,
  UpdateQuantityCommandSchema,
  ClearCartCommandSchema,
  CheckoutCommandSchema,
  CancelCheckoutCommandSchema,
  ProcessPaymentCommandSchema,
  RetryPaymentCommandSchema,
  NewTransactionCommandSchema,
  DemoOrderCommandSchema,
  StartDemoLoopCommandSchema,
  StopDemoLoopCommandSchema,
]);

// Type inference from schema
export type ValidatedCommand = z.infer<typeof CommandSchema>;

// Validation result type
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Validate an IPC command payload
 * Returns a typed result with either validated data or an error message
 */
export function validateCommand(input: unknown): ValidationResult<ValidatedCommand> {
  const result = CommandSchema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  // Format error message for logging
  const errorMessage = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  return {
    success: false,
    error: errorMessage,
  };
}

