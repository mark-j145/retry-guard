import { test } from "node:test";
import { retry, RetryExhaustedError } from "../src/index.js";
import { fixed } from "../src/backoff.js";
import { assertDeepEqual, assertEqual, assertRejects, assertTrue } from "./helpers.js";

function networkError() {
  return Object.assign(new Error("connection reset"), { code: "ECONNRESET" });
}

function validationError() {
  return Object.assign(new Error("bad request"), { status: 400 });
}

test("returns the result on first success without retrying", async () => {
  let calls = 0;
  const result = await retry(
    async () => {
      calls++;
      return "ok";
    },
    { maxAttempts: 3 },
  );
  assertEqual(result, "ok");
  assertEqual(calls, 1);
});

test("strict mode retries a classifiable transient error until it succeeds", async () => {
  let calls = 0;
  const result = await retry(
    async () => {
      calls++;
      if (calls < 3) throw networkError();
      return "ok";
    },
    { maxAttempts: 5, backoff: fixed(0) },
  );
  assertEqual(result, "ok");
  assertEqual(calls, 3);
});

test("strict mode throws the original error immediately for an unclassifiable failure", async () => {
  let calls = 0;
  await assertRejects(
    retry(
      async () => {
        calls++;
        throw validationError();
      },
      { maxAttempts: 5, backoff: fixed(0) },
    ),
    (err) => {
      assertTrue(err instanceof Error, "expected an Error");
      assertEqual((err as { status?: number }).status, 400);
    },
  );
  assertEqual(calls, 1);
});

test("lenient mode retries even unclassifiable errors", async () => {
  let calls = 0;
  const result = await retry(
    async () => {
      calls++;
      if (calls < 3) throw validationError();
      return "ok";
    },
    { maxAttempts: 5, backoff: fixed(0), lenient: true },
  );
  assertEqual(result, "ok");
  assertEqual(calls, 3);
});

test("isRetryable overrides both strict classification and lenient", async () => {
  let calls = 0;
  await assertRejects(
    retry(
      async () => {
        calls++;
        throw networkError();
      },
      { maxAttempts: 3, backoff: fixed(0), lenient: true, isRetryable: () => false },
    ),
  );
  assertEqual(calls, 1);
});

test("throws RetryExhaustedError with attempts and cause once attempts run out", async () => {
  let calls = 0;
  const failure = networkError();
  await assertRejects(
    retry(
      async () => {
        calls++;
        throw failure;
      },
      { maxAttempts: 3, backoff: fixed(0) },
    ),
    (err) => {
      assertTrue(err instanceof RetryExhaustedError, "expected a RetryExhaustedError");
      const exhausted = err as RetryExhaustedError;
      assertEqual(exhausted.attempts, 3);
      assertEqual(exhausted.cause, failure);
    },
  );
  assertEqual(calls, 3);
});

test("calls onRetry with attempt, error, and delay before each retry", async () => {
  const seen: Array<{ attempt: number; delayMs: number }> = [];
  let calls = 0;
  await retry(
    async () => {
      calls++;
      if (calls < 3) throw networkError();
      return "ok";
    },
    {
      maxAttempts: 5,
      backoff: fixed(5),
      onRetry: (info) => seen.push({ attempt: info.attempt, delayMs: info.delayMs }),
    },
  );
  assertDeepEqual(seen, [
    { attempt: 1, delayMs: 5 },
    { attempt: 2, delayMs: 5 },
  ]);
});

test("rejects a non-integer or non-positive maxAttempts", async () => {
  await assertRejects(retry(async () => "ok", { maxAttempts: 0 }));
  await assertRejects(retry(async () => "ok", { maxAttempts: 1.5 }));
});

test("aborts an in-progress wait when the signal fires", async () => {
  const controller = new AbortController();
  let calls = 0;
  const promise = retry(
    async () => {
      calls++;
      throw networkError();
    },
    { maxAttempts: 5, backoff: fixed(1000), signal: controller.signal },
  );
  queueMicrotask(() => controller.abort(new Error("cancelled")));
  await assertRejects(promise, (err) => {
    assertTrue(err instanceof Error && err.message === "cancelled", "expected the abort reason to propagate");
  });
  assertEqual(calls, 1);
});

test("timeoutMs fails an attempt that never settles, and it counts as a retryable timeout", async () => {
  let calls = 0;
  const result = await retry(
    () =>
      new Promise<string>((resolve) => {
        calls++;
        if (calls < 2) return; // never settles; the timeout has to fire
        resolve("ok");
      }),
    { maxAttempts: 3, backoff: fixed(0), timeoutMs: 5 },
  );
  assertEqual(result, "ok");
  assertEqual(calls, 2);
});

test("timeoutMs does not cut short an attempt that settles in time", async () => {
  let calls = 0;
  const result = await retry(
    async () => {
      calls++;
      return "ok";
    },
    { maxAttempts: 3, timeoutMs: 1000 },
  );
  assertEqual(result, "ok");
  assertEqual(calls, 1);
});

test("rejects a non-positive or non-finite timeoutMs", async () => {
  await assertRejects(retry(async () => "ok", { maxAttempts: 1, timeoutMs: 0 }));
  await assertRejects(retry(async () => "ok", { maxAttempts: 1, timeoutMs: -5 }));
  await assertRejects(retry(async () => "ok", { maxAttempts: 1, timeoutMs: Infinity }));
});

test("does not start a new attempt once the signal is already aborted", async () => {
  const controller = new AbortController();
  controller.abort(new Error("cancelled up front"));
  let calls = 0;
  await assertRejects(
    retry(
      async () => {
        calls++;
        return "ok";
      },
      { maxAttempts: 3, signal: controller.signal },
    ),
    (err) => {
      assertTrue(err instanceof Error && err.message === "cancelled up front", "expected the abort reason to propagate");
    },
  );
  assertEqual(calls, 0);
});
