// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { countSlotText } from './countSlotText';

describe('countSlotText', () => {
  it('shows a count from one', () => {
    expect(countSlotText({ count: 1 })).toBe('1');
    expect(countSlotText({ count: 12 })).toBe('12');
  });

  it('says nothing at zero, while loading or when the read is unknown', () => {
    expect(countSlotText({ count: 0 })).toBeNull();
    expect(countSlotText({ count: null })).toBeNull();
    expect(countSlotText({ count: Number.NaN })).toBeNull();
    expect(countSlotText({ count: -3 })).toBeNull();
  });

  it('starts at two beside a glyph that already says one', () => {
    expect(countSlotText({ count: 1, isBesideGlyph: true })).toBeNull();
    expect(countSlotText({ count: 2, isBesideGlyph: true })).toBe('2');
  });

  it('groups large counts the way the rest of the app writes integers', () => {
    expect(countSlotText({ count: 1024 })).toBe('1,024');
  });
});
