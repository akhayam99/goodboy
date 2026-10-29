import { describe, expect, it } from 'vitest';
import { stripControlMarkers } from './marker-parsing';

describe('the outcome line marker', () => {
  it('is stripped from visible text', () => {
    const text =
      '<<outcome>>Done: retry posts one credit.<</outcome>>\n\nThe guard keys on the event id.';
    expect(stripControlMarkers(text)).toBe('The guard keys on the event id.');
  });
});
