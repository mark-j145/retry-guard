import { test } from "node:test";
import { fixed, exponential, withJitter } from "../src/backoff.js";
import { assertEqual, assertThrows, assertTrue } from "./helpers.js";

test("fixed returns the same delay for every attempt", () => {
  const strategy = fixed(1000);
  assertEqual(strategy(1), 1000);
  assertEqual(strategy(2), 1000);
  assertEqual(strategy(10), 1000);
});

test("fixed rejects a negative delay", () => {
  assertThrows(() => fixed(-1), RangeError);
});

test("exponential doubles by default starting from baseMs", () => {
  const strategy = exponential({ baseMs: 100 });
  assertEqual(strategy(1), 100);
  assertEqual(strategy(2), 200);
  assertEqual(strategy(3), 400);
  assertEqual(strategy(4), 800);
});

test("exponential honors a custom factor", () => {
  const strategy = exponential({ baseMs: 100, factor: 3 });
  assertEqual(strategy(1), 100);
  assertEqual(strategy(2), 300);
  assertEqual(strategy(3), 900);
});

test("exponential caps the delay at maxMs", () => {
  const strategy = exponential({ baseMs: 100, factor: 2, maxMs: 250 });
  assertEqual(strategy(1), 100);
  assertEqual(strategy(2), 200);
  assertEqual(strategy(3), 250);
  assertEqual(strategy(10), 250);
});

test("exponential validates its options", () => {
  assertThrows(() => exponential({ baseMs: -1 }), RangeError);
  assertThrows(() => exponential({ factor: 0.5 }), RangeError);
  assertThrows(() => exponential({ baseMs: 500, maxMs: 100 }), RangeError);
});

test("withJitter stays within +/- ratio of the underlying value", () => {
  const strategy = withJitter(fixed(1000), 0.5);
  for (let i = 0; i < 100; i++) {
    const delay = strategy(1);
    assertTrue(delay >= 500 && delay <= 1500, `delay ${delay} out of range`);
  }
});

test("withJitter with ratio 0 returns the underlying value exactly", () => {
  const strategy = withJitter(fixed(1000), 0);
  assertEqual(strategy(1), 1000);
});

test("withJitter rejects an out-of-range ratio", () => {
  assertThrows(() => withJitter(fixed(1000), -0.1), RangeError);
  assertThrows(() => withJitter(fixed(1000), 1.1), RangeError);
});
