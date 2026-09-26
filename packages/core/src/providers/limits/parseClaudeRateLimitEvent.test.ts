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

describe('parseClaudeRateLimitEvent unified windows', () => {
  it('reads both the 5-hour and the weekly window, 5-hour first', () => {
    const read = readClaudeRateLimitLine({
      line: RATE_LIMIT_FIXTURES.claudeUnifiedWindows,
      observedAt: OBSERVED_AT,
    });
    expect(read?.limits?.status).toBe('warning');
    expect(read?.limits?.windows).toEqual([
      {
        kind: 'fiveHour',
        model: null,
        status: 'ok',
        usedFraction: 0.01,
        resetsAt: '2026-09-26T05:40:00.000Z',
      },
      {
        kind: 'weekly',
        model: null,
        status: 'warning',
        usedFraction: 0.93,
        resetsAt: '2026-09-26T21:00:00.000Z',
      },
    ]);
  });

  it('keeps a per model window next to the unified ones', () => {
    const windows = parseClaudeRateLimitEvent({
      value: {
        type: 'rate_limit_event',
        rate_limit_info: {
          status: 'allowed',
          rateLimitType: 'seven_day_opus',
          utilization: 0.4,
          unifiedWindows: {
            five_hour: { utilization: 0.2, resetsAt: 1790401200 },
            seven_day: { utilization: 0.5, resetsAt: 1790456400 },
          },
        },
      },
      observedAt: OBSERVED_AT,
    })?.windows;
    expect(windows?.map((window) => window.kind)).toEqual(['fiveHour', 'weekly', 'weeklyModel']);
  });

  it('still reads the unified windows when the top level type is unknown', () => {
    const windows = parseClaudeRateLimitEvent({
      value: {
        type: 'rate_limit_event',
        rate_limit_info: {
          status: 'allowed',
          rateLimitType: 'overage',
          unifiedWindows: { five_hour: { utilization: 0.3, resetsAt: 1790401200 } },
        },
      },
      observedAt: OBSERVED_AT,
    })?.windows;
    expect(windows).toEqual([
      {
        kind: 'fiveHour',
        model: null,
        status: 'ok',
        usedFraction: 0.3,
        resetsAt: '2026-09-26T05:40:00.000Z',
      },
    ]);
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
