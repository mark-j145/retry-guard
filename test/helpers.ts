// Small hand-rolled assertions so the tests don't need node:assert's type
// declarations, which would otherwise require installing @types/node.

function describe(value: unknown): string {
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(message ?? `expected ${describe(expected)}, got ${describe(actual)}`);
  }
}

export function assertDeepEqual(actual: unknown, expected: unknown, message?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(message ?? `expected ${e}, got ${a}`);
  }
}

export function assertTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function assertThrows(fn: () => unknown, expected: new (...args: any[]) => Error): void {
  try {
    fn();
  } catch (err) {
    if (err instanceof expected) return;
    throw new Error(`expected ${expected.name}, got ${err instanceof Error ? err.constructor.name : describe(err)}`);
  }
  throw new Error(`expected function to throw ${expected.name}`);
}

export async function assertRejects(promise: Promise<unknown>, check?: (error: unknown) => void): Promise<void> {
  try {
    await promise;
  } catch (err) {
    check?.(err);
    return;
  }
  throw new Error("expected promise to reject");
}
