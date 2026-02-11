/**
 * Retry wrapper with exponential backoff.
 * Handles transient failures gracefully.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts. Default: 3 */
  maxRetries?: number;
  /** Initial delay in milliseconds. Default: 1000 */
  initialDelayMs?: number;
  /** Backoff multiplier. Default: 2 */
  backoffMultiplier?: number;
  /** Maximum delay in milliseconds. Default: 30000 */
  maxDelayMs?: number;
  /** Optional function to determine if error is retryable. Default: all errors */
  isRetryable?: (error: unknown) => boolean;
  /** Optional callback for logging retry attempts */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export class RetryExhaustedError extends Error {
  public readonly lastError: unknown;
  public readonly attempts: number;

  constructor(lastError: unknown, attempts: number) {
    super(`All ${attempts} retry attempts exhausted`);
    this.name = "RetryExhaustedError";
    this.lastError = lastError;
    this.attempts = attempts;
  }
}

/**
 * Execute an async function with automatic retries and exponential backoff.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws RetryExhaustedError if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    backoffMultiplier = 2,
    maxDelayMs = 30000,
    isRetryable = () => true,
    onRetry,
  } = options;

  let lastError: unknown;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= maxRetries || !isRetryable(error)) {
        break;
      }

      // Log retry attempt if callback provided
      if (onRetry) {
        onRetry(error, attempt, delayMs);
      }

      // Wait before next attempt
      await sleep(delayMs);

      // Calculate next delay with exponential backoff
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }

  throw new RetryExhaustedError(lastError, maxRetries);
}

/**
 * Helper function to sleep for a given duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pre-configured retry options for HTTP requests.
 * Retries on network errors and 5xx status codes.
 */
export const httpRetryOptions: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  isRetryable: (error) => {
    // Retry on network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return true;
    }
    // Retry on timeout errors
    if (error instanceof Error && error.name === "FetchTimeoutError") {
      return true;
    }
    return true; // Default to retry
  },
  onRetry: (error, attempt, delayMs) => {
    console.warn(
      `[Retry] Attempt ${attempt} failed, retrying in ${delayMs}ms:`,
      error instanceof Error ? error.message : error
    );
  },
};
