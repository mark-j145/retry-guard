// Errors that are safe to retry in strict mode: transient network failures and
// HTTP responses that explicitly signal "try again" (rate limiting, brief
// unavailability). Anything else is treated as unknown, and strict mode does
// not gamble on unknown errors being safe to repeat.

const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
  "ENETUNREACH",
  "EHOSTUNREACH",
]);

// 408 Request Timeout, 425 Too Early, 429 Too Many Requests, 502/503/504
// gateway and availability errors. Deliberately excludes 500: a generic
// server error gives no evidence that a retry will behave any differently.
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 502, 503, 504]);

function readNumber(source: object, key: string): number | undefined {
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

function readString(source: object, key: string): string | undefined {
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

export function isSafeToRetry(error: unknown): boolean {
  if (error == null || typeof error !== "object") {
    // Strings, numbers, undefined thrown as errors carry no classifiable
    // information, so strict mode refuses to retry them.
    return false;
  }

  const code = readString(error, "code");
  if (code !== undefined && RETRYABLE_NETWORK_CODES.has(code)) {
    return true;
  }

  const status = readNumber(error, "status") ?? readNumber(error, "statusCode");
  if (status !== undefined && RETRYABLE_STATUS_CODES.has(status)) {
    return true;
  }

  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "TimeoutError";
  }

  return false;
}
