import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import {
  claudeUsageResultTextOf,
  parseClaudeUsageProbeOutput,
  parseClaudeUsageText,
} from './parseClaudeUsageText';

const OBSERVED_AT = '2026-09-26T06:00:00.000Z' as IsoDateTime;
const NOW_MS = Date.parse('2026-09-26T06:00:00.000Z');

describe('parseClaudeUsageText', () => {
  it('reads the session window and the all-models week window from the real /usage text', () => {
    const text = [
      'Current session: 4% used · resets Sep 26 at 7:40am (Europe/Rome)',
      'Current week (all models): 94% used · resets Sep 26 at 11pm (Europe/Rome)',
    ].join('\n');
    const limits = parseClaudeUsageText({ text, observedAt: OBSERVED_AT, nowMs: NOW_MS });
    expect(limits).not.toBeNull();
    expect(limits?.windows).toHaveLength(2);
    const [session, week] = limits!.windows;
    expect(session).toMatchObject({ kind: 'fiveHour', model: null, usedFraction: 0.04 });
    expect(week).toMatchObject({
      kind: 'weekly',
      model: null,
      usedFraction: 0.94,
      status: 'warning',
    });
  });

  it('reads a per-model weekly window', () => {
    const text = 'Current week (Fable): 11% used · resets Sep 26 at 11pm (Europe/Rome)';
    const limits = parseClaudeUsageText({ text, observedAt: OBSERVED_AT, nowMs: NOW_MS });
    expect(limits?.windows[0]).toMatchObject({
      kind: 'weeklyModel',
      model: 'Fable',
      usedFraction: 0.11,
    });
  });

  it('resolves the reset time in the timezone given in parentheses', () => {
    const text = 'Current session: 4% used · resets Sep 26 at 7:40am (Europe/Rome)';
    const limits = parseClaudeUsageText({ text, observedAt: OBSERVED_AT, nowMs: NOW_MS });
    expect(limits?.windows[0]?.resetsAt).toBe('2026-09-26T05:40:00.000Z');
  });

  it('ignores a line it does not recognize instead of failing the whole parse', () => {
    const text = [
      'Current session: 4% used · resets Sep 26 at 7:40am (Europe/Rome)',
      'Some future line the CLI added that we have never seen',
    ].join('\n');
    const limits = parseClaudeUsageText({ text, observedAt: OBSERVED_AT, nowMs: NOW_MS });
    expect(limits?.windows).toHaveLength(1);
  });

  it('never invents a reset time it cannot parse', () => {
    const text = 'Current session: 4% used · resets sometime soon';
    const limits = parseClaudeUsageText({ text, observedAt: OBSERVED_AT, nowMs: NOW_MS });
    expect(limits?.windows[0]?.resetsAt).toBeNull();
  });

  it('returns null when nothing on the page matches', () => {
    const limits = parseClaudeUsageText({
      text: 'no usage lines here',
      observedAt: OBSERVED_AT,
      nowMs: NOW_MS,
    });
    expect(limits).toBeNull();
  });
});

describe('claudeUsageResultTextOf', () => {
  it('reads the result field out of the --output-format json envelope', () => {
    const raw = JSON.stringify({
      type: 'result',
      num_turns: 0,
      total_cost_usd: 0,
      result: 'Current session: 4% used · resets Sep 26 at 7:40am (Europe/Rome)',
    });
    expect(claudeUsageResultTextOf({ raw })).toBe(
      'Current session: 4% used · resets Sep 26 at 7:40am (Europe/Rome)',
    );
  });

  it('returns null for output that is not JSON', () => {
    expect(claudeUsageResultTextOf({ raw: 'not json at all' })).toBeNull();
  });
});

describe('parseClaudeUsageProbeOutput', () => {
  it('unwraps the envelope and parses the usage text in one step', () => {
    const raw = JSON.stringify({
      result: 'Current session: 4% used · resets Sep 26 at 7:40am (Europe/Rome)',
    });
    const limits = parseClaudeUsageProbeOutput({ raw, observedAt: OBSERVED_AT, nowMs: NOW_MS });
    expect(limits?.windows[0]).toMatchObject({ kind: 'fiveHour', usedFraction: 0.04 });
  });
});
