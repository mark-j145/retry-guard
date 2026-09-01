// A backoff strategy maps a 1-indexed attempt number to a delay in
// milliseconds to wait before the next attempt.
export type BackoffStrategy = (attempt: number) => number;

export function fixed(delayMs: number): BackoffStrategy {
  if (delayMs < 0) {
    throw new RangeError("delayMs must be non-negative");
  }
  return () => delayMs;
}

export interface ExponentialOptions {
  baseMs?: number;
  factor?: number;
  maxMs?: number;
}

export function exponential(options: ExponentialOptions = {}): BackoffStrategy {
  const { baseMs = 200, factor = 2, maxMs = 30_000 } = options;
  if (baseMs < 0) throw new RangeError("baseMs must be non-negative");
  if (factor < 1) throw new RangeError("factor must be at least 1");
  if (maxMs < baseMs) throw new RangeError("maxMs must be at least baseMs");

  return (attempt: number) => {
    const raw = baseMs * factor ** (attempt - 1);
    return Math.min(raw, maxMs);
  };
}

// Wraps a strategy so the delay is spread over a random range around the
// underlying value, +/- ratio. Without this, many concurrent callers that
// fail at the same moment retry in lockstep and hit the downstream service
// with synchronized bursts instead of a smoothed-out trickle.
export function withJitter(strategy: BackoffStrategy, ratio = 0.5): BackoffStrategy {
  if (ratio < 0 || ratio > 1) {
    throw new RangeError("ratio must be between 0 and 1");
  }
  return (attempt: number) => {
    const base = strategy(attempt);
    const spread = base * ratio;
    return base - spread + Math.random() * spread * 2;
  };
}
