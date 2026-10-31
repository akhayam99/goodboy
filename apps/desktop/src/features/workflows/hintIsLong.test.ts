import { describe, expect, it } from 'vitest';
import { hintIsLong } from './hintIsLong';

describe('hintIsLong', () => {
  it('keeps a short single line inline', () => {
    expect(hintIsLong({ text: 'Also cover the chargebacks.' })).toBe(false);
  });

  it('expands a second line or a long line', () => {
    expect(hintIsLong({ text: 'Cover refunds.\nThen chargebacks.' })).toBe(true);
    expect(hintIsLong({ text: 'x'.repeat(61) })).toBe(true);
    expect(hintIsLong({ text: 'x'.repeat(60) })).toBe(false);
  });

  it('ignores trailing newlines', () => {
    expect(hintIsLong({ text: 'Cover refunds.\n\n' })).toBe(false);
  });
});
