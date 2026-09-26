import { describe, expect, it } from 'vitest';
import { nextSweepRecord, shouldSweep } from './updateSweepGate';

const HOUR_MS = 60 * 60_000;
const DAY_ONE = new Date('2026-09-22T10:00:00Z').getTime();

describe('shouldSweep', () => {
  it('allows the first sweep, with no record yet', () => {
    expect(shouldSweep({ nowMs: DAY_ONE, record: null })).toBe(true);
  });

  it('blocks a second sweep less than an hour after the last one', () => {
    const record = { lastSweepAt: DAY_ONE, dayKey: '2026-09-22', countToday: 1 };
    expect(shouldSweep({ nowMs: DAY_ONE + HOUR_MS - 1, record })).toBe(false);
  });

  it('allows a sweep exactly an hour after the last one', () => {
    const record = { lastSweepAt: DAY_ONE, dayKey: '2026-09-22', countToday: 1 };
    expect(shouldSweep({ nowMs: DAY_ONE + HOUR_MS, record })).toBe(true);
  });

  it('blocks a sweep once the day has already had 6', () => {
    const record = { lastSweepAt: DAY_ONE, dayKey: '2026-09-22', countToday: 6 };
    expect(shouldSweep({ nowMs: DAY_ONE + HOUR_MS, record })).toBe(false);
  });

  it('resets the daily cap on a new day even with a recent sweep', () => {
    const record = { lastSweepAt: DAY_ONE, dayKey: '2026-09-22', countToday: 6 };
    const nextDay = DAY_ONE + 20 * HOUR_MS;
    expect(shouldSweep({ nowMs: nextDay, record })).toBe(true);
  });
});

describe('nextSweepRecord', () => {
  it('starts a fresh count when there is no record', () => {
    expect(nextSweepRecord({ nowMs: DAY_ONE, record: null })).toEqual({
      lastSweepAt: DAY_ONE,
      dayKey: '2026-09-22',
      countToday: 1,
    });
  });

  it('increments the count within the same day', () => {
    const record = { lastSweepAt: DAY_ONE, dayKey: '2026-09-22', countToday: 2 };
    expect(nextSweepRecord({ nowMs: DAY_ONE + HOUR_MS, record })).toEqual({
      lastSweepAt: DAY_ONE + HOUR_MS,
      dayKey: '2026-09-22',
      countToday: 3,
    });
  });

  it('resets the count on a new day', () => {
    const record = { lastSweepAt: DAY_ONE, dayKey: '2026-09-22', countToday: 6 };
    const nextDay = DAY_ONE + 20 * HOUR_MS;
    expect(nextSweepRecord({ nowMs: nextDay, record })).toEqual({
      lastSweepAt: nextDay,
      dayKey: '2026-09-23',
      countToday: 1,
    });
  });
});
