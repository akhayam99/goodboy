import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderLimitWindow, ProviderLimits } from '@goodboy/types';
import { selectLimitsChips, worstLimitsChip } from './selectLimitsChips';

const NOW_MS = Date.parse('2026-09-25T12:00:00.000Z');

const iso = (value: string): IsoDateTime => value as IsoDateTime;

const window = (patch: Partial<ProviderLimitWindow>): ProviderLimitWindow => ({
  kind: 'fiveHour',
  model: null,
  status: 'ok',
  usedFraction: 0.3,
  resetsAt: iso('2026-09-25T14:30:00.000Z'),
  ...patch,
});

const limitsOf = (patch: Partial<ProviderLimits>): ProviderLimits => ({
  providerId: 'anthropic',
  plan: null,
  status: 'ok',
  windows: [window({})],
  observedAt: iso('2026-09-25T11:55:00.000Z'),
  ...patch,
});

const ALL_CONNECTED = ['anthropic', 'codex', 'gemini', 'cursor', 'opencode'] as const;

describe('selectLimitsChips', () => {
  it.each([
    ['normal', limitsOf({}), 0.3],
    ['warning', limitsOf({ windows: [window({ usedFraction: 0.82 })], status: 'warning' }), 0.82],
    ['out', limitsOf({ windows: [window({ status: 'reached', usedFraction: null })] }), 1],
    ['stale', limitsOf({ observedAt: iso('2026-09-25T11:29:00.000Z') }), 0.3],
    ['reset', limitsOf({ windows: [window({ resetsAt: iso('2026-09-25T11:00:00.000Z') })] }), null],
  ] as const)('reads a Claude observation as %s', (state, limits, usedFraction) => {
    const [chip] = selectLimitsChips({
      order: ['anthropic'],
      connected: ['anthropic'],
      limits: { anthropic: limits },
      nowMs: NOW_MS,
    });
    expect(chip?.state).toBe(state);
    expect(chip?.usedFraction).toBe(usedFraction);
  });

  it('keeps old data under 30 minutes fresh', () => {
    const [chip] = selectLimitsChips({
      order: ['anthropic'],
      connected: ['anthropic'],
      limits: { anthropic: limitsOf({ observedAt: iso('2026-09-25T11:31:00.000Z') }) },
      nowMs: NOW_MS,
    });
    expect(chip?.state).toBe('normal');
  });

  it('shows the most used window of the provider', () => {
    const [chip] = selectLimitsChips({
      order: ['codex'],
      connected: ['codex'],
      limits: {
        codex: limitsOf({
          providerId: 'codex',
          windows: [
            window({ usedFraction: 0.1 }),
            window({
              kind: 'weekly',
              usedFraction: 0.47,
              resetsAt: iso('2026-09-28T09:00:00.000Z'),
            }),
          ],
        }),
      },
      nowMs: NOW_MS,
    });
    expect(chip?.window?.kind).toBe('weekly');
  });

  it('follows the given order, puts providers without data last and skips api key providers', () => {
    const chips = selectLimitsChips({
      order: ['cursor', 'codex', 'anthropic', 'gemini', 'opencode'],
      connected: [...ALL_CONNECTED],
      limits: {},
      nowMs: NOW_MS,
    });
    expect(chips.map((chip) => [chip.providerId, chip.state])).toEqual([
      ['codex', 'waiting'],
      ['anthropic', 'waiting'],
      ['cursor', 'none'],
      ['gemini', 'none'],
    ]);
  });

  it('leaves out a provider that is not connected', () => {
    expect(
      selectLimitsChips({ order: [], connected: ['codex'], limits: {}, nowMs: NOW_MS }).map(
        (chip) => chip.providerId,
      ),
    ).toEqual(['codex']);
  });

  it('does not reorder by state', () => {
    const chips = selectLimitsChips({
      order: ['anthropic', 'codex'],
      connected: ['anthropic', 'codex'],
      limits: {
        codex: limitsOf({
          providerId: 'codex',
          windows: [window({ status: 'reached', usedFraction: 1 })],
        }),
      },
      nowMs: NOW_MS,
    });
    expect(chips.map((chip) => chip.providerId)).toEqual(['anthropic', 'codex']);
  });
});

describe('worstLimitsChip', () => {
  it('picks out over warning and ignores quiet chips', () => {
    const chips = selectLimitsChips({
      order: ['anthropic', 'codex', 'cursor'],
      connected: ['anthropic', 'codex', 'cursor'],
      limits: {
        anthropic: limitsOf({ windows: [window({ usedFraction: 0.9 })] }),
        codex: limitsOf({
          providerId: 'codex',
          windows: [window({ status: 'reached', usedFraction: 1 })],
        }),
      },
      nowMs: NOW_MS,
    });
    expect(worstLimitsChip({ chips })?.providerId).toBe('codex');
    expect(worstLimitsChip({ chips: chips.slice(2) })).toBeNull();
  });
});
