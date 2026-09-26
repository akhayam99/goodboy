import { describe, expect, it } from 'vitest';
import { shouldShowArrivalCard } from './updateSnoozeGate';

const NOW = new Date('2026-09-26T12:00:00Z').getTime();
const DAY_MS = 24 * 60 * 60_000;

describe('shouldShowArrivalCard', () => {
  it('is false with no version at all', () => {
    expect(
      shouldShowArrivalCard({ version: null, snoozedVersion: null, snoozedAt: null, nowMs: NOW }),
    ).toBe(false);
  });

  it('is true the first time a version is ready, never snoozed', () => {
    expect(
      shouldShowArrivalCard({
        version: '0.8.0',
        snoozedVersion: null,
        snoozedAt: null,
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  it('is false right after snoozing that same version', () => {
    expect(
      shouldShowArrivalCard({
        version: '0.8.0',
        snoozedVersion: '0.8.0',
        snoozedAt: new Date(NOW - DAY_MS).toISOString(),
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it('is true again three days after snoozing', () => {
    expect(
      shouldShowArrivalCard({
        version: '0.8.0',
        snoozedVersion: '0.8.0',
        snoozedAt: new Date(NOW - 3 * DAY_MS).toISOString(),
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  it('is true for a newer version even if an older one was snoozed', () => {
    expect(
      shouldShowArrivalCard({
        version: '0.9.0',
        snoozedVersion: '0.8.0',
        snoozedAt: new Date(NOW - DAY_MS).toISOString(),
        nowMs: NOW,
      }),
    ).toBe(true);
  });
});
