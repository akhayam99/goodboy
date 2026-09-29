// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatRelativeAge } from './relativeDate';

const NOW = 1_700_000_000_000;

describe('formatRelativeAge', () => {
  it('reads the age against the given clock', () => {
    expect(
      formatRelativeAge({ fromIso: new Date(NOW - 5 * 60_000).toISOString(), nowMs: NOW }),
    ).toBe('5m ago');
  });

  it('falls back to the wall clock when none is given', () => {
    expect(formatRelativeAge({ fromIso: new Date(Date.now() - 2 * 3_600_000).toISOString() })).toBe(
      '2h ago',
    );
  });

  it('returns an empty string for an invalid timestamp', () => {
    expect(formatRelativeAge({ fromIso: 'nope', nowMs: NOW })).toBe('');
  });
});
