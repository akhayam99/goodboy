import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { parseClaudeRateLimitEvent, readClaudeRateLimitLine } from './parseClaudeRateLimitEvent';
import { RATE_LIMIT_FIXTURES } from './rateLimitFixtures';

const OBSERVED_AT = '2026-09-25T10:00:00.000Z' as IsoDateTime;

describe('readClaudeRateLimitLine', () => {
  it('reads the weekly window Claude reports near its limit', () => {
    expect(
      readClaudeRateLimitLine({
        line: RATE_LIMIT_FIXTURES.claudeWeeklyWarning,
        observedAt: OBSERVED_AT,
      }),
    ).toEqual({
      limits: {
        providerId: 'anthropic',
        plan: null,
        status: 'warning',
        windows: [
          {
            kind: 'weekly',
            model: null,
            status: 'warning',
            usedFraction: 0.88,
            resetsAt: '2026-06-26T00:00:00.000Z',
          },
        ],
        observedAt: OBSERVED_AT,
      },
    });
  });

  it('keeps the fraction unknown when Claude says only that the turn is allowed', () => {
    const read = readClaudeRateLimitLine({
      line: RATE_LIMIT_FIXTURES.claudeFiveHourAllowed,
      observedAt: OBSERVED_AT,
    });
    expect(read?.limits?.status).toBe('ok');
    expect(read?.limits?.windows).toEqual([
      {
        kind: 'fiveHour',
        model: null,
        status: 'ok',
        usedFraction: null,
        resetsAt: '2026-05-23T04:10:00.000Z',
      },
    ]);
  });

  it('fills the window when Claude refuses the turn', () => {
    const read = readClaudeRateLimitLine({
      line: RATE_LIMIT_FIXTURES.claudeFiveHourRejected,
      observedAt: OBSERVED_AT,
    });
    expect(read?.limits?.status).toBe('reached');
    expect(read?.limits?.windows[0]?.usedFraction).toBe(1);
  });

  it('leaves every other stream line to the envelope parser', () => {
    expect(
      readClaudeRateLimitLine({
        line: '{"type":"assistant","message":{"content":[]}}',
        observedAt: OBSERVED_AT,
      }),
    ).toBeNull();
    expect(
      readClaudeRateLimitLine({
        line: '{"type":"assistant","message":{"content":[{"type":"text","text":"rate_limit_event"}]}}',
        observedAt: OBSERVED_AT,
      }),
    ).toBeNull();
  });

  it('swallows a rate limit event it cannot read', () => {
    expect(
      readClaudeRateLimitLine({
        line: '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","rateLimitType":"overage"}}',
        observedAt: OBSERVED_AT,
      }),
    ).toEqual({ limits: null });
  });
});

describe('parseClaudeRateLimitEvent', () => {
  it('names the model of a per model weekly window', () => {
    expect(
      parseClaudeRateLimitEvent({
        value: {
          type: 'rate_limit_event',
          rate_limit_info: {
            status: 'allowed_warning',
            resetsAt: 1782432000,
            rateLimitType: 'seven_day_opus',
            utilization: 0.81,
          },
        },
        observedAt: OBSERVED_AT,
      })?.windows[0],
    ).toMatchObject({ kind: 'weeklyModel', model: 'Opus', usedFraction: 0.81 });
  });
});
