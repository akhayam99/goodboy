import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderLimits } from '@goodboy/types';
import { parseResetOutcome, resetAdvice } from './resetAdvice';

const NOW = Date.parse('2026-09-26T14:00:00.000Z');

const at = (hours: number): IsoDateTime =>
  new Date(NOW + hours * 60 * 60 * 1000).toISOString() as IsoDateTime;

const codex = ({
  fiveHour,
  week,
  weekResetInHours,
}: {
  readonly fiveHour: number;
  readonly week: number;
  readonly weekResetInHours: number;
}): ProviderLimits => ({
  providerId: 'codex',
  plan: 'Plus',
  status: 'ok',
  windows: [
    { kind: 'fiveHour', model: null, status: 'ok', usedFraction: fiveHour, resetsAt: at(2) },
    {
      kind: 'weekly',
      model: null,
      status: 'ok',
      usedFraction: week,
      resetsAt: at(weekResetInHours),
    },
  ],
  observedAt: at(0),
});

describe('resetAdvice', () => {
  it('lets a reset through without a strong stop when the week is almost used', () => {
    const advice = resetAdvice({
      limits: codex({ fiveHour: 1, week: 0.96, weekResetInHours: 72 }),
      nowMs: NOW,
    });
    expect(advice).toMatchObject({ weekUsedPercent: 96, weekLeftPercent: 4, strong: false });
  });

  it('stops hard when half the week or more is still there', () => {
    const advice = resetAdvice({
      limits: codex({ fiveHour: 1, week: 0.18, weekResetInHours: 72 }),
      nowMs: NOW,
    });
    expect(advice).toMatchObject({
      weekUsedPercent: 18,
      weekLeftPercent: 82,
      isOnlyFiveHourFull: true,
      strong: true,
    });
  });

  it('stops hard when the week refills by itself within a day', () => {
    const advice = resetAdvice({
      limits: codex({ fiveHour: 0.2, week: 0.9, weekResetInHours: 20 }),
      nowMs: NOW,
    });
    expect(advice.strong).toBe(true);
    expect(advice.weeklyRefillInHours).toBe(20);
  });

  it('treats exactly half used as enough to go without the strong stop', () => {
    const advice = resetAdvice({
      limits: codex({ fiveHour: 1, week: 0.5, weekResetInHours: 72 }),
      nowMs: NOW,
    });
    expect(advice.strong).toBe(false);
  });

  it('stops hard when it knows nothing about the week', () => {
    expect(resetAdvice({ limits: null, nowMs: NOW }).strong).toBe(true);
  });
});

describe('parseResetOutcome', () => {
  it('reads the four outcomes and nothing else', () => {
    expect(parseResetOutcome({ value: { outcome: 'reset' } })).toBe('reset');
    expect(parseResetOutcome({ value: { outcome: 'alreadyRedeemed' } })).toBe('alreadyRedeemed');
    expect(parseResetOutcome({ value: { outcome: 'bogus' } })).toBeNull();
    expect(parseResetOutcome({ value: null })).toBeNull();
  });
});
