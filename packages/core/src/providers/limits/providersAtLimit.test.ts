import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderLimits } from '@goodboy/types';
import { providersAtLimit } from './providersAtLimit';

const NOW_MS = Date.parse('2026-09-25T12:00:00.000Z');

const limits = (patch: Partial<ProviderLimits>): ProviderLimits => ({
  providerId: 'codex',
  plan: null,
  status: 'reached',
  windows: [
    {
      kind: 'weekly',
      model: null,
      status: 'reached',
      usedFraction: 1,
      resetsAt: '2026-09-28T09:00:00.000Z' as IsoDateTime,
    },
  ],
  observedAt: '2026-09-25T09:00:00.000Z' as IsoDateTime,
  ...patch,
});

describe('providersAtLimit', () => {
  it('lists a provider whose window is still out', () => {
    expect(providersAtLimit({ limits: { codex: limits({}) }, nowMs: NOW_MS })).toEqual(['codex']);
  });

  it('lets a provider back in once its window reset', () => {
    expect(
      providersAtLimit({
        limits: { codex: limits({}) },
        nowMs: Date.parse('2026-09-29T00:00:00.000Z'),
      }),
    ).toEqual([]);
  });

  it('keeps a provider near its limit in the ladder', () => {
    expect(
      providersAtLimit({
        limits: {
          anthropic: limits({
            providerId: 'anthropic',
            status: 'warning',
            windows: [
              {
                kind: 'fiveHour',
                model: null,
                status: 'warning',
                usedFraction: 0.92,
                resetsAt: '2026-09-25T14:00:00.000Z' as IsoDateTime,
              },
            ],
          }),
        },
        nowMs: NOW_MS,
      }),
    ).toEqual([]);
  });
});
