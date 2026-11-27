import { describe, expect, it } from 'vitest';
import { sinceTextOf } from './sinceTextOf';

const NOW = new Date(2026, 10, 27, 15, 0, 0).getTime();
const at = (day: number, hour: number, minute: number) =>
  new Date(2026, 10, day, hour, minute, 0).toISOString();

describe('sinceTextOf', () => {
  it('gives the clock for a time today', () => {
    expect(sinceTextOf({ at: at(27, 9, 12), now: NOW })).toMatch(/^0?9:12/);
  });

  it('names yesterday before the clock', () => {
    expect(sinceTextOf({ at: at(26, 18, 20), now: NOW })).toMatch(/^yesterday, /);
  });

  it('gives the date for a time older than a week', () => {
    expect(sinceTextOf({ at: at(3, 9, 0), now: NOW })).toMatch(/^Nov 3, /);
  });

  it('gives nothing for a time that is not a date', () => {
    expect(sinceTextOf({ at: 'never', now: NOW })).toBe('');
  });
});
