import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { parseCodexRateLimits } from './parseCodexRateLimits';
import { RATE_LIMIT_FIXTURES } from './rateLimitFixtures';

const OBSERVED_AT = '2026-09-25T10:59:20.919Z' as IsoDateTime;

const rolloutRateLimits = (): unknown => {
  const line: unknown = JSON.parse(RATE_LIMIT_FIXTURES.codexTokenCount);
  const payload: unknown =
    typeof line === 'object' && line !== null && Reflect.get(line, 'payload');
  return typeof payload === 'object' && payload !== null
    ? Reflect.get(payload, 'rate_limits')
    : null;
};

describe('parseCodexRateLimits', () => {
  it('reads both windows and the plan from a rollout token count line', () => {
    expect(parseCodexRateLimits({ value: rolloutRateLimits(), observedAt: OBSERVED_AT })).toEqual({
      providerId: 'codex',
      plan: 'Plus',
      status: 'reached',
      windows: [
        {
          kind: 'fiveHour',
          model: null,
          status: 'ok',
          usedFraction: 0,
          resetsAt: '2026-09-25T15:59:15.000Z',
        },
        {
          kind: 'weekly',
          model: null,
          status: 'reached',
          usedFraction: 1,
          resetsAt: '2026-09-26T21:38:48.000Z',
        },
      ],
      observedAt: OBSERVED_AT,
    });
  });

  it('warns from 80 percent', () => {
    const limits = parseCodexRateLimits({
      value: { primary: { used_percent: 82, window_minutes: 300, resets_at: 1790351955 } },
      observedAt: OBSERVED_AT,
    });
    expect(limits?.status).toBe('warning');
    expect(limits?.plan).toBeNull();
  });

  it('trusts the reached flag even below 100 percent', () => {
    const limits = parseCodexRateLimits({
      value: {
        primary: { used_percent: 12, window_minutes: 300, resets_at: 1790351955 },
        secondary: { used_percent: 97, window_minutes: 10080, resets_at: 1790458728 },
        rate_limit_reached_type: 'secondary',
      },
      observedAt: OBSERVED_AT,
    });
    expect(limits?.status).toBe('reached');
    expect(limits?.windows[1]).toMatchObject({ status: 'reached', usedFraction: 1 });
  });

  it('answers null without a window it can read', () => {
    expect(parseCodexRateLimits({ value: null, observedAt: OBSERVED_AT })).toBeNull();
    expect(
      parseCodexRateLimits({ value: { primary: null, secondary: null }, observedAt: OBSERVED_AT }),
    ).toBeNull();
  });
});
