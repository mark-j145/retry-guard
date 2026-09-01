# retry-guard

Retry policies for TypeScript that default to strict.

Most retry libraries retry on any thrown error unless you tell them not to.
That's convenient right up until an operation with a side effect (charging a
card, submitting an order, sending an email) gets retried after a 500 or a
JSON parse error that had nothing to do with network flakiness, and now
you've done it twice. This library flips the default: out of the box it only
retries errors it can positively identify as transient (connection resets,
timeouts, DNS hiccups, 429/502/503/504). Anything it doesn't recognize is
thrown straight through on the first failure, same as if you weren't using a
retry wrapper at all.

If you want the old "retry anything" behavior, ask for it explicitly with
`lenient: true`.

## Install

No package has been published yet. For now, copy `src/` into your project or
add this repository as a git dependency. Zero runtime dependencies either
way.

## Usage

```ts
import { retry } from "./src/index.js";

const result = await retry(
  () => fetch("https://api.example.com/orders").then((r) => {
    if (!r.ok) {
      const err = new Error(`request failed: ${r.status}`);
      (err as any).status = r.status;
      throw err;
    }
    return r.json();
  }),
  { maxAttempts: 4 },
);
```

A `503` or `429` here gets retried with exponential backoff. A `400` does
not — strict mode has no way to know the request wasn't just malformed, so
it fails fast instead of hammering the server with a request that will never
succeed.

### The lenient escape hatch

Sometimes you know better than the built-in classifier: the operation is
idempotent, or the errors you're catching aren't the shapes this library
recognizes.

```ts
import { retry } from "./src/index.js";

await retry(() => runIdempotentJob(), {
  maxAttempts: 5,
  lenient: true, // retry regardless of error shape
});
```

### Full control

For anything in between, supply your own classifier. This overrides both the
strict default and `lenient`:

```ts
import { retry } from "./src/index.js";

class RateLimited extends Error {}

await retry(() => callThirdPartyApi(), {
  maxAttempts: 3,
  isRetryable: (err) => err instanceof RateLimited,
});
```

### Backoff strategies

```ts
import { retry, fixed, exponential, withJitter } from "./src/index.js";

await retry(fn, { maxAttempts: 5, backoff: fixed(1000) });

await retry(fn, {
  maxAttempts: 5,
  backoff: withJitter(exponential({ baseMs: 200, factor: 2, maxMs: 10_000 })),
});
```

### Cancellation

```ts
const controller = new AbortController();
await retry(fn, { maxAttempts: 5, signal: controller.signal });
```

### Errors

- If every attempt fails, `retry` throws `RetryExhaustedError`, with
  `.attempts` and `.cause` set to the last underlying error.
- If an error is encountered that the active classifier declines to retry,
  `retry` throws that original error immediately, unwrapped.

## Status

Early skeleton. See the roadmap in commit history for what's planned next.

## License

MIT
