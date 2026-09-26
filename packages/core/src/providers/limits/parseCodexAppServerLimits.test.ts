import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { parseCodexAppServerLimits, parseCodexResetCredits } from './parseCodexAppServerLimits';
import { RATE_LIMIT_FIXTURES } from './rateLimitFixtures';

const OBSERVED_AT = '2026-09-26T19:45:12.000Z' as IsoDateTime;

const response = (): unknown => JSON.parse(RATE_LIMIT_FIXTURES.codexAppServerRateLimits);

describe('parseCodexAppServerLimits', () => {
  it('reads both windows and the plan from the codex bucket', () => {
    expect(parseCodexAppServerLimits({ value: response(), observedAt: OBSERVED_AT })).toEqual({
      providerId: 'codex',
      plan: 'Plus',
      status: 'ok',
      windows: [
        {
          kind: 'fiveHour',
          model: null,
          status: 'ok',
          usedFraction: 0.12,
          resetsAt: '2026-09-26T22:42:33.000Z',
        },
        {
          kind: 'weekly',
          model: null,
          status: 'ok',
          usedFraction: 0.02,
          resetsAt: '2026-10-03T17:42:33.000Z',
        },
      ],
      observedAt: OBSERVED_AT,
    });
  });

  it('falls back to the single bucket view when the keyed view is missing', () => {
    const value = {
      rateLimits: {
        primary: { usedPercent: 100, windowDurationMins: 300, resetsAt: 1790462553 },
        secondary: null,
        planType: 'pro',
        rateLimitReachedType: 'primary',
      },
      rateLimitsByLimitId: null,
    };
    const limits = parseCodexAppServerLimits({ value, observedAt: OBSERVED_AT });
    expect(limits?.plan).toBe('Pro');
    expect(limits?.status).toBe('reached');
    expect(limits?.windows).toHaveLength(1);
  });

  it('returns null when no window carries numbers', () => {
    const value = { rateLimits: { primary: null, secondary: null, planType: 'plus' } };
    expect(parseCodexAppServerLimits({ value, observedAt: OBSERVED_AT })).toBeNull();
    expect(parseCodexAppServerLimits({ value: null, observedAt: OBSERVED_AT })).toBeNull();
  });
});

describe('parseCodexResetCredits', () => {
  it('reads the count and the first available credit', () => {
    expect(parseCodexResetCredits({ value: response(), observedAt: OBSERVED_AT })).toEqual({
      availableCount: 1,
      creditId: 'credit-00000000-0000-4000-8000-000000000001',
      expiresAt: '2026-10-22T19:07:28.000Z',
      observedAt: OBSERVED_AT,
    });
  });

  it('keeps the count when details were skipped', () => {
    const value = { rateLimitResetCredits: { availableCount: 2, credits: null } };
    expect(parseCodexResetCredits({ value, observedAt: OBSERVED_AT })).toEqual({
      availableCount: 2,
      creditId: null,
      expiresAt: null,
      observedAt: OBSERVED_AT,
    });
  });

  it('picks the credit that expires first and skips redeemed ones', () => {
    const value = {
      rateLimitResetCredits: {
        availableCount: 2,
        credits: [
          { id: 'late', status: 'available', expiresAt: 1792696048 },
          { id: 'used', status: 'redeemed', expiresAt: 1790000000 },
          { id: 'soon', status: 'available', expiresAt: 1791000000 },
        ],
      },
    };
    expect(parseCodexResetCredits({ value, observedAt: OBSERVED_AT })?.creditId).toBe('soon');
  });

  it('returns null when the server says nothing about resets', () => {
    expect(
      parseCodexResetCredits({ value: { rateLimitResetCredits: null }, observedAt: OBSERVED_AT }),
    ).toBeNull();
  });
});
