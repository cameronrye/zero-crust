/**
 * DemoLoopService - Orchestrates continuous demo transactions
 *
 * Runs a realistic transaction loop for showcasing the POS system:
 * 1. Generate varied demo order (using DemoService patterns)
 * 2. Wait realistic "cashier verification" time
 * 3. Initiate checkout
 * 4. Process payment (with auto-retry on failure)
 * 5. Brief pause after success
 * 6. Start new transaction and repeat
 *
 * Timing is randomized within realistic ranges to simulate human behavior.
 */

import { createLogger } from './Logger';
import { mainStore } from './MainStore';
import { paymentService } from './PaymentService';
import { generateDemoOrder } from './DemoService';
import { DEMO_LOOP_TIMING, RETRY_CONFIG } from '@shared/config';

const logger = createLogger('DemoLoopService');

/**
 * Generate random delay within a range
 */
function randomDelay(range: readonly [number, number]): number {
  const [min, max] = range;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * DemoLoopService class - Manages the continuous demo loop
 */
class DemoLoopService {
  private isRunning = false;
  private abortController: AbortController | null = null;
  private loopPromise: Promise<void> | null = null;

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
      logger.warn('Demo loop already running');
      return { success: false, error: 'Demo loop is already running' };
    }

    // Only start from IDLE state
    const currentStatus = mainStore.getState().transactionStatus;
    if (currentStatus !== 'IDLE') {
      logger.warn('Cannot start demo loop - transaction in progress', { status: currentStatus });
      return { success: false, error: 'Complete current transaction before starting demo loop' };
    }

    logger.info('Starting demo loop');
    this.isRunning = true;
    this.abortController = new AbortController();

    // Start the loop (don't await - runs in background)
    this.loopPromise = this.runLoop(this.abortController.signal);

    // Broadcast state update
    mainStore.setDemoLoopRunning(true);

    return { success: true };
  }

  /**
   * Stop the demo loop
   */
  public stop(): { success: boolean } {
    if (!this.isRunning) {
      logger.debug('Demo loop not running');
      return { success: true };
    }

    logger.info('Stopping demo loop');
    this.abortController?.abort();
    this.isRunning = false;
    this.abortController = null;

    // Broadcast state update
    mainStore.setDemoLoopRunning(false);

    return { success: true };
  }

  /**
   * Main demo loop - runs until aborted
   */
  private async runLoop(signal: AbortSignal): Promise<void> {
    logger.info('Demo loop started');

    while (!signal.aborted) {
      try {
        await this.runSingleTransaction(signal);
      } catch (error) {
        if (signal.aborted) break;
        logger.error('Demo loop transaction error', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Brief pause before retrying
        await this.sleepUnlessAborted(randomDelay(DEMO_LOOP_TIMING.errorRecoveryDelay), signal);
      }
    }

    logger.info('Demo loop stopped');
  }

  /**
   * Run a single complete transaction cycle
   */
  private async runSingleTransaction(signal: AbortSignal): Promise<void> {
    // Step 1: Generate and add demo order items
    await this.buildOrder(signal);
    if (signal.aborted) return;

    // Step 2: Wait before checkout (simulate cashier verification)
    await this.sleepUnlessAborted(randomDelay(DEMO_LOOP_TIMING.preCheckoutDelay), signal);
    if (signal.aborted) return;

    // Step 3: Start checkout
    const checkoutResult = mainStore.startCheckout();
    if (!checkoutResult.success) {
      logger.warn('Checkout failed in demo loop', { error: checkoutResult.error });
      mainStore.clearCart();
      return;
    }

    // Step 4: Process payment (with retries)
    await this.processPaymentWithRetries(signal);
    if (signal.aborted) return;

    // Step 5: Handle post-payment
    const finalStatus = mainStore.getState().transactionStatus;
    if (finalStatus === 'PAID') {
      // Wait briefly then start new transaction
      await this.sleepUnlessAborted(randomDelay(DEMO_LOOP_TIMING.postPaymentDelay), signal);
      if (signal.aborted) return;
      mainStore.resetTransaction();
      paymentService.reset();
    } else {
      // Error state - reset and continue
      await this.sleepUnlessAborted(randomDelay(DEMO_LOOP_TIMING.errorRecoveryDelay), signal);
      mainStore.cancelCheckout();
      paymentService.reset();
    }
  }

  /**
   * Build an order by adding items with realistic delays
   */
  private async buildOrder(signal: AbortSignal): Promise<void> {
    // Clear any existing cart
    mainStore.clearCart();

    // Generate demo order SKUs
    const skus = generateDemoOrder();
    logger.debug('Building demo order', { itemCount: skus.length });

    // Add items one by one with delays
    for (const sku of skus) {
      if (signal.aborted) return;
      mainStore.addItem(sku);
      await this.sleepUnlessAborted(randomDelay(DEMO_LOOP_TIMING.itemAddDelay), signal);
    }
  }

  /**
   * Process payment with automatic retries on failure
   */
  private async processPaymentWithRetries(signal: AbortSignal): Promise<void> {
    const maxRetries = RETRY_CONFIG.maxRetries;
    let attempt = 0;

    while (attempt < maxRetries && !signal.aborted) {
      // Start payment processing
      const startResult = mainStore.startPaymentProcessing();
      if (!startResult.success) {
        logger.warn('Failed to start payment processing', { error: startResult.error });
        return;
      }

      // Process via mock gateway
      const paymentResult = await paymentService.process({
        amountInCents: mainStore.getCartTotal(),
        transactionId: startResult.transactionId,
      });

      if (paymentResult.success) {
        // Success! Complete the transaction
        mainStore.handlePaymentSuccess(paymentResult.transactionId!);
        logger.info('Demo payment successful', { attempt: attempt + 1 });
        return;
      }

      // Payment failed
      attempt++;
      logger.info('Demo payment failed, will retry', {
        attempt,
        maxRetries,
        errorCode: paymentResult.errorCode,
      });

      // Update error state for UI visibility
      mainStore.handlePaymentFailure(paymentResult.errorMessage || 'Payment failed');

      if (attempt < maxRetries && !signal.aborted) {
        // Wait before retry
        await this.sleepUnlessAborted(randomDelay(DEMO_LOOP_TIMING.retryDelay), signal);
      }
    }

    logger.warn('Demo payment failed after max retries');
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
export const demoLoopService = new DemoLoopService();

