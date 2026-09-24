import { describe, expect, it } from 'vitest';
import { dayLabel } from './dayLabel';

describe('dayLabel', () => {
  it('names today as nothing and yesterday by name', () => {
    const now = new Date('2026-09-14T12:00:00');

    expect(dayLabel({ at: '2026-09-14T08:00:00', now })).toBeNull();
    expect(dayLabel({ at: '2026-09-13T08:00:00', now })).toBe('Yesterday');
  });

  it('writes older days in the app locale', () => {
    expect(dayLabel({ at: '2026-09-03T08:00:00', now: new Date('2026-09-14T12:00:00') })).toBe(
      'Sep 3',
    );
  });
});
