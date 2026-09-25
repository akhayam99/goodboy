import { describe, expect, it } from 'vitest';
import type { LimitsChip } from '@goodboy/core';
import type { IsoDateTime } from '@goodboy/types';
import { formatLimitReset, formatLimitResetShort, formatTimeUntil } from './formatLimitReset';
import { limitsChipHeadline } from './limitsChipHeadline';

const NOW_MS = new Date(2026, 8, 25, 12, 0).getTime();

const localIso = (hours: number, minutes: number, dayOffset = 0): IsoDateTime =>
  new Date(2026, 8, 25 + dayOffset, hours, minutes).toISOString() as IsoDateTime;

const chip = (patch: Partial<LimitsChip>): LimitsChip => ({
  providerId: 'codex',
  state: 'normal',
  plan: null,
  window: null,
  windows: [],
  usedFraction: null,
  resetsAt: null,
  observedAt: localIso(11, 57),
  isStale: false,
  ...patch,
});

describe('formatLimitReset', () => {
  it('writes a reset later today as a clock time and a later one with its weekday', () => {
    expect(formatLimitReset({ iso: localIso(14, 30), nowMs: NOW_MS })).toBe('14:30');
    expect(formatLimitReset({ iso: localIso(9, 0, 3), nowMs: NOW_MS })).toMatch(/^\S+ 09:00$/);
    expect(formatLimitResetShort({ iso: localIso(9, 0, 3), nowMs: NOW_MS })).not.toContain(':');
  });

  it('counts down to the reset', () => {
    expect(formatTimeUntil({ iso: localIso(13, 40), nowMs: NOW_MS })).toBe('in 1h 40m');
    expect(formatTimeUntil({ iso: localIso(12, 20), nowMs: NOW_MS })).toBe('in 20m');
    expect(formatTimeUntil({ iso: localIso(12, 0, 3), nowMs: NOW_MS })).toBe('in 3 days');
    expect(formatTimeUntil({ iso: localIso(11, 0), nowMs: NOW_MS })).toBe('');
  });
});

describe('limitsChipHeadline', () => {
  const weekly = {
    kind: 'weekly' as const,
    model: null,
    status: 'ok' as const,
    usedFraction: 0.47,
    resetsAt: localIso(9, 0, 3),
  };

  it('says how much of the most used window is gone', () => {
    expect(
      limitsChipHeadline({
        chip: chip({ providerId: 'anthropic', plan: 'Max', window: weekly, usedFraction: 0.47 }),
        nowMs: NOW_MS,
      }),
    ).toBe('Claude Max · 47% of the week used');
  });

  it('says out for the week with the day it comes back', () => {
    expect(
      limitsChipHeadline({
        chip: chip({ state: 'out', window: weekly, resetsAt: localIso(18, 12) }),
        nowMs: NOW_MS,
      }),
    ).toBe('Codex is out for the week. Back today 18:12');
  });

  it('explains every state without data', () => {
    expect(limitsChipHeadline({ chip: chip({ state: 'waiting' }), nowMs: NOW_MS })).toBe(
      'Codex shares its limits during a turn. Start a Codex agent to see them.',
    );
    expect(
      limitsChipHeadline({ chip: chip({ providerId: 'cursor', state: 'none' }), nowMs: NOW_MS }),
    ).toBe("Cursor doesn't report its limits to Goodboy.");
    expect(
      limitsChipHeadline({
        chip: chip({ providerId: 'anthropic', state: 'reset', resetsAt: localIso(11, 30) }),
        nowMs: NOW_MS,
      }),
    ).toBe('Reset at 11:30. No Claude turn since.');
    expect(
      limitsChipHeadline({
        chip: chip({ state: 'stale', observedAt: localIso(10, 0) }),
        nowMs: NOW_MS,
      }),
    ).toBe('Updated 2h ago');
  });
});
