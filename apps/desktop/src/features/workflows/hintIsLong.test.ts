import { describe, expect, it } from 'vitest';
import { hintIsLong } from './hintIsLong';

describe('hintIsLong', () => {
  it('keeps a short single line inline while it fits', () => {
    expect(hintIsLong({ text: 'Also cover the chargebacks.', isClipped: false })).toBe(false);
  });

  it('expands a second line whatever the width', () => {
    expect(hintIsLong({ text: 'Cover refunds.\nThen chargebacks.', isClipped: false })).toBe(true);
  });

  it('expands any line the pane cuts, however short', () => {
    expect(hintIsLong({ text: 'Cover refunds.', isClipped: true })).toBe(true);
  });

  it('does not expand a long line that still fits', () => {
    expect(hintIsLong({ text: 'x'.repeat(90), isClipped: false })).toBe(false);
  });

  it('ignores trailing newlines', () => {
    expect(hintIsLong({ text: 'Cover refunds.\n\n', isClipped: false })).toBe(false);
  });
});
