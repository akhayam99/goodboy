import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderLimits } from '@goodboy/types';
import { providerHeadroom, providersByHeadroom, readHeadroom } from './providerHeadroom';

const NOW = Date.parse('2026-10-03T10:00:00.000Z');
const MINUTE = 60_000;

type LimitsParams = {
  readonly used: number;
  readonly ageMinutes?: number;
  readonly weekly?: number;
};

const limits = ({ used, ageMinutes = 0, weekly = 0.1 }: LimitsParams): ProviderLimits => ({
  providerId: 'anthropic',
  plan: 'max',
  status: 'ok',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'ok',
      usedFraction: used,
      resetsAt: new Date(NOW + 60 * MINUTE).toISOString() as IsoDateTime,
    },
    {
      kind: 'weekly',
      model: null,
      status: 'ok',
      usedFraction: weekly,
      resetsAt: new Date(NOW + 3 * 24 * 60 * MINUTE).toISOString() as IsoDateTime,
    },
  ],
  observedAt: new Date(NOW - ageMinutes * MINUTE).toISOString() as IsoDateTime,
});

const read = (params: LimitsParams) =>
  providerHeadroom({ providerId: 'anthropic', limits: limits(params), nowMs: NOW });

describe('providerHeadroom', () => {
  it('uses the thresholds of the limit chips: 80 percent is tight, a full window is out', () => {
    expect(read({ used: 0.79 })).toBe('ok');
    expect(read({ used: 0.8 })).toBe('tight');
    expect(read({ used: 0.2, weekly: 0.85 })).toBe('tight');
    expect(read({ used: 1 })).toBe('out');
  });

  it('calls a snapshot older than 30 minutes unknown and a 29 minute one fresh', () => {
    expect(read({ used: 0.2, ageMinutes: 31 })).toBe('unknown');
    expect(read({ used: 0.2, ageMinutes: 29 })).toBe('ok');
    expect(providerHeadroom({ providerId: 'anthropic', limits: undefined, nowMs: NOW })).toBe(
      'unknown',
    );
  });

  it('reads only the providers that report limits and lists the stale ones to re-read', () => {
    const reading = readHeadroom({
      limits: { anthropic: limits({ used: 0.85 }) },
      policy: null,
      nowMs: NOW,
    });

    expect(reading.headroom).toEqual({ anthropic: 'tight', codex: 'unknown' });
    expect(reading.stale).toEqual(['codex']);
  });

  it('keeps a provider marked keep using after the limit, last instead of out', () => {
    const reading = readHeadroom({
      limits: { anthropic: limits({ used: 1 }) },
      policy: [{ id: 'anthropic', state: 'on', keepAfterLimit: true }],
      nowMs: NOW,
    });

    expect(reading.headroom.anthropic).toBe('tight');
  });
});

describe('providersByHeadroom', () => {
  it('drops the providers that are out and puts the tight ones last', () => {
    expect(
      providersByHeadroom({
        providers: ['anthropic', 'codex', 'cursor'],
        headroom: { anthropic: 'tight', codex: 'out' },
      }),
    ).toEqual(['cursor', 'anthropic']);
  });

  it('gives back the menu of today when dropping the out providers would empty it', () => {
    expect(
      providersByHeadroom({
        providers: ['anthropic', 'codex'],
        headroom: { anthropic: 'out', codex: 'out' },
      }),
    ).toEqual(['anthropic', 'codex']);
  });
});
