import { test } from "node:test";
import { fetchWithRetry, HttpError } from "../examples/fetch-retry.js";
import { fixed } from "../src/backoff.js";
import { assertEqual, assertRejects, assertTrue } from "./helpers.js";

function fakeResponse(status: number): Response {
  return new Response(null, { status, statusText: `status ${status}` });
}

test("returns the response on success without retrying", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return fakeResponse(200);
  };
  const response = await fetchWithRetry("https://example.test", undefined, { maxAttempts: 3 }, fetchImpl);
  assertEqual(response.status, 200);
  assertEqual(calls, 1);
});

test("retries a 503 until it succeeds", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return fakeResponse(calls < 3 ? 503 : 200);
  };
  const response = await fetchWithRetry(
    "https://example.test",
    undefined,
    { maxAttempts: 5, backoff: fixed(0) },
    fetchImpl,
  );
  assertEqual(response.status, 200);
  assertEqual(calls, 3);
});

test("does not retry a 400", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return fakeResponse(400);
  };
  await assertRejects(
    fetchWithRetry("https://example.test", undefined, { maxAttempts: 5, backoff: fixed(0) }, fetchImpl),
    (err) => {
      assertTrue(err instanceof HttpError, "expected an HttpError");
      assertEqual((err as HttpError).status, 400);
    },
  );
  assertEqual(calls, 1);
});
