// No @types/node in this project (zero dependencies, nothing to install), so
// tsc has no declaration for the built-in "node:test" module. This is the
// minimal surface the test files actually call; Node supplies the real
// implementation at runtime.
declare module "node:test" {
  export function test(name: string, fn: () => void | Promise<void>): void;
}
