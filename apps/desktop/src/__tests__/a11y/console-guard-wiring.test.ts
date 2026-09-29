import { expect, it } from 'vitest';
import { CONSOLE_GUARD_MARKER } from '../../test/consoleKey';

it('installs the console guard on console.error and console.warn in the a11y project', () => {
  expect(Reflect.get(console.error, CONSOLE_GUARD_MARKER)).toBe(true);
  expect(Reflect.get(console.warn, CONSOLE_GUARD_MARKER)).toBe(true);
});
