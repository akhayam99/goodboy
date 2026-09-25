import { describe, expect, it } from 'vitest';
import type { LimitsChip } from '@goodboy/core';
import type { IsoDateTime } from '@goodboy/types';
import { limitsRailStatus } from './limitsRailStatus';

const NOW_MS = new Date(2026, 8, 25, 12, 0).getTime();

const chip = (patch: Partial<LimitsChip>): LimitsChip => ({
  providerId: 'anthropic',
  state: 'normal',
  plan: null,
  window: {
    kind: 'fiveHour',
    model: null,
    status: 'warning',
    usedFraction: 0.82,
    resetsAt: new Date(2026, 8, 25, 14, 30).toISOString() as IsoDateTime,
  },
  windows: [],
  usedFraction: 0.82,
  resetsAt: new Date(2026, 8, 25, 14, 30).toISOString() as IsoDateTime,
  observedAt: null,
  isStale: false,
  ...patch,
});

describe('limitsRailStatus', () => {
  it('gives the rail row a warning with the share of the window used', () => {
    expect(limitsRailStatus({ chip: chip({ state: 'warning' }), nowMs: NOW_MS })).toEqual({
      tone: 'warning',
      subtitle: '82% of 5-hour used',
    });
  });

  it('gives the rail row a danger with the day the provider comes back', () => {
    const status = limitsRailStatus({
      chip: chip({
        state: 'out',
        resetsAt: new Date(2026, 8, 28, 9, 0).toISOString() as IsoDateTime,
      }),
      nowMs: NOW_MS,
    });
    expect(status?.tone).toBe('danger');
    expect(status?.subtitle).toMatch(/^Out until \S+$/);
  });

  it('keeps a quiet provider out of the rail', () => {
    expect(limitsRailStatus({ chip: chip({}), nowMs: NOW_MS })).toBeNull();
    expect(limitsRailStatus({ chip: chip({ state: 'waiting' }), nowMs: NOW_MS })).toBeNull();
  });
});
