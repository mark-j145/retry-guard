import { test } from "node:test";
import { isSafeToRetry } from "../src/classify.js";
import { assertEqual } from "./helpers.js";

test("retries known transient network error codes", () => {
  for (const code of ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "EPIPE", "ENETUNREACH", "EHOSTUNREACH"]) {
    assertEqual(isSafeToRetry({ code }), true, `expected ${code} to be retryable`);
  }
});

test("does not retry unrecognized network codes", () => {
  assertEqual(isSafeToRetry({ code: "ENOENT" }), false);
});

test("retries known transient HTTP status codes via status or statusCode", () => {
  for (const status of [408, 425, 429, 502, 503, 504]) {
    assertEqual(isSafeToRetry({ status }), true, `expected status ${status} to be retryable`);
    assertEqual(isSafeToRetry({ statusCode: status }), true, `expected statusCode ${status} to be retryable`);
  }
});

test("does not retry a generic 500", () => {
  assertEqual(isSafeToRetry({ status: 500 }), false);
});

test("does not retry a 400", () => {
  assertEqual(isSafeToRetry({ status: 400 }), false);
});

test("retries a DOMException TimeoutError", () => {
  assertEqual(isSafeToRetry(new DOMException("timed out", "TimeoutError")), true);
});

test("does not retry other DOMException names", () => {
  assertEqual(isSafeToRetry(new DOMException("aborted", "AbortError")), false);
});

test("does not retry values with no classifiable shape", () => {
  assertEqual(isSafeToRetry(new Error("plain error")), false);
  assertEqual(isSafeToRetry("boom"), false);
  assertEqual(isSafeToRetry(42), false);
  assertEqual(isSafeToRetry(undefined), false);
  assertEqual(isSafeToRetry(null), false);
});

test("ignores non-string code and non-number status fields", () => {
  assertEqual(isSafeToRetry({ code: 429 }), false);
  assertEqual(isSafeToRetry({ status: "429" }), false);
});
