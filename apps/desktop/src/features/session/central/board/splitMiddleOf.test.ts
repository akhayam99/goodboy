// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { splitMiddleOf } from './splitMiddleOf';

describe('splitMiddleOf', () => {
  it('keeps a short name whole', () => {
    expect(splitMiddleOf({ text: 'ak/fix-header' })).toEqual({ head: 'ak/fix-header', tail: '' });
  });

  it('keeps the end of a long name so the middle is what gets cut', () => {
    const name = 'ak/refactor-patient-journaling-sticky-notes-panel';
    const { head, tail } = splitMiddleOf({ text: name });

    expect(tail.length).toBeGreaterThan(0);
    expect(`${head}${tail}`).toBe(name);
    expect(name.endsWith(tail)).toBe(true);
  });
});
