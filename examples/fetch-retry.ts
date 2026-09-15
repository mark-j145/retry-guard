// A small wrapper showing how to plug `retry` into `fetch`. Fetch doesn't
// throw on non-2xx responses, so without this the strict classifier never
// gets a chance to see the status code — you have to raise it yourself.
import { retry, type RetryOptions } from "../src/index.js";

export class HttpError extends Error {
  readonly status: number;
  readonly response: Response;

  constructor(response: Response) {
    super(`request failed: ${response.status} ${response.statusText}`);
    this.name = "HttpError";
    this.status = response.status;
    this.response = response;
  }
}

// `fetchImpl` defaults to the global fetch but can be swapped out in tests
// so callers don't need a real network connection to exercise retry logic.
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  retryOptions: RetryOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  return retry(async () => {
    const response = await fetchImpl(input, init);
    if (!response.ok) {
      throw new HttpError(response);
    }
    return response;
  }, retryOptions);
}
