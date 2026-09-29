import { expect, it } from 'vitest';

it('installs the console guard on console.error and console.warn', () => {
  const marker = Symbol.for('goodboy.consoleGuard');

  expect(Reflect.get(console.error, marker)).toBe(true);
  expect(Reflect.get(console.warn, marker)).toBe(true);
});
