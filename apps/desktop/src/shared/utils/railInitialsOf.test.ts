// @vitest-environment node

import { expect, it } from 'vitest';
import { railInitialsOf } from './railInitialsOf';

it.each([
  ['Harborline notify-relay', 'HN'],
  ['Northwind ledger-core', 'NL'],
  ['Cascadia', 'CA'],
  ['  Acme   payments-api  ', 'AP'],
  ['', '?'],
])('names the folded session %s with %s', (title, expected) => {
  expect(railInitialsOf({ title })).toBe(expected);
});
