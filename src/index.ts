import { isSafeToRetry } from "./classify.js";
import { exponential, type BackoffStrategy } from "./backoff.js";

export { isSafeToRetry } from "./classify.js";
export { fixed, exponential, withJitter, type BackoffStrategy } from "./backoff.js";

export interface RetryAttemptInfo {
  attempt: number;
  error: unknown;
  delayMs: number;
}

export interface RetryOptions {
  /** Total number of attempts, including the first one. Must be >= 1. */
  maxAttempts: number;
  /** Delay strategy between attempts. Defaults to exponential(). */
  backoff?: BackoffStrategy;
  /**
   * Escape hatch: retry every error, not just the ones this library
   * recognizes as safe. Opt in explicitly when you know your operation is
   * idempotent, or when you are retrying something this library doesn't
   * classify (a custom RPC error shape, for example).
   */
  lenient?: boolean;
  /**
   * Overrides both the strict classifier and `lenient`. Use this when you
   * need precise control, e.g. retrying your own error subclass while still
   * refusing to retry everything else.
   */
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (info: RetryAttemptInfo) => void;
  signal?: AbortSignal;
}

export class RetryExhaustedError extends Error {
  readonly attempts: number;
  readonly cause: unknown;

  constructor(attempts: number, cause: unknown) {
    super(`retry exhausted after ${attempts} attempt${attempts === 1 ? "" : "s"}`);
    this.name = "RetryExhaustedError";
    this.attempts = attempts;
    this.cause = cause;
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal!.reason ?? new Error("aborted"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxAttempts, backoff = exponential(), lenient = false, isRetryable, onRetry, signal } = options;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError("maxAttempts must be an integer >= 1");
  }

  const canRetry = isRetryable ?? (lenient ? () => true : isSafeToRetry);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    signal?.throwIfAborted();
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt >= maxAttempts;
      if (isLastAttempt) {
        throw new RetryExhaustedError(attempt, error);
      }
      if (!canRetry(error)) {
        // Not exhausted, just not worth repeating. Surface the original
        // error rather than wrapping it, so callers can `catch` it the same
        // way they would without this library involved.
        throw error;
      }
      const delayMs = backoff(attempt);
      onRetry?.({ attempt, error, delayMs });
      await sleep(delayMs, signal);
    }
  }

  // Unreachable: the loop above always returns or throws.
  throw new Error("unreachable");
}
