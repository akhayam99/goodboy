import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderLimitWindow, ProviderLimits } from '@goodboy/types';
import { mergeProviderLimits } from './mergeProviderLimits';

const WEEKLY_WINDOW: ProviderLimitWindow = {
  kind: 'weekly',
  model: null,
  status: 'warning',
  usedFraction: 0.88,
  resetsAt: '2026-09-28T09:00:00.000Z' as IsoDateTime,
};

const WEEKLY_WARNING: ProviderLimits = {
  providerId: 'anthropic',
  plan: null,
  status: 'warning',
  windows: [WEEKLY_WINDOW],
  observedAt: '2026-09-25T09:00:00.000Z' as IsoDateTime,
};

const FIVE_HOUR_OK: ProviderLimits = {
  providerId: 'anthropic',
  plan: null,
  status: 'ok',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'ok',
      usedFraction: null,
      resetsAt: '2026-09-25T14:30:00.000Z' as IsoDateTime,
    },
  ],
  observedAt: '2026-09-25T10:00:00.000Z' as IsoDateTime,
};

const NOW_MS = Date.parse('2026-09-25T10:00:00.000Z');

describe('mergeProviderLimits', () => {
  it('keeps a window the newest event did not mention while it is still open', () => {
    const merged = mergeProviderLimits({
      previous: WEEKLY_WARNING,
      next: FIVE_HOUR_OK,
      nowMs: NOW_MS,
    });
    expect(merged.windows.map((window) => window.kind)).toEqual(['fiveHour', 'weekly']);
    expect(merged.status).toBe('warning');
    expect(merged.observedAt).toBe(FIVE_HOUR_OK.observedAt);
  });

  it('drops a carried window once it has reset', () => {
    const merged = mergeProviderLimits({
      previous: WEEKLY_WARNING,
      next: FIVE_HOUR_OK,
      nowMs: Date.parse('2026-09-29T00:00:00.000Z'),
    });
    expect(merged.windows.map((window) => window.kind)).toEqual(['fiveHour']);
    expect(merged.status).toBe('ok');
  });

  it('replaces the same window with the newer reading', () => {
    const lower: ProviderLimits = {
      ...WEEKLY_WARNING,
      status: 'ok',
      windows: [{ ...WEEKLY_WINDOW, status: 'ok', usedFraction: 0.4 }],
    };
    expect(mergeProviderLimits({ previous: WEEKLY_WARNING, next: lower, nowMs: NOW_MS })).toEqual(
      lower,
    );
  });

  it('keeps a plan an earlier reading knew', () => {
    expect(
      mergeProviderLimits({
        previous: { ...WEEKLY_WARNING, plan: 'Max' },
        next: FIVE_HOUR_OK,
        nowMs: NOW_MS,
      }).plan,
    ).toBe('Max');
  });
});
