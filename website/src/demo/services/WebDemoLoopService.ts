/**
 * WebDemoLoopService - Orchestrates continuous demo transactions
 *
 * Runs a realistic transaction loop for showcasing the POS system:
 * 1. Generate varied demo order (using WebDemoService patterns)
 * 2. Wait realistic "cashier verification" time
 * 3. Initiate checkout
 * 4. Process payment (with auto-retry on failure)
 * 5. Brief pause after success
 * 6. Start new transaction and repeat
 *
 * Timing is randomized within realistic ranges to simulate human behavior.
 */

import { webStore } from './WebStore';
import { generateDemoOrder } from './WebDemoService';
import { webTraceService } from './WebTraceService';
import { DEMO_LOOP_TIMING, RETRY_CONFIG } from '../shared/config';

/** Emit a demo action trace event */
function emitDemoTrace(action: string, detail?: string, payload?: Record<string, unknown>): void {
  webTraceService.emit('demo_action', 'demo-loop', {
    payload: { action, detail, ...payload },
  });
}

/**
 * Generate random delay within a range
 */
function randomDelay(range: readonly [number, number]): number {
  const [min, max] = range;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * WebDemoLoopService class - Manages the continuous demo loop
 */
class WebDemoLoopService {
  private isRunning = false;
  private abortController: AbortController | null = null;

  /**
   * Check if demo loop is currently running
   */
  public isLoopRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Start the demo loop
   */
  public start(): { success: boolean; error?: string } {
    if (this.isRunning) {
      return { success: false, error: 'Demo loop is already running' };
    }

    // Only start from IDLE state
    const currentStatus = webStore.getState().transactionStatus;
    if (currentStatus !== 'IDLE') {
      return { success: false, error: 'Complete current transaction before starting demo loop' };
    }

    emitDemoTrace('LOOP_START', 'Demo loop started');
    this.abortController = new AbortController();

    // Update state atomically before starting the loop
    this.isRunning = true;
    webStore.setDemoLoopRunning(true);

    // Start the loop (runs in background) with error handling
    this.runLoop(this.abortController.signal).catch((error) => {
      console.error('Demo loop failed unexpectedly:', error);
      // Ensure state is synchronized on error
      this.isRunning = false;
      this.abortController = null;
      webStore.setDemoLoopRunning(false);
    });

    return { success: true };
  }

  /**
   * Stop the demo loop
   */
  public stop(): { success: boolean } {
    if (!this.isRunning) {
      return { success: true };
    }

    emitDemoTrace('LOOP_STOP', 'Demo loop stopped');
    this.abortController?.abort();
    this.isRunning = false;
    this.abortController = null;

    // Update state
    webStore.setDemoLoopRunning(false);

    return { success: true };
  }

  /**
   * Generate a single demo order (non-looping)
   */
  public generateSingleOrder(): { success: boolean; error?: string } {
    const currentStatus = webStore.getState().transactionStatus;
    if (currentStatus !== 'IDLE') {
      return { success: false, error: 'Transaction in progress' };
    }

    // Clear cart and add demo order
    webStore.clearCart();
    const skus = generateDemoOrder();

    emitDemoTrace('DEMO_ORDER', `${skus.length} items`, { itemCount: skus.length });

    for (const sku of skus) {
      webStore.addItem(sku);
    }

    return { success: true };
  }

  /**
   * Main demo loop - runs until aborted
   */
  private async runLoop(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        await this.runSingleTransaction(signal);
      } catch (error) {
        if (signal.aborted) break;
        console.error('Demo loop transaction error:', error);
        await this.sleepUnlessAborted(randomDelay(DEMO_LOOP_TIMING.errorRecoveryDelay), signal);
      }
    }
  }

  /**
   * Run a single complete transaction cycle
   */
  private async runSingleTransaction(signal: AbortSignal): Promise<void> {
    emitDemoTrace('TXN_START', 'Starting new transaction');

    // Step 1: Generate and add demo order items
    await this.buildOrder(signal);
    if (signal.aborted) return;

    // Step 2: Wait before checkout (simulate cashier verification)
    await this.sleepUnlessAborted(randomDelay(DEMO_LOOP_TIMING.preCheckoutDelay), signal);
    if (signal.aborted) return;

    // Step 3: Start checkout
    emitDemoTrace('CHECKOUT', 'Starting checkout');
    const checkoutResult = webStore.startCheckout();
    if (!checkoutResult.success) {
      emitDemoTrace('CHECKOUT_FAIL', checkoutResult.error);
      webStore.clearCart();
      return;
    }

    // Step 4: Process payment (with retries)
    await this.processPaymentWithRetries(signal);
    if (signal.aborted) return;

    // Step 5: Handle post-payment
    const finalStatus = webStore.getState().transactionStatus;
    if (finalStatus === 'PAID') {
      emitDemoTrace('TXN_COMPLETE', 'Transaction complete');
      await this.sleepUnlessAborted(randomDelay(DEMO_LOOP_TIMING.postPaymentDelay), signal);
      if (signal.aborted) return;
      webStore.resetTransaction();
    } else {
      emitDemoTrace('TXN_ERROR', 'Transaction failed, resetting');
      await this.sleepUnlessAborted(randomDelay(DEMO_LOOP_TIMING.errorRecoveryDelay), signal);
      webStore.cancelCheckout();
    }
  }

  /**
   * Build an order by adding items with realistic delays
   */
  private async buildOrder(signal: AbortSignal): Promise<void> {
    // Clear any existing cart
    webStore.clearCart();

    // Generate demo order SKUs
    const skus = generateDemoOrder();

    // Handle empty catalog gracefully
    if (skus.length === 0) {
      emitDemoTrace('BUILD_ORDER', 'No items available in catalog', { itemCount: 0 });
      return;
    }

    emitDemoTrace('BUILD_ORDER', `${skus.length} items`, { itemCount: skus.length });

    // Add items one by one with delays
    for (const sku of skus) {
      if (signal.aborted) return;
      emitDemoTrace('ADD_ITEM', sku, { sku });
      webStore.addItem(sku);
      await this.sleepUnlessAborted(randomDelay(DEMO_LOOP_TIMING.itemAddDelay), signal);
    }
  }

  /**
   * Process payment with automatic retries on failure
   */
  private async processPaymentWithRetries(signal: AbortSignal): Promise<void> {
    const maxRetries = RETRY_CONFIG.maxRetries;
    let attempt = 0;
    const state = webStore.getState();
    const amountInCents = state.totalInCents;

    while (attempt < maxRetries && !signal.aborted) {
      attempt++;
      emitDemoTrace('PAY_ATTEMPT', `Attempt ${attempt}/${maxRetries}`, {
        attempt,
        maxRetries,
        amountInCents,
      });

      // Process payment
      await webStore.processPayment();

      const currentState = webStore.getState();
      if (currentState.transactionStatus === 'PAID') {
        emitDemoTrace('PAY_SUCCESS', `$${(amountInCents / 100).toFixed(2)}`, { amountInCents });
        return;
      }

      if (currentState.transactionStatus === 'ERROR') {
        emitDemoTrace('PAY_FAIL', currentState.errorMessage ?? 'Unknown error', {
          attempt,
          errorMessage: currentState.errorMessage,
        });

        if (attempt < maxRetries && !signal.aborted) {
          await this.sleepUnlessAborted(randomDelay(DEMO_LOOP_TIMING.retryDelay), signal);
        }
      }
    }
  }

  /**
   * Sleep that can be interrupted by abort signal
   */
  private async sleepUnlessAborted(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }

      const timeout = setTimeout(resolve, ms);

      const abortHandler = () => {
        clearTimeout(timeout);
        resolve();
      };

      signal.addEventListener('abort', abortHandler, { once: true });
    });
  }
}

// Singleton instance
export const webDemoLoopService = new WebDemoLoopService();
